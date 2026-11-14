import { parseM3U } from '../../../shared/m3u'

self.onmessage = (e: MessageEvent<{ text: string }>) => {
  try {
    ;(self as unknown as Worker).postMessage({ ok: true, result: parseM3U(e.data.text) })
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ ok: false, error: (err as Error).message })
  }
}
