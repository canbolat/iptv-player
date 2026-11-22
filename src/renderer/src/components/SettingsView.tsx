import { useEffect, useMemo, useState } from 'react'
import type { Profile, Settings, UpdateStatus } from '../../../shared/types'
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
          {profiles.length === 0 && <div className="text-sm text-ink/45">Kayıtlı profil yok.</div>}
          {profiles.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-panel border border-line">
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{p.name}</div>
                <div className="text-xs text-ink/45">{p.type === 'xtream' ? `Xtream · ${p.server}` : p.type === 'stalker' ? `Stalker · ${p.server}` : p.path ? 'M3U · yerel dosya' : 'M3U · URL'}</div>
              </div>
              <button className="btn" onClick={() => onEdit(p)}>Düzenle</button>
              <button className="btn" onClick={() => { if (confirm(`"${p.name}" silinsin mi?`)) deleteProfile(p.id) }}>Sil</button>
            </div>
          ))}
        </section>

        <section className="space-y-2">
          <h2 className="font-medium">Ağ</h2>
          <label className="text-sm text-ink/60">User-Agent (playlist, API ve yayın istekleri)</label>
          <div className="flex gap-2">
            <input className="field" value={ua} onChange={(e) => setUa(e.target.value)} />
            <button className="btn-primary" onClick={() => patch({ userAgent: ua.trim() || 'VLC/3.0.20 LibVLC/3.0.20' })}>Kaydet</button>
          </div>
          <label className="text-sm text-ink/60 block pt-2">Xtream canlı yayın biçimi</label>
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
          <label className="text-sm text-ink/60 block pt-2">Oynatma motoru (dahili oynatıcı)</label>
          <select className="field max-w-md" value={settings.pipeline}
            onChange={(e) => patch({ pipeline: e.target.value as Settings['pipeline'] })}>
            <option value="native">Hızlı (tarayıcı: mpegts.js / hls.js)</option>
            <option value="ffmpeg">Kararlı (ffmpeg ara katmanı)</option>
          </select>
          {settings.pipeline === 'ffmpeg' && (
            <select className="field max-w-md" value={settings.ffmpegVideo}
              onChange={(e) => patch({ ffmpegVideo: e.target.value as Settings['ffmpegVideo'] })}>
              <option value="auto">Video: otomatik (önce kopyala, olmazsa yeniden kodla)</option>
              <option value="copy">Video: kopyala (hafif, H.264 için)</option>
              <option value="transcode">Video: yeniden kodla (HEVC/MPEG-2 için, işlemciyi yorar)</option>
            </select>
          )}
          <p className="text-xs text-ink/45">
            Kararlı mod yayını ffmpeg ile tarayıcının çözebildiği biçime çevirir: AC3/MP2 gibi sesleri çözer, bozuk akışları ve kopmaları yönetir,
            başlangıçta biriktirme süresi kadar tampon verir. Başlangıç birkaç saniye gecikir, yalnızca canlı yayınlarda kullanılır.
            Oynatıcıda ⓘ (veya I tuşu) ile teknik bilgi panelini açıp donmanın nedenine (ağ, çözme, ses codec'i) bakabilirsiniz.
          </p>
          <label className="text-sm text-ink/60 block pt-2">Oynatıcı</label>
          <select className="field max-w-xs" value={settings.playerMode}
            onChange={(e) => patch({ playerMode: e.target.value as Settings['playerMode'] })}>
            <option value="internal">Dahili oynatıcı</option>
            <option value="external">Harici oynatıcı (mpv / VLC)</option>
          </select>
          <label className="text-sm text-ink/60 block pt-2">Harici oynatıcı yolu (mpv.exe / vlc.exe)</label>
          <div className="flex gap-2">
            <input className="field" placeholder="C:\Program Files\VideoLAN\VLC\vlc.exe" value={ext} onChange={(e) => setExt(e.target.value)} />
            <button className="btn-primary" onClick={() => patch({ externalPlayer: ext.trim() })}>Kaydet</button>
          </div>
          <label className="text-sm text-ink/60 block pt-2">Harici oynatıcı ek parametreleri</label>
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
            <label className="w-64 text-ink/60">İleri tampon hedefi (sn, 5–120)</label>
            <input className="field !w-24" type="number" min={5} max={120} value={buf}
              onChange={(e) => setBuf(Number(e.target.value))}
              onBlur={() => patch({ bufferSec: Math.min(120, Math.max(5, Math.round(buf) || 30)) })} />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <label className="w-64 text-ink/60">Başlamadan/takılınca biriktirme (sn, 0–15)</label>
            <input className="field !w-24" type="number" min={0} max={15} value={pre}
              onChange={(e) => setPre(Number(e.target.value))}
              onBlur={() => patch({ prebufferSec: Math.min(15, Math.max(0, Math.round(pre) || 0)) })} />
          </div>
          <label className="text-sm text-ink/60 block pt-2">Uzantısız canlı adreslerde motor</label>
          <select className="field max-w-xs" value={settings.engine} onChange={(e) => patch({ engine: e.target.value as Settings['engine'] })}>
            <option value="auto">Otomatik</option>
            <option value="ts">MPEG-TS</option>
            <option value="hls">HLS</option>
          </select>
          <p className="text-xs text-ink/45">
            Donma sürüyorsa önce biriktirmeyi 6–10 sn, ileri tamponu 40–60 sn yapın; sonra Xtream biçimini .ts / .m3u8 arasında değiştirin.
            Biriktirme yalnızca MPEG-TS yayınlarda çalışır; başlangıcı ve takılma sonrası devamı birkaç saniye geciktirir.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-medium">Kayıt ve indirme klasörleri</h2>
          {([['recordDir', 'Canlı kayıtlar', 'Videolar\\IPTV Kayitlari'], ['downloadDir', 'Film/dizi indirmeleri', 'Videolar\\IPTV Indirilenler']] as const).map(([key, label, ph]) => (
            <div key={key}>
              <label className="text-sm text-ink/60 block">{label}</label>
              <div className="flex gap-2">
                <input className="field" readOnly placeholder={`${ph} (varsayılan)`} value={settings[key]} />
                <button className="btn" onClick={async () => { const d = await window.api.pickFolder(); if (d) patch({ [key]: d } as Partial<Settings>) }}>Seç…</button>
                {settings[key] && <button className="btn" onClick={() => patch({ [key]: '' } as Partial<Settings>)}>Varsayılan</button>}
              </div>
            </div>
          ))}
        </section>

        <AppearanceSection />
        <GeneralSection />
        <ParentalSection />
        <UpdateSection />

        <section className="space-y-2">
          <h2 className="font-medium">Önbellek</h2>
          <button className="btn" onClick={async () => { await window.api.clearCache(); flash('Önbellek temizlendi') }}>EPG ve ağ önbelleğini temizle</button>
        </section>

        {msg && <div className="fixed bottom-4 right-4 px-4 py-2 rounded-md bg-emerald-600 text-sm">{msg}</div>}
      </div>
    </div>
  )
}

const clean = (e: unknown) => (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

function GeneralSection() {
  const settings = useStore((s) => s.settings)
  const { saveSettings } = useStore.getState()
  return (
    <section className="space-y-2">
      <h2 className="font-medium">Genel</h2>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={settings.closeToTray} onChange={(e) => saveSettings({ closeToTray: e.target.checked })} />
        Pencereyi kapatınca sistem tepsisine küçült (kayıtlar ve zamanlı kayıtlar sürer)
      </label>
      <label className="text-sm text-ink/60 block pt-2">Dil / Language</label>
      <select className="field max-w-xs" value={settings.language} onChange={(e) => saveSettings({ language: e.target.value as Settings['language'] })}>
        <option value="tr">Türkçe</option>
        <option value="en">English</option>
      </select>
    </section>
  )
}

function ParentalSection() {
  const pinSet = useStore((s) => s.pinSet)
  const locks = useStore((s) => s.locks)
  const activeId = useStore((s) => s.activeId)
  const items = useStore((s) => s.items)
  const { loadPin } = useStore.getState()
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [filter, setFilter] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set(locks))
  const [msg, setMsg] = useState('')

  useEffect(() => setSel(new Set(locks)), [locks])
  const groups = useMemo(
    () => [...new Set([...items.live, ...items.vod, ...items.series].map((i) => i.group))].sort((a, b) => a.localeCompare(b, 'tr')),
    [items])
  const shown = groups.filter((g) => g.toLowerCase().includes(filter.toLowerCase())).slice(0, 300)
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); await loadPin(); setCur(''); setNext(''); flash(ok) } catch (e) { flash(clean(e)) }
  }

  return (
    <section className="space-y-2">
      <h2 className="font-medium">Ebeveyn kilidi</h2>
      <p className="text-xs text-ink/45">Seçilen kategoriler PIN girilene kadar listelerden gizlenir. Kilit arayüz düzeyindedir; profilin kendisi korunmaz.</p>
      {pinSet && (
        <input className="field max-w-xs" type="password" inputMode="numeric" maxLength={8} placeholder="Mevcut PIN"
          value={cur} onChange={(e) => setCur(e.target.value.replace(/\D/g, ''))} />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input className="field max-w-xs" type="password" inputMode="numeric" maxLength={8}
          placeholder={pinSet ? 'Yeni PIN (4-8 rakam)' : 'PIN belirle (4-8 rakam)'}
          value={next} onChange={(e) => setNext(e.target.value.replace(/\D/g, ''))} />
        <button className="btn-primary" onClick={() => run(() => window.api.setPin(next, pinSet ? cur : undefined), 'PIN kaydedildi')}>
          {pinSet ? 'PIN değiştir' : 'PIN belirle'}
        </button>
        {pinSet && <button className="btn" onClick={() => run(() => window.api.removePin(cur), 'PIN kaldırıldı')}>PIN kaldır</button>}
      </div>

      {pinSet && activeId && (
        <div className="pt-2 space-y-2">
          <div className="text-sm text-ink/60">Kilitlenecek kategoriler ({sel.size} seçili, mevcut profil)</div>
          <input className="field max-w-xs" placeholder="Kategori ara" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="max-h-56 overflow-y-auto border border-line rounded-md divide-y divide-line">
            {shown.length === 0 && <div className="p-3 text-sm text-ink/45">Kategori yok (içerik henüz yüklenmemiş olabilir).</div>}
            {shown.map((g) => (
              <label key={g} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-ink/5">
                <input type="checkbox" checked={sel.has(g)}
                  onChange={(e) => setSel((o) => { const n = new Set(o); e.target.checked ? n.add(g) : n.delete(g); return n })} />
                <span className="truncate">{g}</span>
              </label>
            ))}
          </div>
          <button className="btn-primary" onClick={() => run(() => window.api.setLocks(activeId, [...sel], cur), 'Kilitler kaydedildi')}>Kilitleri kaydet (mevcut PIN gerekir)</button>
        </div>
      )}
      {msg && <div className="text-sm text-emerald-400">{msg}</div>}
    </section>
  )
}

function UpdateSection() {
  const settings = useStore((s) => s.settings)
  const { saveSettings } = useStore.getState()
  const [ver, setVer] = useState('')
  const [st, setSt] = useState<UpdateStatus>({ state: 'idle' })

  useEffect(() => {
    window.api.appVersion().then(setVer)
    window.api.updateStatus().then(setSt)
    return window.api.onUpdateStatus(setSt)
  }, [])

  const text: Record<UpdateStatus['state'], string> = {
    idle: '', dev: 'Geliştirme modunda güncelleme denetlenmez.', checking: 'Denetleniyor…',
    available: `Yeni sürüm var: ${st.version ?? ''}`, none: 'Uygulama güncel.',
    downloading: `İndiriliyor… %${st.percent ?? 0}`, ready: `Sürüm ${st.version ?? ''} indirildi, yüklemeye hazır.`,
    error: `Güncelleme denetlenemedi: ${st.message ?? ''}`
  }
  return (
    <section className="space-y-2">
      <h2 className="font-medium">Güncellemeler</h2>
      <div className="text-sm text-ink/60">Sürüm {ver}</div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={settings.autoUpdate} onChange={(e) => saveSettings({ autoUpdate: e.target.checked })} />
        Açılışta güncellemeleri otomatik denetle
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn" onClick={() => window.api.checkUpdate().then(setSt)} disabled={st.state === 'checking' || st.state === 'downloading'}>Güncellemeleri denetle</button>
        {st.state === 'available' && <button className="btn-primary" onClick={() => window.api.downloadUpdate()}>İndir</button>}
        {st.state === 'ready' && <button className="btn-primary" onClick={() => window.api.installUpdate()}>Yeniden başlat ve yükle</button>}
      </div>
      {text[st.state] && <div className="text-sm text-ink/80">{text[st.state]}</div>}
      <p className="text-xs text-ink/45">Otomatik güncelleme, sürümlerin GitHub Releases üzerinde herkese açık bir depodan yayınlanmasını gerektirir.</p>
    </section>
  )
}

const THEMES: { id: Settings['theme']; label: string; bg: string; panel: string; ink: string }[] = [
  { id: 'dark', label: 'Koyu', bg: '#0b0d12', panel: '#12151c', ink: '#e5e7eb' },
  { id: 'amoled', label: 'AMOLED siyah', bg: '#000000', panel: '#09090b', ink: '#e5e7eb' },
  { id: 'light', label: 'Açık', bg: '#f2f4f8', panel: '#ffffff', ink: '#0f172a' },
  { id: 'system', label: 'Sistemi izle', bg: 'linear-gradient(135deg,#0b0d12 50%,#f2f4f8 50%)', panel: '#8884', ink: '#94a3b8' }
]

const ACCENTS: { id: Settings['accent']; label: string; color: string }[] = [
  { id: 'indigo', label: 'İndigo', color: '#6366f1' }, { id: 'blue', label: 'Mavi', color: '#3b82f6' },
  { id: 'sky', label: 'Gök mavisi', color: '#0ea5e9' }, { id: 'emerald', label: 'Zümrüt', color: '#10b981' },
  { id: 'rose', label: 'Gül', color: '#f43f5e' }, { id: 'amber', label: 'Kehribar', color: '#d97706' },
  { id: 'violet', label: 'Mor', color: '#8b5cf6' }
]

function AppearanceSection() {
  const settings = useStore((s) => s.settings)
  const { saveSettings } = useStore.getState()
  return (
    <section className="space-y-3">
      <h2 className="font-medium">Görünüm</h2>
      <div>
        <div className="text-sm text-ink/60 mb-2">Tema</div>
        <div className="flex flex-wrap gap-3">
          {THEMES.map((t) => (
            <button key={t.id} onClick={() => saveSettings({ theme: t.id })} className="text-left group">
              <div className={`w-32 h-20 rounded-lg overflow-hidden border-2 transition ${settings.theme === t.id ? 'border-accent' : 'border-line group-hover:border-ink/30'}`}
                style={{ background: t.bg }}>
                <div className="flex h-full">
                  <div className="w-1/4 h-full" style={{ background: t.panel }} />
                  <div className="flex-1 p-2 space-y-1.5">
                    <div className="h-2 rounded" style={{ background: t.ink, opacity: 0.55, width: '70%' }} />
                    <div className="h-2 rounded" style={{ background: t.ink, opacity: 0.25, width: '50%' }} />
                    <div className="h-3 rounded w-8 bg-accent" />
                  </div>
                </div>
              </div>
              <div className="text-xs mt-1 text-ink/70">{t.label}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-sm text-ink/60 mb-2">Vurgu rengi</div>
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((a) => (
            <button key={a.id} title={a.label} aria-label={a.label} onClick={() => saveSettings({ accent: a.id })}
              className={`w-8 h-8 rounded-full transition ring-offset-2 ring-offset-bg ${settings.accent === a.id ? 'ring-2 ring-ink/80 scale-110' : 'hover:scale-110'}`}
              style={{ background: a.color }} />
          ))}
        </div>
      </div>
      <div>
        <div className="text-sm text-ink/60 mb-1">Liste yoğunluğu</div>
        <select className="field max-w-xs" value={settings.density} onChange={(e) => saveSettings({ density: e.target.value as Settings['density'] })}>
          <option value="normal">Normal</option>
          <option value="compact">Sıkışık (daha fazla kanal görünür)</option>
        </select>
      </div>
    </section>
  )
}
