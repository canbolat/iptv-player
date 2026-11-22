/**
 * Hafif çeviri katmanı: arayüzdeki Türkçe metinleri İngilizceye çevirir.
 * Tam eşleşme sözlüğü + dinamik cümleler için kalıplar + kısa ifade değiştirmeleri.
 * Bilinmeyen metinler olduğu gibi (Türkçe) kalır.
 */
export const EN: Record<string, string> = {
  // Genel / gezinme
  'Canlı TV': 'Live TV', 'Rehber': 'Guide', 'Filmler': 'Movies', 'Diziler': 'Series', 'Devam Et': 'Continue',
  'Kayıtlar': 'Recordings', 'İndirilenler': 'Downloads', 'Tanılama': 'Diagnostics', 'Ayarlar': 'Settings',
  'Boşluk: oynat · F: tam ekran · M: sessiz · ↑↓: kanal': 'Space: play · F: fullscreen · M: mute · ↑↓: channel',
  'Başlamak için bir profil ekleyin': 'Add a profile to get started',
  'M3U/M3U8 bağlantısı, yerel playlist dosyası veya Xtream Codes hesabı ekleyebilirsiniz. Uygulama hazır içerik sağlamaz.':
    'You can add an M3U/M3U8 link, a local playlist file, an Xtream Codes account or a Stalker portal. The app does not provide any content.',
  'Profil ekle': 'Add profile', '+ Ekle': '+ Add', 'Profil yok': 'No profile', 'Bir kanal seçin': 'Select a channel',
  'Bir sorun oluştu': 'Something went wrong', 'Tekrar Dene': 'Try Again', 'Tamam': 'OK', 'Vazgeç': 'Cancel',
  'Kaydet': 'Save', 'Kaydediliyor…': 'Saving…', 'Sil': 'Delete', 'Düzenle': 'Edit', 'Temizle': 'Clear', 'Kapat': 'Close',
  'Seç…': 'Choose…', 'Varsayılan': 'Default', 'Aç': 'Open', 'Kaldır': 'Remove', 'İptal': 'Cancel',
  // Profil penceresi
  'Yeni profil': 'New profile', 'Profili düzenle': 'Edit profile', 'Profil adı': 'Profile name',
  'Profil adı gerekli.': 'Profile name is required.', 'Playlist URL (http/https)': 'Playlist URL (http/https)',
  'Dosya seç…': 'Choose file…', 'veya yerel .m3u/.m3u8 dosyası': 'or a local .m3u/.m3u8 file',
  'Sunucu URL (örn. http://sunucu:8080)': 'Server URL (e.g. http://server:8080)', 'Kullanıcı adı': 'Username',
  'Şifre': 'Password', 'Şifre (değiştirmek için yazın)': 'Password (type to change)',
  'EPG (XMLTV) URL, isteğe bağlı': 'EPG (XMLTV) URL, optional',
  'EPG boş bırakılırsa hesabın kendi XMLTV adresi otomatik kullanılır.': 'If EPG is left empty, the account\'s own XMLTV address is used automatically.',
  'Portal URL (örn. http://portal.example:8080/c/)': 'Portal URL (e.g. http://portal.example:8080/c/)',
  'MAC adresi (00:1A:79:XX:XX:XX)': 'MAC address (00:1A:79:XX:XX:XX)',
  'Canlı TV desteklenir; film ve dizi deneyseldir. MAC adresi sağlayıcınızda kayıtlı olmalıdır.':
    'Live TV is supported; movies and series are experimental. The MAC address must be registered with your provider.',
  // Listeler
  'Sonuç yok.': 'No results.', 'Kanallar yükleniyor…': 'Loading channels…', 'Filmler yükleniyor…': 'Loading movies…',
  'Diziler yükleniyor…': 'Loading series…', 'Bu kaynakta film bulunamadı.': 'No movies found in this source.',
  'Bu kaynakta dizi bulunamadı.': 'No series found in this source.',
  'M3U listelerinde film/dizi; adres yolundaki /movie/ ve /series/ ifadelerinden, video dosya uzantısından (.mp4, .mkv) ve "S01E02" gibi bölüm adlarından otomatik ayrılır.':
    'In M3U lists, movies/series are detected automatically from /movie/ and /series/ in the URL, video file extensions (.mp4, .mkv) and episode names like "S01E02".',
  'Tüm kategoriler': 'All categories', 'Kanal ara': 'Search channels', 'Zamanlı kayıt': 'Scheduled recording',
  'Bölüm bulunamadı.': 'No episodes found.', 'Bölümü indir': 'Download episode',
  'İndirme kuyruğuna eklendi': 'Added to download queue', '▶ Devam et': '▶ Resume', '▶ Oynat': '▶ Play', '⬇ İndir': '⬇ Download',
  'Henüz izlemeye devam edilecek bir içerik yok.': 'Nothing to continue watching yet.', 'Listeden kaldır': 'Remove from list',
  // Oynatıcı
  'Oynatılamadı': 'Playback failed', 'Harici oynatıcıda aç': 'Open in external player', 'Otomatik kalite': 'Auto quality',
  'Altyazı kapalı': 'Subtitles off', '● KAYIT': '● REC', '⏺ Kaydet': '⏺ Record', '⏹ Kaydı durdur': '⏹ Stop recording',
  '⏪ Geçmiş': '⏪ Catch-up', 'Geçmiş yayınları izle': 'Watch past broadcasts', 'Bu kanalı kaydet': 'Record this channel',
  'Kaydı durdur': 'Stop recording', 'Oynat/Duraklat (Boşluk)': 'Play/Pause (Space)', 'Sessiz (M)': 'Mute (M)',
  'Tam ekran (F)': 'Fullscreen (F)', 'Her zaman üstte mini oynatıcı': 'Always-on-top mini player',
  'Yayın açılamadı. Bağlantı, hesap durumu veya biçim sorunu olabilir.': 'Could not open the stream. It may be a connection, account or format problem.',
  'Bu biçim veya codec yerleşik oynatıcıda desteklenmiyor (MKV, HEVC ve AC3 ses sık görülen nedenlerdir). Harici oynatıcıyı deneyin.':
    'This format or codec is not supported by the built-in player (MKV, HEVC and AC3 audio are common causes). Try an external player.',
  'Şimdi': 'Now', 'Sonra': 'Next',
  // Kayıt penceresi
  'Kayıt': 'Recording', 'Şimdi başlat': 'Start now', 'Zamanlı başlat': 'Schedule', 'Başlangıç zamanı': 'Start time', 'Süre': 'Duration',
  'Elle durdururum': 'I\'ll stop manually', '30 dk': '30 min', '1 saat': '1 hour', '2 saat': '2 hours', '3 saat': '3 hours',
  'veya özel:': 'or custom:', 'dakika': 'minutes', '⏺ Kaydı başlat': '⏺ Start recording', '⏰ Zamanla': '⏰ Schedule',
  'Kayıt siz durdurana kadar sürer.': 'Recording continues until you stop it.',
  'Kanal değiştirseniz de arka planda devam eder; Kayıtlar sekmesinden durdurabilirsiniz.': 'It keeps running in the background even if you change channels; stop it from the Recordings tab.',
  'Zamanlı kayıt için uygulama açık (veya tepside) ve bilgisayar uyanık olmalı; kaçırılan kayıtlar listede işaretlenir.':
    'For scheduled recordings the app must be open (or in the tray) and the computer awake; missed recordings are marked in the list.',
  // Kayıtlar / indirilenler
  '📂 Klasörü aç': '📂 Open folder', 'Zamanlanmış kayıtlar': 'Scheduled recordings', '▶ İzle': '▶ Watch',
  'Uygulamada oynat': 'Play in app', 'Varsayılan oynatıcıda aç': 'Open in default player', 'Klasörde göster': 'Show in folder',
  '⏹ Durdur': '⏹ Stop', '✕ İptal': '✕ Cancel', 'Dosya silinsin mi?': 'Delete the file?',
  'Kayıt yok. Canlı bir kanal izlerken oynatıcıdaki ⏺ Kaydet düğmesine basın; süreyi seçebilir veya elle durdurabilirsiniz. Kayıtlar .ts dosyasıdır; VLC, mpv veya Windows\'un varsayılan oynatıcısıyla açılır.':
    'No recordings. While watching a live channel press ⏺ Record in the player; choose a duration or stop manually. Recordings are .ts files; open them with VLC, mpv or the default Windows player.',
  'İndirme yok. Film veya dizi ayrıntısında ⬇ İndir düğmesini kullanın. Aynı anda en fazla 2 indirme yürür, diğerleri sırada bekler.':
    'No downloads. Use ⬇ Download in a movie or series detail. At most 2 downloads run at once; the rest wait in the queue.',
  // Rehber, geçmiş yayın
  'Geçmiş yayınlar': 'Past broadcasts', 'Program listesi alınıyor…': 'Loading program list…',
  'Bu kanal için geçmiş program bilgisi bulunamadı.': 'No past program information for this channel.',
  'Geçmiş yayın yalnızca Xtream Codes kanallarında desteklenir.': 'Catch-up is only supported on Xtream Codes channels.',
  'arşivde yok': 'not archived', '◀ 3 sa': '◀ 3 h', '3 sa ▶': '3 h ▶',
  'Bu aralık için EPG verisi yok. Profilde EPG adresi tanımlı mı ve yüklendi mi kontrol edin.': 'No EPG data for this range. Check that the profile has an EPG address and that it loaded.',
  'Rehber için EPG kimliği (tvg-id) olan canlı kanallar gerekir. Profile bir EPG (XMLTV) adresi eklediğinizden emin olun.':
    'The guide needs live channels with an EPG id (tvg-id). Make sure the profile has an EPG (XMLTV) address.',
  // Tanılama
  'Raporu kopyala': 'Copy report', 'Kanal': 'Channel', 'Motor': 'Engine', 'İzleme': 'Plays', 'Takılma': 'Stalls',
  'Yeniden bağlanma': 'Reconnects', 'Düşen kare': 'Dropped frames', 'Son hata': 'Last error',
  'Tanılama verisi silinsin mi?': 'Delete diagnostics data?',
  'Henüz veri yok. Kanalları izledikçe burada her kanalın kaç kez takıldığı, yeniden bağlandığı ve hangi motorla açıldığı görünür. En çok takılan kanallar üstte listelenir; hepsi aynı sağlayıcıdan ve aynı anda takılıyorsa sorun büyük olasılıkla bağlantı veya sağlayıcıdadır.':
    'No data yet. As you watch channels, this shows how often each channel stalled, reconnected and which engine opened it. The most problematic channels are listed first; if all channels from the same provider stall at once, the problem is most likely the connection or the provider.',
  // PIN
  'PIN girin': 'Enter PIN', 'Kilitli içeriği aç': 'Unlock content', 'PIN yanlış': 'Wrong PIN',
  '🔒 Kilitli içerik gizli · Aç': '🔒 Locked content hidden · Unlock', '🔓 Tekrar kilitle': '🔓 Lock again',
  // Ayarlar
  'Profiller': 'Profiles', 'Kayıtlı profil yok.': 'No saved profiles.', 'Ağ': 'Network',
  'User-Agent (playlist, API ve yayın istekleri)': 'User-Agent (playlist, API and stream requests)',
  'Xtream canlı yayın biçimi': 'Xtream live stream format', 'Oynatıcı': 'Player', 'Donanım hızlandırma': 'Hardware acceleration',
  'Değişiklik için yeniden başlatma gerekir.': 'A restart is required for this change.', 'Şimdi yeniden başlat': 'Restart now',
  'Dahili oynatıcı': 'Built-in player', 'Harici oynatıcı (mpv / VLC)': 'External player (mpv / VLC)',
  'Harici oynatıcı yolu (mpv.exe / vlc.exe)': 'External player path (mpv.exe / vlc.exe)',
  'Harici oynatıcı ek parametreleri': 'External player extra arguments',
  'Harici mod için oynatıcı yolunu girin; aksi halde dahili oynatıcı kullanılır.': 'Enter the player path for external mode; otherwise the built-in player is used.',
  'Akış tamponu (donma/takılma)': 'Stream buffer (freezing/stalling)', 'İleri tampon hedefi (sn, 5–120)': 'Forward buffer target (s, 5–120)',
  'Başlamadan/takılınca biriktirme (sn, 0–15)': 'Pre-buffer before start/after stall (s, 0–15)',
  'Uzantısız canlı adreslerde motor': 'Engine for URLs without extension', 'Otomatik': 'Automatic',
  'Donma sürüyorsa önce biriktirmeyi 6–10 sn, ileri tamponu 40–60 sn yapın; sonra Xtream biçimini .ts / .m3u8 arasında değiştirin. Biriktirme yalnızca MPEG-TS yayınlarda çalışır; başlangıcı ve takılma sonrası devamı birkaç saniye geciktirir.':
    'If freezing continues, set pre-buffering to 6–10 s and the forward buffer to 40–60 s; then switch the Xtream format between .ts / .m3u8. Pre-buffering only works for MPEG-TS streams and delays the start and the resume after a stall by a few seconds.',
  'Kayıt ve indirme klasörleri': 'Recording and download folders', 'Canlı kayıtlar': 'Live recordings', 'Film/dizi indirmeleri': 'Movie/series downloads',
  'Genel': 'General', 'Pencereyi kapatınca sistem tepsisine küçült (kayıtlar ve zamanlı kayıtlar sürer)': 'Minimize to the system tray when the window is closed (recordings and scheduled recordings keep running)',
  'Dil / Language': 'Language', 'Türkçe': 'Türkçe', 'English': 'English',
  'Ebeveyn kilidi': 'Parental lock', 'Seçilen kategoriler PIN girilene kadar listelerden gizlenir. Kilit arayüz düzeyindedir; profilin kendisi korunmaz.':
    'Selected categories are hidden from lists until the PIN is entered. The lock is at UI level; the profile itself is not protected.',
  'Mevcut PIN': 'Current PIN', 'Yeni PIN (4-8 rakam)': 'New PIN (4–8 digits)', 'PIN belirle (4-8 rakam)': 'Set PIN (4–8 digits)',
  'PIN belirle': 'Set PIN', 'PIN değiştir': 'Change PIN', 'PIN kaldır': 'Remove PIN', 'PIN kaydedildi': 'PIN saved', 'PIN kaldırıldı': 'PIN removed',
  'Kategori ara': 'Search categories', 'Kategori yok (içerik henüz yüklenmemiş olabilir).': 'No categories (content may not be loaded yet).',
  'Kilitleri kaydet (mevcut PIN gerekir)': 'Save locks (current PIN required)', 'Kilitler kaydedildi': 'Locks saved',
  'Güncellemeler': 'Updates', 'Açılışta güncellemeleri otomatik denetle': 'Check for updates automatically on startup',
  'Güncellemeleri denetle': 'Check for updates', 'İndir': 'Download', 'Yeniden başlat ve yükle': 'Restart and install',
  'Geliştirme modunda güncelleme denetlenmez.': 'Updates are not checked in development mode.', 'Denetleniyor…': 'Checking…',
  'Uygulama güncel.': 'The app is up to date.',
  'Otomatik güncelleme, sürümlerin GitHub Releases üzerinde herkese açık bir depodan yayınlanmasını gerektirir.':
    'Automatic updates require releases to be published on GitHub Releases from a public repository.',
  'Önbellek': 'Cache', 'EPG ve ağ önbelleğini temizle': 'Clear EPG and network cache', 'Önbellek temizlendi': 'Cache cleared',
  'Kaydedildi': 'Saved',
  'Oynatma motoru (dahili oynatıcı)': 'Playback engine (built-in player)',
  'Hızlı (tarayıcı: mpegts.js / hls.js)': 'Fast (browser: mpegts.js / hls.js)',
  'Kararlı (ffmpeg ara katmanı)': 'Stable (ffmpeg layer)',
  'Video: otomatik (önce kopyala, olmazsa yeniden kodla)': 'Video: automatic (copy first, re-encode if needed)',
  'Video: kopyala (hafif, H.264 için)': 'Video: copy (light, for H.264)',
  'Video: yeniden kodla (HEVC/MPEG-2 için, işlemciyi yorar)': 'Video: re-encode (for HEVC/MPEG-2, uses CPU)',
  'Kararlı mod yayını ffmpeg ile tarayıcının çözebildiği biçime çevirir: AC3/MP2 gibi sesleri çözer, bozuk akışları ve kopmaları yönetir, başlangıçta biriktirme süresi kadar tampon verir. Başlangıç birkaç saniye gecikir, yalnızca canlı yayınlarda kullanılır. Oynatıcıda ⓘ (veya I tuşu) ile teknik bilgi panelini açıp donmanın nedenine (ağ, çözme, ses codec\'i) bakabilirsiniz.':
    'Stable mode converts the stream with ffmpeg into a format the browser can decode: it handles AC3/MP2 audio, damaged streams and drops, and gives a buffer equal to the pre-buffer time at start. Start is delayed by a few seconds and it is only used for live streams. Open the technical info panel with ⓘ (or the I key) in the player to see the cause of freezing (network, decoding, audio codec).',
  'Teknik bilgi (I)': 'Technical info (I)', 'Veri toplanıyor…': 'Collecting data…',
  'Sık takılma algılandı. Ayarlar → Oynatıcı → Oynatma motoru bölümünde "Kararlı (ffmpeg)" modunu deneyin; ⓘ düğmesi teknik bilgiyi gösterir.':
    'Frequent stalling detected. Try "Stable (ffmpeg)" under Settings → Player → Playback engine; the ⓘ button shows technical info.',
  'Görünüm': 'Appearance', 'Tema': 'Theme', 'Koyu': 'Dark', 'AMOLED siyah': 'AMOLED black', 'Açık': 'Light',
  'Sistemi izle': 'Follow system', 'Vurgu rengi': 'Accent color', 'Liste yoğunluğu': 'List density', 'Normal': 'Normal',
  'Sıkışık (daha fazla kanal görünür)': 'Compact (shows more channels)', 'İndigo': 'Indigo', 'Mavi': 'Blue',
  'Gök mavisi': 'Sky blue', 'Zümrüt': 'Emerald', 'Gül': 'Rose', 'Kehribar': 'Amber', 'Mor': 'Violet',
  // Store mesajları
  'Playlist içinde oynatılabilir kanal bulunamadı.': 'No playable channels found in the playlist.',
  'Harici oynatıcı açılamadı': 'Could not open the external player',
  'Rapor panoya kopyalandı': 'Report copied to clipboard'
}

type Pat = [RegExp, (m: RegExpExecArray) => string]
const plural = (n: string, one: string, many: string) => (Number(n) === 1 ? one : many)

const PATTERNS: Pat[] = [
  [/^(\d+) kayıt sürüyor$/, (m) => `${m[1]} ${plural(m[1], 'recording', 'recordings')} running`],
  [/^(\d+) indirme sürüyor$/, (m) => `${m[1]} ${plural(m[1], 'download', 'downloads')} running`],
  [/^Kanal ara \(([\d.,]+) kanal\)$/, (m) => `Search channels (${m[1]})`],
  [/^Ara \(([\d.,]+) içerik\)$/, (m) => `Search (${m[1]} items)`],
  [/^Tüm kategoriler \((\d+)\)$/, (m) => `All categories (${m[1]})`],
  [/^Favoriler \((\d+)\)$/, (m) => `Favorites (${m[1]})`],
  [/^Yeniden bağlanılıyor \((\d+)\/(\d+)\)…$/, (m) => `Reconnecting (${m[1]}/${m[2]})…`],
  [/^(\d+)\. Sezon$/, (m) => `Season ${m[1]}`],
  [/^Sezonu indir \((\d+)\)$/, (m) => `Download season (${m[1]})`],
  [/^(\d+) bölüm indirme kuyruğuna eklendi$/, (m) => `${m[1]} episodes added to the download queue`],
  [/^Sürüm (\S+) indirildi, yüklemeye hazır\.$/, (m) => `Version ${m[1]} downloaded, ready to install.`],
  [/^Sürüm (\S*)$/, (m) => `Version ${m[1]}`],
  [/^Yeni sürüm var: (.*)$/, (m) => `New version available: ${m[1]}`],
  [/^İndiriliyor… %(\d+)$/, (m) => `Downloading… ${m[1]}%`],
  [/^Güncelleme denetlenemedi: (.*)$/, (m) => `Could not check for updates: ${m[1]}`],
  [/^(\d+) bozuk satır atlandı\.$/, (m) => `${m[1]} malformed lines skipped.`],
  [/^EPG yüklenemedi: (.*)$/, (m) => `Could not load EPG: ${m[1]}`],
  [/^Oyuncular: (.*)$/, (m) => `Cast: ${m[1]}`],
  [/^Kayıt saat (\S+) civarında otomatik durur\.$/, (m) => `Recording stops automatically around ${m[1]}.`],
  [/^Kilitlenecek kategoriler \((\d+) seçili, mevcut profil\)$/, (m) => `Categories to lock (${m[1]} selected, current profile)`],
  [/^"(.*)" silinsin mi\?$/, (m) => `Delete "${m[1]}"?`],
  [/^Xtream · (.*)$/, (m) => `Xtream · ${m[1]}`],
  [/^M3U · yerel dosya$/, () => 'M3U · local file'],
  [/^M3U · URL$/, () => 'M3U · URL']
]

/** Cümle içi kısa ifadeler (tarih/süre/durum satırları gibi birleşik metinler için) */
const PHRASES: [RegExp, string][] = [
  [/(\d+) sa /g, '$1 h '], [/(\d+) dk/g, '$1 min'], [/(\d+) sn\b/g, '$1 s'],
  [/ · sırada/g, ' · queued'], [/ · iptal edildi/g, ' · cancelled'], [/ · kaydediliyor/g, ' · recording'],
  [/ · elle durdurulacak/g, ' · stops manually'], [/elle durdurulacak/g, 'stops manually'],
  [/(\d+) yeniden bağlanma/g, '$1 reconnects'], [/'de durur/g, ' stop'],
  [/bekliyor$/g, 'pending'], [/başladı$/g, 'started'], [/kaçırıldı \(uygulama kapalıydı\)$/g, 'missed (app was closed)'], [/ · hata$/g, ' · error']
]

const LEAD = /^[^\p{L}\p{N}]*/u

function lookup(core: string): string | undefined {
  if (EN[core] !== undefined) return EN[core]
  for (const [re, fn] of PATTERNS) {
    const m = re.exec(core)
    if (m) { const r = fn(m); if (r) return r }
  }
  return undefined
}

/** Tek bir metin parçasını çevirir (baştaki/sondaki boşluk ve simgeler korunur). */
export function translate(text: string): string {
  const lead = /^\s*/.exec(text)![0]
  const trail = /\s*$/.exec(text)![0]
  const trimmed = text.trim()
  if (!trimmed) return text

  let out = lookup(trimmed)
  if (out === undefined) {
    const sym = LEAD.exec(trimmed)![0] // örn. "⬇ ", "★ "
    if (sym) {
      const r = lookup(trimmed.slice(sym.length))
      if (r !== undefined) out = sym + r
    }
  }
  if (out === undefined) {
    // sondaki nokta/üç nokta ile dene
    const m = /^(.*?)([.…]+)$/.exec(trimmed)
    if (m) {
      const r = lookup(m[1])
      if (r !== undefined) out = r + m[2]
    }
  }
  if (out === undefined) {
    let t = trimmed
    for (const [re, rep] of PHRASES) t = t.replace(re, rep)
    out = t
  }
  return lead + out + trail
}
