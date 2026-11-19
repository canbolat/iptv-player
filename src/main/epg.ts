import { app } from 'electron'
import { gunzipSync } from 'zlib'
import { existsSync, readFileSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { fetchBuffer } from './net'
import type { EpgEntry, EpgNowNext } from '../shared/types'
import { parseXmltv } from '../shared/xmltv'

const MAX_AGE_MS = 12 * 3600_000
const guide = new Map<string, EpgEntry[]>()
let loadedUrl = ''

const cachePath = () => join(app.getPath('userData'), 'epg-cache.json')

function setGuide(map: Map<string, EpgEntry[]>) {
  guide.clear()
  for (const [k, v] of map) guide.set(k, v)
}

export async function loadEpg(url: string): Promise<{ ok: boolean; channels: number; error?: string }> {
  try {
    if (loadedUrl === url && guide.size) return { ok: true, channels: guide.size }
    // Önbellek
    if (existsSync(cachePath())) {
      try {
        const c = JSON.parse(readFileSync(cachePath(), 'utf8')) as { url: string; at: number; data: [string, EpgEntry[]][] }
        if (c.url === url && Date.now() - c.at < MAX_AGE_MS) {
          setGuide(new Map(c.data))
          loadedUrl = url
          return { ok: true, channels: guide.size }
        }
      } catch { /* bozuk önbellek: yeniden indir */ }
    }
    let buf = await fetchBuffer(url)
    if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf)
    const parsed = parseXmltv(buf.toString('utf8'))
    setGuide(parsed)
    loadedUrl = url
    writeFileSync(cachePath(), JSON.stringify({ url, at: Date.now(), data: [...parsed] }))
    return { ok: true, channels: guide.size }
  } catch (e) {
    return { ok: false, channels: 0, error: (e as Error).message }
  }
}

export function nowNext(tvgId: string): EpgNowNext {
  const list = guide.get(tvgId.toLowerCase())
  if (!list) return {}
  const t = Date.now()
  const i = list.findIndex((e) => e.start <= t && t < e.stop)
  if (i >= 0) return { now: list[i], next: list[i + 1] }
  return { next: list.find((e) => e.start > t) }
}

export function clearEpgCache() {
  guide.clear()
  loadedUrl = ''
  try { rmSync(cachePath(), { force: true }) } catch { /* yok say */ }
}

/** Program rehberi ızgarası için: verilen kanalların [from, to] aralığındaki programları */
export function epgRange(ids: string[], from: number, to: number): Record<string, EpgEntry[]> {
  const out: Record<string, EpgEntry[]> = {}
  for (const id of ids.slice(0, 200)) {
    const list = guide.get(String(id).toLowerCase())
    if (list) out[id] = list.filter((e) => e.stop > from && e.start < to)
  }
  return out
}
