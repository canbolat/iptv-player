import { useEffect, useState } from 'react'
import type { EpgNowNext } from '../../../shared/types'

const hhmm = (t: number) => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

export default function EpgInfo({ tvgId }: { tvgId?: string }) {
  const [d, setD] = useState<EpgNowNext>({})
  const [, tick] = useState(0)

  useEffect(() => {
    setD({})
    if (!tvgId) return
    let alive = true
    const load = () => window.api.epgNowNext(tvgId).then((r) => alive && (setD(r), tick((x) => x + 1)))
    load()
    const id = setInterval(load, 20_000)
    return () => { alive = false; clearInterval(id) }
  }, [tvgId])

  if (!d.now && !d.next) return null
  const pct = d.now ? Math.min(100, Math.max(0, ((Date.now() - d.now.start) / (d.now.stop - d.now.start)) * 100)) : 0
  return (
    <div className="mt-1 text-xs text-slate-300 space-y-1">
      {d.now && (
        <>
          <div className="truncate">
            <span className="text-accent font-medium">Şimdi</span> {hhmm(d.now.start)}–{hhmm(d.now.stop)} · {d.now.title}
          </div>
          <div className="h-1 rounded bg-white/15 overflow-hidden max-w-sm">
            <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        </>
      )}
      {d.next && <div className="truncate text-slate-400">Sonra {hhmm(d.next.start)} · {d.next.title}</div>}
    </div>
  )
}
