import { useState } from 'react'

export default function PinDialog({ title = 'PIN girin', onSubmit, onClose }: {
  title?: string
  onSubmit(pin: string): Promise<boolean> | boolean
  onClose(): void
}) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')

  const submit = async () => {
    if (!(await onSubmit(pin))) { setErr('PIN yanlış'); setPin('') } else onClose()
  }
  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="w-full max-w-xs bg-panel border border-line rounded-xl shadow-2xl modal-in p-5 space-y-3" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="font-semibold">🔒 {title}</h2>
        <input className="field text-center tracking-[0.5em]" type="password" inputMode="numeric" autoFocus maxLength={8}
          value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setErr('') }}
          onKeyDown={(e) => e.key === 'Enter' && submit()} />
        {err && <div className="text-sm text-red-400">{err}</div>}
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn-primary" onClick={submit}>Tamam</button>
        </div>
      </div>
    </div>
  )
}
