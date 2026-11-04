import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEFAULT_RULES, canonicalLanguage, compileRules, effectiveUserLanguage, fromUiLocale, modelLanguage, resolveSettings,
  sameLanguage, validateRules, validateUserLanguage, workingLanguageRule,
} from '../rules.js'

const defaults = compileRules(DEFAULT_RULES)

test('default rules cover the Claude, Gemini and GPT families', () => {
  for (const model of ['claude/claude-opus-5-5', 'antigravity/claude-sonnet-5-5', 'antigravity/gemini-3-flash', 'GEMINI-2.5-PRO',
    'gpt-5', 'openai/gpt-4o', 'chatgpt-4o-latest', 'antigravity/gpt-oss-120b-medium', 'gpt4']) {
    assert.equal(modelLanguage(defaults, model), 'en', model)
  }
})

test('the GPT pattern does not match unrelated ids', () => {
  for (const model of ['egpt-1', 'gptoss', 'mygpt-large', 'deepseek-flash', 'qwen-max', 'llama-3', 'gpts']) {
    assert.equal(modelLanguage(defaults, model), undefined, model)
  }
})

test('the first matching rule wins and order is respected', () => {
  const rules = compileRules([{ match: 'gemini-3-flash', language: 'zh-CN' }, { match: 'gemini', language: 'en' }])
  assert.equal(modelLanguage(rules, 'antigravity/gemini-3-flash'), 'zh-CN')
  assert.equal(modelLanguage(rules, 'antigravity/gemini-4-argon'), 'en')
  const reversed = compileRules([{ match: 'gemini', language: 'en' }, { match: 'gemini-3-flash', language: 'zh-CN' }])
  assert.equal(modelLanguage(reversed, 'antigravity/gemini-3-flash'), 'en')
})

test('matching is case-insensitive and a missing model is not bridged', () => {
  assert.equal(modelLanguage(compileRules([{ match: 'QWEN', language: 'zh-CN' }]), 'qwen-max'), 'zh-CN')
  assert.equal(modelLanguage(defaults, undefined), undefined)
  assert.equal(modelLanguage(defaults, ''), undefined)
})

test('validation reports invalid regexes and languages by row', () => {
  const { rules, errors } = validateRules([
    { match: 'claude', language: 'en' },
    { match: '(unclosed', language: 'en' },
    { match: 'x', language: 'english' },
    { match: '  ', language: 'en' },
  ])
  assert.deepEqual(rules, [{ match: 'claude', language: 'en' }])
  assert.deepEqual(errors, [
    { index: 1, field: 'match', code: 'invalid-regex' },
    { index: 2, field: 'language', code: 'invalid-language' },
    { index: 3, field: 'match', code: 'empty' },
  ])
  assert.equal(validateRules('nope').errors[0].code, 'not-a-list')
})

test('language tags are canonicalized and bad ones rejected', () => {
  assert.equal(canonicalLanguage('ZH-cn'), 'zh-CN')
  assert.equal(canonicalLanguage('fil'), 'fil')
  for (const bad of ['english', '', 'e', 'not a tag', 42]) assert.equal(canonicalLanguage(bad), undefined, String(bad))
  assert.equal(validateUserLanguage('AUTO'), 'auto')
  assert.equal(validateUserLanguage('es-MX'), 'es-MX')
  assert.equal(validateUserLanguage('klingon language'), undefined)
})

test('sameLanguage ignores region but not script', () => {
  assert.equal(sameLanguage('en', 'en-GB'), true)
  assert.equal(sameLanguage('zh-CN', 'zh-Hans'), true)
  assert.equal(sameLanguage('zh-CN', 'zh-TW'), false)
  assert.equal(sameLanguage('es', 'en'), false)
})

test('auto follows the UI locale, and bare zh maps to the tag old sessions saved under', () => {
  assert.equal(effectiveUserLanguage('auto', 'es'), 'es')
  assert.equal(effectiveUserLanguage('auto', 'zh'), 'zh-CN')
  assert.equal(effectiveUserLanguage('auto', undefined), undefined)
  assert.equal(effectiveUserLanguage('ja', 'zh'), 'ja')
  assert.equal(fromUiLocale('not a locale'), undefined)
})

test('settings layer saved over config over defaults and drop bad rows', () => {
  assert.deepEqual(resolveSettings().rules, DEFAULT_RULES.map((rule) => ({ ...rule })))
  const config = { rules: [{ match: 'a', language: 'fr' }], userLanguage: 'de' }
  assert.equal(resolveSettings(config).userLanguage, 'de')
  assert.equal(resolveSettings(config).rules[0].language, 'fr')
  const saved = { rules: [{ match: 'b', language: 'ja' }, { match: '(', language: 'ja' }], userLanguage: 'es' }
  const resolved = resolveSettings(config, saved)
  assert.deepEqual(resolved.rules, [{ match: 'b', language: 'ja' }])
  assert.equal(resolved.userLanguage, 'es')
  assert.equal(resolved.issues.length, 1)
  assert.deepEqual(resolveSettings(config, { rules: [] }).rules, [])
})

test('the prompt rule names the language and covers tool output', () => {
  const rule = workingLanguageRule('en')
  assert.match(rule, /reason and reply in English \(en\)/)
  assert.match(rule, /tool output/)
  assert.match(workingLanguageRule('zh-CN'), /zh-CN/)
})
