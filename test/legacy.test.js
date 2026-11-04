import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// The client fetches settings when it loads; these tests only look at what it renders.
globalThis.document = { baseURI: 'http://localhost/', visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} }
globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) })

// client.js is one browser module with no exports, so load it the way the page does and
// reach originalContent through the user bubble it renders.
function loadClient() {
  let definition
  const window = { __ModuleLoader__: { load: (value) => { definition = value } } }
  new Function('window', readFileSync(new URL('../client.js', import.meta.url), 'utf8'))(window)
  return definition
}

function fakeReact() {
  const element = (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat() })
  return {
    createElement: element,
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useMemo: (factory) => factory(),
    useRef: (current) => ({ current }),
    useEffect: () => {},
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
  }
}

function userBubble(source) {
  const registered = {}
  const noop = () => () => {}
  const ctx = {
    effect: (fn) => fn(),
    on: noop,
    locale: { register: noop, bind: () => (key) => key, subscribe: noop, getSnapshot: () => ({ active: 'en' }) },
    slots: {
      inject: (_name, fn) => fn(),
      register: (options, component) => {
        registered[options.key ?? options.id] = component
        return noop
      },
      entries: () => [],
    },
  }
  const plugin = loadClient().factory((name) => (name === 'react' ? fakeReact() : undefined))
  plugin.apply(ctx)
  const seen = []
  const tree = registered.user({
    node: { data: { content: [{ type: 'text', text: 'sent text' }], source } },
    renderFactorySlot: (_name, props) => {
      seen.push(props.content.text)
      return null
    },
    t: (key) => key,
  })
  return { shown: seen[0], tree }
}

const walk = (node, visit) => {
  if (node === null || typeof node !== 'object') return
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}
const hasWarning = (tree) => {
  let found = false
  walk(tree, (node) => {
    if (node.props?.['data-language-bridge-warning'] !== undefined) found = true
  })
  return found
}

const originals = [{ index: 0, text: '原文' }]

test('the original is read from the legacy source.claudeZhBridge key', () => {
  assert.equal(userBubble({ kind: 'user', claudeZhBridge: { version: 1, originals } }).shown, '原文')
})

test('the original is read from the current source.languageBridge key', () => {
  assert.equal(userBubble({ kind: 'user', languageBridge: { version: 2, originals, warnings: [] } }).shown, '原文')
})

test('a message the bridge never touched shows its own text', () => {
  assert.equal(userBubble({ kind: 'user' }).shown, 'sent text')
})

test('a stored translation failure shows a warning in the bubble', () => {
  const failed = { kind: 'user', languageBridge: { version: 2, originals: [], warnings: [{ index: 0, code: 'TRANSLATION_TIMEOUT' }] } }
  assert.equal(hasWarning(userBubble(failed).tree), true)
  assert.equal(hasWarning(userBubble({ kind: 'user', languageBridge: { version: 2, originals, warnings: [] } }).tree), false)
})
