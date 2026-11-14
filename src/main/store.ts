import Store from 'electron-store'
import { safeStorage } from 'electron'
import { DEFAULT_SETTINGS } from '../shared/types'
import type { HistoryEntry, Profile, RecInfo, Settings } from '../shared/types'

export interface StoredProfile extends Profile {
  passwordEnc?: string
}

interface Schema {
  profiles: StoredProfile[]
  settings: Settings
  favorites: Record<string, string[]>
  history: HistoryEntry[]
  records: RecInfo[]
}

export const store = new Store<Schema>({
  defaults: { profiles: [], settings: DEFAULT_SETTINGS, favorites: {}, history: [], records: [] }
})

export function getSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...store.get('settings') }
}

export function encryptSecret(plain: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return 'enc:' + safeStorage.encryptString(plain).toString('base64')
  }
  return 'plain:' + Buffer.from(plain, 'utf8').toString('base64')
}

export function decryptSecret(stored?: string): string {
  if (!stored) return ''
  try {
    if (stored.startsWith('enc:')) {
      return safeStorage.decryptString(Buffer.from(stored.slice(4), 'base64'))
    }
    if (stored.startsWith('plain:')) return Buffer.from(stored.slice(6), 'base64').toString('utf8')
  } catch {
    /* bozuk kayıt */
  }
  return ''
}

export function findProfile(id: string): StoredProfile {
  const p = store.get('profiles').find((x) => x.id === id)
  if (!p) throw new Error('Profil bulunamadı')
  return p
}

/** Renderer'a asla şifre göndermeyiz. */
export function publicProfile(p: StoredProfile): Profile {
  const { passwordEnc, ...rest } = p
  return { ...rest, hasPassword: !!passwordEnc }
}
