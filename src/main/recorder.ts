import { app, net, powerSaveBlocker } from 'electron'
import { createWriteStream, existsSync, mkdirSync, WriteStream } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { getSettings, store } from './store'
import { maskUrl } from './net'
import type { RecInfo } from '../shared/types'

interface Rec extends RecInfo {
  abort: AbortController
  resolve?: () => Promise<string>
  subdir?: string[]
  timer?: ReturnType<typeof setInterval>
}

class FatalError extends Error {}

const recs = new Map<string, Rec>()
const MAX_DOWNLOADS = 2
let blockerId: number | null = null

const toInfo = (r: Rec): RecInfo => ({
  id: r.id, type: r.type, title: r.title, file: r.file, startedAt: r.startedAt, endedAt: r.endedAt,
  stopAt: r.stopAt, bytes: r.bytes, total: r.total, reconnects: r.reconnects, status: r.status, error: r.error
})

const safe = (s: string, max = 80) => s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\.+$/, '').trim().slice(0, max) || 'adsiz'
const pad = (n: number) => String(n).padStart(2, '0')

export function recordDir(): string {
  const dir = getSettings().recordDir || join(app.getPath('videos'), 'IPTV Kayitlari')
  mkdirSync(dir, { recursive: true })
  return dir
}
export function downloadDir(): string {
  const dir = getSettings().downloadDir || join(app.getPath('videos'), 'IPTV Indirilenler')
  mkdirSync(dir, { recursive: true })
  return dir
}

function uniquePath(dir: string, base: string, ext: string): string {
  let p = join(dir, `${base}.${ext}`)
  for (let i = 2; existsSync(p); i++) p = join(dir, `${base} (${i}).${ext}`)
  return p
}

function extFor(url: string, ct: string): string {
  let path = url
  try { path = new URL(url).pathname } catch { /* ham */ }
  const m = /\.(mp4|mkv|avi|mov|m4v|ts|webm|wmv|flv)$/i.exec(path)
  if (m) return m[1].toLowerCase()
  if (/\.m3u8$/i.test(path) || /mpegurl/.test(ct)) return 'ts'
  if (/matroska/.test(ct)) return 'mkv'
  if (/mp2t/.test(ct)) return 'ts'
  if (/webm/.test(ct)) return 'webm'
  return 'mp4'
}

function updateBlocker() {
  const active = [...recs.values()].some((r) => r.status === 'recording' || r.status === 'queued')
  if (active && blockerId === null) blockerId = powerSaveBlocker.start('prevent-app-suspension')
  else if (!active && blockerId !== null) { powerSaveBlocker.stop(blockerId); blockerId = null }
}

function persist(r: Rec) {
  const rest = store.get('records').filter((x) => x.id !== r.id)
  store.set('records', [toInfo(r), ...rest].slice(0, 300))
}

function finish(r: Rec) {
  if (r.timer) clearInterval(r.timer)
  r.endedAt = Date.now()
  persist(r)
  updateBlocker()
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { clearTimeout(t); resolve() }, { once: true })
  })

function write(out: WriteStream, chunk: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => out.write(chunk, (err) => (err ? reject(err) : resolve())))
}

async function pipeBody(res: Response, rec: Rec, out: WriteStream) {
  const reader = res.body!.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    await write(out, value)
    rec.bytes += value.length
  }
}

/** HLS: 'endlist' (yayın bitti) veya 'aborted' döndürür. */
async function pipeHls(
  startUrl: string, firstText: string, rec: Rec, out: WriteStream,
  headers: Record<string, string>, fromStart: boolean
): Promise<'endlist' | 'aborted'> {
  const signal = rec.abort.signal
  const get = async (u: string) => {
    const r = await net.fetch(u, { headers, signal })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r
  }
  let playlistUrl = startUrl
  let text = firstText

  if (text.includes('#EXT-X-STREAM-INF')) {
    const lines = text.split(/\r?\n/)
    let best = -1, bestUri = ''
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
        const bw = Number(/BANDWIDTH=(\d+)/.exec(lines[i])?.[1] ?? 0)
        const uri = lines.slice(i + 1).find((l) => l.trim() && !l.startsWith('#'))
        if (uri && bw >= best) { best = bw; bestUri = uri.trim() }
      }
    }
    if (!bestUri) throw new FatalError('HLS ana listesinde akış bulunamadı')
    playlistUrl = new URL(bestUri, startUrl).toString()
    text = await (await get(playlistUrl)).text()
  }

  const seen: string[] = []
  const seenSet = new Set<string>()
  let first = true
  let failures = 0

  while (!signal.aborted) {
    if (/#EXT-X-KEY:.*METHOD=(?!NONE)/.test(text)) throw new FatalError('Şifreli (AES/DRM) HLS yayınları kaydedilemiyor')
    if (/#EXT-X-MAP/.test(text)) throw new FatalError('Bu HLS biçimi (fMP4) desteklenmiyor; .ts akışı deneyin')

    const segs: string[] = []
    for (const l of text.split(/\r?\n/)) {
      const t = l.trim()
      if (t && !t.startsWith('#')) segs.push(new URL(t, playlistUrl).toString())
    }
    const target = Number(/#EXT-X-TARGETDURATION:(\d+)/.exec(text)?.[1] ?? 6)
    const isEnd = /#EXT-X-ENDLIST/.test(text)
    const fresh = (first ? (fromStart || isEnd ? segs : segs.slice(-3)) : segs).filter((u) => !seenSet.has(u))
    first = false

    for (const u of fresh) {
      if (signal.aborted) break
      seenSet.add(u); seen.push(u)
      if (seen.length > 800) seenSet.delete(seen.shift()!)
      try {
        const buf = new Uint8Array(await (await get(u)).arrayBuffer())
        await write(out, buf)
        rec.bytes += buf.length
      } catch {
        if (signal.aborted) break
        /* tek parça hatası işlemi durdurmaz */
      }
    }
    if (isEnd) return 'endlist'
    await sleep(Math.max(1000, (target * 1000) / 2), signal)
    if (signal.aborted) break
    try {
      text = await (await get(playlistUrl)).text()
      failures = 0
    } catch (e) {
      if (signal.aborted) break
      if (++failures >= 6) throw new Error('Yayın listesi alınamıyor: ' + (e as Error).message)
    }
  }
  return 'aborted'
}

const isHls = (ct: string, url: string) => /mpegurl/.test(ct) || /\.m3u8(\?|$)/i.test(url)

async function runRecording(rec: Rec, url: string, out: WriteStream) {
  const signal = rec.abort.signal
  const headers = { 'User-Agent': getSettings().userAgent }
  let failures = 0
  while (!signal.aborted) {
    const before = rec.bytes
    try {
      const res = await net.fetch(url, { headers, signal })
      if (!res.ok) throw new Error(`Sunucu yanıtı: HTTP ${res.status}`)
      const ct = (res.headers.get('content-type') || '').toLowerCase()
      if (isHls(ct, url)) {
        const r = await pipeHls(url, await res.text(), rec, out, headers, false)
        if (r === 'endlist') return
      } else if (res.body) {
        await pipeBody(res, rec, out)
      } else throw new Error('Yayın verisi alınamadı')
    } catch (e) {
      if (signal.aborted) break
      if (e instanceof FatalError) throw e
      if (++failures >= 8) throw e
    }
    if (signal.aborted) break
    if (rec.bytes > before) failures = 0
    // Sunucu bağlantıyı kapattı veya kesinti oldu: yeniden bağlan, aynı dosyaya devam et
    rec.reconnects = (rec.reconnects ?? 0) + 1
    await sleep(Math.min(2000 * (failures + 1), 10_000), signal)
  }
}

export function startRecording(url: string, title: string, minutes = 0): { id: string } {
  if (!/^https?:\/\//i.test(url)) throw new Error('Yalnızca http/https yayınları kaydedilebilir')
  const d = new Date()
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  const rec: Rec = {
    id: randomUUID(), type: 'record', title, file: join(recordDir(), `${safe(title)} ${stamp}.ts`),
    startedAt: Date.now(), bytes: 0, reconnects: 0, status: 'recording', abort: new AbortController()
  }
  if (minutes > 0) {
    rec.stopAt = Date.now() + minutes * 60_000
    // setTimeout yerine periyodik kontrol: bilgisayar uykudan dönse de zamanında durur
    rec.timer = setInterval(() => { if (Date.now() >= rec.stopAt!) rec.abort.abort() }, 5000)
  }
  recs.set(rec.id, rec)
  updateBlocker()

  const out = createWriteStream(rec.file)
  runRecording(rec, url, out)
    .then(() => { rec.status = 'done' })
    .catch((e: Error) => {
      if (rec.abort.signal.aborted) rec.status = 'done'
      else { rec.status = 'error'; rec.error = `${e.message} (${maskUrl(url)})` }
    })
    .finally(() => { out.end(); finish(rec) })
  return { id: rec.id }
}

async function runDownload(rec: Rec) {
  const signal = rec.abort.signal
  const headers = { 'User-Agent': getSettings().userAgent }
  const url = await rec.resolve!()
  if (!/^https?:\/\//i.test(url)) throw new Error('Geçersiz indirme adresi')
  let out: WriteStream | null = null
  let attempts = 0
  try {
    while (!signal.aborted) {
      try {
        const res = await net.fetch(url, {
          headers: rec.bytes > 0 ? { ...headers, Range: `bytes=${rec.bytes}-` } : headers, signal
        })
        if (!res.ok && res.status !== 206) throw new Error(`Sunucu yanıtı: HTTP ${res.status}`)
        const ct = (res.headers.get('content-type') || '').toLowerCase()
        if (!out) {
          const dir = join(downloadDir(), ...(rec.subdir ?? []).map((x) => safe(x, 60)))
          mkdirSync(dir, { recursive: true })
          rec.file = uniquePath(dir, safe(rec.title, 100), extFor(url, ct))
          out = createWriteStream(rec.file)
        } else if (rec.bytes > 0 && res.status !== 206) {
          // Sunucu kaldığı yerden devam etmeyi desteklemiyor: baştan başla
          rec.bytes = 0
          out.end()
          out = createWriteStream(rec.file, { flags: 'w' })
        }
        if (isHls(ct, url)) {
          await pipeHls(url, await res.text(), rec, out, headers, true)
          break
        }
        const cr = /\/(\d+)$/.exec(res.headers.get('content-range') || '')
        const cl = Number(res.headers.get('content-length') || 0)
        rec.total = cr ? Number(cr[1]) : cl ? cl + rec.bytes : rec.total
        await pipeBody(res, rec, out)
        if (rec.total && rec.bytes < rec.total) throw new Error('Bağlantı yarıda kesildi')
        break
      } catch (e) {
        if (signal.aborted) break
        if (e instanceof FatalError || ++attempts > 6) throw e
        await sleep(2000 * attempts, signal)
      }
    }
  } finally {
    out?.end()
  }
}

function pump() {
  const active = [...recs.values()].filter((r) => r.type === 'download' && r.status === 'recording').length
  let slots = MAX_DOWNLOADS - active
  for (const r of recs.values()) {
    if (slots <= 0) break
    if (r.type !== 'download' || r.status !== 'queued') continue
    r.status = 'recording'
    slots--
    runDownload(r)
      .then(() => { r.status = r.abort.signal.aborted ? 'cancelled' : 'done' })
      .catch((e: Error) => {
        if (r.abort.signal.aborted) r.status = 'cancelled'
        else { r.status = 'error'; r.error = e.message }
      })
      .finally(() => { finish(r); pump() })
  }
}

export function startDownload(resolve: () => Promise<string>, title: string, subdir?: string[]): { id: string } {
  const rec: Rec = {
    id: randomUUID(), type: 'download', title, file: '', startedAt: Date.now(), bytes: 0,
    status: 'queued', abort: new AbortController(), resolve, subdir
  }
  recs.set(rec.id, rec)
  updateBlocker()
  pump()
  return { id: rec.id }
}

export function stopRecording(id: string) {
  const r = recs.get(id)
  if (!r) return
  if (r.status === 'queued') { r.status = 'cancelled'; finish(r); return }
  r.abort.abort()
}

export function activeCount(): number {
  return [...recs.values()].filter((r) => r.status === 'recording' || r.status === 'queued').length
}

export function stopAll() {
  for (const r of recs.values()) r.abort.abort()
}

export function listRecordings(): RecInfo[] {
  const live = [...recs.values()].map(toInfo)
  const ids = new Set(live.map((x) => x.id))
  const saved = store.get('records').filter((r) => !ids.has(r.id) && (r.bytes === 0 || !r.file || existsSync(r.file)))
  return [...live, ...saved].sort((a, b) => b.startedAt - a.startedAt)
}

export function findRecording(id: string): RecInfo | undefined {
  const r = recs.get(id)
  return r ? toInfo(r) : store.get('records').find((x) => x.id === id)
}

export function forgetRecording(id: string) {
  recs.delete(id)
  store.set('records', store.get('records').filter((x) => x.id !== id))
}
