import type { Item, PlayTarget } from '../../shared/types'

/** Canlı kanal öğesinden oynatma hedefi üretir (M3U, Xtream veya Stalker). */
export function liveTarget(it: Item): PlayTarget {
  return {
    title: it.name, logo: it.logo, kind: 'live', url: it.url, tvgId: it.tvgId,
    xtream: it.streamId ? { type: 'live', id: it.streamId } : undefined,
    stalker: it.cmd ? { type: 'itv', cmd: it.cmd } : undefined
  }
}
