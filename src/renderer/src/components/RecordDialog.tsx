import { useState } from 'react'

const PRESETS: [number, string][] = [[0, 'Elle durdururum'], [30, '30 dk'], [60, '1 saat'], [120, '2 saat'], [180, '3 saat']]

export default function RecordDialog({ title, onStart, onClose }: { title: string; onStart(minutes: number): void; onClose(): void }) {
  const [minutes, setMinutes] = useState(0)
  const [custom, setCustom] = useState('')
  const value = custom ? Math.max(0, Math.floor(Number(custom)) || 0) : minutes
  const end = value > 0 ? new Date(Date.now() + value * 60_000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="w-full max-w-md bg-panel border border-line rounded-xl p-5 space-y-4" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Kaydı başlat</h2>
        <div className="text-sm text-slate-400 truncate">{title}</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(([m, label]) => (
            <button key={m} onClick={() => { setMinutes(m); setCustom('') }}
              className={`px-3 py-1.5 rounded-md text-sm border ${!custom && minutes === m ? 'border-accent bg-accent/20' : 'border-line bg-bg'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">veya özel süre:</span>
          <input className="field !w-24" type="number" min={1} max={1440} placeholder="dk" value={custom} onChange={(e) => setCustom(e.target.value)} />
          <span className="text-slate-400">dakika</span>
        </div>
        <p className="text-xs text-slate-500">
          {end ? `Kayıt saat ${end} civarında otomatik durur. ` : 'Kayıt siz durdurana kadar sürer. '}
          Kanal değiştirseniz ya da farklı sekmeye geçseniz de arka planda devam eder; Kayıtlar sekmesinden durdurabilirsiniz.
        </p>
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn-primary" onClick={() => onStart(value)}>⏺ Kaydı başlat</button>
        </div>
      </div>
    </div>
  )
}
