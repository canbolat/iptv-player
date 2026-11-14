import { net } from 'electron'
import { getSettings } from './store'

export async function fetchBuffer(url: string, ua?: string): Promise<Buffer> {
  const res = await net.fetch(url, {
    headers: { 'User-Agent': ua || getSettings().userAgent },
    signal: AbortSignal.timeout(60_000)
  })
  if (!res.ok) throw new Error(`Sunucu yanıtı: HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

export async function fetchText(url: string, ua?: string): Promise<string> {
  return (await fetchBuffer(url, ua)).toString('utf8')
}

export async function fetchJson<T = unknown>(url: string): Promise<T> {
  const text = await fetchText(url)
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('Sunucu geçerli bir JSON döndürmedi (adres veya bilgiler hatalı olabilir)')
  }
}

/** URL'lerdeki kimlik bilgilerini günlüklerde maskeler. */
export function maskUrl(u: string): string {
  return u.replace(/(\/(?:live|movie|series)\/)[^/]+\/[^/]+\//, '$1***/***/').replace(/(password=)[^&]+/i, '$1***').replace(/((?:mac|play_token|token)=)[^&]+/gi, '$1***')
}
