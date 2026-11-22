import { app } from 'electron'
import { ChildProcess, spawn } from 'child_process'
import http from 'http'
import type { AddressInfo } from 'net'
import { randomBytes } from 'crypto'
import ffmpegPath from 'ffmpeg-static'
import { buildFfmpegArgs } from '../shared/ffmpeg'
import { getSettings } from './store'

interface Session {
  id: string
  url: string
  video: 'copy' | 'transcode'
  pre: number
  proc?: ChildProcess
  lastErr?: string
}

const sessions = new Map<string, Session>()
let server: http.Server | null = null
let port = 0

function binPath(): string {
  const p = (ffmpegPath as unknown as string) || ''
  return app.isPackaged ? p.replace('app.asar', 'app.asar.unpacked') : p
}

function onRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const m = /^\/s\/([a-f0-9]+)\.mp4/.exec(req.url || '')
  const s = m ? sessions.get(m[1]) : undefined
  if (!s) { res.writeHead(404); res.end(); return }

  s.proc?.kill() // oturum başına tek ffmpeg (sağlayıcıya ikinci bağlantı açma)
  const proc = spawn(binPath(), buildFfmpegArgs(s.url, getSettings().userAgent, s.video), {
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
  })
  s.proc = proc

  res.writeHead(200, {
    'Content-Type': 'video/mp4', 'Cache-Control': 'no-store', 'Accept-Ranges': 'none', 'Access-Control-Allow-Origin': '*'
  })
  res.flushHeaders()

  // Başlangıçta `pre` saniye veri biriktirip toplu gönderir: tarayıcı o kadar tamponla başlar
  const chunks: Buffer[] = []
  let released = false
  let timer: ReturnType<typeof setTimeout> | null = null
  const release = () => {
    if (released) return
    released = true
    if (timer) clearTimeout(timer)
    for (const c of chunks) res.write(c)
    chunks.length = 0
  }

  proc.stdout!.on('data', (c: Buffer) => {
    if (!released) {
      chunks.push(c)
      if (!timer) timer = setTimeout(release, s.pre * 1000)
      if (s.pre <= 0) release()
      return
    }
    if (!res.write(c)) {
      proc.stdout!.pause()
      res.once('drain', () => proc.stdout!.resume())
    }
  })
  proc.stderr!.on('data', (d: Buffer) => { s.lastErr = (s.lastErr + d.toString()).slice(-1500) })
  proc.on('error', (e) => { s.lastErr = e.message; res.end() })
  proc.on('close', () => { release(); res.end() })
  res.on('close', () => { proc.kill() })
}

function ensureServer(): Promise<number> {
  if (server && port) return Promise.resolve(port)
  return new Promise((resolve, reject) => {
    server = http.createServer(onRequest)
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      port = (server!.address() as AddressInfo).port
      resolve(port)
    })
  })
}

export async function startProxy(url: string, video: 'copy' | 'transcode', preSec: number) {
  if (!/^https?:\/\//i.test(url)) throw new Error('Geçersiz yayın adresi')
  const id = randomBytes(12).toString('hex')
  sessions.set(id, { id, url, video, pre: Math.min(Math.max(Number(preSec) || 0, 0), 15), lastErr: '' })
  const p = await ensureServer()
  return { id, url: `http://127.0.0.1:${p}/s/${id}.mp4` }
}

export function stopProxy(id: string) {
  const s = sessions.get(id)
  s?.proc?.kill()
  sessions.delete(id)
}

export function stopAllProxies() {
  for (const id of [...sessions.keys()]) stopProxy(id)
  server?.close()
  server = null
  port = 0
}
