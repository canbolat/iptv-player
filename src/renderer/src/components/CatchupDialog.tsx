import { useEffect, useMemo, useState } from 'react'
import type { CatchupEntry, PlayTarget } from '../../../shared/types'
import { catchupMinutes, formatCatchupStart } from '../../../shared/catchup'
import { useStore } from '../store'
import { Spinner } from './ui'

const hhmm = (t: number) => new Date(t * 1000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
const day = (t: number) => new Date(t * 1000).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })

export default function CatchupDialog({ target, onClose }: { target: PlayTarget; onClose(): void }) {
  const activeId = useStore((s) => s.activeId)!
  const { play } = useStore.getState()
  const [list, setList] = useState<CatchupEntry[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!target.xtream) { setErr('Geçmiş yayın yalnızca Xtream Codes kanallarında desteklenir.'); return }
    window.api.catchupList(activeId, target.xtream.id)
      .then((r) => setList(r))
      .catch((e: Error) => setErr(e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')))
  }, [target, activeId])

  const now = Date.now() / 1000
  const days = useMemo(() => {
    const m = new Map<string, CatchupEntry[]>()
    for (const e of (list ?? []).filter((x) => x.startTs < now).reverse()) {
      const k = day(e.startTs)
      m.set(k, [...(m.get(k) ?? []), e])
    }
    return [...m.entries()]
  }, [list, now])

  const watch = (e: CatchupEntry) => {
    const start = formatCatchupStart(e.start)
    if (!start || !target.xtream) return
    play(
      { title: `${target.title} · ${e.title}`, logo: target.logo, kind: 'vod',
        catchup: { streamId: target.xtream.id, start, minutes: catchupMinutes(e.startTs, e.stopTs) } },
      { overlay: true }
    )
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-panel border border-line rounded-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-line flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold">Geçmiş yayınlar</h2>
            <div className="text-xs text-slate-500 truncate">{target.title}</div>
          </div>
          <button className="btn" onClick={onClose}>✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {!list && !err && <div className="h-40"><Spinner label="Program listesi alınıyor…" /></div>}
          {err && <div className="p-4 text-sm text-red-400">{err}</div>}
          {list && days.length === 0 && <div className="p-4 text-sm text-slate-500">Bu kanal için geçmiş program bilgisi bulunamadı.</div>}
          {days.map(([d, entries]) => (
            <div key={d} className="mb-4">
              <div className="text-xs uppercase tracking-wide text-slate-500 px-2 mb-1">{d}</div>
              <div className="divide-y divide-line border border-line rounded-lg">
                {entries.map((e) => (
                  <div key={e.startTs}
                    className={`flex items-center gap-3 p-2.5 ${e.hasArchive ? 'hover:bg-white/5 cursor-pointer' : 'opacity-40'}`}
                    onClick={() => e.hasArchive && watch(e)} title={e.desc}>
                    <div className="w-24 text-xs text-slate-400 tabular-nums">{hhmm(e.startTs)}–{hhmm(e.stopTs)}</div>
                    <div className="flex-1 min-w-0 text-sm truncate">{e.title}</div>
                    {e.hasArchive ? <span className="text-accent">▶</span> : <span className="text-xs text-slate-600">arşivde yok</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
