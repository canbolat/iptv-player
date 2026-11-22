const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Tema değişkenleri (src/renderer/src/index.css): koyu, AMOLED ve açık temalar bunları değiştirir
        bg: v('bg'), panel: v('panel'), line: v('line'), accent: v('accent'),
        // "ink": koyu temada beyaz, açık temada koyu lacivert. Metin ve yarı saydam yüzeyler için.
        ink: v('ink')
      }
    }
  },
  plugins: []
}
