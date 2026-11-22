import { create } from 'zustand'
import type {
  HistoryEntry, Item, Kind, M3UResult, PlayTarget, Profile, ProfileInput, RecInfo, Schedule, Settings
} from '../../shared/types'
import { groupSeries } from '../../shared/m3u'
import { liveTarget } from './target'
import { DEFAULT_SETTINGS } from '../../shared/types'

export type Tab = 'live' | 'vod' | 'series' | 'epg' | 'continue' | 'recordings' | 'downloads' | 'diagnostics' | 'settings'

export interface DiagEntry {
  title: string
  mode: string
  plays: number
  stalls: number
  retries: number
  errors: number
  dropped: number
  lastError?: string
  updated: number
}
export interface DiagEvent {
  type: 'start' | 'stall' | 'retry' | 'error' | 'drops'
  mode?: string
  info?: string
  value?: number
}

const cleanErr = (e: unknown) => (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
export const NO_GROUPS: string[] = []

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
  /** Oynatılan adres -> kayıt kimliği */
  recMap: Record<string, string>
  schedules: Schedule[]
  pinSet: boolean
  locks: string[]
  unlocked: boolean
  diag: Record<string, DiagEntry>
  recDialog?: PlayTarget

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
  startRecord(minutes: number, target?: PlayTarget): Promise<void>
  setRecDialog(t?: PlayTarget): void
  refreshSchedules(): Promise<void>
  schedule(target: PlayTarget, startAt: number, minutes: number): Promise<void>
  removeSchedule(id: string): Promise<void>
  loadPin(): Promise<void>
  unlock(pin: string): Promise<boolean>
  lock(): void
  playLocal(r: RecInfo): void
  recordDiag(title: string, e: DiagEvent): void
  clearDiag(): void
  stopRecord(): Promise<void>
  isRecording(url: string): boolean
}

export const useStore = create<S>((set, get) => ({
  ready: false, profiles: [], settings: DEFAULT_SETTINGS, tab: 'live',
  items: empty(), loaded: flags(), loading: flags(), error: '', notice: '',
  favs: [], history: [], visibleLive: [], playError: '', mini: false, recordings: [], recMap: {},
  schedules: [], pinSet: false, locks: [], unlocked: false, diag: {},

  async init() {
    const [profiles, settings] = await Promise.all([window.api.getProfiles(), window.api.getSettings()])
    let diag: Record<string, DiagEntry> = {}
    try {
      for (const d of JSON.parse(localStorage.getItem('diag') || '[]') as DiagEntry[]) diag[d.title] = d
    } catch { diag = {} }
    set({ profiles, settings, ready: true, diag })
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
    await get().loadPin()
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
      const st = get().settings
      if (st.playerMode === 'external' && st.externalPlayer) {
        const r = await window.api.openExternal(url)
        if (!r.ok) set({ playError: r.error ?? 'Harici oynatıcı açılamadı' })
        return
      }
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
    get().play(liveTarget(next), { itemId: next.id, overlay: playing.overlay })
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
    const r = await window.api.listRecordings()
    if (JSON.stringify(r) !== JSON.stringify(get().recordings)) set({ recordings: r })
  },

  async startRecord(minutes, target) {
    const { playing, activeId } = get()
    const t = target ?? playing?.target
    if (!t || t.kind !== 'live' || !activeId) return
    try {
      const url = playing && t === playing.target ? playing.url : await window.api.resolveUrl(activeId, t)
      const { id } = await window.api.startRecording(url, t.title, minutes)
      set((s) => ({ recMap: { ...s.recMap, [url]: id } }))
    } catch (e) {
      alert(cleanErr(e))
    }
    await get().refreshRecordings()
  },

  setRecDialog(t) { set({ recDialog: t }) },

  async refreshSchedules() {
    const r = await window.api.listSchedules()
    if (JSON.stringify(r) !== JSON.stringify(get().schedules)) set({ schedules: r })
  },

  async schedule(target, startAt, minutes) {
    const { activeId } = get()
    if (!activeId) return
    try {
      await window.api.addSchedule(activeId, target, target.title, startAt, minutes)
    } catch (e) {
      alert(cleanErr(e))
    }
    await get().refreshSchedules()
  },

  async removeSchedule(id) {
    await window.api.removeSchedule(id)
    await get().refreshSchedules()
  },

  async loadPin() {
    const id = get().activeId
    const [pinSet, locks] = await Promise.all([window.api.pinStatus(), id ? window.api.getLocks(id) : Promise.resolve([])])
    set({ pinSet, locks })
  },

  async unlock(pin) {
    const ok = await window.api.verifyPin(pin)
    if (ok) set({ unlocked: true })
    return ok
  },

  lock() { set({ unlocked: false }) },

  playLocal(r) {
    const ext = (/\.([a-z0-9]+)$/i.exec(r.file)?.[1] ?? 'mp4').toLowerCase()
    const url = `iptvfile://rec/${r.id}.${ext}`
    set({ playing: { target: { title: r.title, kind: 'vod', url }, url, startAt: 0, overlay: true } })
  },

  recordDiag(title, e) {
    set((s) => {
      const cur: DiagEntry = s.diag[title] ?? { title, mode: '', plays: 0, stalls: 0, retries: 0, errors: 0, dropped: 0, updated: 0 }
      const n: DiagEntry = { ...cur, updated: Date.now() }
      if (e.type === 'start') { n.plays++; n.mode = e.mode ?? n.mode }
      else if (e.type === 'stall') n.stalls++
      else if (e.type === 'retry') n.retries++
      else if (e.type === 'error') { n.errors++; n.lastError = e.info }
      else if (e.type === 'drops') n.dropped = Math.max(n.dropped, e.value ?? 0)
      const diag = { ...s.diag, [title]: n }
      try { localStorage.setItem('diag', JSON.stringify(Object.values(diag).slice(-300))) } catch { /* yok say */ }
      return { diag }
    })
  },

  clearDiag() {
    try { localStorage.removeItem('diag') } catch { /* yok say */ }
    set({ diag: {} })
  },

  async stopRecord() {
    const { playing, recMap } = get()
    const id = playing && recMap[playing.url]
    if (id) await window.api.stopRecording(id)
    await get().refreshRecordings()
  },

  isRecording(url) {
    const { recMap, recordings } = get()
    const id = recMap[url]
    return !!id && recordings.find((r) => r.id === id)?.status === 'recording'
  }
}))
