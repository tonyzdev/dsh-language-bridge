import assert from 'node:assert/strict'
import { test } from 'node:test'
import { needsTranslation, proseOf } from '../detect.js'

const yes = (text, target, source) => assert.equal(needsTranslation(text, { target, source }), true, `should translate to ${target}: ${text}`)
const no = (text, target, source) => assert.equal(needsTranslation(text, { target, source }), false, `should not translate to ${target}: ${text}`)

test('Latin to Latin: Spanish, French, German, Portuguese and Italian to English', () => {
  yes('Necesito que arregles el error en el parser', 'en', 'es')
  yes('¿Puedes revisar los tests?', 'en', 'es')
  yes('hola', 'en', 'es')
  yes('Peux-tu corriger le bug dans ce fichier ?', 'en', 'fr')
  yes('Bitte behebe den Fehler in der Datei', 'en', 'de')
  yes('Preciso que você corrija este erro', 'en', 'pt')
  yes('Per favore correggi questo errore', 'en', 'it')
})

test('Latin to Latin: English text is left alone for a Spanish user', () => {
  no('Please fix the failing test and add a regression case', 'en', 'es')
  no('run `npm test` and fix parseConfig in src/app.ts', 'en', 'es')
  no('The build is broken, can you look at it?', 'en', 'es')
})

test('Latin to Latin: an undecidable short text is translated, not silently sent', () => {
  yes('arregla parseConfig', 'en', 'es')
  yes('run tests', 'en', 'es')
})

test('English sentences with Spanish technical mixing still translate when Spanish dominates', () => {
  yes('arregla el bug en el parser y corre los tests', 'en', 'es')
  yes('the bug en el parser', 'en', 'es')
})

test('script-different pairs, both directions', () => {
  yes('このバグを直してください', 'en', 'ja')
  yes('修复这个错误', 'en', 'zh-CN')
  yes('이 버그를 고쳐 주세요', 'en', 'ko')
  yes('Исправь эту ошибку', 'en', 'ru')
  yes('أصلح هذا الخطأ', 'en', 'ar')
  yes('इस बग को ठीक करो', 'en', 'hi')
  yes('Please fix the bug in this file.', 'ja', 'en')
  yes('Done.', 'zh-CN', 'en')
  yes('I fixed the parser and added tests.', 'ru', 'en')
  yes('I fixed the parser and added tests.', 'ar', 'en')
  yes('I fixed the parser and added tests.', 'hi', 'en')
})

test('text already in a non-Latin target is left alone, loanwords included', () => {
  no('このバグを直しました', 'ja', 'en')
  no('修复了这个错误', 'zh-CN', 'en')
  no('이 버그를 고쳤습니다', 'ko', 'en')
  no('Я исправил эту ошибку', 'ru', 'en')
  no('Claude を使ってバグを修正しました', 'ja', 'en')
  no('我用 Claude 修复了 parser 的 bug', 'zh-CN', 'en')
  no('Исправил баг в parser', 'ru', 'en')
})

test('a user whose language uses another script can type target-language commands', () => {
  no('run tests', 'en', 'ja')
  no('fix bug', 'en', 'zh-CN')
  no('deploy now', 'en', 'ru')
})

test('such a user writing a third Latin language is still caught', () => {
  yes('necesito ayuda con el error en este archivo', 'en', 'ja')
})

test('same-script pairs outside Latin', () => {
  yes('Я исправил эту ошибку в этом файле и это работает', 'uk', 'ru')
  yes('این فایل را برای من درست کن', 'ar', 'fa')
  yes('Виправ цю помилку будь ласка', 'ru', 'uk')
})

test('Han alone is ambiguous between Chinese variants and Japanese', () => {
  yes('修复这个错误', 'zh-TW', 'zh-CN')
  yes('修复这个错误', 'ja', 'zh-CN')
  yes('これを直して', 'zh-CN', 'ja')
})

test('a target language with no word list falls back to translating same-script text', () => {
  yes('Tafadhali rekebisha hitilafu hii', 'sw', 'id')
  yes('Please fix the bug', 'sw', 'en')
})

test('an unknown target language translates rather than guessing', () => {
  yes('some text', 'xx-Zzzz', 'en')
})

test('unknown source language still decides', () => {
  no('Please fix the bug in the parser', 'en')
  yes('修复这个错误', 'en')
  yes('Necesito ayuda con esto', 'en')
  no('修复了这个错误', 'zh-CN')
  yes('修复了这个错误', 'ja')
})

test('code, links, identifiers and numbers alone need nothing', () => {
  for (const text of ['```js\nconst a = 1\n```', '`npm test`', 'https://example.com/a?b=1', '@src/app.ts', '@"My File.md"',
    'src/app.ts', 'parseConfig', 'foo_bar', 'dsh-language-bridge', '42', '3.14', '--no-verify', 'HTTP API', '⟦0⟧ ⟦1⟧', '']) {
    assert.equal(needsTranslation(text, { target: 'en', source: 'es' }), false, text)
    assert.equal(needsTranslation(text, { target: 'ja', source: 'en' }), false, text)
  }
})

test('identifiers inside prose do not count as prose', () => {
  assert.doesNotMatch(proseOf('修复parseConfig函数 in src/app.ts'), /parseConfig|app\.ts/)
  assert.match(proseOf('修复parseConfig函数'), /修复/)
  no('修复 parseConfig 和 src/app.ts 里的 fooBar 错误', 'zh-CN', 'en')
  no('Please update parseConfig, fooBar and src/app.ts', 'en', 'ja')
})

test('a stray symbol does not trigger translation', () => {
  no('Compute the area with π and the radius', 'en', 'ja')
})

test('shouting is prose, not an acronym', () => {
  yes('ARREGLA EL ERROR', 'en', 'es')
  no('Fix the HTTP API in the CLI', 'en', 'es')
})

test('a long English text quoting a little Chinese stays English', () => {
  const english = 'Please review the following module and tell me whether the error handling is correct for all of the cases that we need to support in this release of the product. '.repeat(3)
  no(`${english} The label is 确定 in the UI.`, 'en', 'ja')
})
