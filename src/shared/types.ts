export type Kind = 'live' | 'vod' | 'series'

export interface Item {
  id: string
  name: string
  logo?: string
  group: string
  kind: Kind
  /** Doğrudan yayın adresi (M3U profillerinde) */
  url?: string
  tvgId?: string
  /** Xtream tarafı */
  streamId?: number
  seriesId?: number
  ext?: string
  rating?: string
  plot?: string
  userAgent?: string
  /** M3U'dan gruplanmış dizilerde bölüm listesi */
  localDetail?: Detail
}

export interface Profile {
  id: string
  name: string
  type: 'm3u' | 'xtream'
  url?: string
  path?: string
  epgUrl?: string
  server?: string
  username?: string
  hasPassword?: boolean
}

export interface ProfileInput {
  id?: string
  name: string
  type: 'm3u' | 'xtream'
  url?: string
  path?: string
  epgUrl?: string
  server?: string
  username?: string
  /** Boş bırakılırsa mevcut şifre korunur */
  password?: string
}

export interface Settings {
  userAgent: string
  hwAccel: boolean
  externalPlayer: string
  liveExt: 'm3u8' | 'ts'
  /** Kayıt klasörü; boşsa Videolar\\IPTV Kayitlari */
  recordDir: string
  /** Uzantısız canlı adreslerde hangi motorun kullanılacağı */
  engine: 'auto' | 'hls' | 'ts'
  buffer: 'low' | 'balanced' | 'stable'
}

export const DEFAULT_SETTINGS: Settings = {
  userAgent: 'VLC/3.0.20 LibVLC/3.0.20',
  hwAccel: true,
  externalPlayer: '',
  liveExt: 'm3u8',
  recordDir: '',
  engine: 'auto',
  buffer: 'stable'
}

export interface EpgEntry {
  title: string
  desc?: string
  start: number
  stop: number
}

export interface EpgNowNext {
  now?: EpgEntry
  next?: EpgEntry
}

/** Oynatılacak şeyin tarifi; gerçek URL main process'te çözülür. */
export interface PlayTarget {
  title: string
  logo?: string
  kind: Kind
  /** M3U: doğrudan adres */
  url?: string
  /** Xtream: tür + kimlik */
  xtream?: { type: 'live' | 'movie' | 'series'; id: number; ext?: string }
  tvgId?: string
}

export interface HistoryEntry {
  key: string
  profileId: string
  target: PlayTarget
  position: number
  duration: number
  updated: number
}

export interface Episode {
  id: number
  title: string
  season: number
  episode: number
  ext: string
  /** M3U kaynaklı bölümlerde doğrudan adres */
  url?: string
  plot?: string
  image?: string
  duration?: string
}

export interface Detail {
  plot?: string
  rating?: string
  genre?: string
  cover?: string
  year?: string
  cast?: string
  seasons?: Record<string, Episode[]>
}

export interface M3UResult {
  items: Item[]
  skipped: number
  epgUrl?: string
}

export interface RecInfo {
  id: string
  title: string
  file: string
  startedAt: number
  endedAt?: number
  bytes: number
  status: 'recording' | 'done' | 'error'
  error?: string
}
