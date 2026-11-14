import { fetchJson } from './net'
import { decryptSecret, findProfile } from './store'
import type { StoredProfile } from './store'
import type { Detail, Episode, Item, Kind, PlayTarget } from '../shared/types'

type Raw = Record<string, any>

export function baseUrl(p: StoredProfile): string {
  let s = (p.server || '').trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s
  return s
}

function apiUrl(p: StoredProfile, action: string, extra: Record<string, string | number> = {}): string {
  const q = new URLSearchParams({
    username: p.username || '',
    password: decryptSecret(p.passwordEnc),
    action,
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)]))
  })
  return `${baseUrl(p)}/player_api.php?${q.toString()}`
}

const arr = (x: unknown): Raw[] => (Array.isArray(x) ? (x as Raw[]) : [])
const str = (x: unknown): string | undefined => (x === null || x === undefined || x === '' ? undefined : String(x))

export function xtreamEpgUrl(p: StoredProfile): string {
  const q = new URLSearchParams({ username: p.username || '', password: decryptSecret(p.passwordEnc) })
  return `${baseUrl(p)}/xmltv.php?${q.toString()}`
}

export async function loadXtream(profileId: string, kind: Kind): Promise<Item[]> {
  const p = findProfile(profileId)
  const names = {
    live: ['get_live_categories', 'get_live_streams'],
    vod: ['get_vod_categories', 'get_vod_streams'],
    series: ['get_series_categories', 'get_series']
  }[kind]

  const [cats, streams] = await Promise.all([
    fetchJson<unknown>(apiUrl(p, names[0])),
    fetchJson<unknown>(apiUrl(p, names[1]))
  ])
  // Hatalı kimlik bilgisinde bazı paneller nesne döndürür
  if (!Array.isArray(streams)) {
    const msg = (streams as Raw)?.user_info?.message || (streams as Raw)?.message
    throw new Error(msg ? String(msg) : 'Giriş başarısız veya içerik alınamadı. Kullanıcı adı/şifreyi kontrol edin.')
  }
  const catMap = new Map<string, string>()
  for (const c of arr(cats)) catMap.set(String(c.category_id), String(c.category_name ?? 'Diğer'))

  const out: Item[] = []
  for (const s of streams as Raw[]) {
    try {
      const group = catMap.get(String(s.category_id)) ?? 'Diğer'
      if (kind === 'live') {
        out.push({
          id: `l-${s.stream_id}`, kind, name: String(s.name ?? 'Adsız'), logo: str(s.stream_icon),
          group, streamId: Number(s.stream_id), tvgId: str(s.epg_channel_id)
        })
      } else if (kind === 'vod') {
        out.push({
          id: `v-${s.stream_id}`, kind, name: String(s.name ?? 'Adsız'), logo: str(s.stream_icon),
          group, streamId: Number(s.stream_id), ext: str(s.container_extension) ?? 'mp4',
          rating: str(s.rating_5based ?? s.rating)
        })
      } else {
        out.push({
          id: `s-${s.series_id}`, kind, name: String(s.name ?? 'Adsız'), logo: str(s.cover),
          group, seriesId: Number(s.series_id), rating: str(s.rating_5based ?? s.rating), plot: str(s.plot)
        })
      }
    } catch {
      /* bozuk kayıt: atla */
    }
  }
  return out
}

export async function xtreamDetail(profileId: string, kind: 'vod' | 'series', id: number): Promise<Detail> {
  const p = findProfile(profileId)
  if (kind === 'vod') {
    const r = await fetchJson<Raw>(apiUrl(p, 'get_vod_info', { vod_id: id }))
    const i: Raw = r.info ?? {}
    return {
      plot: str(i.plot ?? i.description), rating: str(i.rating), genre: str(i.genre),
      cover: str(i.movie_image ?? i.cover_big), year: str(i.releasedate ?? i.year), cast: str(i.cast ?? i.actors)
    }
  }
  const r = await fetchJson<Raw>(apiUrl(p, 'get_series_info', { series_id: id }))
  const i: Raw = r.info ?? {}
  const seasons: Record<string, Episode[]> = {}
  const eps = r.episodes
  const groups: [string, Raw[]][] = Array.isArray(eps)
    ? eps.map((g: Raw[], idx: number) => [String(idx + 1), arr(g)] as [string, Raw[]])
    : Object.entries((eps ?? {}) as Record<string, unknown>).map(([k, v]) => [k, arr(v)] as [string, Raw[]])
  for (const [season, list] of groups) {
    seasons[season] = list.map((e) => ({
      id: Number(e.id),
      title: String(e.title ?? `Bölüm ${e.episode_num}`),
      season: Number(e.season ?? season),
      episode: Number(e.episode_num ?? 0),
      ext: str(e.container_extension) ?? 'mp4',
      plot: str(e.info?.plot), image: str(e.info?.movie_image), duration: str(e.info?.duration)
    })).sort((a, b) => a.episode - b.episode)
  }
  return {
    plot: str(i.plot), rating: str(i.rating_5based ?? i.rating), genre: str(i.genre),
    cover: str(i.cover), year: str(i.releaseDate ?? i.release_date), cast: str(i.cast), seasons
  }
}

export function resolveStreamUrl(profileId: string, t: PlayTarget, liveExt: string): string {
  if (t.url) return t.url
  if (!t.xtream) throw new Error('Oynatılacak adres bulunamadı')
  const p = findProfile(profileId)
  const user = encodeURIComponent(p.username || '')
  const pass = encodeURIComponent(decryptSecret(p.passwordEnc))
  const { type, id, ext } = t.xtream
  const e = ext || (type === 'live' ? liveExt : 'mp4')
  return `${baseUrl(p)}/${type}/${user}/${pass}/${id}.${e}`
}
