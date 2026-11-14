import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Item } from '../../../shared/types'
import { norm } from '../../../shared/m3u'
import { useStore } from '../store'
import DetailModal from './DetailModal'
import { ErrorBox, Logo, Spinner } from './ui'

const CARD_W = 168
const ROW_H = 300

export default function GridView({ kind }: { kind: 'vod' | 'series' }) {
  const items = useStore((s) => s.items[kind])
  const loading = useStore((s) => s.loading[kind])
  const error = useStore((s) => s.error)
  const profileType = useStore((s) => s.profiles.find((p) => p.id === s.activeId)?.type)
  const { loadKind } = useStore.getState()

  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [sel, setSel] = useState<Item | null>(null)
  const [cols, setCols] = useState(5)
  const dq = useDeferredValue(q)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setCols(Math.max(1, Math.floor((el.clientWidth - 16) / CARD_W))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cats = useMemo(() => [...new Set(items.map((i) => i.group))].sort((a, b) => a.localeCompare(b, 'tr')), [items])
  const list = useMemo(() => {
    const nq = norm(dq.trim())
    return items.filter((i) => (!cat || i.group === cat) && (!nq || norm(i.name).includes(nq)))
  }, [items, dq, cat])

  const rows = Math.ceil(list.length / cols)
  const v = useVirtualizer({ count: rows, getScrollElement: () => ref.current, estimateSize: () => ROW_H, overscan: 3 })

  if (profileType === 'm3u') {
    return <ErrorBox message="M3U profillerinde yalnızca canlı yayınlar listelenir. Film ve diziler için Xtream Codes profili ekleyin." />
  }
  if (loading && items.length === 0) return <Spinner label={kind === 'vod' ? 'Filmler yükleniyor…' : 'Diziler yükleniyor…'} />
  if (error && items.length === 0) return <ErrorBox message={error} onRetry={() => loadKind(kind, true)} />

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 flex gap-2 border-b border-line">
        <input className="field max-w-md" placeholder={`Ara (${items.length.toLocaleString('tr-TR')} içerik)`} value={q}
          onChange={(e) => setQ(e.target.value)} />
        <select className="field max-w-xs" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Tüm kategoriler</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div ref={ref} className="flex-1 overflow-y-auto px-2">
        {list.length === 0 && <div className="p-8 text-center text-sm text-slate-500">Sonuç yok.</div>}
        <div style={{ height: v.getTotalSize(), position: 'relative' }}>
          {v.getVirtualItems().map((row) => (
            <div key={row.index} className="absolute inset-x-0 flex gap-2 py-1"
              style={{ height: row.size, transform: `translateY(${row.start}px)` }}>
              {list.slice(row.index * cols, row.index * cols + cols).map((it) => (
                <div key={it.id} className="rounded-lg bg-panel border border-line hover:border-accent cursor-pointer overflow-hidden flex flex-col"
                  style={{ width: CARD_W - 8 }} onClick={() => setSel(it)}>
                  <div className="h-[220px] flex items-center justify-center bg-black/40">
                    {it.logo ? <Poster src={it.logo} name={it.name} /> : <Logo name={it.name} size={80} />}
                  </div>
                  <div className="p-2 min-w-0">
                    <div className="text-sm truncate" title={it.name}>{it.name}</div>
                    <div className="text-xs text-slate-500 flex justify-between">
                      <span className="truncate">{it.group}</span>
                      {it.rating && Number(it.rating) > 0 && <span className="text-amber-400 ml-1">★ {it.rating}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      {sel && <DetailModal item={sel} onClose={() => setSel(null)} />}
    </div>
  )
}

function Poster({ src, name }: { src: string; name: string }) {
  const [bad, setBad] = useState(false)
  if (bad) return <Logo name={name} size={80} />
  return <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} className="w-full h-full object-cover" />
}
