/** Model-language rules, language tags, and validation of saved settings. Pure. */

// The GPT pattern needs its boundaries: a bare `gpt` also matches ids like `egpt-1` or `gptoss`.
export const DEFAULT_RULES = Object.freeze([
  Object.freeze({ match: 'claude', language: 'en' }),
  Object.freeze({ match: 'gemini', language: 'en' }),
  Object.freeze({ match: '(^|[^a-z0-9])(chat)?gpt($|[^a-z])', language: 'en' }),
])

/** Canonical BCP 47 tag, or undefined. The primary subtag must be a real 2-3 letter code. */
export function canonicalLanguage(tag) {
  if (typeof tag !== 'string') return undefined
  try {
    const canonical = Intl.getCanonicalLocales(tag.trim())[0]
    return /^[a-z]{2,3}(-|$)/.test(canonical) ? canonical : undefined
  } catch {
    return undefined
  }
}

/** Same language and script; regional variants (`en-US`, `en-GB`) count as the same. */
export function sameLanguage(a, b) {
  try {
    const left = new Intl.Locale(a).maximize()
    const right = new Intl.Locale(b).maximize()
    return left.language === right.language && left.script === right.script
  } catch {
    return false
  }
}

/** English name of a language, for the system prompt. */
export function languageName(tag) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(tag) ?? tag
  } catch {
    return tag
  }
}

/** The GUI's bare `zh` means Simplified; this also matches translations the old bridge saved under `zh-CN`. */
export function fromUiLocale(locale) {
  if (locale === 'zh') return 'zh-CN'
  return canonicalLanguage(locale)
}

/**
 * Validate an ordered rule list.
 * @returns the cleaned `rules`, plus `errors` naming each bad row and field.
 */
export function validateRules(input) {
  if (!Array.isArray(input)) return { rules: [], errors: [{ index: -1, field: 'rules', code: 'not-a-list' }] }
  const rules = []
  const errors = []
  input.forEach((row, index) => {
    const match = typeof row?.match === 'string' ? row.match.trim() : ''
    const language = canonicalLanguage(row?.language)
    let valid = true
    if (match === '') {
      errors.push({ index, field: 'match', code: 'empty' })
      valid = false
    } else {
      try {
        new RegExp(match, 'i')
      } catch {
        errors.push({ index, field: 'match', code: 'invalid-regex' })
        valid = false
      }
    }
    if (language === undefined) {
      errors.push({ index, field: 'language', code: 'invalid-language' })
      valid = false
    }
    if (valid) rules.push({ match, language })
  })
  return { rules, errors }
}

/** `auto` or a canonical tag; undefined when invalid. */
export function validateUserLanguage(input) {
  if (typeof input === 'string' && input.trim().toLowerCase() === 'auto') return 'auto'
  return canonicalLanguage(input)
}

export function compileRules(rules) {
  return rules.map(({ match, language }) => ({ pattern: new RegExp(match, 'i'), language }))
}

/** Working language of a model: the first matching rule wins; no match means not bridged. */
export function modelLanguage(compiled, model) {
  if (typeof model !== 'string' || model === '') return undefined
  return compiled.find(({ pattern }) => pattern.test(model))?.language
}

/** Resolve `auto` from the UI locale the browser last reported; undefined until one is known. */
export function effectiveUserLanguage(userLanguage, uiLocale) {
  if (userLanguage !== 'auto') return userLanguage
  return uiLocale === undefined ? undefined : fromUiLocale(uiLocale)
}

/**
 * Layer saved GUI settings over patch-file config over defaults.
 * Bad rows are dropped and reported, so one typo cannot switch the plugin off or break a turn.
 */
export function resolveSettings(config = {}, saved = {}) {
  const issues = []
  const pick = (source) => {
    const { rules, errors } = validateRules(source)
    issues.push(...errors)
    return rules
  }
  const rules = saved.rules !== undefined ? pick(saved.rules)
    : config.rules !== undefined ? pick(config.rules)
      : DEFAULT_RULES.map((rule) => ({ ...rule }))
  const userLanguage = validateUserLanguage(saved.userLanguage) ?? validateUserLanguage(config.userLanguage) ?? 'auto'
  return { rules, userLanguage, uiLocale: typeof saved.uiLocale === 'string' ? saved.uiLocale : undefined, issues }
}

/** Short rule for the system prompt. It makes the language likely, it cannot enforce it. */
export function workingLanguageRule(language) {
  const name = `${languageName(language)} (${language})`
  return `Working language: reason and reply in ${name}, including when instructions, tool output, file contents or user messages arrive in another language. User messages may have been machine-translated into ${languageName(language)}, and your replies are translated for the user separately, so do not translate them yourself. Content the user explicitly requests in a specific language, such as a file or a translation, is still written in that language.`
}
