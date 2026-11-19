/** "2024-05-01 20:00:00" -> "2024-05-01:20-00" (Xtream timeshift biçimi, sunucu saati) */
export function formatCatchupStart(s: string): string | null {
  const m = /(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/.exec(s)
  return m ? `${m[1]}:${m[2]}-${m[3]}` : null
}

export function catchupMinutes(startTs: number, stopTs: number): number {
  return Math.max(1, Math.ceil((stopTs - startTs) / 60))
}

export function catchupPath(user: string, pass: string, minutes: number, start: string, streamId: number): string {
  return `/timeshift/${user}/${pass}/${minutes}/${start}/${streamId}.ts`
}
