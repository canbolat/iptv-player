import { ReactNode, useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import mpegts from 'mpegts.js'

interface Props {
  url: string
  title: string
  live: boolean
  startAt?: number
  mini: boolean
  header?: ReactNode
  onClose(): void
  onStep(delta: number): void
  onToggleMini(): void
  onExternal(): void
  onProgress?(pos: number, dur: number): void
}

type Status = 'loading' | 'playing' | 'error'
type Mode = 'hls' | 'ts' | 'native'

const MAX_RETRY = 5
const fmt = (s: number) => {
  if (!Number.isFinite(s)) return '--:--'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60)
  const mm = String(m).padStart(h ? 2 : 1, '0'), ss = String(sec).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export default function Player(props: Props) {
  const { url, title, live, startAt = 0, mini, header } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const tsRef = useRef<any>(null)
  const modeRef = useRef<Mode>('native')
  const retry = useRef(0)
  const attempt = useRef(0)
  const timer = useRef(0)
  const startRef = useRef<() => void>(() => {})
  const propsRef = useRef(props)
  propsRef.current = props
  const lastSave = useRef(0)

  const [status, setStatus] = useState<Status>('loading')
  const [msg, setMsg] = useState('')
  const [paused, setPaused] = useState(false)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [levels, setLevels] = useState<{ i: number; h: number; b: number }[]>([])
  const [level, setLevel] = useState(-1)
  const [audio, setAudio] = useState<string[]>([])
  const [audioIdx, setAudioIdx] = useState(0)
  const [subs, setSubs] = useState<string[]>([])
  const [subIdx, setSubIdx] = useState(-1)
  const [badge, setBadge] = useState('')
  const [showUi, setShowUi] = useState(true)
  const idleTimer = useRef(0)

  const teardown = () => {
    hlsRef.current?.destroy(); hlsRef.current = null
    if (tsRef.current) { try { tsRef.current.destroy() } catch { /* yok say */ } tsRef.current = null }
    const v = videoRef.current
    if (v) { v.removeAttribute('src'); v.load() }
  }

  const scheduleRetry = () => {
    if (timer.current) return
    if (retry.current >= MAX_RETRY) {
      setStatus('error')
      setMsg('Yayın açılamadı. Bağlantı, hesap durumu veya biçim sorunu olabilir.')
      return
    }
    retry.current += 1
    attempt.current += 1
    setStatus('loading')
    setMsg(`Yeniden bağlanılıyor (${retry.current}/${MAX_RETRY})…`)
    timer.current = window.setTimeout(() => { timer.current = 0; startRef.current() }, Math.min(1000 * 2 ** retry.current, 15000))
  }

  const start = () => {
    const v = videoRef.current
    if (!v) return
    teardown()
    setStatus('loading')
    if (retry.current === 0) setMsg('')
    setLevels([]); setAudio([]); setSubs([]); setLevel(-1); setSubIdx(-1)

    const clean = url.split('?')[0].toLowerCase()
    let mode: Mode
    if (clean.endsWith('.m3u8')) mode = 'hls'
    else if (clean.endsWith('.ts')) mode = 'ts'
    else if (live && !/\.(mp4|mkv|avi|webm|mov|m4v)$/.test(clean)) mode = attempt.current % 2 === 0 ? 'ts' : 'hls'
    else mode = 'native'
    if (mode === 'hls' && !Hls.isSupported()) mode = 'native'
    if (mode === 'ts' && !mpegts.isSupported()) mode = 'native'
    modeRef.current = mode

    if (mode === 'hls') {
      const hls = new Hls({ enableWorker: true, maxBufferLength: 30 })
      hlsRef.current = hls
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, d) => {
        setLevels(d.levels.map((l, i) => ({ i, h: l.height, b: l.bitrate })))
        v.play().catch(() => {})
      })
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () =>
        setAudio(hls.audioTracks.map((t, i) => t.name || t.lang || `Ses ${i + 1}`)))
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () =>
        setSubs(hls.subtitleTracks.map((t, i) => t.name || t.lang || `Altyazı ${i + 1}`)))
      hls.on(Hls.Events.ERROR, (_e, d) => {
        if (!d.fatal) return
        if (d.type === Hls.ErrorTypes.MEDIA_ERROR && retry.current === 0) { hls.recoverMediaError(); retry.current = 1; return }
        scheduleRetry()
      })
      hls.loadSource(url)
      hls.attachMedia(v)
    } else if (mode === 'ts') {
      const p = mpegts.createPlayer(
        { type: 'mpegts', isLive: live, url },
        { enableWorker: false, liveBufferLatencyChasing: live, lazyLoad: false }
      )
      tsRef.current = p
      p.on(mpegts.Events.ERROR, () => scheduleRetry())
      p.attachMediaElement(v)
      p.load()
      Promise.resolve(p.play()).catch(() => {})
    } else {
      v.src = url
      v.play().catch(() => {})
    }
  }
  startRef.current = start

  // Kaynak değişince baştan kur
  useEffect(() => {
    retry.current = 0
    attempt.current = 0
    if (timer.current) { clearTimeout(timer.current); timer.current = 0 }
    setTime(0); setDuration(0)
    start()
    return () => {
      if (timer.current) { clearTimeout(timer.current); timer.current = 0 }
      teardown()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  // Takılma bekçisi + istatistik rozeti
  useEffect(() => {
    let lastT = -1, same = 0, lastFrames = 0
    const id = window.setInterval(() => {
      const v = videoRef.current
      if (!v) return
      if (live && !v.paused && !timer.current) {
        if (v.currentTime === lastT) same++ ; else same = 0
        lastT = v.currentTime
        if (same >= 5) { same = 0; scheduleRetry() }
      }
      const q = v.getVideoPlaybackQuality?.()
      const fps = q ? Math.max(0, q.totalVideoFrames - lastFrames) : 0
      if (q) lastFrames = q.totalVideoFrames
      let codec = ''
      const hls = hlsRef.current
      if (hls && hls.currentLevel >= 0) codec = (hls.levels[hls.currentLevel]?.videoCodec || '').split('.')[0]
      const mi = tsRef.current?.mediaInfo
      if (mi?.videoCodec) codec = String(mi.videoCodec).split('.')[0]
      setBadge(v.videoWidth ? `${v.videoHeight}p · ${fps} FPS${codec ? ' · ' + codec.toUpperCase() : ''}` : '')
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, url])

  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else containerRef.current?.requestFullscreen()
  }
  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    v.paused ? v.play().catch(() => {}) : v.pause()
  }
  const toggleMute = () => { const v = videoRef.current; if (v) v.muted = !v.muted }

  // Klavye kısayolları
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && (t as HTMLInputElement).type !== 'range') return
      const p = propsRef.current
      const v = videoRef.current
      switch (e.key) {
        case ' ': e.preventDefault(); togglePlay(); break
        case 'f': case 'F': toggleFs(); break
        case 'm': case 'M': toggleMute(); break
        case 'ArrowUp': e.preventDefault(); if (p.live) p.onStep(-1); break
        case 'ArrowDown': e.preventDefault(); if (p.live) p.onStep(1); break
        case 'ArrowLeft': if (!p.live && v) { e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 10) } break
        case 'ArrowRight': if (!p.live && v) { e.preventDefault(); v.currentTime += 10 } break
        case 'Escape': if (p.mini) p.onToggleMini(); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const poke = () => {
    setShowUi(true)
    clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(() => setShowUi(false), 3000)
  }
  useEffect(() => { poke(); return () => clearTimeout(idleTimer.current) }, [])

  const ui = showUi || paused || status === 'error'

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-black overflow-hidden ${ui ? '' : 'cursor-none'}`}
      onMouseMove={poke}
      onDoubleClick={toggleFs}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        onClick={togglePlay}
        onPlaying={() => { setStatus('playing'); setMsg(''); retry.current = 0 }}
        onWaiting={() => setStatus((s) => (s === 'error' ? s : 'loading'))}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onVolumeChange={(e) => { setVolume(e.currentTarget.volume); setMuted(e.currentTarget.muted) }}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration)
          if (!live && startAt > 0) e.currentTarget.currentTime = startAt
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget
          setTime(v.currentTime)
          if (!live && propsRef.current.onProgress && Date.now() - lastSave.current > 5000) {
            lastSave.current = Date.now()
            propsRef.current.onProgress(v.currentTime, v.duration)
          }
        }}
        onError={() => {
          if (modeRef.current === 'native') {
            setStatus('error')
            setMsg('Bu biçim veya codec yerleşik oynatıcıda desteklenmiyor (MKV, HEVC ve AC3 ses sık görülen nedenlerdir). Harici oynatıcıyı deneyin.')
          } else scheduleRetry()
        }}
      />

      {/* Üst çubuk */}
      <div className={`absolute top-0 inset-x-0 p-3 bg-gradient-to-b from-black/80 to-transparent transition-opacity ${ui ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex items-center gap-3">
          {(!live || mini) && (
            <button className="btn" onClick={props.onClose} title="Kapat">✕</button>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{title}</div>
            {header}
          </div>
          {badge && <span className="px-2 py-0.5 rounded bg-white/15 text-xs whitespace-nowrap">{badge}</span>}
        </div>
      </div>

      {/* Yükleniyor / hata */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-accent animate-spin" />
          {msg && <div className="text-sm text-slate-300">{msg}</div>}
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center bg-black/70">
          <div className="text-lg font-medium">Oynatılamadı</div>
          <div className="max-w-md text-sm text-slate-300">{msg}</div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => { retry.current = 0; attempt.current = 0; start() }}>Tekrar Dene</button>
            <button className="btn" onClick={props.onExternal}>Harici oynatıcıda aç</button>
          </div>
        </div>
      )}

      {/* Alt kontrol çubuğu */}
      <div className={`absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/85 to-transparent transition-opacity ${ui ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {!live && (
          <div className="flex items-center gap-2 mb-2 text-xs">
            <span className="w-14 text-right tabular-nums">{fmt(time)}</span>
            <input
              type="range" className="flex-1 accent-indigo-500" min={0} max={duration || 0} step={1} value={time}
              onChange={(e) => { if (videoRef.current) videoRef.current.currentTime = Number(e.target.value) }}
            />
            <span className="w-14 tabular-nums">{fmt(duration)}</span>
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn" onClick={togglePlay} title="Oynat/Duraklat (Boşluk)">{paused ? '▶' : '⏸'}</button>
          <button className="btn" onClick={toggleMute} title="Sessiz (M)">{muted || volume === 0 ? '🔇' : '🔊'}</button>
          <input
            type="range" className="w-24 accent-indigo-500" min={0} max={1} step={0.05} value={muted ? 0 : volume}
            onChange={(e) => { const v = videoRef.current; if (v) { v.muted = false; v.volume = Number(e.target.value) } }}
          />
          <div className="flex-1" />
          {levels.length > 1 && (
            <select className="field !w-auto !py-1" value={level}
              onChange={(e) => { const i = Number(e.target.value); setLevel(i); if (hlsRef.current) hlsRef.current.currentLevel = i }}>
              <option value={-1}>Otomatik kalite</option>
              {levels.map((l) => <option key={l.i} value={l.i}>{l.h ? `${l.h}p` : `${Math.round(l.b / 1000)} kbps`}</option>)}
            </select>
          )}
          {audio.length > 1 && (
            <select className="field !w-auto !py-1" value={audioIdx}
              onChange={(e) => { const i = Number(e.target.value); setAudioIdx(i); if (hlsRef.current) hlsRef.current.audioTrack = i }}>
              {audio.map((a, i) => <option key={i} value={i}>🔈 {a}</option>)}
            </select>
          )}
          {subs.length > 0 && (
            <select className="field !w-auto !py-1" value={subIdx}
              onChange={(e) => { const i = Number(e.target.value); setSubIdx(i); if (hlsRef.current) hlsRef.current.subtitleTrack = i }}>
              <option value={-1}>Altyazı kapalı</option>
              {subs.map((a, i) => <option key={i} value={i}>{a}</option>)}
            </select>
          )}
          <button className="btn" onClick={props.onToggleMini} title="Her zaman üstte mini oynatıcı">{mini ? '⤢' : '🗗'}</button>
          <button className="btn" onClick={toggleFs} title="Tam ekran (F)">⛶</button>
        </div>
      </div>
    </div>
  )
}
