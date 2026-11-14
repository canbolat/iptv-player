import { app, net } from 'electron'
import { createWriteStream, mkdirSync, WriteStream } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { getSettings } from './store'
import { maskUrl } from './net'
import type { RecInfo } from '../shared/types'

interface Rec extends RecInfo {
  abort: AbortController
}

const recs = new Map<string, Rec>()

export function recordDir(): string {
  const dir = getSettings().recordDir || join(app.getPath('videos'), 'IPTV Kayitlari')
  mkdirSync(dir, { recursive: true })
  return dir
}

const pad = (n: number) => String(n).padStart(2, '0')
function fileName(title: string): string {
  const d = new Date()
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  const safe = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 80) || 'kayit'
  return `${safe} ${stamp}.ts`
}

function write(out: WriteStream, chunk: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    out.write(chunk, (err) => (err ? reject(err) : resolve()))
  })
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { clearTimeout(t); resolve() }, { once: true })
  })

async function recordRaw(res: Response, rec: Rec, out: WriteStream) {
  const reader = res.body!.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    await write(out, value)
    rec.bytes += value.length
  }
}

async function recordHls(startUrl: string, firstText: string, rec: Rec, out: WriteStream, headers: Record<string, string>) {
  const signal = rec.abort.signal
  const get = async (u: string) => {
    const r = await net.fetch(u, { headers, signal })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r
  }
  let playlistUrl = startUrl
  let text = firstText

  // Ana liste ise en yüksek bant genişlikli varyantı seç
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
    if (!bestUri) throw new Error('HLS ana listesinde akış bulunamadı')
    playlistUrl = new URL(bestUri, startUrl).toString()
    text = await (await get(playlistUrl)).text()
  }

  const seen: string[] = []
  const seenSet = new Set<string>()
  let first = true
  let failures = 0

  while (!signal.aborted) {
    if (/#EXT-X-KEY:.*METHOD=(?!NONE)/.test(text)) throw new Error('Şifreli (DRM/AES) HLS yayınları kaydedilemiyor')
    if (/#EXT-X-MAP/.test(text)) throw new Error('Bu HLS biçimi (fMP4) kaydedilemiyor; .ts akışı deneyin')

    const lines = text.split(/\r?\n/)
    const segs: string[] = []
    for (const l of lines) {
      const t = l.trim()
      if (t && !t.startsWith('#')) segs.push(new URL(t, playlistUrl).toString())
    }
    const target = Number(/#EXT-X-TARGETDURATION:(\d+)/.exec(text)?.[1] ?? 6)
    // İlk turda eski yığını indirmek yerine son 3 parçadan başla
    const fresh = (first ? segs.slice(-3) : segs).filter((u) => !seenSet.has(u))
    first = false

    for (const u of fresh) {
      if (signal.aborted) break
      seenSet.add(u); seen.push(u)
      if (seen.length > 600) seenSet.delete(seen.shift()!)
      try {
        const buf = new Uint8Array(await (await get(u)).arrayBuffer())
        await write(out, buf)
        rec.bytes += buf.length
      } catch (e) {
        if (signal.aborted) break
        /* tek parça hatası kaydı durdurmaz */
      }
    }

    if (/#EXT-X-ENDLIST/.test(text)) break
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
}

export function startRecording(url: string, title: string): { id: string } {
  if (!/^https?:\/\//i.test(url)) throw new Error('Yalnızca http/https yayınları kaydedilebilir')
  const id = randomUUID()
  const file = join(recordDir(), fileName(title))
  const rec: Rec = { id, title, file, startedAt: Date.now(), bytes: 0, status: 'recording', abort: new AbortController() }
  recs.set(id, rec)

  const out = createWriteStream(file)
  const headers = { 'User-Agent': getSettings().userAgent }

  ;(async () => {
    try {
      const res = await net.fetch(url, { headers, signal: rec.abort.signal })
      if (!res.ok) throw new Error(`Sunucu yanıtı: HTTP ${res.status}`)
      const ct = (res.headers.get('content-type') || '').toLowerCase()
      const isHls = /mpegurl/.test(ct) || /\.m3u8(\?|$)/i.test(url)
      if (isHls) await recordHls(url, await res.text(), rec, out, headers)
      else if (res.body) await recordRaw(res, rec, out)
      else throw new Error('Yayın verisi alınamadı')
      rec.status = 'done'
    } catch (e) {
      if (rec.abort.signal.aborted) rec.status = 'done'
      else { rec.status = 'error'; rec.error = (e as Error).message + ` (${maskUrl(url)})` }
    } finally {
      rec.endedAt = Date.now()
      out.end()
    }
  })()

  return { id }
}

export function stopRecording(id: string) {
  recs.get(id)?.abort.abort()
}

export function stopAllRecordings() {
  for (const r of recs.values()) r.abort.abort()
}

export function listRecordings(): RecInfo[] {
  return [...recs.values()]
    .map(({ abort, ...info }) => info)
    .sort((a, b) => b.startedAt - a.startedAt)
}

export function findRecording(id: string): RecInfo | undefined {
  const r = recs.get(id)
  if (!r) return undefined
  const { abort, ...info } = r
  return info
}

export function forgetRecording(id: string) {
  recs.delete(id)
}
