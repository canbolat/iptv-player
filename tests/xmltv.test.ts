import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseXmltv, parseXmltvTime } from '../src/shared/xmltv.ts'

test('XMLTV zaman ve saat dilimi', () => {
  assert.equal(parseXmltvTime('20240101120000 +0300'), Date.UTC(2024, 0, 1, 9, 0, 0))
  assert.equal(parseXmltvTime('20240101120000 -0500'), Date.UTC(2024, 0, 1, 17, 0, 0))
  assert.equal(parseXmltvTime('20240101120000'), Date.UTC(2024, 0, 1, 12, 0, 0))
  assert.ok(Number.isNaN(parseXmltvTime('bozuk')))
})

test('programlar kanala göre gruplanır, sıralanır, varlıklar çözülür', () => {
  const xml = `<?xml version="1.0"?><tv>
<programme start="20240101130000 +0000" stop="20240101140000 +0000" channel="TRT1.tr"><title lang="tr">İkinci &amp; Haber</title><desc>Açıklama</desc></programme>
<programme start="20240101120000 +0000" stop="20240101130000 +0000" channel="trt1.tr"><title><![CDATA[Birinci]]></title></programme>
<programme start="20240101120000 +0000" stop="20240101130000 +0000" channel="x"><desc>başlık yok</desc></programme>
<programme start="bozuk" stop="20240101130000 +0000" channel="y"><title>Y</title></programme>
</tv>`
  const m = parseXmltv(xml, Date.UTC(2024, 0, 1), Date.UTC(2024, 0, 2))
  const list = m.get('trt1.tr')!
  assert.equal(list.length, 2)
  assert.equal(list[0].title, 'Birinci')
  assert.equal(list[1].title, 'İkinci & Haber')
  assert.equal(list[1].desc, 'Açıklama')
  assert.equal(m.has('x'), false)
  assert.equal(m.has('y'), false)
})

test('zaman aralığı dışındaki programlar elenir', () => {
  const xml = '<programme start="20200101120000 +0000" stop="20200101130000 +0000" channel="a"><title>Eski</title></programme>'
  assert.equal(parseXmltv(xml, Date.UTC(2024, 0, 1), Date.UTC(2024, 0, 2)).size, 0)
})
