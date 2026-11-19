import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron'
import { TRAY_ICON } from './trayIcon'

let tray: Tray | null = null

export function appIcon() {
  return nativeImage.createFromDataURL(TRAY_ICON)
}

export function hideToTray(win: BrowserWindow, quit: () => void) {
  if (!tray) {
    tray = new Tray(appIcon())
    tray.setToolTip('IPTV Player')
    const show = () => { win.show(); win.focus() }
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Göster', click: show },
      { label: 'Çık', click: quit }
    ]))
    tray.on('click', show)
  }
  win.hide()
}

export function destroyTray() {
  tray?.destroy()
  tray = null
}

export const isDev = !app.isPackaged
