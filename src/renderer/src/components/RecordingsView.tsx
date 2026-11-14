import { useStore } from '../store'

const fmtSize = (b: number) => (b > 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${(b / 1e6).toFixed(1)} MB`)
const fmtDur = (ms: number) => {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return `${h ? h + ' sa ' : ''}${m} dk ${sec} sn`
}

export default function RecordingsView() {
  const recordings = useStore((s) => s.recordings)
  const refresh = useStore((s) => s.refreshRecordings)

  const act = async (fn: () => Promise<unknown>) => { await fn(); await refresh() }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-line flex items-center gap-3">
        <h1 className="text-lg font-semibold flex-1">Kayıtlar</h1>
        <button className="btn" onClick={() => window.api.showRecordingFolder()}>📂 Kayıt klasörünü aç</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {recordings.length === 0 && (
          <div className="text-sm text-slate-500 max-w-lg">
            Bu oturumda kayıt yok. Canlı bir kanal izlerken oynatıcıdaki <b>⏺ Kaydet</b> düğmesine basın.
            Kayıtlar .ts dosyası olarak kayıt klasörüne yazılır; VLC, mpv veya Windows'un varsayılan oynatıcısıyla açılır.
            Kayıt, kanalı izlemeyi bıraksanız da arka planda sürer.
          </div>
        )}
        {recordings.map((r) => (
          <div key={r.id} className="p-3 rounded-lg bg-panel border border-line flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full shrink-0 ${r.status === 'recording' ? 'bg-red-500 animate-pulse' : r.status === 'error' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <div className="min-w-0 flex-1">
              <div className="text-sm truncate">{r.title}</div>
              <div className="text-xs text-slate-500">
                {new Date(r.startedAt).toLocaleString('tr-TR')} · {fmtDur((r.endedAt ?? Date.now()) - r.startedAt)} · {fmtSize(r.bytes)}
                {r.status === 'recording' && ' · kaydediliyor'}
              </div>
              {r.error && <div className="text-xs text-red-400 mt-1 break-words">{r.error}</div>}
            </div>
            {r.status === 'recording' ? (
              <button className="btn !bg-red-600 hover:!bg-red-500" onClick={() => act(() => window.api.stopRecording(r.id))}>⏹ Durdur</button>
            ) : (
              <>
                {r.bytes > 0 && <button className="btn" onClick={async () => { const x = await window.api.openRecording(r.id); if (!x.ok) alert(x.error) }}>▶ Aç</button>}
                <button className="btn" onClick={() => window.api.showRecordingFolder(r.id)}>📂</button>
                <button className="btn" onClick={() => { if (confirm('Kayıt dosyası silinsin mi?')) act(() => window.api.deleteRecording(r.id)) }}>🗑</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
