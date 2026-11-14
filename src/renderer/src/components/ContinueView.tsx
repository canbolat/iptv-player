import { useStore } from '../store'
import { Logo } from './ui'

const fmt = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h ? `${h} sa ${m} dk` : `${m} dk`
}

export default function ContinueView() {
  const history = useStore((s) => s.history)
  const { play, removeHistory } = useStore.getState()

  if (history.length === 0) {
    return <div className="h-full flex items-center justify-center text-sm text-slate-500">Henüz izlemeye devam edilecek bir içerik yok.</div>
  }
  return (
    <div className="h-full overflow-y-auto p-4 grid gap-3 grid-cols-[repeat(auto-fill,minmax(320px,1fr))] content-start">
      {history.map((h) => (
        <div key={h.key} className="flex items-center gap-3 p-3 rounded-lg bg-panel border border-line hover:border-accent cursor-pointer"
          onClick={() => play(h.target, { startAt: h.position, historyKey: h.key })}>
          <Logo src={h.target.logo} name={h.target.title} size={56} />
          <div className="min-w-0 flex-1">
            <div className="text-sm truncate" title={h.target.title}>{h.target.title}</div>
            <div className="text-xs text-slate-500">{fmt(h.position)} / {fmt(h.duration)}</div>
            <div className="mt-1 h-1 rounded bg-white/10"><div className="h-full bg-accent rounded" style={{ width: `${(h.position / h.duration) * 100}%` }} /></div>
          </div>
          <button className="btn" onClick={(e) => { e.stopPropagation(); removeHistory(h.key) }} title="Listeden kaldır">✕</button>
        </div>
      ))}
    </div>
  )
}
