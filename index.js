/**
 * Host half of the Claude/Gemini Chinese bridge.
 *
 * - `agent/pre-step`: when the Session's model matches `modelPattern` (Claude and Gemini
 *   families by default), user-authored text containing Chinese is translated to English
 *   by DeepSeek before it enters the step, so the durable `user/message` (and therefore
 *   the model input) is English.
 * - `POST /api/claude-zh-bridge/translate`: the browser half asks for the Chinese
 *   translation of one completed bridged-model Turn. Paid DeepSeek results are stored by
 *   the translator in the Session, so reopening reuses them.
 */
export const inject = ['translator', 'connection']

const ROUTE = '/api/claude-zh-bridge/translate'
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/
const LATIN = /[A-Za-z]/
// Code, URLs and @references stay verbatim; the translator only sees placeholders.
const PROTECTED = /```[\s\S]*?```|`[^`\n]+`|https?:\/\/[^\s)>\]]+|@"[^"\n]+"|@[^\s,，。；;)）]+/g
const PROVIDER_PREFERENCE = ['deepseek-official', 'deepseek-account']
const PROVIDER_TTL_MS = 60_000
const CHUNK_CONCURRENCY = 3

export function apply(ctx, config = {}) {
  const options = {
    provider: config.provider ?? 'auto',
    modelPattern: new RegExp(config.modelPattern ?? 'claude|gemini', 'i'),
    translateInput: config.translateInput !== false,
    translateOutput: config.translateOutput !== false,
  }
  const logger = ctx.logger ?? console

  // Latest provider/model per Session from durable selection and request events.
  const routes = new Map()
  ctx.on('session/event', (session, event) => {
    if (event.type !== 'model/selection' && event.type !== 'request/context') return
    const model = event.data?.model
    if (typeof model === 'string') routes.set(session.id, { provider: event.data.provider, model })
  })
  ctx.on('session/disposed', (session) => {
    routes.delete(session.id)
  })

  function routeOfAgent(agent) {
    return routes.get(agent.id) ?? agent.session?.requestContext?.() ?? agent.options
  }

  function isBridgedModel(model) {
    return typeof model === 'string' && options.modelPattern.test(model)
  }

  let providerChoice
  async function pickProvider(signal) {
    if (options.provider !== 'auto') return options.provider
    if (providerChoice && Date.now() - providerChoice.at < PROVIDER_TTL_MS) return providerChoice.task
    const task = ctx.translator.availableProviders(signal).then((available) => {
      const picked = PROVIDER_PREFERENCE.find((provider) => available.includes(provider))
      if (picked === undefined) {
        throw new Error('No DeepSeek translation route: configure a DeepSeek API key or account with deepseek-flash')
      }
      return picked
    })
    providerChoice = { at: Date.now(), task }
    task.catch(() => {
      if (providerChoice?.task === task) providerChoice = undefined
    })
    return task
  }

  async function translateChunk(sessionId, text, targetLanguage, signal) {
    const provider = await pickProvider(signal)
    const request = { text, targetLanguage, provider, sessionId }
    try {
      return await ctx.translator.translate(ctx.translator.resolve(request), signal)
    } catch (error) {
      if (error?.code !== 'TRANSLATION_SESSION_INACTIVE') throw error
      const sessionController = ctx.get('sessionController')
      if (sessionController === undefined) throw error
      const resolved = await sessionController.resolveAgent(sessionId)
      if ('error' in resolved) throw resolved.error
      signal?.throwIfAborted()
      return await ctx.translator.translate(ctx.translator.resolve(request), signal)
    }
  }

  /** Split masked text on paragraph, then line, boundaries into translator-sized chunks. */
  function chunk(text, max) {
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

  /**
   * Translate one text, keeping protected spans verbatim.
   * @returns the translation, or undefined when placeholders did not survive.
   */
  async function translateText(sessionId, text, targetLanguage, wanted, signal) {
    const tokens = []
    const masked = text.replace(PROTECTED, (match) => {
      tokens.push(match)
      return `⟦${tokens.length - 1}⟧`
    })
    const max = Math.max(200, (ctx.translator.maxTextChars ?? 4000) - 100)
    const pieces = chunk(masked, max)
    const results = new Array(pieces.length)
    let next = 0
    const worker = async () => {
      while (next < pieces.length) {
        const index = next++
        const piece = pieces[index]
        // Leading/trailing whitespace is restored locally so Markdown structure survives.
        const [, lead, body, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(piece)
        results[index] = wanted(body) ? lead + (await translateChunk(sessionId, body, targetLanguage, signal)).trim() + trail : piece
      }
    }
    await Promise.all(Array.from({ length: Math.min(CHUNK_CONCURRENCY, pieces.length) }, worker))
    const translated = results.join('')
    let intact = true
    const restored = translated.replace(/⟦\s*(\d+)\s*⟧/g, (match, index) => tokens[Number(index)] ?? match)
    for (const token of tokens) if (!restored.includes(token)) intact = false
    return intact ? restored : undefined
  }

  const hasChineseOutsideCode = (text) => CJK.test(text.replace(PROTECTED, ''))
  const needsChinese = (text) => {
    const plain = text.replace(PROTECTED, '').replace(/⟦\d+⟧/g, '')
    if (!LATIN.test(plain)) return false
    const cjk = (plain.match(new RegExp(CJK.source, 'g')) ?? []).length
    const latin = (plain.match(/[A-Za-z]+/g) ?? []).length
    return latin > cjk / 2
  }

  async function translateUserMessage(sessionId, message, signal) {
    let changed = false
    const content = []
    // Originals ride on the model-invisible message source so the GUI can show them.
    const originals = []
    for (const [index, block] of message.content.entries()) {
      if (block?.type !== 'text' || !hasChineseOutsideCode(block.text)) {
        content.push(block)
        continue
      }
      const english = await translateText(sessionId, block.text, 'en', (body) => CJK.test(body), signal)
      if (english === undefined || english.trim() === '') {
        logger.warn?.('claude-zh-bridge: kept a prompt block untranslated because protected spans changed')
        content.push(block)
        continue
      }
      changed = true
      originals.push({ index, text: block.text })
      content.push({ ...block, text: english })
    }
    if (!changed) return message
    return { ...message, content, source: { ...message.source, claudeZhBridge: { version: 1, originals } } }
  }

  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    if (!options.translateInput || decision.kind !== 'enter') return decision
    const { agent, signal } = payload
    if (!isBridgedModel(routeOfAgent(agent)?.model)) return decision
    let changed = false
    const messages = []
    for (const message of decision.messages) {
      let replacement = message
      if (message.role === 'user' && message.source?.kind === 'user' && Array.isArray(message.content)) {
        try {
          replacement = await translateUserMessage(agent.id, message, signal)
        } catch (error) {
          if (signal.aborted) throw error
          logger.warn?.(`claude-zh-bridge: prompt translation failed, sending the original: ${error?.message ?? error}`)
        }
      }
      if (replacement !== message) changed = true
      messages.push(replacement)
    }
    return changed ? { ...decision, messages } : decision
  })

  const reply = (status, value) => new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

  async function sessionIsBridged(sessionId) {
    let route = routes.get(sessionId)
    if (route === undefined) {
      const agent = ctx.get('agents')?.get(sessionId)
      if (agent !== undefined) route = routeOfAgent(agent)
    }
    if (route === undefined) {
      const resolved = await ctx.get('sessionController')?.resolveAgent(sessionId)
      if (resolved && 'agent' in resolved) route = routeOfAgent(resolved.agent)
    }
    return isBridgedModel(route?.model)
  }

  ctx.connection.fetch.register({
    path: ROUTE,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      let body
      try {
        body = await request.json()
      } catch {
        return reply(400, { error: 'invalid JSON body' })
      }
      const { sessionId, text, models } = body ?? {}
      if (typeof sessionId !== 'string' || typeof text !== 'string') return reply(400, { error: 'sessionId and text are required' })
      if (!options.translateOutput) return reply(200, { skipped: 'disabled' })
      try {
        const bridged = Array.isArray(models) && models.length > 0
          ? models.some(isBridgedModel)
          : await sessionIsBridged(sessionId)
        if (!bridged) return reply(200, { skipped: 'not-bridged' })
        if (!needsChinese(text)) return reply(200, { skipped: 'already-chinese' })
        const chinese = await translateText(sessionId, text, 'zh-CN', needsChinese, request.signal)
        if (chinese === undefined) return reply(502, { error: 'translation changed code or links' })
        return reply(200, { text: chinese })
      } catch (error) {
        logger.warn?.(`claude-zh-bridge: reply translation failed: ${error?.message ?? error}`)
        return reply(502, { error: error?.code ?? error?.message ?? 'translation failed' })
      }
    },
  })
}
