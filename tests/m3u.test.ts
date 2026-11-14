import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseM3U, norm } from '../src/shared/m3u.ts'

test('temel kanal ayrıştırma', () => {
  const r = parseM3U(`#EXTM3U url-tvg="http://epg.example/guide.xml"
#EXTINF:-1 tvg-id="trt1.tr" tvg-logo="http://x/logo.png" group-title="Ulusal",TRT 1
http://example.com/live/1.m3u8
#EXTINF:-1 tvg-id="" group-title="Haber",Kanal Haber
http://example.com/live/2.ts
`)
  assert.equal(r.items.length, 2)
  assert.equal(r.items[0].name, 'TRT 1')
  assert.equal(r.items[0].tvgId, 'trt1.tr')
  assert.equal(r.items[0].logo, 'http://x/logo.png')
  assert.equal(r.items[0].group, 'Ulusal')
  assert.equal(r.items[1].tvgId, undefined)
  assert.equal(r.epgUrl, 'http://epg.example/guide.xml')
  assert.equal(r.skipped, 0)
})

test('bozuk satırlar atlanır, çökmez', () => {
  const r = parseM3U(`#EXTM3U
http://orphan.example/no-extinf.m3u8
#EXTINF:-1 group-title="A",Url yok
#EXTINF:-1 group-title="A",Geçerli
http://example.com/ok
#EXTINF:-1,Geçersiz url
not-a-url
%%% çöp satır
`)
  assert.equal(r.items.length, 1)
  assert.equal(r.items[0].name, 'Geçerli')
  assert.equal(r.skipped, 4)
})

test('tırnak içindeki virgül kanal adını bozmaz', () => {
  const r = parseM3U(`#EXTINF:-1 tvg-name="A, B" group-title="X, Y",Gerçek Ad
http://example.com/1
`)
  assert.equal(r.items[0].name, 'Gerçek Ad')
  assert.equal(r.items[0].group, 'X, Y')
})

test('BOM, CRLF, EXTGRP ve EXTVLCOPT', () => {
  const r = parseM3U('\uFEFF#EXTM3U\r\n#EXTGRP:Spor\r\n#EXTINF:-1,Spor 1\r\n#EXTVLCOPT:http-user-agent=Test/1.0\r\nhttp://example.com/s1\r\n')
  assert.equal(r.items.length, 1)
  assert.equal(r.items[0].group, 'Spor')
  assert.equal(r.items[0].userAgent, 'Test/1.0')
})

test('boş ve anlamsız girdi', () => {
  assert.deepEqual(parseM3U('').items, [])
  assert.deepEqual(parseM3U('   \n\n').items, [])
  assert.doesNotThrow(() => parseM3U(undefined as unknown as string))
})

test('100 bin kanal makul sürede ayrıştırılır', () => {
  const parts: string[] = ['#EXTM3U']
  for (let i = 0; i < 100_000; i++) {
    parts.push(`#EXTINF:-1 tvg-id="c${i}" tvg-logo="http://x/${i}.png" group-title="G${i % 50}",Kanal ${i}`)
    parts.push(`http://example.com/live/${i}.m3u8`)
  }
  const t = Date.now()
  const r = parseM3U(parts.join('\n'))
  const ms = Date.now() - t
  assert.equal(r.items.length, 100_000)
  assert.ok(ms < 3000, `çok yavaş: ${ms}ms`)
})

test('Türkçe arama normalleştirme', () => {
  assert.equal(norm('İstanbul ŞEHİR'), norm('istanbul sehir'))
  assert.equal(norm('Işık'), 'isik')
})

import { classify, groupSeries, parseEpisodeName } from '../src/shared/m3u.ts'

test('içerik türü: canlı, film, dizi', () => {
  assert.equal(classify('http://h/live/u/p/1.ts', 'Spor', 'Spor 1'), 'live')
  assert.equal(classify('http://h/u/p/123', 'Haber', 'Haber'), 'live')
  assert.equal(classify('http://h/movie/u/p/5.mkv', 'Aksiyon', 'Film'), 'vod')
  assert.equal(classify('http://h/series/u/p/9.mp4', 'X', 'Y'), 'series')
  assert.equal(classify('http://h/files/film.mp4', 'Komedi', 'Bir Film (2020)'), 'vod')
  assert.equal(classify('http://h/files/a.mp4', 'Diziler', 'Bir Dizi'), 'series')
  assert.equal(classify('http://h/files/a.mkv', 'Tümü', 'Show S02E05'), 'series')
  // canlı sinema kanalı, kategori adı "film" içerse de canlı kalır
  assert.equal(classify('http://h/stream/77.m3u8', 'Film Kanalları', 'Sinema 1'), 'live')
})

test('bölüm adı ayrıştırma', () => {
  assert.deepEqual(parseEpisodeName('Breaking Bad S01E02'), { title: 'Breaking Bad', season: 1, episode: 2 })
  assert.deepEqual(parseEpisodeName('Show - S3 E10'), { title: 'Show', season: 3, episode: 10 })
  assert.deepEqual(parseEpisodeName('Dizi 2x05'), { title: 'Dizi', season: 2, episode: 5 })
  assert.deepEqual(parseEpisodeName('Gibi 1. Sezon 4. Bölüm'), { title: 'Gibi', season: 1, episode: 4 })
  assert.equal(parseEpisodeName('Sadece Film'), null)
})

test('diziler gruplanır, sezon ve bölümler sıralanır', () => {
  const r = parseM3U(`#EXTM3U
#EXTINF:-1 group-title="Diziler",Show S01E02
http://h/series/u/p/2.mkv
#EXTINF:-1 group-title="Diziler",Show S01E01
http://h/series/u/p/1.mkv
#EXTINF:-1 group-title="Diziler",Show S02E01
http://h/series/u/p/3.mkv
#EXTINF:-1 group-title="Diziler",Baska S01E01
http://h/series/u/p/4.mkv
`)
  const series = groupSeries(r.items.filter((i) => i.kind === 'series'))
  assert.equal(series.length, 2)
  const show = series.find((s) => s.name === 'Show')!
  assert.deepEqual(Object.keys(show.localDetail!.seasons!), ['1', '2'])
  assert.deepEqual(show.localDetail!.seasons!['1'].map((e) => e.episode), [1, 2])
})

import { isValidMac, normalizeMac, stalkerCandidates, stripCmd } from '../src/shared/stalker.ts'

test('stalker: MAC doğrulama', () => {
  assert.equal(isValidMac('00:1A:79:AB:CD:EF'), true)
  assert.equal(isValidMac('00-1a-79-ab-cd-ef'), true)
  assert.equal(isValidMac('00:1A:79:AB:CD'), false)
  assert.equal(isValidMac('zz:1A:79:AB:CD:EF'), false)
  assert.equal(normalizeMac(' 00-1a-79-ab-cd-ef '), '00:1A:79:AB:CD:EF')
})

test('stalker: uç nokta adayları', () => {
  assert.deepEqual(stalkerCandidates('http://h.example:8080/c/'), [
    'http://h.example:8080/portal.php', 'http://h.example:8080/server/load.php',
    'http://h.example:8080/stalker_portal/server/load.php'])
  assert.deepEqual(stalkerCandidates('h.example/stalker_portal/c'), [
    'http://h.example/stalker_portal/portal.php', 'http://h.example/stalker_portal/server/load.php'])
  assert.deepEqual(stalkerCandidates('http://h/portal.php'), ['http://h/portal.php'])
})

test('stalker: komut ön ekini temizleme', () => {
  assert.equal(stripCmd('ffmpeg http://s/live/1.ts?x=1'), 'http://s/live/1.ts?x=1')
  assert.equal(stripCmd('ffrt3 http://s/ch/5'), 'http://s/ch/5')
  assert.equal(stripCmd('http://s/direct'), 'http://s/direct')
})
