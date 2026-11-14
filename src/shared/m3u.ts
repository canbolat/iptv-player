import type { Item, M3UResult } from './types'

const ATTR_RE = /([\w-]+)="([^"]*)"/g
const URL_RE = /^(https?|rtmp|rtmps|rtsp|udp|rtp|mms):\/\//i

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
    items.push({
      id: `m3u-${items.length}`,
      name: cur.name || a['tvg-name'] || 'Adsız kanal',
      logo: a['tvg-logo'] || undefined,
      tvgId: a['tvg-id'] || undefined,
      group: a['group-title'] || extGrp || 'Diğer',
      kind: 'live',
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
