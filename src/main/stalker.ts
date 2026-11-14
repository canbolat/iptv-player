import { net } from 'electron'
import { createHash } from 'crypto'
import type { StoredProfile } from './store'
import type { Item, Kind, PlayTarget } from '../shared/types'
import { stalkerCandidates, stripCmd } from '../shared/stalker'

type Raw = Record<string, any>

const MAG_UA = 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3'
const SESSION_MS = 20 * 60_000

interface Session { endpoint: string; token: string; at: number }
const sessions = new Map<string, Session>()

export function clearStalkerSession(id: string) { sessions.delete(id) }

/** Cookie başlığı için fetch yerine net.request kullanılır. */
function httpGet(url: string, headers: Record<string, string>, timeoutMs = 25_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = net.request({ url, method: 'GET', redirect: 'follow' })
    for (const [k, v] of Object.entries(headers)) req.setHeader(k, v)
    const timer = setTimeout(() => { req.abort(); reject(new Error('Portal zaman aşımına uğradı')) }, timeoutMs)
    req.on('response', (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(Buffer.from(c)))
      res.on('end', () => {
        clearTimeout(timer)
        if ((res.statusCode ?? 0) >= 400) reject(new Error(`Portal yanıtı: HTTP ${res.statusCode}`))
        else resolve(Buffer.concat(chunks).toString('utf8'))
      })
      res.on('error', (e: Error) => { clearTimeout(timer); reject(e) })
    })
    req.on('error', (e) => { clearTimeout(timer); reject(e) })
    req.end()
  })
}

function ids(mac: string) {
  const sn = createHash('md5').update(mac).digest('hex').slice(0, 13).toUpperCase()
  const did = createHash('sha256').update(mac).digest('hex').toUpperCase()
  return { sn, did }
}

function headersFor(p: StoredProfile, token?: string): Record<string, string> {
  const h: Record<string, string> = {
    'User-Agent': MAG_UA,
    'X-User-Agent': 'Model: MAG250; Link: WiFi',
    Cookie: `mac=${p.mac}; stb_lang=en; timezone=Europe/Istanbul`,
    Accept: '*/*'
  }
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

async function rawCall(endpoint: string, p: StoredProfile, token: string | undefined, params: Record<string, string>): Promise<Raw> {
  const qs = new URLSearchParams({ ...params, JsHttpRequest: '1-xml' })
  const text = await httpGet(`${endpoint}?${qs.toString()}`, headersFor(p, token))
  try {
    return JSON.parse(text) as Raw
  } catch {
    throw new Error('Portal geçerli bir yanıt vermedi')
  }
}

async function handshake(p: StoredProfile): Promise<Session> {
  let lastErr = 'Portal bulunamadı'
  for (const endpoint of stalkerCandidates(p.server || '')) {
    try {
      const j = await rawCall(endpoint, p, undefined, { type: 'stb', action: 'handshake', token: '' })
      const token = j?.js?.token
      if (!token) { lastErr = 'Portal bağlantıyı reddetti (MAC adresi kayıtlı olmayabilir)'; continue }
      const s: Session = { endpoint, token: String(token), at: Date.now() }
      const { sn, did } = ids(p.mac!)
      try {
        await rawCall(endpoint, p, s.token, {
          type: 'stb', action: 'get_profile', hd: '1', sn, stb_type: 'MAG250', client_type: 'STB',
          image_version: '218', video_out: 'hdmi', num_banks: '2', device_id: did, device_id2: did,
          auth_second_step: '1', hw_version: '1.7-BD-00', api_signature: '262',
          ver: 'ImageDescription: 0.2.18-r14-pub-250; PORTAL version: 5.5.0; API Version: JS API version: 328; STB API version: 134; Player Engine version: 0x566'
        })
      } catch { /* profil çağrısı isteğe bağlı */ }
      return s
    } catch (e) {
      lastErr = (e as Error).message
    }
  }
  throw new Error(lastErr)
}

async function getSession(p: StoredProfile, force = false): Promise<Session> {
  const cur = sessions.get(p.id)
  if (!force && cur && Date.now() - cur.at < SESSION_MS) return cur
  const s = await handshake(p)
  sessions.set(p.id, s)
  return s
}

async function call(p: StoredProfile, params: Record<string, string>): Promise<any> {
  const attempt = async (force: boolean) => {
    const s = await getSession(p, force)
    const j = await rawCall(s.endpoint, p, s.token, params)
    if (j?.js === undefined) throw new Error('Portal boş yanıt verdi')
    return j.js
  }
  try {
    return await attempt(false)
  } catch {
    return attempt(true) // jeton süresi dolmuş olabilir
  }
}

async function paged(p: StoredProfile, params: Record<string, string>, maxPages = 200): Promise<Raw[]> {
  const out: Raw[] = []
  let total = Infinity
  let perPage = 0
  for (let page = 1; page <= maxPages && out.length < total; page++) {
    const js = await call(p, { ...params, p: String(page) })
    const data: Raw[] = Array.isArray(js?.data) ? js.data : []
    if (data.length === 0) break
    out.push(...data)
    const t = Number(js.total_items ?? 0)
    total = t > 0 ? t : Infinity
    perPage = perPage || data.length
    if (total === Infinity && data.length < perPage) break
  }
  return out
}

const str = (x: unknown): string | undefined => (x === null || x === undefined || x === '' ? undefined : String(x))

function absUrl(p: StoredProfile, u: unknown): string | undefined {
  const s = str(u)
  if (!s) return undefined
  try {
    const base = stalkerCandidates(p.server || '')[0]
    return new URL(s, base).toString()
  } catch {
    return undefined
  }
}

export async function loadStalker(p: StoredProfile, kind: Kind): Promise<Item[]> {
  if (kind === 'live') {
    const genreJs = await call(p, { type: 'itv', action: 'get_genres' }).catch(() => [])
    const genres = new Map<string, string>()
    for (const g of Array.isArray(genreJs) ? genreJs : []) genres.set(String(g.id), String(g.title ?? 'Diğer'))

    let chans: Raw[] = []
    try {
      const js = await call(p, { type: 'itv', action: 'get_all_channels' })
      chans = Array.isArray(js?.data) ? js.data : Array.isArray(js) ? js : []
    } catch { chans = [] }
    if (chans.length === 0) {
      chans = await paged(p, { type: 'itv', action: 'get_ordered_list', genre: '*', fav: '0', sortby: 'number', hd: '0' })
    }
    if (chans.length === 0) throw new Error('Portaldan kanal listesi alınamadı. MAC adresi etkin olmayabilir.')
    const out: Item[] = []
    for (const c of chans) {
      if (!c?.cmd) continue
      out.push({
        id: `st-l-${c.id}`, kind: 'live', name: String(c.name ?? 'Adsız'), logo: absUrl(p, c.logo),
        group: genres.get(String(c.tv_genre_id)) ?? 'Diğer', tvgId: str(c.xmltv_id), cmd: String(c.cmd)
      })
    }
    return out
  }

  // Film ve diziler (deneysel)
  const catJs = await call(p, { type: 'vod', action: 'get_categories' }).catch(() => [])
  const cats = new Map<string, string>()
  for (const c of Array.isArray(catJs) ? catJs : []) cats.set(String(c.id), String(c.title ?? 'Diğer'))

  let list = await paged(p, { type: 'vod', action: 'get_ordered_list', category: '*', sortby: 'added' }, 150).catch(() => [])
  if (list.length === 0) {
    for (const id of cats.keys()) {
      if (id === '*') continue
      list.push(...(await paged(p, { type: 'vod', action: 'get_ordered_list', category: id, sortby: 'added' }, 5).catch(() => [])))
    }
  }
  const out: Item[] = []
  for (const v of list) {
    if (!v?.cmd) continue
    const eps: number[] = Array.isArray(v.series) ? v.series.map(Number).filter((n: number) => n > 0) : []
    const isSeries = String(v.is_series) === '1' || eps.length > 0
    if ((kind === 'series') !== isSeries) continue
    const base: Item = {
      id: `st-v-${v.id}`, kind, name: String(v.name ?? 'Adsız'), logo: absUrl(p, v.screenshot_uri ?? v.cover),
      group: cats.get(String(v.category_id)) ?? 'Diğer', cmd: String(v.cmd), plot: str(v.description),
      rating: str(v.rating_imdb ?? v.rating_kinopoisk)
    }
    if (isSeries) {
      base.localDetail = {
        seasons: {
          '1': eps.map((n) => ({ id: n, title: `Bölüm ${n}`, season: 1, episode: n, ext: '' }))
        }
      }
    }
    out.push(base)
  }
  return out
}

export async function stalkerLink(p: StoredProfile, t: NonNullable<PlayTarget['stalker']>): Promise<string> {
  const params: Record<string, string> = {
    type: t.type, action: 'create_link', cmd: t.cmd, forced_storage: 'undefined', disable_ip_check: '0'
  }
  if (t.series) params.series = String(t.series)
  const js = await call(p, params)
  const cmd = js?.cmd
  if (!cmd) throw new Error('Portal yayın adresi vermedi (hesap süresi dolmuş veya bağlantı sınırı aşılmış olabilir)')
  const url = stripCmd(String(cmd))
  if (!/^https?:\/\//i.test(url)) throw new Error('Desteklenmeyen yayın adresi')
  return url
}
