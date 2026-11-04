/**
 * Translation that leaves code, links and @references untouched. Pure apart from the injected
 * translator call. Placeholder format, chunking and whitespace handling are part of the
 * translator's cache key, so changing them orphans translations already saved in Sessions.
 */
// Code, URLs and @references stay verbatim; the translator only sees placeholders.
export const PROTECTED = /```[\s\S]*?```|`[^`\n]+`|https?:\/\/[^\s)>\]]+|@"[^"\n]+"|@[^\s,，。；;)）、！？]+/g

const CHUNK_CONCURRENCY = 3

export function mask(text) {
  const tokens = []
  const masked = text.replace(PROTECTED, (match) => {
    tokens.push(match)
    return `⟦${tokens.length - 1}⟧`
  })
  return { masked, tokens }
}

/** @returns the restored text, or undefined when a placeholder did not survive translation. */
export function unmask(translated, tokens) {
  const restored = translated.replace(/⟦\s*(\d+)\s*⟧/g, (match, index) => tokens[Number(index)] ?? match)
  for (const token of tokens) if (!restored.includes(token)) return undefined
  return restored
}

/** Split masked text on paragraph, then line, boundaries into translator-sized chunks. */
export function chunk(text, max) {
  const chunks = []
  let current = ''
  const push = (piece) => {
    if (current.length + piece.length <= max) {
      current += piece
      return
    }
    if (current !== '') chunks.push(current)
    current = ''
    if (piece.length <= max) {
      current = piece
      return
    }
    const lines = piece.split(/(?<=\n)/)
    if (lines.length > 1) {
      for (const line of lines) push(line)
      return
    }
    for (let index = 0; index < piece.length; index += max) chunks.push(piece.slice(index, index + max))
  }
  for (const piece of text.split(/(?<=\n{2,})/)) push(piece)
  if (current !== '') chunks.push(current)
  return chunks
}

const placeholdersOf = (text) => (text.match(/⟦\s*\d+\s*⟧/g) ?? []).map((token) => token.replace(/\s/g, '')).sort()
const keepsPlaceholders = (body, translated) => placeholdersOf(body).join() === placeholdersOf(translated).join()

/**
 * The model dropped a placeholder. The result is cached, so asking again returns the same
 * text: translate the prose between placeholders instead, which cannot lose them.
 */
async function translateAround(body, translate) {
  const parts = body.split(/(⟦\d+⟧)/)
  const translated = await Promise.all(parts.map(async (part) => {
    if (!/\p{L}/u.test(part) || /^⟦\d+⟧$/.test(part)) return part
    const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(part)
    return lead + (await translate(core)).trim() + trail
  }))
  return translated.join('')
}

/**
 * Translate one text, keeping protected spans verbatim.
 * @param options.max translator request limit in UTF-16 code units.
 * @param options.wanted whether one masked chunk needs translating.
 * @param options.translate translator call for one trimmed chunk.
 * @returns the translation, or undefined when placeholders still did not survive.
 */
export async function translateProtected(text, { max, wanted, translate }) {
  const { masked, tokens } = mask(text)
  const pieces = chunk(masked, max)
  const results = new Array(pieces.length)
  let next = 0
  const worker = async () => {
    while (next < pieces.length) {
      const index = next++
      const piece = pieces[index]
      // Leading/trailing whitespace is restored locally so Markdown structure survives.
      const [, lead, body, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(piece)
      if (!wanted(body)) {
        results[index] = piece
        continue
      }
      const translated = (await translate(body)).trim()
      results[index] = lead + (keepsPlaceholders(body, translated) ? translated : await translateAround(body, translate)) + trail
    }
  }
  await Promise.all(Array.from({ length: Math.min(CHUNK_CONCURRENCY, pieces.length) }, worker))
  return unmask(results.join(''), tokens)
}
