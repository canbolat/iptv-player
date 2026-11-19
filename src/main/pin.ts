import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { store } from './store'

const valid = (pin: unknown): pin is string => typeof pin === 'string' && /^\d{4,8}$/.test(pin)
const hash = (pin: string, salt: string) => scryptSync(pin, salt, 32).toString('hex')

export const hasPin = () => !!store.get('pin')

export function verifyPin(pin: unknown): boolean {
  const cur = store.get('pin')
  if (!cur) return true
  if (!valid(pin)) return false
  const a = Buffer.from(hash(pin, cur.salt), 'hex')
  const b = Buffer.from(cur.hash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

export function setPin(newPin: unknown, oldPin?: unknown) {
  if (!valid(newPin)) throw new Error('PIN 4-8 haneli rakamlardan oluşmalı')
  if (hasPin() && !verifyPin(oldPin)) throw new Error('Mevcut PIN yanlış')
  const salt = randomBytes(16).toString('hex')
  store.set('pin', { salt, hash: hash(newPin, salt) })
}

export function removePin(oldPin: unknown) {
  if (!verifyPin(oldPin)) throw new Error('Mevcut PIN yanlış')
  store.delete('pin')
}

export const getLocks = (profileId: string): string[] => store.get('locks')[profileId] ?? []

export function setLocks(profileId: string, groups: string[], pin?: unknown) {
  if (hasPin() && !verifyPin(pin)) throw new Error('PIN yanlış')
  const all = store.get('locks')
  all[profileId] = [...new Set(groups.map(String))].slice(0, 2000)
  store.set('locks', all)
}
