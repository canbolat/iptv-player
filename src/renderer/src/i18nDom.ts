import { translate } from '../../shared/i18n'

/**
 * Seçilen dil İngilizceyse DOM'daki Türkçe metinleri çalışma anında çevirir;
 * Türkçeye dönülünce özgün metinleri geri yükler.
 */
const ATTRS = ['placeholder', 'title', 'aria-label']
const origText = new WeakMap<Text, string>()
const wroteText = new WeakMap<Text, string>()
const origAttr = new WeakMap<Element, Record<string, string>>()
const wroteAttr = new WeakMap<Element, Record<string, string>>()

let observer: MutationObserver | null = null
let origAlert: typeof window.alert | null = null
let origConfirm: typeof window.confirm | null = null

function fixText(n: Text) {
  const cur = n.nodeValue ?? ''
  if (wroteText.get(n) === cur) return // kendi yazdığımız değer
  origText.set(n, cur)
  const t = translate(cur)
  if (t !== cur) { wroteText.set(n, t); n.nodeValue = t } else wroteText.delete(n)
}

function fixAttrs(el: Element) {
  for (const a of ATTRS) {
    const cur = el.getAttribute(a)
    if (cur === null) continue
    const wrote = wroteAttr.get(el) ?? {}
    if (wrote[a] === cur) continue
    const orig = origAttr.get(el) ?? {}
    orig[a] = cur
    origAttr.set(el, orig)
    const t = translate(cur)
    if (t !== cur) { wrote[a] = t; wroteAttr.set(el, wrote); el.setAttribute(a, t) } else delete wrote[a]
  }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) { fixText(root as Text); return }
  if (root.nodeType !== Node.ELEMENT_NODE) return
  const el = root as Element
  if (/^(SCRIPT|STYLE|TEXTAREA)$/.test(el.tagName)) return
  fixAttrs(el)
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  let n: Node | null = tw.nextNode()
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) {
      if (!/^(SCRIPT|STYLE|TEXTAREA)$/.test((n.parentElement?.tagName) ?? '')) fixText(n as Text)
    } else fixAttrs(n as Element)
    n = tw.nextNode()
  }
}

function restore() {
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  let n: Node | null = tw.nextNode()
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = n as Text
      const w = wroteText.get(t)
      if (w !== undefined && t.nodeValue === w) t.nodeValue = origText.get(t) ?? w
      wroteText.delete(t)
    } else {
      const el = n as Element
      const w = wroteAttr.get(el)
      const o = origAttr.get(el)
      if (w && o) for (const a of Object.keys(w)) if (el.getAttribute(a) === w[a]) el.setAttribute(a, o[a])
      wroteAttr.delete(el)
    }
    n = tw.nextNode()
  }
}

export function applyLanguage(lang: 'tr' | 'en') {
  document.documentElement.lang = lang
  if (lang === 'en') {
    if (observer) return
    walk(document.body)
    observer = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'childList') m.addedNodes.forEach((n) => walk(n))
        else if (m.type === 'characterData') fixText(m.target as Text)
        else if (m.type === 'attributes') fixAttrs(m.target as Element)
      }
    })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS })
    origAlert = window.alert
    origConfirm = window.confirm
    window.alert = (m?: unknown) => origAlert!.call(window, translate(String(m ?? '')))
    window.confirm = (m?: string) => origConfirm!.call(window, translate(String(m ?? '')))
  } else if (observer) {
    observer.disconnect()
    observer = null
    restore()
    if (origAlert) window.alert = origAlert
    if (origConfirm) window.confirm = origConfirm
  }
}
