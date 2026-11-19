import { randomUUID } from 'crypto'
import { store } from './store'
import { startRecording } from './recorder'
import type { PlayTarget, Schedule } from '../shared/types'

type Resolver = (profileId: string, target: PlayTarget) => Promise<string> | string

const MISSED_AFTER_MS = 10 * 60_000
let resolver: Resolver | null = null
let busy = false

const save = (list: Schedule[]) => store.set('schedules', list)

export function listSchedules(): Schedule[] {
  return store.get('schedules').slice().sort((a, b) => a.startAt - b.startAt)
}

export const pendingCount = () => store.get('schedules').filter((s) => s.status === 'pending').length

export function addSchedule(profileId: string, target: PlayTarget, title: string, startAt: number, minutes: number): Schedule {
  if (!Number.isFinite(startAt) || startAt < Date.now() - 60_000) throw new Error('Başlangıç zamanı geçmişte')
  const s: Schedule = {
    id: randomUUID(), profileId, target, title, startAt,
    minutes: Math.min(Math.max(Math.floor(minutes) || 0, 0), 24 * 60), status: 'pending'
  }
  save([...store.get('schedules'), s])
  return s
}

export function removeSchedule(id: string) {
  save(store.get('schedules').filter((s) => s.id !== id))
}

async function tick() {
  if (busy || !resolver) return
  busy = true
  try {
    const now = Date.now()
    const list = store.get('schedules')
    let changed = false
    for (const s of list) {
      if (s.status !== 'pending' || s.startAt > now) continue
      changed = true
      if (now - s.startAt > MISSED_AFTER_MS) { s.status = 'missed'; continue }
      try {
        const url = await resolver(s.profileId, s.target)
        const remaining = s.minutes > 0 ? Math.max(1, Math.ceil((s.startAt + s.minutes * 60_000 - now) / 60_000)) : 0
        startRecording(url, s.title, remaining)
        s.status = 'started'
      } catch (e) {
        s.status = 'error'
        s.error = (e as Error).message
      }
    }
    // Eski kayıtları temizle (7 günden eski, bekleyen olmayan)
    const keep = list.filter((s) => s.status === 'pending' || now - s.startAt < 7 * 24 * 3600_000)
    if (changed || keep.length !== list.length) save(keep)
  } finally {
    busy = false
  }
}

export function startScheduler(r: Resolver) {
  resolver = r
  setTimeout(tick, 3000)
  setInterval(tick, 15_000)
}
