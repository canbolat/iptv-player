import type { Settings } from '../../shared/types'

const KEY = 'theme'

/** Seçili temayı <html> üzerine uygular ve açılışta titremeyi önlemek için önbelleğe yazar. */
export function applyTheme(theme: Settings['theme'], accent: Settings['accent']) {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolved = theme === 'system' ? (dark ? 'dark' : 'light') : theme
  const el = document.documentElement
  el.dataset.theme = resolved
  el.dataset.accent = accent
  try { localStorage.setItem(KEY, JSON.stringify({ theme, accent })) } catch { /* yok say */ }
}

/** React açılmadan önce, önbellekteki temayı hemen uygular. */
export function initTheme() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null') as { theme: Settings['theme']; accent: Settings['accent'] } | null
    if (c) applyTheme(c.theme, c.accent)
  } catch { /* yok say */ }
}
