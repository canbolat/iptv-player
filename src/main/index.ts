import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron'
import { unlink } from 'fs/promises'
import { spawn } from 'child_process'
import { readFileSync } from 'fs'
import { basename, join } from 'path'
import { randomUUID } from 'crypto'
import {
  encryptSecret, findProfile, getSettings, publicProfile, store
} from './store'
import type { StoredProfile } from './store'
import { fetchText } from './net'
import { loadXtream, resolveStreamUrl, xtreamDetail, xtreamEpgUrl } from './xtream'
import { clearEpgCache, loadEpg, nowNext } from './epg'
import {
  activeCount, downloadDir, findRecording, forgetRecording, listRecordings, recordDir,
  startDownload, startRecording, stopAll, stopRecording
} from './recorder'
import { clearStalkerSession, loadStalker, stalkerLink } from './stalker'
import { isValidMac, normalizeMac } from '../shared/stalker'
import type { HistoryEntry, Kind, PlayTarget, ProfileInput, Settings } from '../shared/types'

// Donanım hızlandırma ayarı uygulama hazır olmadan uygulanmalı
if (!getSettings().hwAccel) app.disableHardwareAcceleration()

const DEV_URL = process.env['ELECTRON_RENDERER_URL']
let win: BrowserWindow | null = null
let savedBounds: Electron.Rectangle | null = null
let quitting = false

function createWindow() {
  win = new BrowserWindow({
    width: 1360, height: 840, minWidth: 900, minHeight: 560,
    backgroundColor: '#0b0d12', autoHideMenuBar: true, title: 'IPTV Player',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      autoplayPolicy: 'no-user-gesture-required'
    }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (!DEV_URL || !url.startsWith(DEV_URL)) e.preventDefault()
  })
  win.on('close', (e) => {
    if (quitting || activeCount() === 0) return
    const choice = dialog.showMessageBoxSync(win!, {
      type: 'question', title: 'Aktif kayıt veya indirme var',
      message: `${activeCount()} kayıt/indirme sürüyor.`,
      detail: 'Çıkarsanız durdurulur. Küçültürseniz arka planda devam eder.',
      buttons: ['Küçült (arka planda sürsün)', 'Çık ve durdur', 'Vazgeç'], defaultId: 0, cancelId: 2
    })
    if (choice === 0) { e.preventDefault(); win!.minimize() }
    else if (choice === 2) e.preventDefault()
  })
  if (DEV_URL) win.loadURL(DEV_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

function isRemote(url: string) {
  if (!/^https?:/i.test(url)) return false
  if (DEV_URL && url.startsWith(DEV_URL)) return false
  return true
}

function setupSession() {
  const ses = session.defaultSession
  const types = new Set(['xhr', 'media', 'other'])

  // Yayın istekleri için User-Agent (yalnızca uzak xhr/media istekleri)
  ses.webRequest.onBeforeSendHeaders((d, cb) => {
    const h = d.requestHeaders
    if (isRemote(d.url) && types.has(d.resourceType)) h['User-Agent'] = getSettings().userAgent
    cb({ requestHeaders: h })
  })

  // Uzak yayın sunucuları CORS başlığı göndermediğinde oynatıcının çalışması için
  ses.webRequest.onHeadersReceived((d, cb) => {
    const headers = d.responseHeaders ?? {}
    let statusLine = d.statusLine
    if (isRemote(d.url) && types.has(d.resourceType)) {
      for (const k of Object.keys(headers)) if (k.toLowerCase().startsWith('access-control-allow-')) delete headers[k]
      headers['Access-Control-Allow-Origin'] = ['*']
      headers['Access-Control-Allow-Headers'] = ['*']
      headers['Access-Control-Allow-Methods'] = ['GET, HEAD, OPTIONS']
      if (d.method === 'OPTIONS') statusLine = 'HTTP/1.1 200 OK'
    }
    // Üretimde sıkı CSP
    if (app.isPackaged && d.resourceType === 'mainFrame') {
      headers['Content-Security-Policy'] = [
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "img-src * data: blob:; media-src * blob:; connect-src *; worker-src 'self' blob:; " +
        "object-src 'none'; base-uri 'none'"
      ]
    }
    cb({ responseHeaders: headers, statusLine })
  })
}

const handle = <A extends unknown[], R>(ch: string, fn: (...a: A) => R | Promise<R>) =>
  ipcMain.handle(ch, (_e, ...args) => fn(...(args as A)))

function resolveTarget(profileId: string, t: PlayTarget): Promise<string> | string {
  if (t.stalker) return stalkerLink(findProfile(profileId), t.stalker)
  return resolveStreamUrl(profileId, t, getSettings().liveExt)
}

const isStr = (x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length < 4096

function setupIpc() {
  handle('profiles:get', () => store.get('profiles').map(publicProfile))

  handle('profiles:save', (input: ProfileInput) => {
    if (!input || !isStr(input.name) || !['m3u', 'xtream', 'stalker'].includes(input.type)) throw new Error('Geçersiz profil')
    const list = store.get('profiles')
    const existing = input.id ? list.find((p) => p.id === input.id) : undefined
    const p: StoredProfile = {
      id: existing?.id ?? randomUUID(),
      name: input.name.trim(), type: input.type,
      url: input.url?.trim() || undefined, path: input.path || undefined,
      epgUrl: input.epgUrl?.trim() || undefined,
      server: input.server?.trim() || undefined, username: input.username?.trim() || undefined,
      mac: input.mac ? normalizeMac(input.mac) : existing?.mac,
      passwordEnc: input.password ? encryptSecret(input.password) : existing?.passwordEnc
    }
    if (p.type === 'm3u' && !p.url && !p.path) throw new Error('M3U adresi veya dosyası gerekli')
    if (p.type === 'stalker' && (!p.server || !p.mac || !isValidMac(p.mac))) throw new Error('Portal adresi ve geçerli bir MAC adresi (00:1A:79:XX:XX:XX) gerekli')
    if (p.type === 'xtream' && (!p.server || !p.username || !p.passwordEnc)) throw new Error('Sunucu, kullanıcı adı ve şifre gerekli')
    clearStalkerSession(p.id)
    store.set('profiles', existing ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p])
    return publicProfile(p)
  })

  handle('profiles:delete', (id: string) => {
    store.set('profiles', store.get('profiles').filter((p) => p.id !== id))
    const fav = store.get('favorites'); delete fav[id]; store.set('favorites', fav)
    store.set('history', store.get('history').filter((h) => h.profileId !== id))
  })

  handle('dialog:m3u', async () => {
    const r = await dialog.showOpenDialog(win!, {
      title: 'Playlist seç', properties: ['openFile'],
      filters: [{ name: 'Playlist', extensions: ['m3u', 'm3u8'] }, { name: 'Tümü', extensions: ['*'] }]
    })
    if (r.canceled || !r.filePaths[0]) return null
    return { path: r.filePaths[0], name: basename(r.filePaths[0]) }
  })

  handle('playlist:text', async (profileId: string) => {
    const p = findProfile(profileId)
    if (p.path) return readFileSync(p.path, 'utf8')
    if (p.url) return fetchText(p.url)
    throw new Error('Bu profilde playlist kaynağı yok')
  })

  handle('xtream:load', (profileId: string, kind: Kind) => {
    const p = findProfile(profileId)
    return p.type === 'stalker' ? loadStalker(p, kind) : loadXtream(profileId, kind)
  })
  handle('xtream:detail', (profileId: string, kind: 'vod' | 'series', id: number) => xtreamDetail(profileId, kind, id))
  handle('stream:resolve', (profileId: string, t: PlayTarget) => resolveTarget(profileId, t))

  handle('epg:load', (profileId: string, fallbackUrl?: string) => {
    const p = findProfile(profileId)
    const url = p.epgUrl || (p.type === 'xtream' ? xtreamEpgUrl(p) : fallbackUrl)
    if (!url) return { ok: false, channels: 0, error: 'EPG adresi yok' }
    return loadEpg(url)
  })
  handle('epg:now', (tvgId: string) => nowNext(String(tvgId)))

  handle('settings:get', () => getSettings())
  handle('settings:set', (s: Partial<Settings>) => {
    const next = { ...getSettings(), ...s }
    store.set('settings', next)
    return next
  })

  handle('fav:get', (pid: string) => store.get('favorites')[pid] ?? [])
  handle('fav:toggle', (pid: string, itemId: string) => {
    const all = store.get('favorites')
    const cur = new Set(all[pid] ?? [])
    cur.has(itemId) ? cur.delete(itemId) : cur.add(itemId)
    all[pid] = [...cur]
    store.set('favorites', all)
    return all[pid]
  })

  handle('history:get', (pid: string) =>
    store.get('history').filter((h) => h.profileId === pid).sort((a, b) => b.updated - a.updated))
  handle('history:save', (e: HistoryEntry) => {
    const rest = store.get('history').filter((h) => h.key !== e.key)
    store.set('history', [e, ...rest].slice(0, 200))
  })
  handle('history:remove', (key: string) => store.set('history', store.get('history').filter((h) => h.key !== key)))

  handle('cache:clear', async () => {
    clearEpgCache()
    await session.defaultSession.clearCache()
  })

  handle('window:mini', (on: boolean) => {
    if (!win) return
    if (on) {
      savedBounds = win.getBounds()
      win.setMinimumSize(320, 200)
      win.setAlwaysOnTop(true, 'screen-saver')
      win.setSize(480, 290)
    } else {
      win.setAlwaysOnTop(false)
      win.setMinimumSize(900, 560)
      if (savedBounds) win.setBounds(savedBounds)
    }
  })

  handle('player:external', (url: string) => {
    const exe = getSettings().externalPlayer
    if (!exe) return { ok: false, error: 'Ayarlar sayfasından harici oynatıcı yolunu (mpv.exe / vlc.exe) belirtin.' }
    if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'Geçersiz adres' }
    try {
      const args = getSettings().externalArgs.split(/\s+/).filter(Boolean)
      spawn(exe, [...args, url], { detached: true, stdio: 'ignore' }).unref()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })

  handle('record:start', (url: string, title: string, minutes?: number) => {
    if (!isStr(url) || !isStr(title)) throw new Error('Geçersiz kayıt isteği')
    const m = Number.isFinite(minutes) ? Math.min(Math.max(Math.floor(minutes!), 0), 24 * 60) : 0
    return startRecording(url, title, m)
  })
  handle('download:start', (profileId: string, target: PlayTarget, title: string, subdir?: string[]) => {
    if (!isStr(profileId) || !isStr(title) || !target) throw new Error('Geçersiz indirme isteği')
    findProfile(profileId)
    const sub = Array.isArray(subdir) ? subdir.filter(isStr).slice(0, 4) : undefined
    return startDownload(async () => resolveTarget(profileId, target), title, sub)
  })
  handle('record:stop', (id: string) => stopRecording(String(id)))
  handle('record:list', () => listRecordings())
  handle('record:open', async (id: string) => {
    const r = findRecording(String(id))
    if (!r) return { ok: false, error: 'Kayıt bulunamadı' }
    const err = await shell.openPath(r.file)
    return err ? { ok: false, error: err } : { ok: true }
  })
  handle('record:folder', async (id?: string, kind?: 'record' | 'download') => {
    const r = id ? findRecording(String(id)) : undefined
    if (r) shell.showItemInFolder(r.file)
    else shell.openPath(kind === 'download' ? downloadDir() : recordDir())
  })
  handle('record:delete', async (id: string) => {
    const r = findRecording(String(id))
    if (!r) return
    stopRecording(r.id)
    await new Promise((res) => setTimeout(res, 300))
    try { await unlink(r.file) } catch { /* dosya yok say */ }
    forgetRecording(r.id)
  })
  handle('dialog:folder', async () => {
    const r = await dialog.showOpenDialog(win!, { title: 'Kayıt klasörü seç', properties: ['openDirectory', 'createDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })

  handle('app:relaunch', () => { app.relaunch(); app.exit(0) })
}

app.whenReady().then(() => {
  setupSession()
  setupIpc()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('before-quit', () => { quitting = true; stopAll() })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

// Harici bağlantıları sistem tarayıcısında aç (yalnızca https)
app.on('web-contents-created', (_e, wc) => {
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
})
