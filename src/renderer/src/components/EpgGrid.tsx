import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { EpgEntry } from '../../../shared/types'
import { norm } from '../../../shared/m3u'
import { NO_GROUPS, useStore } from '../store'
import { liveTarget } from '../target'
import { Logo } from './ui'

const PX_PER_MIN = 5 // 300 px / saat
const ROW_H = 56
const LEFT_W = 200
const SPAN_H = 6
const HHMM = (t: number) => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

const halfHour = (t: number) => Math.floor(t / 1_800_000) * 1_800_000

export default function EpgGrid() {
  const allItems = useStore((s) => s.items.live)
  const hidden = useStore((s) => (s.pinSet && !s.unlocked ? s.locks : NO_GROUPS))
  const { play, setVisibleLive } = useStore.getState()

  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [ws, setWs] = useState(() => halfHour(Date.now() - 60 * 60_000))
  const [data, setData] = useState<Record<string, EpgEntry[]>>({})
  const [fetched, setFetched] = useState(false)
  const [tick, setTick] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const we = ws + SPAN_H * 3_600_000
  const totalW = LEFT_W + SPAN_H * 60 * PX_PER_MIN

  const items = useMemo(() => {
    const hs = new Set(hidden)
    return allItems.filter((i) => i.tvgId && !hs.has(i.group))
  }, [allItems, hidden])
  const cats = useMemo(() => [...new Set(items.map((i) => i.group))].sort((a, b) => a.localeCompare(b, 'tr')), [items])
  const list = useMemo(() => {
    const nq = norm(q.trim())
    return items.filter((i) => (!cat || i.group === cat) && (!nq || norm(i.name).includes(nq)))
  }, [items, q, cat])
  useEffect(() => { setVisibleLive(list) }, [list])

  const v = useVirtualizer({ count: list.length, getScrollElement: () => ref.current, estimateSize: () => ROW_H, overscan: 6 })
  const visible = v.getVirtualItems()
  const idsKey = visible.map((r) => list[r.index]?.tvgId).join('|')

  // Görünen satırların programlarını getir
  useEffect(() => {
    const ids = [...new Set(visible.map((r) => list[r.index]?.tvgId).filter(Boolean) as string[])]
    if (ids.length === 0) return
    let alive = true
    const t = setTimeout(() => {
      window.api.epgRange(ids, ws, we).then((r) => {
        if (!alive) return
        setData((d) => ({ ...d, ...r }))
        setFetched(true)
      })
    }, 120)
    return () => { alive = false; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, ws])
  useEffect(() => { setData({}); setFetched(false) }, [ws])
  useEffect(() => { const id = setInterval(() => setTick((x) => x + 1), 30_000); return () => clearInterval(id) }, [])

  const now = Date.now()
  const nowX = LEFT_W + ((now - ws) / 60_000) * PX_PER_MIN
  const minWs = halfHour(now - 2 * 3_600_000)
  const maxWs = halfHour(now + 44 * 3_600_000)
  const anyData = Object.values(data).some((x) => x.length > 0)

  const ticks: number[] = []
  for (let t = ws; t < we; t += 1_800_000) ticks.push(t)

  if (items.length === 0) {
    return <div className="h-full flex items-center justify-center p-8 text-center text-sm text-ink/45 max-w-md mx-auto">
      Rehber için EPG kimliği (tvg-id) olan canlı kanallar gerekir. Profile bir EPG (XMLTV) adresi eklediğinizden emin olun.
    </div>
  }

  return (
    <div className="h-full flex flex-col" data-tick={tick}>
      <div className="p-3 flex flex-wrap items-center gap-2 border-b border-line">
        <input className="field max-w-xs" placeholder="Kanal ara" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="field max-w-xs" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Tüm kategoriler</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex-1" />
        <button className="btn" disabled={ws <= minWs} onClick={() => setWs((w) => Math.max(minWs, w - 3 * 3_600_000))}>◀ 3 sa</button>
        <button className="btn" onClick={() => { setWs(halfHour(Date.now() - 60 * 60_000)); ref.current?.scrollTo({ left: 0 }) }}>Şimdi</button>
        <button className="btn" disabled={ws >= maxWs} onClick={() => setWs((w) => Math.min(maxWs, w + 3 * 3_600_000))}>3 sa ▶</button>
      </div>

      <div ref={ref} className="flex-1 overflow-auto relative">
        {/* Zaman başlığı */}
        <div className="sticky top-0 z-20 flex bg-panel border-b border-line" style={{ width: totalW, height: 28 }}>
          <div className="sticky left-0 z-30 bg-panel border-r border-line text-xs text-ink/45 flex items-center px-3" style={{ width: LEFT_W }}>
            {new Date(ws).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
          {ticks.map((t) => (
            <div key={t} className="text-xs text-ink/60 flex items-center border-l border-line/60 pl-1" style={{ width: 30 * PX_PER_MIN }}>
              {HHMM(t)}
            </div>
          ))}
        </div>

        <div style={{ height: v.getTotalSize(), width: totalW, position: 'relative' }}>
          {nowX > LEFT_W && nowX < totalW && (
            <div className="absolute top-0 bottom-0 w-px bg-red-500/70 z-10 pointer-events-none" style={{ left: nowX }} />
          )}
          {visible.map((row) => {
            const it = list[row.index]
            const progs = data[it.tvgId!] ?? []
            return (
              <div key={it.id} className="absolute left-0 border-b border-line/60" style={{ top: row.start, height: ROW_H, width: totalW }}>
                <div className="sticky left-0 z-10 flex items-center gap-2 px-3 bg-bg border-r border-line h-full cursor-pointer hover:bg-ink/5"
                  style={{ width: LEFT_W }} onClick={() => play(liveTarget(it), { itemId: it.id, overlay: true })}>
                  <Logo src={it.logo} name={it.name} size={32} />
                  <div className="min-w-0 text-sm truncate" title={it.name}>{it.name}</div>
                </div>
                {progs.map((p) => {
                  const s0 = Math.max(p.start, ws), e0 = Math.min(p.stop, we)
                  if (e0 <= s0) return null
                  const left = LEFT_W + ((s0 - ws) / 60_000) * PX_PER_MIN
                  const width = ((e0 - s0) / 60_000) * PX_PER_MIN - 2
                  const live = p.start <= now && now < p.stop
                  return (
                    <div key={p.start}
                      className={`absolute top-1 bottom-1 rounded-md px-2 py-1 text-xs overflow-hidden cursor-pointer border ${live ? 'bg-accent/30 border-accent' : p.stop < now ? 'bg-ink/5 border-line text-ink/45' : 'bg-ink/10 border-line hover:bg-ink/15'}`}
                      style={{ left, width }} title={`${HHMM(p.start)}–${HHMM(p.stop)} ${p.title}${p.desc ? '\n\n' + p.desc : ''}`}
                      onClick={() => play(liveTarget(it), { itemId: it.id, overlay: true })}>
                      <div className="truncate font-medium">{p.title}</div>
                      <div className="truncate text-ink/60">{HHMM(p.start)}–{HHMM(p.stop)}</div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
        {fetched && !anyData && (
          <div className="sticky left-0 p-6 text-sm text-ink/45">Bu aralık için EPG verisi yok. Profilde EPG adresi tanımlı mı ve yüklendi mi kontrol edin.</div>
        )}
      </div>
    </div>
  )
}
