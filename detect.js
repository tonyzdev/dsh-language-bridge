/**
 * Decides whether a text still needs translating into a target language, for any language
 * pair and with no dependencies. Pure: no I/O, no model calls.
 *
 * Order of evidence: strip code-like tokens, compare Unicode scripts, then compare function
 * words. Anything still undecided counts as "translate": a wrong yes costs one cheap
 * translation, a wrong no sends the model text in the wrong language without anyone noticing.
 */
import { PROTECTED } from './protect.js'

// Distinctive function words. Words shared with English ("a", "no", "me", "on") are left out
// on purpose, so a hit is real evidence. `chars` are letters that language uses and the
// others in its script mostly do not; each occurrence counts as one hit.
const LEXICONS = {
  en: { words: 'the and is are was were be been to of in that it for with this you your not have has had can from or but what how why when where which who please should would could will there their they we my our an at by as if do does did need use make add', chars: '' },
  es: { words: 'el la los las un una unos unas de del que en y por para con es son está están este esta esto estos pero más como cómo qué porque cuando donde dónde hay muy mi tu su sus lo le les al ser hacer quiero necesito puedes favor hola gracias', chars: '¿¡ñ' },
  fr: { words: 'le la les un une des du de et est sont dans pour avec que qui ne pas sur ce cette ces je tu il nous vous ils au aux mais ou où comment pourquoi quand faire peux veux merci bonjour', chars: 'œçêèà' },
  de: { words: 'der die das den dem des ein eine einen einem und ist sind nicht mit für auf von zu im ich du er wir ihr sie aber oder wie warum wenn dass bitte kann können muss danke hallo', chars: 'ßäöü' },
  pt: { words: 'os um uma uns umas de da das dos em na nas nos é são está estão para com que por mais como mas não eu você ele ela isso este esta por favor obrigado olá preciso', chars: 'ãõç' },
  it: { words: 'il lo la gli le un una uno di del della dei delle è sono per con che non ma perché quando dove questo questa io tu lui noi voi loro grazie ciao fare posso voglio', chars: 'ìò' },
  nl: { words: 'de het een zijn niet met voor op van te ik jij hij wij jullie maar hoe waarom wanneer dat dit moet graag bedankt hallo', chars: '' },
  pl: { words: 'w na z nie jest są się że jak ale lub dla co czy ja ty wy proszę dziękuję cześć', chars: 'ąćęłńśźż' },
  tr: { words: 've bir bu için ile de da ne nasıl neden ama veya ben sen biz siz var yok lütfen teşekkürler merhaba', chars: 'ğış' },
  vi: { words: 'và của là có không cho với một các những này tôi bạn chúng để trong khi như nhưng vui lòng cảm ơn xin chào', chars: 'ơưđ' },
  id: { words: 'dan yang di ke dari untuk dengan ini itu saya kamu kami tidak ada adalah akan bisa tolong terima kasih halo atau tetapi bagaimana mengapa', chars: '' },
  sv: { words: 'och är att det en ett som för på med av till inte jag du vi de men eller hur varför när tack hej kan', chars: 'åäö' },
  ru: { words: 'и в не на что это как с по для но из у он она мы вы они я ты или почему когда где пожалуйста спасибо привет', chars: 'ыэъё' },
  uk: { words: 'і в не на що це як з по для але із у він вона ми ви вони я ти або чому коли де будь ласка дякую привіт', chars: 'їєґ' },
  bg: { words: 'и в не на че това как с по за но от той тя ние вие те аз ти или защо кога къде моля благодаря здравей', chars: 'ъ' },
  ar: { words: 'في من على إلى هذا هذه أن هو هي لا ما كيف لماذا و أو لكن شكرا مرحبا من فضلك', chars: 'ةى' },
  fa: { words: 'در از به که این آن را است و یا اما چرا چگونه من تو ما شما لطفا متشکرم سلام', chars: 'پچژگ' },
}
const WORDS = Object.fromEntries(Object.entries(LEXICONS).map(([language, { words }]) => [language, new Set(words.split(' '))]))

const WIDE_SCRIPTS = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u
const LATIN_LETTER = /\p{Script=Latin}/u
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u
const LETTER = /\p{L}/gu
// Roughly one word per 2 CJK/Hangul characters and per 5 letters elsewhere, so that share
// compares words and not characters.
const unitsOf = (letter) => (WIDE_SCRIPTS.test(letter) ? 0.5 : 0.2)

const COMPOSITE_SCRIPTS = { Jpan: ['Han', 'Hira', 'Kana'], Kore: ['Hang', 'Han'], Hans: ['Han'], Hant: ['Han'] }

function scriptCode(tag) {
  try {
    return new Intl.Locale(tag).maximize().script
  } catch {
    return undefined
  }
}

/** Patterns for the scripts a language is written in, or undefined when its script is unknown. */
export function scriptsOf(tag) {
  const script = scriptCode(tag)
  if (script === undefined) return undefined
  try {
    return (COMPOSITE_SCRIPTS[script] ?? [script]).map((name) => new RegExp(`\\p{Script=${name}}`, 'u'))
  } catch {
    return undefined
  }
}

const primaryLanguage = (tag) => {
  try {
    return new Intl.Locale(tag).language
  } catch {
    return undefined
  }
}
const usesHan = (tag) => ['Jpan', 'Hans', 'Hant'].includes(scriptCode(tag))

// A run of ASCII word and code characters. Non-ASCII letters end a run, so "修复parseConfig函数"
// still yields the identifier.
const CODE_RUN = /[A-Za-z0-9_][A-Za-z0-9_.\-/\\:=+#$%&*~^|<>{}()[\]]*/g
const looksLikeCode = (token) => /[_/\\=+#$%&*~^|<>{}()[\]]|::/.test(token)
  || /\d/.test(token)
  || /[a-z][A-Z]/.test(token)
  || /[A-Za-z0-9]\.[A-Za-z0-9]/.test(token)
  || /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(token)
const isAllCaps = (token) => /^[A-Z]{2,}$/.test(token)

/**
 * Remove protected spans and code-like tokens, leaving the prose a human wrote.
 * All-caps tokens are acronyms unless the text is mostly shouting, so "ARREGLA EL ERROR"
 * survives and "HTTP API" does not.
 */
export function proseOf(text) {
  const unprotected = text.replace(PROTECTED, ' ').replace(/⟦\s*\d+\s*⟧/g, ' ')
  const runs = (unprotected.match(CODE_RUN) ?? []).map((run) => run.replace(/[.,:;)\]}>-]+$/, ''))
  const words = runs.filter((run) => !looksLikeCode(run))
  const capitals = words.filter(isAllCaps).length
  const shouting = capitals >= 3 && capitals * 2 >= words.length
  return unprotected.replace(CODE_RUN, (run) => {
    const token = run.replace(/[.,:;)\]}>-]+$/, '')
    if (token === '' || looksLikeCode(token)) return ' '
    return !shouting && isAllCaps(token) ? ' ' : run
  })
}

function countScripts(prose, targetScripts) {
  const counts = { letters: 0, units: 0, targetUnits: 0, latinUnits: 0, otherUnits: 0, otherLetters: 0 }
  for (const [letter] of prose.matchAll(LETTER)) {
    const units = unitsOf(letter)
    counts.letters += 1
    counts.units += units
    if (targetScripts.some((script) => script.test(letter))) {
      counts.targetUnits += units
    } else if (LATIN_LETTER.test(letter)) {
      counts.latinUnits += units
    } else {
      counts.otherUnits += units
      counts.otherLetters += 1
    }
  }
  return counts
}

function lexiconScores(prose) {
  const scores = {}
  for (const language of Object.keys(LEXICONS)) scores[language] = 0
  const lowered = prose.toLowerCase().normalize('NFC')
  for (const [token] of lowered.matchAll(/\p{L}+/gu)) {
    for (const language of Object.keys(LEXICONS)) if (WORDS[language].has(token)) scores[language] += 1
  }
  for (const [language, { chars }] of Object.entries(LEXICONS)) {
    for (const char of chars) scores[language] += lowered.split(char).length - 1
  }
  return scores
}

/**
 * @param text the text as written, code and links included.
 * @param options.target BCP 47 tag of the language the text should end up in.
 * @param options.source BCP 47 tag it is expected to come from, when known. Only ever a hint:
 *   people write in other languages than their configured one.
 * @returns whether the text should be sent to the translator.
 */
export function needsTranslation(text, { target, source } = {}) {
  const prose = proseOf(text)
  if (!/\p{L}/u.test(prose)) return false
  const targetScripts = scriptsOf(target)
  if (targetScripts === undefined) return true

  const counts = countScripts(prose, targetScripts)
  const otherShare = counts.otherUnits / counts.units
  // Non-Latin text inside other text is rarely incidental, but one letter can be a symbol (π).
  if (otherShare >= 0.03 && (counts.otherLetters >= 2 || otherShare >= 0.5)) return true
  // Latin words inside CJK, Cyrillic or Arabic prose are usually names and loanwords, so a
  // non-Latin target only counts Latin text as foreign when it dominates.
  if (counts.latinUnits / counts.units >= 0.6) return true

  const targetLanguage = primaryLanguage(target)
  if (targetLanguage === 'ja' && KANA.test(prose)) return false
  // Han alone cannot tell Japanese from Chinese, or Simplified from Traditional.
  if (usesHan(target) && counts.targetUnits > 0) {
    if (source === undefined) return targetLanguage === 'ja'
    if (usesHan(source)) return true
  }

  const targetScript = scriptCode(target)
  const scores = lexiconScores(prose)
  const targetScore = scores[targetLanguage] ?? 0
  let otherScore = 0
  for (const [language, score] of Object.entries(scores)) {
    if (language !== targetLanguage && scriptCode(language) === targetScript && score > otherScore) otherScore = score
  }
  if (otherScore >= 2 && otherScore > targetScore * 1.5) return true
  if (targetScore >= 1 && targetScore >= otherScore * 2) return false

  // Nothing decisive. A Latin target shares its script with many languages, so assume the text
  // still needs translating, unless the user's language uses another script: then this text
  // was typed in the target's script on purpose (a Japanese user writing "run tests").
  if (source === undefined) return targetScript === 'Latn'
  return scriptCode(source) === targetScript
}
