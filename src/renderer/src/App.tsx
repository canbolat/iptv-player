import { useEffect, useState } from 'react'
import type { Profile } from '../../shared/types'
import { Tab, useStore } from './store'
import ContinueView from './components/ContinueView'
import EpgInfo from './components/EpgInfo'
import GridView from './components/GridView'
import LiveView from './components/LiveView'
import Player from './components/Player'
import ProfileDialog from './components/ProfileDialog'
import RecordingsView from './components/RecordingsView'
import SettingsView from './components/SettingsView'

const SIDEBAR_W = 200
const LIST_W = 360

const NAV: { tab: Tab; label: string; icon: string }[] = [
  { tab: 'live', label: 'Canlı TV', icon: '📺' },
  { tab: 'vod', label: 'Filmler', icon: '🎬' },
  { tab: 'series', label: 'Diziler', icon: '🎞️' },
  { tab: 'continue', label: 'Devam Et', icon: '⏯️' },
  { tab: 'recordings', label: 'Kayıtlar', icon: '⏺️' },
  { tab: 'settings', label: 'Ayarlar', icon: '⚙️' }
]

export default function App() {
  const s = useStore()
  const [dialog, setDialog] = useState<{ profile?: Profile } | null>(null)

  useEffect(() => { s.init() }, [])
  useEffect(() => {
    s.refreshRecordings()
    const id = setInterval(() => s.refreshRecordings(), 2000)
    return () => clearInterval(id)
  }, [])

  const profile = s.profiles.find((p) => p.id === s.activeId)
  const p = s.playing
  const live = p?.target.kind === 'live'
  const showPlayer = !!p && (s.mini || p.overlay || (live && s.tab === 'live'))
  const fullscreenLayout = s.mini || !!p?.overlay

  const external = async () => {
    if (!p) return
    const r = await window.api.openExternal(p.url)
    if (!r.ok) alert(r.error)
  }

  if (!s.ready) return null

  return (
    <div className="h-full flex">
      {/* Kenar çubuğu */}
      <aside className={`${s.mini ? 'hidden' : 'flex'} flex-col bg-panel border-r border-line`} style={{ width: SIDEBAR_W }}>
        <div className="p-4 text-lg font-semibold tracking-tight">▶ IPTV Player</div>
        <div className="px-3 pb-3 space-y-2">
          <select className="field" value={s.activeId ?? ''} onChange={(e) => s.selectProfile(e.target.value)} disabled={s.profiles.length === 0}>
            {s.profiles.length === 0 && <option value="">Profil yok</option>}
            {s.profiles.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <div className="flex gap-2">
            <button className="btn flex-1" onClick={() => setDialog({})}>+ Ekle</button>
            {profile && <button className="btn" onClick={() => setDialog({ profile })} title="Profili düzenle">✎</button>}
          </div>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          {NAV.map((n) => (
            <button key={n.tab} onClick={() => s.setTab(n.tab)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 ${s.tab === n.tab ? 'bg-accent/25 text-white' : 'text-slate-400 hover:bg-white/5'}`}>
              <span>{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <div className="p-3 text-[11px] text-slate-600">Boşluk: oynat · F: tam ekran · M: sessiz · ↑↓: kanal</div>
      </aside>

      {/* İçerik */}
      <main className="flex-1 min-w-0 relative">
        {s.profiles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center p-8">
            <div className="text-3xl">📡</div>
            <div className="text-lg font-medium">Başlamak için bir profil ekleyin</div>
            <div className="text-sm text-slate-500 max-w-md">M3U/M3U8 bağlantısı, yerel playlist dosyası veya Xtream Codes hesabı ekleyebilirsiniz. Uygulama hazır içerik sağlamaz.</div>
            <button className="btn-primary" onClick={() => setDialog({})}>Profil ekle</button>
          </div>
        ) : (
          <>
            {s.tab === 'live' && (
              <div className="h-full flex">
                <div className="border-r border-line" style={{ width: LIST_W }}><LiveView /></div>
                <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
                  {s.playError ? <span className="text-red-400">{s.playError}</span> : 'Bir kanal seçin'}
                </div>
              </div>
            )}
            {s.tab === 'vod' && <GridView kind="vod" />}
            {s.tab === 'series' && <GridView kind="series" />}
            {s.tab === 'continue' && <ContinueView />}
            {s.tab === 'recordings' && <RecordingsView />}
            {s.tab === 'settings' && <SettingsView onEdit={(pr) => setDialog({ profile: pr })} />}
          </>
        )}
      </main>

      {/* Oynatıcı: tek noktada, sabit konumlu; yerleşim moda göre değişir */}
      {showPlayer && p && (
        <div className="fixed z-30 bg-black"
          style={fullscreenLayout ? { inset: 0 } : { top: 0, right: 0, bottom: 0, left: SIDEBAR_W + LIST_W }}>
          <Player
            url={p.url}
            title={p.target.title}
            live={!!live}
            startAt={p.startAt}
            mini={s.mini}
            header={live ? <EpgInfo tvgId={p.target.tvgId} /> : undefined}
            onClose={() => s.stop()}
            onStep={(d) => s.step(d)}
            onToggleMini={() => s.setMini(!s.mini)}
            onExternal={external}
            onProgress={(pos, dur) => s.saveProgress(pos, dur)}
            engine={s.settings.engine}
            buffer={s.settings.buffer}
            recording={!!s.rec && s.rec.url === p.url && s.recordings.find((r) => r.id === s.rec!.id)?.status === 'recording'}
            onRecord={live ? () => s.toggleRecord() : undefined}
          />
        </div>
      )}

      {dialog && <ProfileDialog profile={dialog.profile} onClose={() => setDialog(null)} />}
    </div>
  )
}
