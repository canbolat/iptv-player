import { useEffect, useState } from 'react'
import type { Detail, Episode, Item } from '../../../shared/types'
import { useStore } from '../store'
import { Spinner } from './ui'

export default function DetailModal({ item, onClose }: { item: Item; onClose(): void }) {
  const activeId = useStore((s) => s.activeId)!
  const history = useStore((s) => s.history)
  const { play } = useStore.getState()
  const [d, setD] = useState<Detail | null>(null)
  const [err, setErr] = useState('')
  const [season, setSeason] = useState('')

  useEffect(() => {
    let alive = true
    const id = item.kind === 'vod' ? item.streamId! : item.seriesId!
    window.api.xtreamDetail(activeId, item.kind as 'vod' | 'series', id)
      .then((r) => {
        if (!alive) return
        setD(r)
        const keys = Object.keys(r.seasons ?? {}).sort((a, b) => Number(a) - Number(b))
        if (keys[0]) setSeason(keys[0])
      })
      .catch((e: Error) => alive && setErr(e.message))
    return () => { alive = false }
  }, [item, activeId])

  const playMovie = () => {
    const key = `movie:${item.streamId}`
    const h = history.find((x) => x.key === key)
    play({ title: item.name, logo: item.logo, kind: 'vod', xtream: { type: 'movie', id: item.streamId!, ext: item.ext } },
      { startAt: h?.position ?? 0, historyKey: key })
    onClose()
  }
  const playEp = (e: Episode) => {
    const key = `ep:${e.id}`
    const h = history.find((x) => x.key === key)
    const label = `${item.name} · S${String(e.season).padStart(2, '0')}E${String(e.episode).padStart(2, '0')} · ${e.title}`
    play({ title: label, logo: item.logo, kind: 'series', xtream: { type: 'series', id: e.id, ext: e.ext } },
      { startAt: h?.position ?? 0, historyKey: key })
    onClose()
  }

  const eps = d?.seasons?.[season] ?? []
  return (
    <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="w-full max-w-3xl max-h-[88vh] overflow-y-auto bg-panel border border-line rounded-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="p-5 flex gap-5">
          <div className="w-40 shrink-0">
            {(d?.cover || item.logo) && (
              <img src={d?.cover || item.logo} alt="" referrerPolicy="no-referrer" className="w-full rounded-lg bg-black/40" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start gap-2">
              <h2 className="text-xl font-semibold flex-1">{item.name}</h2>
              <button className="btn" onClick={onClose}>✕</button>
            </div>
            <div className="text-sm text-slate-400 flex flex-wrap gap-x-4">
              <span>{item.group}</span>
              {d?.year && <span>{d.year}</span>}
              {(d?.rating || item.rating) && <span className="text-amber-400">★ {d?.rating || item.rating}</span>}
              {d?.genre && <span>{d.genre}</span>}
            </div>
            {!d && !err && <div className="h-20"><Spinner /></div>}
            {err && <div className="text-sm text-red-400">{err}</div>}
            {(d?.plot || item.plot) && <p className="text-sm text-slate-300 leading-relaxed">{d?.plot || item.plot}</p>}
            {d?.cast && <p className="text-xs text-slate-500">Oyuncular: {d.cast}</p>}
            {item.kind === 'vod' && (
              <button className="btn-primary mt-2" onClick={playMovie}>
                {history.find((x) => x.key === `movie:${item.streamId}`) ? '▶ Devam et' : '▶ Oynat'}
              </button>
            )}
          </div>
        </div>

        {item.kind === 'series' && d?.seasons && (
          <div className="px-5 pb-5 space-y-3">
            <div className="flex flex-wrap gap-2">
              {Object.keys(d.seasons).sort((a, b) => Number(a) - Number(b)).map((s) => (
                <button key={s} onClick={() => setSeason(s)}
                  className={`px-3 py-1 rounded-md text-sm ${s === season ? 'bg-accent text-white' : 'bg-white/10 hover:bg-white/20'}`}>
                  {s}. Sezon
                </button>
              ))}
            </div>
            <div className="divide-y divide-line border border-line rounded-lg">
              {eps.length === 0 && <div className="p-4 text-sm text-slate-500">Bölüm bulunamadı.</div>}
              {eps.map((e) => {
                const h = history.find((x) => x.key === `ep:${e.id}`)
                return (
                  <div key={e.id} className="flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer" onClick={() => playEp(e)}>
                    <div className="w-8 text-center text-slate-500 text-sm">{e.episode}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">{e.title}</div>
                      {e.plot && <div className="text-xs text-slate-500 line-clamp-1">{e.plot}</div>}
                      {h && <div className="mt-1 h-1 max-w-[160px] rounded bg-white/10"><div className="h-full bg-accent rounded" style={{ width: `${(h.position / h.duration) * 100}%` }} /></div>}
                    </div>
                    {e.duration && <div className="text-xs text-slate-500">{e.duration}</div>}
                    <div className="text-accent">▶</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
