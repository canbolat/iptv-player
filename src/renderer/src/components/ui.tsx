import { useState } from 'react'

export function Logo({ src, name, size = 40, round = false }: { src?: string; name: string; size?: number; round?: boolean }) {
  const [bad, setBad] = useState(false)
  const initials = name.replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '▶'
  const cls = `shrink-0 ${round ? 'rounded-full' : 'rounded-md'}`
  if (!src || bad) {
    return (
      <div className={`${cls} flex items-center justify-center bg-gradient-to-br from-indigo-600/40 to-slate-700 text-xs font-semibold text-slate-200`}
        style={{ width: size, height: size }}>
        {initials}
      </div>
    )
  }
  return (
    <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)}
      className={`${cls} object-contain bg-black/30`} style={{ width: size, height: size }} />
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
      <div className="w-10 h-10 rounded-full border-4 border-white/10 border-t-accent animate-spin" />
      {label && <div className="text-sm">{label}</div>}
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="text-red-400 font-medium">Bir sorun oluştu</div>
      <div className="max-w-md text-sm text-slate-400">{message}</div>
      {onRetry && <button className="btn-primary" onClick={onRetry}>Tekrar Dene</button>}
    </div>
  )
}
