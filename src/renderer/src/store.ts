import { create } from 'zustand'
import type {
  HistoryEntry, Item, Kind, M3UResult, PlayTarget, Profile, ProfileInput, RecInfo, Settings
} from '../../shared/types'
import { groupSeries } from '../../shared/m3u'
import { DEFAULT_SETTINGS } from '../../shared/types'

export type Tab = 'live' | 'vod' | 'series' | 'continue' | 'recordings' | 'settings'

export interface PlayState {
  target: PlayTarget
  itemId?: string
  url: string
  startAt: number
  overlay: boolean
  historyKey?: string
}

function parseInWorker(text: string): Promise<M3UResult> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./workers/m3u.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e) => {
      w.terminate()
      e.data.ok ? resolve(e.data.result) : reject(new Error(e.data.error))
    }
    w.onerror = (e) => {
      w.terminate()
      reject(new Error(e.message || 'Ayrıştırma hatası'))
    }
    w.postMessage({ text })
  })
}

const empty = (): Record<Kind, Item[]> => ({ live: [], vod: [], series: [] })
const flags = () => ({ live: false, vod: false, series: false })

interface S {
  ready: boolean
  profiles: Profile[]
  activeId?: string
  settings: Settings
  tab: Tab
  items: Record<Kind, Item[]>
  loaded: Record<Kind, boolean>
  loading: Record<Kind, boolean>
  error: string
  notice: string
  favs: string[]
  history: HistoryEntry[]
  visibleLive: Item[]
  playing?: PlayState
  playError: string
  mini: boolean
  recordings: RecInfo[]
  rec?: { id: string; url: string }

  init(): Promise<void>
  selectProfile(id: string): Promise<void>
  loadKind(kind: Kind, force?: boolean): Promise<void>
  setTab(t: Tab): void
  saveProfile(input: ProfileInput): Promise<void>
  deleteProfile(id: string): Promise<void>
  toggleFav(itemId: string): Promise<void>
  setVisibleLive(list: Item[]): void
  play(target: PlayTarget, opts?: { itemId?: string; startAt?: number; overlay?: boolean; historyKey?: string }): Promise<void>
  stop(): void
  step(delta: number): void
  saveProgress(pos: number, dur: number): void
  removeHistory(key: string): Promise<void>
  saveSettings(s: Partial<Settings>): Promise<void>
  setMini(on: boolean): Promise<void>
  refreshRecordings(): Promise<void>
  toggleRecord(): Promise<void>
}

export const useStore = create<S>((set, get) => ({
  ready: false, profiles: [], settings: DEFAULT_SETTINGS, tab: 'live',
  items: empty(), loaded: flags(), loading: flags(), error: '', notice: '',
  favs: [], history: [], visibleLive: [], playError: '', mini: false, recordings: [],

  async init() {
    const [profiles, settings] = await Promise.all([window.api.getProfiles(), window.api.getSettings()])
    set({ profiles, settings, ready: true })
    let last: string | null = null
    try { last = localStorage.getItem('lastProfile') } catch { /* yok say */ }
    const id = profiles.find((p) => p.id === last)?.id ?? profiles[0]?.id
    if (id) await get().selectProfile(id)
  },

  async selectProfile(id) {
    try { localStorage.setItem('lastProfile', id) } catch { /* yok say */ }
    get().stop()
    set({ activeId: id, items: empty(), loaded: flags(), loading: flags(), error: '', notice: '', tab: 'live', visibleLive: [] })
    const [favs, history] = await Promise.all([window.api.getFavorites(id), window.api.getHistory(id)])
    set({ favs, history })
    await get().loadKind('live')
  },

  async loadKind(kind, force = false) {
    const { activeId, profiles, loaded, loading } = get()
    const profile = profiles.find((p) => p.id === activeId)
    if (!profile) return
    // M3U profillerinde tek seferde üç tür birden ayrıştırılır
    if (profile.type === 'm3u') kind = 'live'
    if (!force && (loaded[kind] || loading[kind])) return
    set((s) => ({ loading: { ...s.loading, [kind]: true }, error: '' }))
    try {
      let items: Item[]
      let epgFallback: string | undefined
      if (profile.type === 'm3u') {
        const text = await window.api.getPlaylistText(profile.id)
        const r = await parseInWorker(text)
        epgFallback = r.epgUrl
        if (r.skipped > 0) set({ notice: `${r.skipped} bozuk satır atlandı.` })
        if (r.items.length === 0) throw new Error('Playlist içinde oynatılabilir kanal bulunamadı.')
        const live = r.items.filter((i) => i.kind === 'live')
        const vod = r.items.filter((i) => i.kind === 'vod')
        const series = groupSeries(r.items.filter((i) => i.kind === 'series'))
        if (get().activeId !== profile.id) return
        set({ items: { live, vod, series }, loaded: { live: true, vod: true, series: true } })
        items = live
      } else {
        items = await window.api.loadXtream(profile.id, kind)
      }
      if (get().activeId !== profile.id) return
      set((s) => ({ items: { ...s.items, [kind]: items }, loaded: { ...s.loaded, [kind]: true } }))
      if (kind === 'live') {
        window.api.loadEpg(profile.id, epgFallback).then((r) => {
          if (!r.ok && r.error && r.error !== 'EPG adresi yok') set({ notice: `EPG yüklenemedi: ${r.error}` })
        })
      }
    } catch (e) {
      set({ error: (e as Error).message })
    } finally {
      set((s) => ({ loading: { ...s.loading, [kind]: false } }))
    }
  },

  setTab(t) {
    const { playing, mini } = get()
    if (!mini && playing && !playing.overlay) get().stop()
    set({ tab: t })
    if (t === 'vod' || t === 'series') get().loadKind(t)
  },

  async saveProfile(input) {
    const saved = await window.api.saveProfile(input)
    const profiles = await window.api.getProfiles()
    set({ profiles })
    await get().selectProfile(saved.id)
  },

  async deleteProfile(id) {
    await window.api.deleteProfile(id)
    const profiles = await window.api.getProfiles()
    set({ profiles })
    if (get().activeId === id) {
      get().stop()
      set({ activeId: undefined, items: empty(), loaded: flags(), error: '' })
      if (profiles[0]) await get().selectProfile(profiles[0].id)
    }
  },

  async toggleFav(itemId) {
    const id = get().activeId
    if (!id) return
    set({ favs: await window.api.toggleFavorite(id, itemId) })
  },

  setVisibleLive(list) { set({ visibleLive: list }) },

  async play(target, opts = {}) {
    const id = get().activeId
    if (!id) return
    set({ playError: '' })
    try {
      const url = await window.api.resolveUrl(id, target)
      set({
        playing: {
          target, url, itemId: opts.itemId, startAt: opts.startAt ?? 0,
          overlay: opts.overlay ?? target.kind !== 'live', historyKey: opts.historyKey
        }
      })
    } catch (e) {
      set({ playError: (e as Error).message })
    }
  },

  stop() {
    if (get().mini) get().setMini(false)
    set({ playing: undefined })
  },

  step(delta) {
    const { playing, visibleLive } = get()
    if (!playing || playing.target.kind !== 'live' || visibleLive.length === 0) return
    const i = visibleLive.findIndex((x) => x.id === playing.itemId)
    const next = visibleLive[(i + delta + visibleLive.length) % visibleLive.length]
    if (!next) return
    get().play(
      { title: next.name, logo: next.logo, kind: 'live', url: next.url, tvgId: next.tvgId,
        xtream: next.streamId ? { type: 'live', id: next.streamId } : undefined },
      { itemId: next.id, overlay: false }
    )
  },

  saveProgress(pos, dur) {
    const { playing, activeId } = get()
    if (!playing?.historyKey || !activeId || !Number.isFinite(dur) || dur < 60) return
    if (pos > dur * 0.95) { get().removeHistory(playing.historyKey); return }
    if (pos < 10) return
    const entry: HistoryEntry = {
      key: playing.historyKey, profileId: activeId, target: playing.target,
      position: pos, duration: dur, updated: Date.now()
    }
    window.api.saveHistory(entry).then(async () => {
      set({ history: await window.api.getHistory(activeId) })
    })
  },

  async removeHistory(key) {
    const id = get().activeId
    await window.api.removeHistory(key)
    if (id) set({ history: await window.api.getHistory(id) })
  },

  async saveSettings(s) { set({ settings: await window.api.setSettings(s) }) },

  async setMini(on) {
    set({ mini: on })
    await window.api.setMini(on)
  },

  async refreshRecordings() {
    set({ recordings: await window.api.listRecordings() })
  },

  async toggleRecord() {
    const { playing, rec, recordings } = get()
    if (!playing || playing.target.kind !== 'live') return
    const active = rec && rec.url === playing.url && recordings.find((r) => r.id === rec.id)?.status === 'recording'
    try {
      if (active) await window.api.stopRecording(rec!.id)
      else {
        const { id } = await window.api.startRecording(playing.url, playing.target.title)
        set({ rec: { id, url: playing.url } })
      }
    } catch (e) {
      set({ playError: (e as Error).message })
    }
    await get().refreshRecordings()
  }
}))
