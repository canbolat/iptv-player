import { useStore } from '../store'

const fmtSize = (b: number) => (b > 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${(b / 1e6).toFixed(1)} MB`)
const fmtDur = (ms: number) => {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return `${h ? h + ' sa ' : ''}${m} dk ${sec} sn`
}
const hhmm = (t: number) => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

export default function RecordingsView({ type }: { type: 'record' | 'download' }) {
  const all = useStore((s) => s.recordings)
  const refresh = useStore((s) => s.refreshRecordings)
  const schedules = useStore((s) => s.schedules)
  const { removeSchedule, playLocal } = useStore.getState()
  const list = all.filter((r) => r.type === type)
  const isRec = type === 'record'
  const act = async (fn: () => Promise<unknown>) => { await fn(); await refresh() }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-line flex items-center gap-3">
        <h1 className="text-lg font-semibold flex-1">{isRec ? 'Kayıtlar' : 'İndirilenler'}</h1>
        <button className="btn" onClick={() => window.api.showRecordingFolder(undefined, type)}>📂 Klasörü aç</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isRec && schedules.length > 0 && (
          <div className="space-y-2 pb-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">Zamanlanmış kayıtlar</div>
            {schedules.map((sc) => (
              <div key={sc.id} className="p-3 rounded-lg bg-panel border border-line flex items-center gap-3">
                <span className="text-lg">{sc.status === 'pending' ? '⏰' : sc.status === 'started' ? '✅' : sc.status === 'missed' ? '⚠️' : '❌'}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{sc.title}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(sc.startAt).toLocaleString('tr-TR')} · {sc.minutes ? `${sc.minutes} dk` : 'elle durdurulacak'} ·{' '}
                    {{ pending: 'bekliyor', started: 'başladı', missed: 'kaçırıldı (uygulama kapalıydı)', error: 'hata' }[sc.status]}
                  </div>
                  {sc.error && <div className="text-xs text-red-400">{sc.error}</div>}
                </div>
                <button className="btn" onClick={() => removeSchedule(sc.id)}>{sc.status === 'pending' ? 'İptal' : 'Kaldır'}</button>
              </div>
            ))}
          </div>
        )}
        {list.length === 0 && (
          <div className="text-sm text-slate-500 max-w-lg">
            {isRec
              ? 'Kayıt yok. Canlı bir kanal izlerken oynatıcıdaki ⏺ Kaydet düğmesine basın; süreyi seçebilir veya elle durdurabilirsiniz. Kayıtlar .ts dosyasıdır; VLC, mpv veya Windows\'un varsayılan oynatıcısıyla açılır.'
              : 'İndirme yok. Film veya dizi ayrıntısında ⬇ İndir düğmesini kullanın. Aynı anda en fazla 2 indirme yürür, diğerleri sırada bekler.'}
          </div>
        )}
        {list.map((r) => {
          const active = r.status === 'recording'
          const pct = r.total ? Math.min(100, (r.bytes / r.total) * 100) : 0
          return (
            <div key={r.id} className="p-3 rounded-lg bg-panel border border-line space-y-2">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full shrink-0 ${active ? 'bg-red-500 animate-pulse' : r.status === 'error' ? 'bg-amber-500' : r.status === 'done' ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate" title={r.title}>{r.title}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(r.startedAt).toLocaleString('tr-TR')}
                    {r.status === 'queued' ? ' · sırada' : ` · ${fmtDur((r.endedAt ?? Date.now()) - r.startedAt)} · ${fmtSize(r.bytes)}${r.total ? ` / ${fmtSize(r.total)}` : ''}`}
                    {active && isRec && (r.stopAt ? ` · ${hhmm(r.stopAt)}'de durur` : ' · elle durdurulacak')}
                    {isRec && !!r.reconnects && ` · ${r.reconnects} yeniden bağlanma`}
                    {r.status === 'cancelled' && ' · iptal edildi'}
                  </div>
                </div>
                {(active || r.status === 'queued') ? (
                  <button className="btn !bg-red-600 hover:!bg-red-500" onClick={() => act(() => window.api.stopRecording(r.id))}>
                    {isRec ? '⏹ Durdur' : '✕ İptal'}
                  </button>
                ) : (
                  <>
                    {r.bytes > 0 && r.file && <button className="btn" title="Uygulamada oynat" onClick={() => playLocal(r)}>▶ İzle</button>}
                    {r.bytes > 0 && r.file && <button className="btn" title="Varsayılan oynatıcıda aç" onClick={async () => { const x = await window.api.openRecording(r.id); if (!x.ok) alert(x.error) }}>Aç</button>}
                    {r.file && <button className="btn" title="Klasörde göster" onClick={() => window.api.showRecordingFolder(r.id, type)}>📂</button>}
                    <button className="btn" title="Sil" onClick={() => { if (confirm('Dosya silinsin mi?')) act(() => window.api.deleteRecording(r.id)) }}>🗑</button>
                  </>
                )}
              </div>
              {!isRec && active && r.total ? (
                <div className="h-1.5 rounded bg-white/10"><div className="h-full rounded bg-accent" style={{ width: `${pct}%` }} /></div>
              ) : null}
              {r.error && <div className="text-xs text-red-400 break-words">{r.error}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
