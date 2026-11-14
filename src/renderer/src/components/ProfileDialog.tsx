import { useState } from 'react'
import type { Profile, ProfileInput } from '../../../shared/types'
import { useStore } from '../store'

export default function ProfileDialog({ profile, onClose }: { profile?: Profile; onClose(): void }) {
  const saveProfile = useStore((s) => s.saveProfile)
  const [type, setType] = useState<'m3u' | 'xtream' | 'stalker'>(profile?.type ?? 'm3u')
  const [name, setName] = useState(profile?.name ?? '')
  const [url, setUrl] = useState(profile?.url ?? '')
  const [path, setPath] = useState(profile?.path ?? '')
  const [epgUrl, setEpgUrl] = useState(profile?.epgUrl ?? '')
  const [server, setServer] = useState(profile?.server ?? '')
  const [username, setUsername] = useState(profile?.username ?? '')
  const [password, setPassword] = useState('')
  const [mac, setMac] = useState(profile?.mac ?? '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const pick = async () => {
    const f = await window.api.pickM3UFile()
    if (f) { setPath(f.path); setUrl(''); if (!name) setName(f.name) }
  }

  const submit = async () => {
    setErr('')
    if (!name.trim()) return setErr('Profil adı gerekli.')
    const input: ProfileInput = {
      id: profile?.id, name, type, epgUrl,
      ...(type === 'm3u' ? { url: path ? undefined : url, path: path || undefined }
        : type === 'xtream' ? { server, username, password } : { server, mac })
    }
    setBusy(true)
    try {
      await saveProfile(input)
      onClose()
    } catch (e) {
      setErr((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="w-full max-w-lg bg-panel border border-line rounded-xl p-5 space-y-4" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">{profile ? 'Profili düzenle' : 'Yeni profil'}</h2>

        <div className="flex gap-2">
          {(['m3u', 'xtream', 'stalker'] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} disabled={!!profile}
              className={`flex-1 py-2 rounded-md text-sm border ${type === t ? 'border-accent bg-accent/20' : 'border-line bg-bg'} disabled:opacity-60`}>
              {t === 'm3u' ? 'M3U / M3U8' : t === 'xtream' ? 'Xtream Codes' : 'Stalker (MAC)'}
            </button>
          ))}
        </div>

        <input className="field" placeholder="Profil adı" value={name} onChange={(e) => setName(e.target.value)} />

        {type === 'm3u' ? (
          <>
            <input className="field" placeholder="Playlist URL (http/https)" value={url} disabled={!!path}
              onChange={(e) => setUrl(e.target.value)} />
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <button className="btn" onClick={pick}>Dosya seç…</button>
              <span className="truncate flex-1">{path || 'veya yerel .m3u/.m3u8 dosyası'}</span>
              {path && <button className="btn" onClick={() => setPath('')}>Temizle</button>}
            </div>
          </>
        ) : type === 'stalker' ? (
          <>
            <input className="field" placeholder="Portal URL (örn. http://portal.example:8080/c/)" value={server} onChange={(e) => setServer(e.target.value)} />
            <input className="field" placeholder="MAC adresi (00:1A:79:XX:XX:XX)" value={mac} onChange={(e) => setMac(e.target.value)} />
            <p className="text-xs text-slate-500">Canlı TV desteklenir; film ve dizi deneyseldir. MAC adresi sağlayıcınızda kayıtlı olmalıdır.</p>
          </>
        ) : (
          <>
            <input className="field" placeholder="Sunucu URL (örn. http://sunucu:8080)" value={server} onChange={(e) => setServer(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className="field" placeholder="Kullanıcı adı" value={username} onChange={(e) => setUsername(e.target.value)} />
              <input className="field" type="password" placeholder={profile?.hasPassword ? 'Şifre (değiştirmek için yazın)' : 'Şifre'}
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </>
        )}

        <input className="field" placeholder="EPG (XMLTV) URL, isteğe bağlı" value={epgUrl} onChange={(e) => setEpgUrl(e.target.value)} />
        {type === 'xtream' && <p className="text-xs text-slate-500">EPG boş bırakılırsa hesabın kendi XMLTV adresi otomatik kullanılır.</p>}

        {err && <div className="text-sm text-red-400">{err}</div>}
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
        </div>
      </div>
    </div>
  )
}
