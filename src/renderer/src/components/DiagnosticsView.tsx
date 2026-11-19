import { useMemo } from 'react'
import { useStore } from '../store'

export default function DiagnosticsView() {
  const diag = useStore((s) => s.diag)
  const settings = useStore((s) => s.settings)
  const clear = useStore((s) => s.clearDiag)
  const rows = useMemo(() => Object.values(diag).sort((a, b) => b.stalls + b.retries - (a.stalls + a.retries)), [diag])

  const report = async () => {
    const lines = [
      `IPTV Player tanılama raporu (${new Date().toLocaleString('tr-TR')})`,
      `Ayarlar: tampon=${settings.bufferSec}sn, biriktirme=${settings.prebufferSec}sn, motor=${settings.engine}, xtream=${settings.liveExt}, donanım hızlandırma=${settings.hwAccel}`,
      '',
      ...rows.map((r) => `${r.title} | motor=${r.mode} | izleme=${r.plays} takılma=${r.stalls} yeniden-bağlanma=${r.retries} hata=${r.errors} düşen-kare=${r.dropped}${r.lastError ? ' | son hata: ' + r.lastError : ''}`)
    ]
    try { await navigator.clipboard.writeText(lines.join('\n')); alert('Rapor panoya kopyalandı') } catch { alert(lines.join('\n')) }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-line flex items-center gap-3">
        <h1 className="text-lg font-semibold flex-1">Tanılama</h1>
        <button className="btn" onClick={report} disabled={rows.length === 0}>Raporu kopyala</button>
        <button className="btn" onClick={() => { if (confirm('Tanılama verisi silinsin mi?')) clear() }} disabled={rows.length === 0}>Temizle</button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {rows.length === 0 ? (
          <div className="text-sm text-slate-500 max-w-lg">
            Henüz veri yok. Kanalları izledikçe burada her kanalın kaç kez takıldığı, yeniden bağlandığı ve hangi motorla açıldığı görünür.
            En çok takılan kanallar üstte listelenir; hepsi aynı sağlayıcıdan ve aynı anda takılıyorsa sorun büyük olasılıkla bağlantı veya sağlayıcıdadır.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 text-xs">
              <tr><th className="py-2 pr-4">Kanal</th><th className="pr-4">Motor</th><th className="pr-4">İzleme</th><th className="pr-4">Takılma</th>
                <th className="pr-4">Yeniden bağlanma</th><th className="pr-4">Düşen kare</th><th>Son hata</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.title} className="border-t border-line">
                  <td className="py-2 pr-4 max-w-[260px] truncate" title={r.title}>{r.title}</td>
                  <td className="pr-4">{r.mode || '-'}</td>
                  <td className="pr-4">{r.plays}</td>
                  <td className={`pr-4 ${r.stalls > 5 ? 'text-amber-400' : ''}`}>{r.stalls}</td>
                  <td className={`pr-4 ${r.retries > 0 ? 'text-amber-400' : ''}`}>{r.retries}</td>
                  <td className="pr-4">{r.dropped}</td>
                  <td className="text-xs text-red-400 max-w-[220px] truncate" title={r.lastError}>{r.lastError ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
