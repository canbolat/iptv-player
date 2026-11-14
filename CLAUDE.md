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

## Bilinen sınırlar / yapılacaklar
- MKV, HEVC, AC3/E-AC3 yerleşik oynatıcıda garanti değil → "Harici oynatıcıda aç".
- Veri depolama şimdilik `electron-store` (JSON) + `epg-cache.json`; çok büyük EPG/kanal setleri için better-sqlite3'e geçiş planlı.
- EPG ayrıştırıcı regex tabanlıdır ve dosyayı belleğe alır; çok büyük XMLTV için akışlı ayrıştırıcıya geçilecek.
- Catch-up/timeshift, ebeveyn kilidi, çoklu dil, otomatik güncelleme henüz yok.
