# IPTV Player

Electron + React + TypeScript + Tailwind ile IPTV oynatıcı. M3U/M3U8 (URL veya dosya) ve Xtream Codes (Canlı TV, Filmler, Diziler), XMLTV EPG, HLS/MPEG-TS oynatma, favoriler, "Devam Et".

> Uygulama hiçbir hazır playlist içermez. Yalnızca yasal olarak erişim hakkınız olan kaynakları ekleyin.

## Gereksinimler (Windows)
- Node.js 20 veya üzeri (testler için 22+): https://nodejs.org
- İnternet bağlantısı (ilk `npm install` için)

## Çalıştırma
```powershell
npm install
npm run dev
```

## Windows kurulum dosyası (.exe) üretme
```powershell
npm install
npm test
npm run dist
```
Çıktı: `release\IPTV Player-Setup-0.2.0.exe`

Notlar:
- Kod imzası olmadığı için Windows SmartScreen "Bilinmeyen yayıncı" uyarısı verebilir. "Ek bilgi → Yine de çalıştır" ile açılır. Uyarısız dağıtım için kod imzalama sertifikası gerekir.
- `npm run dist` sırasında electron-builder, Electron ve NSIS araçlarını indirir; ilk çalıştırma birkaç dakika sürebilir.
- Özel simge için `build/icon.ico` (256x256) dosyası ekleyebilirsiniz.

## Kullanım
1. **+ Ekle** → M3U URL/dosya veya Xtream bilgileri (EPG URL isteğe bağlı).
2. Canlı TV: arama, kategori, ★ favori. Film/Dizi: Xtream profillerinde.
3. Kısayollar: **Boşluk** oynat/duraklat · **F** tam ekran · **M** sessiz · **↑/↓** kanal değiştir · **←/→** 10 sn geri/ileri (film/dizi).
4. Oynatılamayan biçimler (MKV/HEVC/AC3) için Ayarlar'da `vlc.exe` veya `mpv.exe` yolunu verip "Harici oynatıcıda aç" kullanın.

## Proje yapısı
Ayrıntılar için `CLAUDE.md`.
