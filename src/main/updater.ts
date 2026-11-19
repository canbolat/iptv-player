import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '../shared/types'

let status: UpdateStatus = { state: 'idle' }
let getWin: () => BrowserWindow | null = () => null
let beforeInstall: () => void = () => {}

function push(s: UpdateStatus) {
  status = s
  getWin()?.webContents.send('update:status', s)
}

export function initUpdater(win: () => BrowserWindow | null, onBeforeInstall: () => void) {
  getWin = win
  beforeInstall = onBeforeInstall
  if (!app.isPackaged) { status = { state: 'dev' }; return }
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => push({ state: 'checking' }))
  autoUpdater.on('update-available', (i) => push({ state: 'available', version: i.version }))
  autoUpdater.on('update-not-available', () => push({ state: 'none' }))
  autoUpdater.on('download-progress', (p) => push({ state: 'downloading', percent: Math.round(p.percent), version: status.version }))
  autoUpdater.on('update-downloaded', (i) => push({ state: 'ready', version: i.version }))
  autoUpdater.on('error', (e) => push({ state: 'error', message: e?.message ?? 'Bilinmeyen hata' }))
}

export const getUpdateStatus = () => status

export async function checkUpdate(): Promise<UpdateStatus> {
  if (!app.isPackaged) return { state: 'dev' }
  try { await autoUpdater.checkForUpdates() } catch (e) { push({ state: 'error', message: (e as Error).message }) }
  return status
}

export async function downloadUpdate() {
  if (!app.isPackaged) return
  try { await autoUpdater.downloadUpdate() } catch (e) { push({ state: 'error', message: (e as Error).message }) }
}

export function installUpdate() {
  if (!app.isPackaged) return
  beforeInstall()
  autoUpdater.quitAndInstall()
}
