export function normalizeMac(mac: string): string {
  return mac.trim().toUpperCase().replace(/-/g, ':')
}

export function isValidMac(mac: string): boolean {
  return /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(normalizeMac(mac))
}

/** Kullanıcının girdiği portal adresinden denenecek uç noktaları üretir. */
export function stalkerCandidates(portal: string): string[] {
  let s = portal.trim()
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s
  s = s.replace(/[?#].*$/, '').replace(/\/+$/, '')
  if (/\/(portal|load)\.php$/i.test(s)) return [s]
  s = s.replace(/\/c$/i, '')
  const out = [`${s}/portal.php`, `${s}/server/load.php`]
  if (!/stalker_portal/i.test(s)) out.push(`${s}/stalker_portal/server/load.php`)
  return [...new Set(out)]
}

/** create_link yanıtındaki "ffmpeg http://..." gibi komutlardan gerçek adresi çıkarır. */
export function stripCmd(cmd: string): string {
  const m = /(https?:\/\/\S+)/.exec(cmd)
  return (m ? m[1] : cmd).trim()
}
