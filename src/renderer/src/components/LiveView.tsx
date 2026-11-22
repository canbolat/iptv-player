import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { norm } from '../../../shared/m3u'
import { NO_GROUPS, useStore } from '../store'
import { liveTarget } from '../target'
import { ErrorBox, Logo, Spinner } from './ui'

const ALL = '__all__'
const FAV = '__fav__'

export default function LiveView() {
  const allItems = useStore((s) => s.items.live)
  const hidden = useStore((s) => (s.pinSet && !s.unlocked ? s.locks : NO_GROUPS))
  const loading = useStore((s) => s.loading.live)
  const error = useStore((s) => s.error)
  const favs = useStore((s) => s.favs)
  const playing = useStore((s) => s.playing)
  const notice = useStore((s) => s.notice)
  const compact = useStore((s) => s.settings.density === 'compact')
  const rowH = compact ? 44 : 56
  const { play, toggleFav, loadKind, setVisibleLive, setRecDialog } = useStore.getState()

  const [q, setQ] = useState('')
  const [cat, setCat] = useState(ALL)
  const dq = useDeferredValue(q)
  const parentRef = useRef<HTMLDivElement>(null)

  const items = useMemo(() => (hidden.length ? allItems.filter(((hs) => (i: { group: string }) => !hs.has(i.group))(new Set(hidden))) : allItems), [allItems, hidden])
  const index = useMemo(() => items.map((it) => ({ it, n: norm(it.name) })), [items])
  const cats = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of items) m.set(it.group, (m.get(it.group) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'tr'))
  }, [items])
  const favSet = useMemo(() => new Set(favs), [favs])

  const list = useMemo(() => {
    const nq = norm(dq.trim())
    return index
      .filter(({ it, n }) =>
        (cat === ALL || (cat === FAV ? favSet.has(it.id) : it.group === cat)) && (!nq || n.includes(nq)))
      .map((x) => x.it)
  }, [index, dq, cat, favSet])

  useEffect(() => { setVisibleLive(list) }, [list])

  const v = useVirtualizer({ count: list.length, getScrollElement: () => parentRef.current, estimateSize: () => rowH, overscan: 12 })
  useEffect(() => { v.measure() }, [rowH])

  if (loading && items.length === 0) return <Spinner label="Kanallar yükleniyor…" />
  if (error && items.length === 0) return <ErrorBox message={error} onRetry={() => loadKind('live', true)} />

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 space-y-2 border-b border-line">
        <input className="field" placeholder={`Kanal ara (${items.length.toLocaleString('tr-TR')} kanal)`} value={q}
          onChange={(e) => setQ(e.target.value)} />
        <select className="field" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value={ALL}>Tüm kategoriler ({items.length})</option>
          <option value={FAV}>★ Favoriler ({favs.length})</option>
          {cats.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
        </select>
        {notice && <div className="text-xs text-amber-400">{notice}</div>}
      </div>
      <div ref={parentRef} className="flex-1 overflow-y-auto">
        {list.length === 0 && <div className="p-6 text-sm text-ink/45 text-center">Sonuç yok.</div>}
        <div style={{ height: v.getTotalSize(), position: 'relative' }}>
          {v.getVirtualItems().map((row) => {
            const it = list[row.index]
            const active = playing?.itemId === it.id
            return (
              <div key={it.id}
                className={`absolute inset-x-0 flex items-center gap-3 px-3 cursor-pointer ${active ? 'bg-accent/25' : 'hover:bg-ink/5'}`}
                style={{ height: row.size, transform: `translateY(${row.start}px)` }}
                onClick={() => play(liveTarget(it), { itemId: it.id, overlay: false })}>
                <Logo src={it.logo} name={it.name} size={compact ? 30 : 38} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{it.name}</div>
                  <div className="truncate text-xs text-ink/45">{it.group}</div>
                </div>
                <button className="text-sm text-ink/30 hover:text-ink/80" title="Zamanlı kayıt"
                  onClick={(e) => { e.stopPropagation(); setRecDialog(liveTarget(it)) }}>⏰</button>
                <button className={`text-lg ${favSet.has(it.id) ? 'text-amber-400' : 'text-ink/30 hover:text-ink/80'}`}
                  onClick={(e) => { e.stopPropagation(); toggleFav(it.id) }}>★</button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
