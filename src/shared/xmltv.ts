import type { EpgEntry } from './types'

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
}

/** "20240101120000 +0100" -> epoch ms */
export function parseXmltvTime(s: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/.exec(s.trim())
  if (!m) return NaN
  const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0))
  let off = 0
  if (m[7]) off = (m[7][0] === '-' ? -1 : 1) * (+m[7].slice(1, 3) * 60 + +m[7].slice(3, 5)) * 60_000
  return utc - off
}

export function parseXmltv(xml: string, from = Date.now() - 2 * 3600_000, to = Date.now() + 48 * 3600_000) {
  const out = new Map<string, EpgEntry[]>()
  const re = /<programme\s+([^>]*?)>([\s\S]*?)<\/programme>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const attrs = m[1]
    const ch = /channel="([^"]*)"/.exec(attrs)?.[1]
    const st = /start="([^"]*)"/.exec(attrs)?.[1]
    const sp = /stop="([^"]*)"/.exec(attrs)?.[1]
    if (!ch || !st || !sp) continue
    const start = parseXmltvTime(st)
    const stop = parseXmltvTime(sp)
    if (!Number.isFinite(start) || !Number.isFinite(stop) || stop < from || start > to) continue
    const title = /<title[^>]*>([\s\S]*?)<\/title>/.exec(m[2])?.[1]
    if (!title) continue
    const desc = /<desc[^>]*>([\s\S]*?)<\/desc>/.exec(m[2])?.[1]
    const key = decodeEntities(ch).toLowerCase()
    const list = out.get(key) ?? []
    list.push({ title: decodeEntities(title).trim(), desc: desc ? decodeEntities(desc).trim() : undefined, start, stop })
    out.set(key, list)
  }
  for (const list of out.values()) list.sort((a, b) => a.start - b.start)
  return out
}
