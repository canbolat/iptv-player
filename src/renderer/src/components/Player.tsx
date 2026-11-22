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
  engine: 'auto' | 'hls' | 'ts'
  bufferSec: number
  prebufferSec: number
  pipeline: 'native' | 'ffmpeg'
  ffmpegVideo: 'auto' | 'copy' | 'transcode'
  recording: boolean
  overlay: boolean
  onRecord?(): void
  onCatchup?(): void
  onDiag?(e: { type: 'start' | 'stall' | 'retry' | 'error' | 'drops'; mode?: string; info?: string; value?: number }): void
}

type Status = 'loading' | 'playing' | 'error'
type Mode = 'hls' | 'ts' | 'native' | 'proxy'

const MAX_RETRY = 5

/** Geçerli konumdan ileriye doğru tamponlanmış saniye */
function bufferedAhead(v: HTMLVideoElement): number {
  const b = v.buffered
  if (!b.length) return 0
  const s0 = b.start(b.length - 1), e0 = b.end(b.length - 1), cur = v.currentTime
  return e0 - (cur >= s0 && cur <= e0 ? cur : s0)
}
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
  const holdRef = useRef(false)
  const holdSince = useRef(0)
  const holds = useRef<number[]>([])
  const waitTimer = useRef(0)
  const proxyId = useRef<string | null>(null)
  const runId = useRef(0)
  const stallTimes = useRef<number[]>([])
  const stalls = useRef(0)
  const infoRef = useRef(false)

  const [status, setStatus] = useState<Status>('loading')
  const statusRef = useRef<Status>('loading')
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
  const [info, setInfo] = useState(false)
  const [infoLines, setInfoLines] = useState<string[]>([])
  const [tip, setTip] = useState('')
  const idleTimer = useRef(0)
  statusRef.current = status
  infoRef.current = info

  const teardown = () => {
    holdRef.current = false
    runId.current++
    if (waitTimer.current) { clearTimeout(waitTimer.current); waitTimer.current = 0 }
    if (proxyId.current) { window.api.proxyStop(proxyId.current); proxyId.current = null }
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
      propsRef.current.onDiag?.({ type: 'error', info: 'Yeniden bağlanma hakkı bitti' })
      return
    }
    retry.current += 1
    attempt.current += 1
    propsRef.current.onDiag?.({ type: 'retry' })
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
    const wantProxy = live && propsRef.current.pipeline === 'ffmpeg' && /^https?:/i.test(url)
    const ffv: 'copy' | 'transcode' = propsRef.current.ffmpegVideo === 'auto'
      ? (attempt.current % 2 === 0 ? 'copy' : 'transcode') : propsRef.current.ffmpegVideo
    if (wantProxy) mode = 'proxy'
    else if (clean.endsWith('.m3u8')) mode = 'hls'
    else if (clean.endsWith('.ts')) mode = 'ts'
    else if (live && !/\.(mp4|mkv|avi|webm|mov|m4v)$/.test(clean)) {
      const eng = propsRef.current.engine
      mode = eng === 'hls' ? 'hls' : eng === 'ts' ? 'ts' : attempt.current % 2 === 0 ? 'ts' : 'hls'
    }
    else mode = 'native'
    if (mode === 'hls' && !Hls.isSupported()) mode = 'native'
    if (mode === 'ts' && !mpegts.isSupported()) mode = 'native'
    modeRef.current = mode
    if (retry.current === 0) propsRef.current.onDiag?.({ type: 'start', mode: mode === 'proxy' ? `ffmpeg-${ffv}` : mode })

    if (mode === 'hls') {
      const sec = Math.min(120, Math.max(5, propsRef.current.bufferSec))
      const cfg = {
        maxBufferLength: sec, maxMaxBufferLength: sec * 2,
        liveSyncDurationCount: Math.min(10, Math.max(3, Math.round(sec / 6))),
        backBufferLength: 30, fragLoadingMaxRetry: 6, levelLoadingMaxRetry: 6, manifestLoadingMaxRetry: 6
      }
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false, ...cfg })
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
        {
          enableWorker: true,
          liveBufferLatencyChasing: false,
          enableStashBuffer: true,
          stashInitialSize: 1024 * 1024,
          autoCleanupSourceBuffer: true,
          autoCleanupMaxBackwardDuration: 60,
          autoCleanupMinBackwardDuration: 30,
          lazyLoad: false
        } as any
      )
      tsRef.current = p
      p.on(mpegts.Events.ERROR, () => scheduleRetry())
      p.attachMediaElement(v)
      p.load()
      // Oynatmadan önce tampon biriktir (takılmaları azaltır)
      if (live && propsRef.current.prebufferSec > 0) {
        holdRef.current = true
        holdSince.current = Date.now()
      } else {
        Promise.resolve(p.play()).catch(() => {})
      }
    } else if (mode === 'proxy') {
      const my = ++runId.current
      window.api.proxyStart(url, ffv, propsRef.current.prebufferSec)
        .then(({ id, url: local }) => {
          if (runId.current !== my) { window.api.proxyStop(id); return }
          proxyId.current = id
          v.src = local
          v.play().catch(() => {})
        })
        .catch(() => scheduleRetry())
    } else {
      v.src = url
      v.play().catch(() => {})
    }
  }
  startRef.current = start

  const metricsRef = useRef('')
  const collectInfo = (v: HTMLVideoElement, q: VideoPlaybackQuality | undefined, fps: number, codec: string) => {
    const mode = modeRef.current
    const lines: string[] = []
    lines.push(`Motor: ${mode === 'proxy' ? 'ffmpeg ara katmanı' : mode === 'ts' ? 'mpegts.js' : mode === 'hls' ? 'hls.js' : 'tarayıcı (doğrudan)'}`)
    lines.push(`Görüntü: ${v.videoWidth}x${v.videoHeight} · ${fps} FPS · codec: ${codec || '?'}`)
    if (q) lines.push(`Kareler: düşen ${q.droppedVideoFrames} · bozuk ${q.corruptedVideoFrames} · toplam ${q.totalVideoFrames}`)
    lines.push(`Tampon (ileri): ${bufferedAhead(v).toFixed(1)} sn${holdRef.current ? ' · biriktiriliyor' : ''}`)
    const mi = tsRef.current?.mediaInfo
    if (mi) lines.push(`Ses: ${mi.audioCodec || '?'} · video: ${mi.videoCodec || '?'}`)
    const si = tsRef.current?.statisticsInfo
    if (si?.speed) lines.push(`İndirme hızı: ${Math.round(si.speed)} KB/s${si.droppedFrames ? ` · motor düşen ${si.droppedFrames}` : ''}`)
    const hls = hlsRef.current
    if (hls?.bandwidthEstimate) lines.push(`Bant genişliği tahmini: ${(hls.bandwidthEstimate / 1e6).toFixed(1)} Mbit/s`)
    lines.push(`Oturum: ${stalls.current} takılma · ${retry.current} yeniden bağlanma`)
    if (metricsRef.current) lines.push(metricsRef.current)
    setInfoLines(lines)
  }

  // Ana süreç CPU/GPU ölçümleri (bilgi paneli açıkken)
  useEffect(() => {
    if (!info) return
    let alive = true
    const load = () => window.api.metrics().then((m) => {
      if (!alive) return
      metricsRef.current = `CPU: arayüz %${m.cpu.renderer} · GPU işlemi %${m.cpu.gpu} · ana %${m.cpu.main} · video çözme: ${m.videoDecode}`
    }).catch(() => {})
    load()
    const id = setInterval(load, 2000)
    return () => { alive = false; clearInterval(id) }
  }, [info])

  // Kaynak değişince baştan kur
  useEffect(() => {
    retry.current = 0
    attempt.current = 0
    stalls.current = 0
    holds.current = []
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
    let lastT = -1, same = 0, lastFrames = 0, tick5 = 0
    const id = window.setInterval(() => {
      const v = videoRef.current
      if (!v) return
      if (live && !v.paused && !timer.current) {
        if (v.currentTime === lastT) same++ ; else same = 0
        lastT = v.currentTime
        if (same >= 15) { same = 0; scheduleRetry() }
      }
      const q = v.getVideoPlaybackQuality?.()
      tick5++
      if (q && tick5 % 5 === 0 && q.droppedVideoFrames > 0) propsRef.current.onDiag?.({ type: 'drops', value: q.droppedVideoFrames })
      const fps = q ? Math.max(0, q.totalVideoFrames - lastFrames) : 0
      if (q) lastFrames = q.totalVideoFrames
      let codec = ''
      const hls = hlsRef.current
      if (hls && hls.currentLevel >= 0) codec = (hls.levels[hls.currentLevel]?.videoCodec || '').split('.')[0]
      const mi = tsRef.current?.mediaInfo
      if (mi?.videoCodec) codec = String(mi.videoCodec).split('.')[0]
      if (infoRef.current) collectInfo(v, q, fps, codec)
      setBadge(v.videoWidth ? `${v.videoHeight}p · ${fps} FPS${codec ? ' · ' + codec.toUpperCase() : ''}` : '')
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, url])

  // MPEG-TS: tampon hedefe ulaşınca oynat; takılma sonrası yeniden biriktir
  useEffect(() => {
    const id = window.setInterval(() => {
      const v = videoRef.current
      if (!v || !holdRef.current) return
      const want = propsRef.current.prebufferSec
      const waited = (Date.now() - holdSince.current) / 1000
      if (bufferedAhead(v) >= want || waited > want * 1.5 + 4) {
        holdRef.current = false
        const p = tsRef.current
        Promise.resolve(p ? p.play() : v.play()).catch(() => {})
      }
    }, 400)
    return () => clearInterval(id)
  }, [url])

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
        case 'i': case 'I': setInfo((x) => !x); break
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
      data-theme="dark"
      className={`relative w-full h-full bg-black overflow-hidden ${ui ? '' : 'cursor-none'}`}
      onMouseMove={poke}
      onDoubleClick={toggleFs}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        onClick={togglePlay}
        onPlaying={() => {
          if (waitTimer.current) { clearTimeout(waitTimer.current); waitTimer.current = 0 }
          setStatus('playing'); setMsg(''); retry.current = 0
        }}
        onWaiting={() => {
          if (statusRef.current === 'playing') {
            stalls.current++
            const now = Date.now()
            stallTimes.current = [...stallTimes.current.filter((t) => now - t < 60_000), now]
            propsRef.current.onDiag?.({ type: 'stall' })
            if (stallTimes.current.length >= 3 && propsRef.current.pipeline === 'native' && !tip) {
              setTip('Sık takılma algılandı. Ayarlar → Oynatıcı → Oynatma motoru bölümünde "Kararlı (ffmpeg)" modunu deneyin; ⓘ düğmesi teknik bilgiyi gösterir.')
            }
          }
          setStatus((s) => (s === 'error' ? s : 'loading'))
          // Kısa kesintilerde tekrar biriktirme yapma: yalnızca 1,5 sn'den uzun süren takılmada
          if (!waitTimer.current && modeRef.current === 'ts') {
            waitTimer.current = window.setTimeout(() => {
              waitTimer.current = 0
              const v = videoRef.current
              if (!v || statusRef.current !== 'loading' || holdRef.current || v.paused) return
              if (!live || propsRef.current.prebufferSec <= 0) return
              const now = Date.now()
              holds.current = holds.current.filter((t) => now - t < 30_000)
              if (holds.current.length >= 3) return // çok sık tekrarlıyorsa döngüye girmesin
              holds.current.push(now)
              holdRef.current = true
              holdSince.current = now
              v.pause()
            }, 1500)
          }
        }}
        onPlay={() => setPaused(false)}
        onPause={() => { if (!holdRef.current) setPaused(true) }}
        onVolumeChange={(e) => { setVolume(e.currentTarget.volume); setMuted(e.currentTarget.muted) }}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration)
          if (!live && startAt > 0) e.currentTarget.currentTime = startAt
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget
          if (!live) setTime(v.currentTime)
          if (!live && propsRef.current.onProgress && Date.now() - lastSave.current > 5000) {
            lastSave.current = Date.now()
            propsRef.current.onProgress(v.currentTime, v.duration)
          }
        }}
        onError={() => {
          if (modeRef.current === 'native') {
            propsRef.current.onDiag?.({ type: 'error', info: 'Biçim/codec desteklenmiyor' })
            setStatus('error')
            setMsg('Bu biçim veya codec yerleşik oynatıcıda desteklenmiyor (MKV, HEVC ve AC3 ses sık görülen nedenlerdir). Harici oynatıcıyı deneyin.')
          } else scheduleRetry()
        }}
      />

      {/* Üst çubuk */}
      <div className={`absolute top-0 inset-x-0 p-3 bg-gradient-to-b from-black/80 to-transparent transition-opacity ${ui ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex items-center gap-3">
          {(!live || mini || props.overlay) && (
            <button className="btn" onClick={props.onClose} title="Kapat">✕</button>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{title}</div>
            {header}
          </div>
          {props.recording && <span className="px-2 py-0.5 rounded bg-red-600 text-xs font-semibold animate-pulse whitespace-nowrap">● KAYIT</span>}
          {badge && <span className="px-2 py-0.5 rounded bg-ink/15 text-xs whitespace-nowrap">{badge}</span>}
        </div>
      </div>

      {info && (
        <div className="absolute top-16 left-3 z-10 max-w-[90%] p-3 rounded-md bg-black/75 text-[11px] leading-5 font-mono text-ink/90 pointer-events-none">
          {infoLines.length === 0 ? 'Veri toplanıyor…' : infoLines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
      {tip && (
        <div className="absolute bottom-24 left-3 right-3 z-10 flex items-start gap-3 p-3 rounded-md bg-amber-600/90 text-sm">
          <div className="flex-1">{tip}</div>
          <button className="btn" onClick={() => setTip('')}>✕</button>
        </div>
      )}

      {/* Yükleniyor / hata */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <div className="w-12 h-12 rounded-full border-4 border-ink/20 border-t-accent animate-spin" />
          {msg && <div className="text-sm text-ink/80">{msg}</div>}
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center bg-black/70">
          <div className="text-lg font-medium">Oynatılamadı</div>
          <div className="max-w-md text-sm text-ink/80">{msg}</div>
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
              type="range" className="flex-1 accent-accent" min={0} max={duration || 0} step={1} value={time}
              onChange={(e) => { if (videoRef.current) videoRef.current.currentTime = Number(e.target.value) }}
            />
            <span className="w-14 tabular-nums">{fmt(duration)}</span>
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn" onClick={togglePlay} title="Oynat/Duraklat (Boşluk)">{paused ? '▶' : '⏸'}</button>
          <button className="btn" onClick={toggleMute} title="Sessiz (M)">{muted || volume === 0 ? '🔇' : '🔊'}</button>
          <input
            type="range" className="w-24 accent-accent" min={0} max={1} step={0.05} value={muted ? 0 : volume}
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
          {live && props.onCatchup && (
            <button className="btn" onClick={props.onCatchup} title="Geçmiş yayınları izle">⏪ Geçmiş</button>
          )}
          {live && props.onRecord && (
            <button className={`btn ${props.recording ? '!bg-red-600 hover:!bg-red-500' : ''}`} onClick={props.onRecord}
              title={props.recording ? 'Kaydı durdur' : 'Bu kanalı kaydet'}>
              {props.recording ? '⏹ Kaydı durdur' : '⏺ Kaydet'}
            </button>
          )}
          <button className="btn" onClick={props.onToggleMini} title="Her zaman üstte mini oynatıcı">{mini ? '⤢' : '🗗'}</button>
          <button className={`btn ${info ? '!bg-accent' : ''}`} onClick={() => setInfo((x) => !x)} title="Teknik bilgi (I)">ⓘ</button>
          <button className="btn" onClick={toggleFs} title="Tam ekran (F)">⛶</button>
        </div>
      </div>
    </div>
  )
}
