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
  /** Stalker portal komutu */
  cmd?: string
  /** Xtream geçmiş yayın (catch-up) gün sayısı */
  archive?: number
}

export interface Profile {
  id: string
  name: string
  type: 'm3u' | 'xtream' | 'stalker'
  url?: string
  path?: string
  epgUrl?: string
  server?: string
  username?: string
  /** Stalker için cihaz MAC adresi */
  mac?: string
  hasPassword?: boolean
}

export interface ProfileInput {
  id?: string
  name: string
  type: 'm3u' | 'xtream' | 'stalker'
  url?: string
  path?: string
  epgUrl?: string
  server?: string
  username?: string
  mac?: string
  /** Boş bırakılırsa mevcut şifre korunur */
  password?: string
}

export interface Settings {
  userAgent: string
  hwAccel: boolean
  externalPlayer: string
  liveExt: 'm3u8' | 'ts'
  /** Kayıt klasörü; boşsa Videolar\IPTV Kayitlari */
  recordDir: string
  /** İndirme klasörü; boşsa Videolar\IPTV Indirilenler */
  downloadDir: string
  /** Uzantısız canlı adreslerde hangi motorun kullanılacağı */
  engine: 'auto' | 'hls' | 'ts'
  /** İleri tampon hedefi (saniye) */
  bufferSec: number
  /** Oynatmadan önce ve takılma sonrası biriktirilecek tampon (saniye, yalnızca MPEG-TS) */
  prebufferSec: number
  /** Dahili oynatıcı veya harici (mpv/VLC) */
  playerMode: 'internal' | 'external'
  externalArgs: string
  /** Oynatma boru hattı: tarayıcı (hızlı) veya ffmpeg ara katmanı (kararlı) */
  pipeline: 'native' | 'ffmpeg'
  ffmpegVideo: 'auto' | 'copy' | 'transcode'
  theme: 'dark' | 'amoled' | 'light' | 'system'
  accent: 'indigo' | 'blue' | 'sky' | 'emerald' | 'rose' | 'amber' | 'violet'
  density: 'normal' | 'compact'
  closeToTray: boolean
  autoUpdate: boolean
  language: 'tr' | 'en'
}

export const DEFAULT_SETTINGS: Settings = {
  userAgent: 'VLC/3.0.20 LibVLC/3.0.20',
  hwAccel: true,
  externalPlayer: '',
  liveExt: 'm3u8',
  recordDir: '',
  downloadDir: '',
  engine: 'auto',
  bufferSec: 30,
  prebufferSec: 4,
  playerMode: 'internal',
  externalArgs: '',
  pipeline: 'native',
  ffmpegVideo: 'auto',
  theme: 'dark',
  accent: 'indigo',
  density: 'normal',
  closeToTray: false,
  autoUpdate: true,
  language: 'tr'
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
  /** Stalker: komut ve (varsa) bölüm numarası */
  stalker?: { type: 'itv' | 'vod'; cmd: string; series?: number }
  /** Xtream geçmiş yayın: sunucu saatiyle başlangıç (YYYY-MM-DD:HH-mm) ve dakika */
  catchup?: { streamId: number; start: string; minutes: number }
  /** Kanalın geçmiş yayın desteği var mı */
  archive?: boolean
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
  type: 'record' | 'download'
  title: string
  file: string
  startedAt: number
  endedAt?: number
  /** Zamanlı durdurma (epoch ms) */
  stopAt?: number
  bytes: number
  /** İndirmelerde toplam boyut, biliniyorsa */
  total?: number
  reconnects?: number
  status: 'queued' | 'recording' | 'done' | 'error' | 'cancelled'
  error?: string
}

export interface Schedule {
  id: string
  profileId: string
  target: PlayTarget
  title: string
  startAt: number
  /** 0 = elle durdurulur */
  minutes: number
  status: 'pending' | 'started' | 'missed' | 'error'
  error?: string
}

export interface CatchupEntry {
  title: string
  desc?: string
  /** Sunucu saatiyle başlangıç metni */
  start: string
  startTs: number
  stopTs: number
  hasArchive: boolean
}

export interface UpdateStatus {
  state: 'idle' | 'dev' | 'checking' | 'available' | 'none' | 'downloading' | 'ready' | 'error'
  version?: string
  percent?: number
  message?: string
}

export interface AppMetrics {
  cpu: { renderer: number; gpu: number; main: number; other: number }
  videoDecode: string
  gpuCompositing: string
}
