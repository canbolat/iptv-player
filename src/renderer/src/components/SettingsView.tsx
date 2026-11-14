import { useEffect, useState } from 'react'
import type { Profile, Settings } from '../../../shared/types'
import { useStore } from '../store'

export default function SettingsView({ onEdit }: { onEdit(p: Profile): void }) {
  const settings = useStore((s) => s.settings)
  const profiles = useStore((s) => s.profiles)
  const { saveSettings, deleteProfile } = useStore.getState()
  const [ua, setUa] = useState(settings.userAgent)
  const [ext, setExt] = useState(settings.externalPlayer)
  const [args, setArgs] = useState(settings.externalArgs)
  const [buf, setBuf] = useState(settings.bufferSec)
  const [pre, setPre] = useState(settings.prebufferSec)
  const [msg, setMsg] = useState('')
  const [needRestart, setNeedRestart] = useState(false)

  useEffect(() => { setUa(settings.userAgent); setExt(settings.externalPlayer); setArgs(settings.externalArgs); setBuf(settings.bufferSec); setPre(settings.prebufferSec) }, [settings])
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
                <div className="text-xs text-slate-500">{p.type === 'xtream' ? `Xtream · ${p.server}` : p.type === 'stalker' ? `Stalker · ${p.server}` : p.path ? 'M3U · yerel dosya' : 'M3U · URL'}</div>
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
          <label className="text-sm text-slate-400 block pt-2">Oynatıcı</label>
          <select className="field max-w-xs" value={settings.playerMode}
            onChange={(e) => patch({ playerMode: e.target.value as Settings['playerMode'] })}>
            <option value="internal">Dahili oynatıcı</option>
            <option value="external">Harici oynatıcı (mpv / VLC)</option>
          </select>
          <label className="text-sm text-slate-400 block pt-2">Harici oynatıcı yolu (mpv.exe / vlc.exe)</label>
          <div className="flex gap-2">
            <input className="field" placeholder="C:\Program Files\VideoLAN\VLC\vlc.exe" value={ext} onChange={(e) => setExt(e.target.value)} />
            <button className="btn-primary" onClick={() => patch({ externalPlayer: ext.trim() })}>Kaydet</button>
          </div>
          <label className="text-sm text-slate-400 block pt-2">Harici oynatıcı ek parametreleri</label>
          <div className="flex gap-2">
            <input className="field" placeholder="mpv için örn: --cache=yes --demuxer-max-bytes=150MiB" value={args} onChange={(e) => setArgs(e.target.value)} />
            <button className="btn-primary" onClick={() => patch({ externalArgs: args.trim() })}>Kaydet</button>
          </div>
          {settings.playerMode === 'external' && !settings.externalPlayer && (
            <div className="text-xs text-amber-400">Harici mod için oynatıcı yolunu girin; aksi halde dahili oynatıcı kullanılır.</div>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="font-medium">Akış tamponu (donma/takılma)</h2>
          <div className="flex items-center gap-3 text-sm">
            <label className="w-64 text-slate-400">İleri tampon hedefi (sn, 5–120)</label>
            <input className="field !w-24" type="number" min={5} max={120} value={buf}
              onChange={(e) => setBuf(Number(e.target.value))}
              onBlur={() => patch({ bufferSec: Math.min(120, Math.max(5, Math.round(buf) || 30)) })} />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <label className="w-64 text-slate-400">Başlamadan/takılınca biriktirme (sn, 0–15)</label>
            <input className="field !w-24" type="number" min={0} max={15} value={pre}
              onChange={(e) => setPre(Number(e.target.value))}
              onBlur={() => patch({ prebufferSec: Math.min(15, Math.max(0, Math.round(pre) || 0)) })} />
          </div>
          <label className="text-sm text-slate-400 block pt-2">Uzantısız canlı adreslerde motor</label>
          <select className="field max-w-xs" value={settings.engine} onChange={(e) => patch({ engine: e.target.value as Settings['engine'] })}>
            <option value="auto">Otomatik</option>
            <option value="ts">MPEG-TS</option>
            <option value="hls">HLS</option>
          </select>
          <p className="text-xs text-slate-500">
            Donma sürüyorsa önce biriktirmeyi 6–10 sn, ileri tamponu 40–60 sn yapın; sonra Xtream biçimini .ts / .m3u8 arasında değiştirin.
            Biriktirme yalnızca MPEG-TS yayınlarda çalışır; başlangıcı ve takılma sonrası devamı birkaç saniye geciktirir.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-medium">Kayıt ve indirme klasörleri</h2>
          {([['recordDir', 'Canlı kayıtlar', 'Videolar\\IPTV Kayitlari'], ['downloadDir', 'Film/dizi indirmeleri', 'Videolar\\IPTV Indirilenler']] as const).map(([key, label, ph]) => (
            <div key={key}>
              <label className="text-sm text-slate-400 block">{label}</label>
              <div className="flex gap-2">
                <input className="field" readOnly placeholder={`${ph} (varsayılan)`} value={settings[key]} />
                <button className="btn" onClick={async () => { const d = await window.api.pickFolder(); if (d) patch({ [key]: d } as Partial<Settings>) }}>Seç…</button>
                {settings[key] && <button className="btn" onClick={() => patch({ [key]: '' } as Partial<Settings>)}>Varsayılan</button>}
              </div>
            </div>
          ))}
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
