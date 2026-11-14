import type {
  Detail, EpgNowNext, HistoryEntry, Item, Kind, PlayTarget, Profile, ProfileInput, RecInfo, Settings
} from './types'

export interface Api {
  getProfiles(): Promise<Profile[]>
  saveProfile(input: ProfileInput): Promise<Profile>
  deleteProfile(id: string): Promise<void>
  pickM3UFile(): Promise<{ path: string; name: string } | null>
  /** M3U profilinin ham metnini döndürür (URL veya yerel dosya) */
  getPlaylistText(profileId: string): Promise<string>
  /** Xtream içeriğini yükler */
  loadXtream(profileId: string, kind: Kind): Promise<Item[]>
  xtreamDetail(profileId: string, kind: 'vod' | 'series', id: number): Promise<Detail>
  resolveUrl(profileId: string, target: PlayTarget): Promise<string>
  loadEpg(profileId: string, fallbackUrl?: string): Promise<{ ok: boolean; channels: number; error?: string }>
  epgNowNext(tvgId: string): Promise<EpgNowNext>
  getSettings(): Promise<Settings>
  setSettings(s: Partial<Settings>): Promise<Settings>
  getFavorites(profileId: string): Promise<string[]>
  toggleFavorite(profileId: string, itemId: string): Promise<string[]>
  getHistory(profileId: string): Promise<HistoryEntry[]>
  saveHistory(entry: HistoryEntry): Promise<void>
  removeHistory(key: string): Promise<void>
  clearCache(): Promise<void>
  setMini(on: boolean): Promise<void>
  openExternal(url: string): Promise<{ ok: boolean; error?: string }>
  relaunch(): Promise<void>
  startRecording(url: string, title: string, minutes?: number): Promise<{ id: string }>
  startDownload(profileId: string, target: PlayTarget, title: string, subdir?: string[]): Promise<{ id: string }>
  stopRecording(id: string): Promise<void>
  listRecordings(): Promise<RecInfo[]>
  openRecording(id: string): Promise<{ ok: boolean; error?: string }>
  showRecordingFolder(id?: string, kind?: 'record' | 'download'): Promise<void>
  deleteRecording(id: string): Promise<void>
  pickFolder(): Promise<string | null>
}

declare global {
  interface Window {
    api: Api
  }
}
