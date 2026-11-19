import { useState } from 'react'

const PRESETS: [number, string][] = [[0, 'Elle durdururum'], [30, '30 dk'], [60, '1 saat'], [120, '2 saat'], [180, '3 saat']]

const toLocalInput = (t: number) => {
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function RecordDialog({ title, onStart, onSchedule, onClose }: {
  title: string
  onStart(minutes: number): void
  onSchedule(startAt: number, minutes: number): void
  onClose(): void
}) {
  const [mode, setMode] = useState<'now' | 'later'>('now')
  const [minutes, setMinutes] = useState(0)
  const [custom, setCustom] = useState('')
  const [when, setWhen] = useState(toLocalInput(Date.now() + 10 * 60_000))
  const value = custom ? Math.max(0, Math.floor(Number(custom)) || 0) : minutes
  const startAt = new Date(when).getTime()
  const base = mode === 'now' ? Date.now() : startAt
  const end = value > 0 && Number.isFinite(base)
    ? new Date(base + value * 60_000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : null
  const invalid = mode === 'later' && (!Number.isFinite(startAt) || startAt < Date.now() - 30_000)

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="w-full max-w-md bg-panel border border-line rounded-xl p-5 space-y-4" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Kayıt</h2>
        <div className="text-sm text-slate-400 truncate">{title}</div>

        <div className="flex gap-2">
          {([['now', 'Şimdi başlat'], ['later', 'Zamanlı başlat']] as const).map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-md text-sm border ${mode === m ? 'border-accent bg-accent/20' : 'border-line bg-bg'}`}>{label}</button>
          ))}
        </div>

        {mode === 'later' && (
          <div className="space-y-1">
            <label className="text-sm text-slate-400">Başlangıç zamanı</label>
            <input className="field" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
        )}

        <div>
          <div className="text-sm text-slate-400 mb-2">Süre</div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(([m, label]) => (
              <button key={m} onClick={() => { setMinutes(m); setCustom('') }}
                className={`px-3 py-1.5 rounded-md text-sm border ${!custom && minutes === m ? 'border-accent bg-accent/20' : 'border-line bg-bg'}`}>{label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm mt-2">
            <span className="text-slate-400">veya özel:</span>
            <input className="field !w-24" type="number" min={1} max={1440} placeholder="dk" value={custom} onChange={(e) => setCustom(e.target.value)} />
            <span className="text-slate-400">dakika</span>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          {end ? `Kayıt saat ${end} civarında otomatik durur. ` : 'Kayıt siz durdurana kadar sürer. '}
          {mode === 'later'
            ? 'Zamanlı kayıt için uygulama açık (veya tepside) ve bilgisayar uyanık olmalı; kaçırılan kayıtlar listede işaretlenir.'
            : 'Kanal değiştirseniz de arka planda devam eder; Kayıtlar sekmesinden durdurabilirsiniz.'}
        </p>
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Vazgeç</button>
          {mode === 'now'
            ? <button className="btn-primary" onClick={() => onStart(value)}>⏺ Kaydı başlat</button>
            : <button className="btn-primary" disabled={invalid} onClick={() => onSchedule(startAt, value)}>⏰ Zamanla</button>}
        </div>
      </div>
    </div>
  )
}
