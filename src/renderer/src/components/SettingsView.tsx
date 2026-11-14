import { useEffect, useState } from 'react'
import type { Profile, Settings } from '../../../shared/types'
import { useStore } from '../store'

export default function SettingsView({ onEdit }: { onEdit(p: Profile): void }) {
  const settings = useStore((s) => s.settings)
  const profiles = useStore((s) => s.profiles)
  const { saveSettings, deleteProfile } = useStore.getState()
  const [ua, setUa] = useState(settings.userAgent)
  const [ext, setExt] = useState(settings.externalPlayer)
  const [msg, setMsg] = useState('')
  const [needRestart, setNeedRestart] = useState(false)

  useEffect(() => { setUa(settings.userAgent); setExt(settings.externalPlayer) }, [settings])
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }
  const patch = async (s: Partial<Settings>, m = 'Kaydedildi') => { await saveSettings(s); flash(m) }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl space-y-8">
        <h1 className="text-xl font-semibold">Ayarlar</h1>

        <section className="space-y-3">
          <h2 className="font-medium">Profiller</h2>
          {profiles.length === 0 && <div className="text-sm text-slate-500">Kayıtlı profil yok.</div>}
          {profiles.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-panel border border-line">
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{p.name}</div>
                <div className="text-xs text-slate-500">{p.type === 'xtream' ? `Xtream · ${p.server}` : p.path ? 'M3U · yerel dosya' : 'M3U · URL'}</div>
              </div>
              <button className="btn" onClick={() => onEdit(p)}>Düzenle</button>
              <button className="btn" onClick={() => { if (confirm(`"${p.name}" silinsin mi?`)) deleteProfile(p.id) }}>Sil</button>
            </div>
          ))}
        </section>

        <section className="space-y-2">
          <h2 className="font-medium">Ağ</h2>
          <label className="text-sm text-slate-400">User-Agent (playlist, API ve yayın istekleri)</label>
          <div className="flex gap-2">
            <input className="field" value={ua} onChange={(e) => setUa(e.target.value)} />
            <button className="btn-primary" onClick={() => patch({ userAgent: ua.trim() || 'VLC/3.0.20 LibVLC/3.0.20' })}>Kaydet</button>
          </div>
          <label className="text-sm text-slate-400 block pt-2">Xtream canlı yayın biçimi</label>
          <select className="field max-w-xs" value={settings.liveExt} onChange={(e) => patch({ liveExt: e.target.value as 'm3u8' | 'ts' })}>
            <option value="m3u8">HLS (.m3u8)</option>
            <option value="ts">MPEG-TS (.ts)</option>
          </select>
        </section>

        <section className="space-y-2">
          <h2 className="font-medium">Oynatıcı</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.hwAccel}
              onChange={async (e) => { await patch({ hwAccel: e.target.checked }); setNeedRestart(true) }} />
            Donanım hızlandırma
          </label>
          {needRestart && (
            <div className="text-sm text-amber-400 flex items-center gap-3">
              Değişiklik için yeniden başlatma gerekir.
              <button className="btn" onClick={() => window.api.relaunch()}>Şimdi yeniden başlat</button>
            </div>
          )}
          <label className="text-sm text-slate-400 block pt-2">Harici oynatıcı yolu (mpv.exe / vlc.exe)</label>
          <div className="flex gap-2">
            <input className="field" placeholder="C:\Program Files\VideoLAN\VLC\vlc.exe" value={ext} onChange={(e) => setExt(e.target.value)} />
            <button className="btn-primary" onClick={() => patch({ externalPlayer: ext.trim() })}>Kaydet</button>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="font-medium">Önbellek</h2>
          <button className="btn" onClick={async () => { await window.api.clearCache(); flash('Önbellek temizlendi') }}>EPG ve ağ önbelleğini temizle</button>
        </section>

        {msg && <div className="fixed bottom-4 right-4 px-4 py-2 rounded-md bg-emerald-600 text-sm">{msg}</div>}
      </div>
    </div>
  )
}
