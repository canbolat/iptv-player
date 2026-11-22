/** ffmpeg ara katmanı için komut satırı: kaynağı tarayıcının sevdiği parçalı MP4'e çevirir. */
export function buildFfmpegArgs(url: string, ua: string, video: 'copy' | 'transcode'): string[] {
  const args = ['-hide_banner', '-loglevel', 'warning', '-nostdin']
  if (/^https?:\/\//i.test(url)) {
    args.push('-user_agent', ua, '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5')
  }
  args.push(
    '-fflags', '+genpts+discardcorrupt', '-analyzeduration', '4000000', '-probesize', '8000000',
    '-i', url, '-map', '0:v:0?', '-map', '0:a:0?', '-sn', '-dn'
  )
  if (video === 'copy') {
    args.push('-c:v', 'copy')
  } else {
    args.push(
      '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency', '-pix_fmt', 'yuv420p',
      '-profile:v', 'high', '-crf', '23', '-g', '50', '-sc_threshold', '0', '-vf', "scale='min(1920,iw)':-2"
    )
  }
  // Ses her zaman AAC'ye çevrilir: AC3/MP2/E-AC3 gibi tarayıcının çözemediği sesleri çözer
  args.push('-c:a', 'aac', '-b:a', '160k', '-ac', '2', '-ar', '48000', '-af', 'aresample=async=1:first_pts=0')
  args.push('-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov+default_base_moof', 'pipe:1')
  return args
}
