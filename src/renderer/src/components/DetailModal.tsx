import { useEffect, useState } from 'react'
import type { Detail, Episode, Item, PlayTarget } from '../../../shared/types'
import { useStore } from '../store'
import { Spinner } from './ui'

export default function DetailModal({ item, onClose }: { item: Item; onClose(): void }) {
  const activeId = useStore((s) => s.activeId)!
  const history = useStore((s) => s.history)
  const { play } = useStore.getState()
  const [d, setD] = useState<Detail | null>(null)
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [season, setSeason] = useState('')

  const movieKey = item.url ? `movie:${item.url}` : item.cmd ? `movie:${item.id}` : `movie:${item.streamId}`
  const epKey = (e: Episode) => (e.url ? `ep:${e.url}` : item.cmd ? `ep:${item.id}:${e.episode}` : `ep:${e.id}`)
  const epLabel = (e: Episode) =>
    `${item.name} · S${String(e.season).padStart(2, '0')}E${String(e.episode).padStart(2, '0')} · ${e.title}`

  const movieTarget = (): PlayTarget =>
    item.url ? { title: item.name, logo: item.logo, kind: 'vod', url: item.url }
    : item.cmd ? { title: item.name, logo: item.logo, kind: 'vod', stalker: { type: 'vod', cmd: item.cmd } }
    : { title: item.name, logo: item.logo, kind: 'vod', xtream: { type: 'movie', id: item.streamId!, ext: item.ext } }

  const epTarget = (e: Episode): PlayTarget =>
    e.url ? { title: epLabel(e), logo: item.logo, kind: 'series', url: e.url }
    : item.cmd ? { title: epLabel(e), logo: item.logo, kind: 'series', stalker: { type: 'vod', cmd: item.cmd, series: e.episode } }
    : { title: epLabel(e), logo: item.logo, kind: 'series', xtream: { type: 'series', id: e.id, ext: e.ext } }

  useEffect(() => {
    // M3U ve Stalker kaynaklarında ayrıntı listeden gelir
    if (item.localDetail || (item.kind === 'vod' && !item.streamId)) {
      const r = item.localDetail ?? {}
      setD(r)
      const keys = Object.keys(r.seasons ?? {}).sort((a, b) => Number(a) - Number(b))
      if (keys[0]) setSeason(keys[0])
      return
    }
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

  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(''), 3000) }

  const playMovie = () => {
    const h = history.find((x) => x.key === movieKey)
    play(movieTarget(), { startAt: h?.position ?? 0, historyKey: movieKey })
    onClose()
  }
  const playEp = (e: Episode) => {
    const h = history.find((x) => x.key === epKey(e))
    play(epTarget(e), { startAt: h?.position ?? 0, historyKey: epKey(e) })
    onClose()
  }

  const download = async (items: { target: PlayTarget; title: string; subdir?: string[] }[]) => {
    try {
      for (const x of items) await window.api.startDownload(activeId, x.target, x.title, x.subdir)
      flash(items.length > 1 ? `${items.length} bölüm indirme kuyruğuna eklendi` : 'İndirme kuyruğuna eklendi')
    } catch (e) {
      setErr((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    }
  }
  const epDl = (e: Episode) => ({ target: epTarget(e), title: epLabel(e), subdir: [item.name, `Sezon ${e.season}`] })

  const eps = d?.seasons?.[season] ?? []
  return (
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="w-full max-w-3xl max-h-[88vh] overflow-y-auto bg-panel border border-line rounded-xl shadow-2xl modal-in" onMouseDown={(e) => e.stopPropagation()}>
        <div className="p-5 flex gap-5">
          <div className="w-40 shrink-0">
            {(d?.cover || item.logo) && (
              <img src={d?.cover || item.logo} alt="" referrerPolicy="no-referrer" className="w-full rounded-lg bg-ink/10" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start gap-2">
              <h2 className="text-xl font-semibold flex-1">{item.name}</h2>
              <button className="btn" onClick={onClose}>✕</button>
            </div>
            <div className="text-sm text-ink/60 flex flex-wrap gap-x-4">
              <span>{item.group}</span>
              {d?.year && <span>{d.year}</span>}
              {(d?.rating || item.rating) && <span className="text-amber-400">★ {d?.rating || item.rating}</span>}
              {d?.genre && <span>{d.genre}</span>}
            </div>
            {!d && !err && <div className="h-20"><Spinner /></div>}
            {err && <div className="text-sm text-red-400">{err}</div>}
            {note && <div className="text-sm text-emerald-400">{note}</div>}
            {(d?.plot || item.plot) && <p className="text-sm text-ink/80 leading-relaxed">{d?.plot || item.plot}</p>}
            {d?.cast && <p className="text-xs text-ink/45">Oyuncular: {d.cast}</p>}
            {item.kind === 'vod' && (
              <div className="flex gap-2 mt-2">
                <button className="btn-primary" onClick={playMovie}>
                  {history.find((x) => x.key === movieKey) ? '▶ Devam et' : '▶ Oynat'}
                </button>
                <button className="btn" onClick={() => download([{ target: movieTarget(), title: item.name }])}>⬇ İndir</button>
              </div>
            )}
          </div>
        </div>

        {item.kind === 'series' && d?.seasons && (
          <div className="px-5 pb-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {Object.keys(d.seasons).sort((a, b) => Number(a) - Number(b)).map((s) => (
                <button key={s} onClick={() => setSeason(s)}
                  className={`px-3 py-1 rounded-md text-sm ${s === season ? 'bg-accent text-white' : 'bg-ink/10 hover:bg-ink/20'}`}>
                  {s}. Sezon
                </button>
              ))}
              <div className="flex-1" />
              {eps.length > 0 && <button className="btn" onClick={() => download(eps.map(epDl))}>⬇ Sezonu indir ({eps.length})</button>}
            </div>
            <div className="divide-y divide-line border border-line rounded-lg">
              {eps.length === 0 && <div className="p-4 text-sm text-ink/45">Bölüm bulunamadı.</div>}
              {eps.map((e) => {
                const h = history.find((x) => x.key === epKey(e))
                return (
                  <div key={`${e.id}-${e.episode}`} className="flex items-center gap-3 p-3 hover:bg-ink/5 cursor-pointer" onClick={() => playEp(e)}>
                    <div className="w-8 text-center text-ink/45 text-sm">{e.episode}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">{e.title}</div>
                      {e.plot && <div className="text-xs text-ink/45 line-clamp-1">{e.plot}</div>}
                      {h && <div className="mt-1 h-1 max-w-[160px] rounded bg-ink/10"><div className="h-full bg-accent rounded" style={{ width: `${(h.position / h.duration) * 100}%` }} /></div>}
                    </div>
                    {e.duration && <div className="text-xs text-ink/45">{e.duration}</div>}
                    <button className="btn" title="Bölümü indir" onClick={(ev) => { ev.stopPropagation(); download([epDl(e)]) }}>⬇</button>
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
