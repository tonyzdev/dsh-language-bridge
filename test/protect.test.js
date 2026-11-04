import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chunk, mask, translateProtected, unmask } from '../protect.js'

const upper = async (body) => body.toUpperCase()
const options = { max: 3900, wanted: () => true, translate: upper }

test('code blocks, inline code, URLs and @paths reach the translator only as placeholders', async () => {
  const text = 'mira ```js\nconst a = 1\n``` y `npm test` en https://example.com/a?b=1 y @src/app.ts y @"My File.md"'
  const sent = []
  const translated = await translateProtected(text, { ...options, translate: async (body) => { sent.push(body); return body.toUpperCase() } })
  assert.equal(sent.length, 1)
  for (const secret of ['const a', 'npm test', 'example.com', 'src/app.ts', 'My File']) assert.ok(!sent[0].includes(secret), secret)
  for (const kept of ['```js\nconst a = 1\n```', '`npm test`', 'https://example.com/a?b=1', '@src/app.ts', '@"My File.md"']) {
    assert.ok(translated.includes(kept), kept)
  }
  assert.ok(translated.startsWith('MIRA'))
})

test('a dropped placeholder falls back to translating around it, so code survives', async () => {
  const sent = []
  const result = await translateProtected('usa `npm test` ahora', {
    ...options,
    translate: async (body) => {
      sent.push(body)
      return body.includes('⟦') ? 'use it now' : body.toUpperCase()
    },
  })
  assert.equal(result, 'USA `npm test` AHORA')
  assert.deepEqual(sent, ['usa ⟦0⟧ ahora', 'usa', 'ahora'])
})

test('a placeholder that never comes back fails instead of silently dropping code', () => {
  const { tokens } = mask('usa `npm test`')
  assert.equal(unmask('use it', tokens), undefined)
})

test('placeholders may come back with spaces or reordered', () => {
  const { tokens } = mask('`a` y `b`')
  assert.equal(unmask('⟦ 1 ⟧ and ⟦0⟧', tokens), '`b` and `a`')
})

test('whitespace around a chunk is restored, and an unwanted chunk costs nothing', async () => {
  let calls = 0
  const translated = await translateProtected('\n\nhola\n\n', { ...options, translate: async (body) => { calls += 1; return body.toUpperCase() } })
  assert.equal(translated, '\n\nHOLA\n\n')
  assert.equal(calls, 1)
  calls = 0
  const skipped = await translateProtected('hola', { ...options, wanted: () => false, translate: async () => { calls += 1; return 'x' } })
  assert.equal(skipped, 'hola')
  assert.equal(calls, 0)
})

test('long text is chunked under the limit on paragraph boundaries', () => {
  const pieces = chunk(`${'a'.repeat(100)}\n\n${'b'.repeat(100)}\n\n${'c'.repeat(100)}`, 150)
  assert.equal(pieces.length, 3)
  assert.ok(pieces.every((piece) => piece.length <= 150))
  assert.equal(pieces.join(''), `${'a'.repeat(100)}\n\n${'b'.repeat(100)}\n\n${'c'.repeat(100)}`)
})

test('masking and chunking match the old bridge, so its saved translations stay reusable', async () => {
  // Literal output of claude-zh-bridge 1.1.0 for this input: the translator's cache key includes it.
  const { masked } = mask('看 `foo` 和 https://a.b/c 还有 @x/y.ts。')
  assert.equal(masked, '看 ⟦0⟧ 和 ⟦1⟧ 还有 ⟦2⟧。')
  const sent = []
  await translateProtected('\n一\n\n二 `a`\n', { ...options, translate: async (body) => { sent.push(body); return body } })
  assert.deepEqual(sent, ['一\n\n二 ⟦0⟧'])
})
