# CLAUDE.md — IPTV Player

Electron + React + TypeScript + Tailwind CSS ile yazılmış, karanlık temalı IPTV masaüstü oynatıcı.
**Uygulama hiçbir hazır playlist içermez**; yalnızca kullanıcının eklediği kaynakları oynatır.

## Komutlar
- `npm run dev` — geliştirme (electron-vite, HMR)
- `npm test` — parser birim testleri (Node 22+, `node:test`)
- `npm run typecheck` — TypeScript denetimi
- `npm run dist` — Windows NSIS kurulum dosyası (`release/`)

## Klasör yapısı
- `src/main/` — pencere, oturum (header/CORS/CSP), IPC, depolama, Xtream, EPG
- `src/preload/` — tek köprü: `contextBridge` ile tipli `window.api`
- `src/shared/` — tipler (`types.ts`), IPC sözleşmesi (`api.ts`), M3U ayrıştırıcı (`m3u.ts`)
- `src/renderer/src/` — React arayüzü, Zustand store (`store.ts`), bileşenler, Web Worker

## Kurallar
1. Güvenlik: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. `webSecurity` asla kapatılmaz.
2. Renderer'a şifre gönderilmez. Xtream şifreleri `safeStorage` ile şifrelenir; akış URL'leri main'de çözülür (`stream:resolve`).
3. Yeni IPC: `shared/api.ts` arayüzüne ekle → `preload/index.ts` → `main/index.ts` içinde `handle(...)`; giriş doğrulaması main tarafında yapılır.
4. Ağ: playlist/API istekleri main'de `net.fetch`; video istekleri için `webRequest` kuralları yalnızca uzak `xhr/media/other` isteklerine uygulanır.
5. Ayrıştırma UI'yi bloke etmemeli: M3U `workers/m3u.worker.ts` içinde, listeler TanStack Virtual ile sanallaştırılır.
6. Parser asla istisna fırlatmaz; bozuk satırlar atlanıp sayılır. Parser değişirse `tests/m3u.test.ts` güncellenir.
7. Günlüklerde kimlik bilgisi basılmaz (`maskUrl`).
8. Kod yorumları ve arayüz metinleri Türkçe.

## Özellik notları
- M3U içerik türü: `shared/m3u.ts` içindeki `classify` (URL yolu /movie/ /series/ /live/, dosya uzantısı, bölüm adı "S01E02") ve `groupSeries`.
- Kayıt: `main/recorder.ts` yayını .ts olarak diske yazar (ham TS veya HLS segmentleri). Fazladan bir bağlantı açar; bazı sağlayıcılar tek bağlantıya izin verir.
- Akış ayarları: Ayarlar > ileri tampon (`bufferSec`), biriktirme (`prebufferSec`, yalnızca MPEG-TS) ve motor (auto/hls/ts). Oynatıcı: dahili veya harici (`playerMode`).
- Kayıt/indirme (`main/recorder.ts`): kayıt kopunca yeniden bağlanır, zamanlı durdurma (`stopAt`), uyku engelleyici (powerSaveBlocker), indirme kuyruğu (en fazla 2), Range ile devam. Pencere kapatılırken aktif iş varsa kullanıcıya sorulur. Biten kayıtlar `electron-store` içinde (`records`) saklanır.
- Stalker (`main/stalker.ts`, `shared/stalker.ts`): MAC ile el sıkışma + Bearer jeton; canlı TV tam, film/dizi deneyseldir. Yayın adresleri geçicidir; oynatma/indirme anında `create_link` ile çözülür.

- Zamanlı kayıt (`main/scheduler.ts`): 15 sn'de bir denetim; adres başlama anında çözülür; 10 dk'dan fazla kaçırılan kayıt `missed` olur.
- Geçmiş yayın: yalnızca Xtream (`get_simple_data_table` + `/timeshift/` adresi, sunucu saatiyle başlangıç). M3U `catchup` öznitelikleri henüz kullanılmıyor.
- Ebeveyn kilidi (`main/pin.ts`): PIN scrypt ile saklanır; kilit kategori gizleme olarak arayüz düzeyindedir.
- Dil: `shared/i18n.ts` sözlüğü + `renderer/src/i18nDom.ts` DOM çevirici. Yeni arayüz metni eklenince sözlüğe İngilizcesi de eklenmeli (`tests/i18n.test.ts`).
- Tepsi/simge: `build/icon.*` ve `main/trayIcon.ts` (üretilmiş PNG). Güncelleme: `main/updater.ts` (electron-updater, GitHub Releases).
- Yerel oynatma: `iptvfile://rec/<id>.<uzantı>` özel şeması (`main/index.ts`), yalnızca bilinen kayıt kimlikleri için dosya sunar.

## Bilinen sınırlar / yapılacaklar
- MKV, HEVC, AC3/E-AC3 yerleşik oynatıcıda garanti değil → "Harici oynatıcıda aç".
- Stalker gerçek bir portala karşı denenmedi; sağlayıcıya göre uç nokta/alan farkları olabilir.
- Veri depolama şimdilik `electron-store` (JSON) + `epg-cache.json`; çok büyük EPG/kanal setleri için better-sqlite3'e geçiş planlı.
- EPG ayrıştırıcı regex tabanlıdır ve dosyayı belleğe alır; çok büyük XMLTV için akışlı ayrıştırıcıya geçilecek.
- Şifreli HLS ve fMP4 kaydedilemez.
- Dil çevirisi sözlük tabanlıdır; tarih biçimleri ve ana süreç iletileri (pencere/hata metinleri) Türkçe kalır.
