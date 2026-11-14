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
