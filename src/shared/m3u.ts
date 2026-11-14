import type { Detail, Episode, Item, Kind, M3UResult } from './types'

const ATTR_RE = /([\w-]+)="([^"]*)"/g
const VIDEO_EXT = /\.(mp4|mkv|avi|mov|m4v|wmv|flv|webm)$/i
const SERIES_GROUP = /dizi|series|sezon|season|tv.?show/i
const URL_RE = /^(https?|rtmp|rtmps|rtsp|udp|rtp|mms):\/\//i

const EP_PATTERNS: RegExp[] = [
  /^(.*?)[\s._\-–:]*\bS(\d{1,2})\s*[._\-]?\s*E(\d{1,3})/i,
  /^(.*?)[\s._\-–:]*\b(\d{1,2})x(\d{2,3})\b/i,
  /^(.*?)[\s._\-–:]*(\d{1,2})\.?\s*sezon[\s._\-–:]*(\d{1,3})\.?\s*b[öo]l[üu]m/i
]

/** "Dizi Adı S01E02" gibi adlardan dizi başlığı, sezon ve bölüm çıkarır. */
export function parseEpisodeName(name: string): { title: string; season: number; episode: number } | null {
  for (const re of EP_PATTERNS) {
    const m = re.exec(name)
    if (m) {
      const title = m[1].replace(/[\s._\-–:|]+$/, '').trim()
      return { title, season: Number(m[2]), episode: Number(m[3]) }
    }
  }
  return null
}

/** URL yoluna, dosya uzantısına ve kategori/ad ipuçlarına göre içerik türünü tahmin eder. */
export function classify(url: string, group: string, name: string): Kind {
  let path = url
  try { path = new URL(url).pathname } catch { /* ham metin */ }
  const lower = path.toLowerCase()
  if (/\/series\//.test(lower)) return 'series'
  if (/\/movie\//.test(lower)) return 'vod'
  if (/\/live\//.test(lower)) return 'live'
  if (VIDEO_EXT.test(lower)) {
    return parseEpisodeName(name) || SERIES_GROUP.test(group) ? 'series' : 'vod'
  }
  return 'live'
}

/** Bölüm düzeyindeki öğeleri dizi başına gruplar (sezon ve bölümlerle). */
export function groupSeries(eps: Item[]): Item[] {
  const map = new Map<string, { item: Item; list: Episode[] }>()
  for (const e of eps) {
    const p = parseEpisodeName(e.name)
    const title = (p?.title || e.group || e.name).trim()
    const key = norm(title)
    let g = map.get(key)
    if (!g) {
      g = { item: { id: `ms-${map.size}`, name: title, logo: e.logo, group: e.group, kind: 'series' }, list: [] }
      map.set(key, g)
    }
    g.list.push({
      id: g.list.length, title: e.name, season: p?.season ?? 1,
      episode: p?.episode ?? g.list.length + 1, ext: '', url: e.url, image: e.logo
    })
    if (!g.item.logo && e.logo) g.item.logo = e.logo
  }
  const out: Item[] = []
  for (const { item, list } of map.values()) {
    const seasons: Record<string, Episode[]> = {}
    for (const ep of list) (seasons[String(ep.season)] ??= []).push(ep)
    for (const k of Object.keys(seasons)) seasons[k].sort((a, b) => a.episode - b.episode)
    const detail: Detail = { seasons }
    out.push({ ...item, localDetail: detail })
  }
  return out
}

/** Tırnak dışındaki son virgülün konumunu bulur (#EXTINF'te ad virgülden sonra gelir). */
function splitInf(line: string): [string, string] {
  let inQuote = false
  let last = -1
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') inQuote = !inQuote
    else if (c === ',' && !inQuote) last = i
  }
  if (last === -1) return [line, '']
  return [line.slice(0, last), line.slice(last + 1).trim()]
}

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of s.matchAll(ATTR_RE)) out[m[1].toLowerCase()] = m[2]
  return out
}

/**
 * M3U/M3U8 metnini ayrıştırır. Bozuk satırlar atlanır ve `skipped` içinde sayılır;
 * bu fonksiyon hiçbir zaman istisna fırlatmaz.
 */
export function parseM3U(input: string): M3UResult {
  const items: Item[] = []
  let skipped = 0
  let epgUrl: string | undefined

  let cur: { attrs: Record<string, string>; name: string } | null = null
  let vlcUA: string | undefined
  let extGrp: string | undefined

  const text = String(input ?? '').replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/)

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    if (line.startsWith('#EXTM3U')) {
      const a = parseAttrs(line)
      epgUrl = a['url-tvg'] || a['x-tvg-url'] || epgUrl
      continue
    }
    if (line.startsWith('#EXTINF')) {
      if (cur) skipped++ // önceki EXTINF'in URL'si gelmemiş
      const colon = line.indexOf(':')
      const [head, name] = splitInf(colon === -1 ? '' : line.slice(colon + 1))
      cur = { attrs: parseAttrs(head), name }
      vlcUA = undefined
      continue
    }
    if (line.startsWith('#EXTVLCOPT:')) {
      const m = /http-user-agent=(.*)/i.exec(line)
      if (m) vlcUA = m[1].trim()
      continue
    }
    if (line.startsWith('#EXTGRP:')) {
      extGrp = line.slice(8).trim() || undefined
      continue
    }
    if (line.startsWith('#')) continue

    // URL satırı
    if (!cur || !URL_RE.test(line)) {
      skipped++
      cur = null
      continue
    }
    const a = cur.attrs
    const name = cur.name || a['tvg-name'] || 'Adsız kanal'
    const group = a['group-title'] || extGrp || 'Diğer'
    items.push({
      id: `m3u-${items.length}`,
      name,
      logo: a['tvg-logo'] || undefined,
      tvgId: a['tvg-id'] || undefined,
      group,
      kind: classify(line, group, name),
      url: line,
      userAgent: vlcUA
    })
    cur = null
    extGrp = undefined
  }
  if (cur) skipped++
  return { items, skipped, epgUrl }
}

/** Anlık arama için Türkçe karakterleri de tolere eden normalleştirme. */
export function norm(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
}
