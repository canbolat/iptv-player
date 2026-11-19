import { test } from 'node:test'
import assert from 'node:assert/strict'
import { translate } from '../src/shared/i18n.ts'

test('tam eşleşme ve boşluk koruma', () => {
  assert.equal(translate('Canlı TV'), 'Live TV')
  assert.equal(translate('  Kaydet '), '  Save ')
  assert.equal(translate('Bilinmeyen metin'), 'Bilinmeyen metin')
  assert.equal(translate(''), '')
})

test('simge önekli metinler', () => {
  assert.equal(translate('⏺ Kaydet'), '⏺ Record')
  assert.equal(translate('⬇ Sezonu indir (10)'), '⬇ Download season (10)')
  assert.equal(translate('★ Favoriler (3)'), '★ Favorites (3)')
  assert.equal(translate('⬇ 2 indirme sürüyor'), '⬇ 2 downloads running')
  assert.equal(translate('● 1 kayıt sürüyor'), '● 1 recording running')
})

test('dinamik cümleler', () => {
  assert.equal(translate('Kanal ara (1.234 kanal)'), 'Search channels (1.234)')
  assert.equal(translate('Yeniden bağlanılıyor (2/5)…'), 'Reconnecting (2/5)…')
  assert.equal(translate('3. Sezon'), 'Season 3')
  assert.equal(translate('Sürüm 0.4.0'), 'Version 0.4.0')
  assert.equal(translate('Kayıt saat 18:30 civarında otomatik durur. '), 'Recording stops automatically around 18:30. ')
  assert.equal(translate('"Profilim" silinsin mi?'), 'Delete "Profilim"?')
})

test('süre ve durum ifadeleri', () => {
  assert.equal(translate('1 sa 5 dk 3 sn'), '1 h 5 min 3 s')
  assert.equal(translate(' · 3 yeniden bağlanma'), ' · 3 reconnects')
})
