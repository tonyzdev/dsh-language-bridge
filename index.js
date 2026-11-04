/**
 * Host half of the language bridge.
 *
 * - `agent/pre-step`: when the step's model matches a rule, user-authored text is translated
 *   into that model's working language by DeepSeek before it enters the step, so the durable
 *   `user/message` (and therefore the model input) is in the working language.
 * - system prompt section: asks bridged models to reason and reply in their working language.
 * - `POST /api/language-bridge/translate`: the browser half asks for the translation of one
 *   completed Turn into the user's language. Paid DeepSeek results are stored by the
 *   translator in the Session, so reopening reuses them.
 * - `/api/language-bridge/settings` and `/locale`: the GUI settings page and the UI locale
 *   that `auto` follows. Saved settings apply from the next step, without a restart.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { needsTranslation } from './detect.js'
import { translateProtected } from './protect.js'
import {
  compileRules, effectiveUserLanguage, fromUiLocale, modelLanguage, resolveSettings, sameLanguage,
  validateRules, validateUserLanguage, workingLanguageRule,
} from './rules.js'

export const inject = ['translator', 'connection', 'systemPrompt']

const API = '/api/language-bridge'
const PROVIDER_PREFERENCE = ['deepseek-official', 'deepseek-account']
const PROVIDER_TTL_MS = 60_000
// Before the Harness's environment-bearing prompt suffix (10000), so it stays in the reusable prefix.
const PROMPT_ORDER = 9900

const defaultStateFile = () => join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'storages', 'language-bridge.json')

export function apply(ctx, config = {}) {
  const options = {
    provider: config.provider ?? 'auto',
    translateInput: config.translateInput !== false,
    translateOutput: config.translateOutput !== false,
    stateFile: typeof config.stateFile === 'string' && config.stateFile !== '' ? config.stateFile : defaultStateFile(),
  }
  const logger = ctx.logger ?? console

  function readSaved() {
    try {
      return JSON.parse(readFileSync(options.stateFile, 'utf8'))
    } catch (error) {
      if (error?.code !== 'ENOENT') logger.warn?.(`language-bridge: ignoring unreadable settings: ${error?.message ?? error}`)
      return {}
    }
  }

  let saved = readSaved()
  let settings = resolveSettings(config, saved)
  let compiled = compileRules(settings.rules)
  for (const issue of settings.issues) logger.warn?.(`language-bridge: dropped rule ${issue.index}: ${issue.code} (${issue.field})`)

  function persist(patch) {
    const next = { ...saved, ...patch, version: 1 }
    mkdirSync(dirname(options.stateFile), { recursive: true })
    const temporary = `${options.stateFile}.${process.pid}.tmp`
    writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 })
    renameSync(temporary, options.stateFile)
    saved = next
    settings = resolveSettings(config, saved)
    compiled = compileRules(settings.rules)
  }

  const userLanguage = () => effectiveUserLanguage(settings.userLanguage, settings.uiLocale)
  /** Working language when this model is bridged; a no-op pair is not bridged and costs nothing. */
  function bridgeLanguage(model) {
    const language = modelLanguage(compiled, model)
    if (language === undefined) return undefined
    const user = userLanguage()
    return user !== undefined && sameLanguage(user, language) ? undefined : language
  }

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

  // Newer Harness builds pass the step's model selection; 0.2.1 passes only the agent.
  ctx.systemPrompt.section({
    name: 'language-bridge:working-language',
    order: PROMPT_ORDER,
    interpolate: false,
    text: (context) => {
      const model = context.modelSelection?.model ?? (context.agent === undefined ? undefined : routeOfAgent(context.agent)?.model)
      const language = bridgeLanguage(model)
      return language === undefined ? '' : workingLanguageRule(language)
    },
  })

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

  const translateText = (sessionId, text, target, source, signal) => translateProtected(text, {
    max: Math.max(200, (ctx.translator.maxTextChars ?? 4000) - 100),
    wanted: (body) => needsTranslation(body, { target, source }),
    translate: (body) => translateChunk(sessionId, body, target, signal),
  })

  async function translateUserMessage(sessionId, message, target, source, signal) {
    const content = []
    // Originals ride on the model-invisible message source so the GUI can show them.
    const originals = []
    const warnings = []
    for (const [index, block] of message.content.entries()) {
      if (block?.type !== 'text' || !needsTranslation(block.text, { target, source })) {
        content.push(block)
        continue
      }
      let translated
      try {
        translated = await translateText(sessionId, block.text, target, source, signal)
        if (translated === undefined || translated.trim() === '') warnings.push({ index, code: 'protected-spans-changed' })
      } catch (error) {
        if (signal.aborted) throw error
        warnings.push({ index, code: error?.code ?? 'translation-failed' })
        logger.warn?.(`language-bridge: prompt translation failed, sending the original: ${error?.message ?? error}`)
      }
      // A false positive from detection comes back unchanged: nothing to show or toggle.
      if (translated === undefined || translated.trim() === '' || translated.trim() === block.text.trim()) {
        content.push(block)
        continue
      }
      originals.push({ index, text: block.text })
      content.push({ ...block, text: translated })
    }
    if (originals.length === 0 && warnings.length === 0) return message
    return { ...message, content, source: { ...message.source, languageBridge: { version: 2, targetLanguage: target, originals, warnings } } }
  }

  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    if (!options.translateInput || decision.kind !== 'enter') return decision
    const { agent, signal } = payload
    const target = bridgeLanguage(payload.modelSelection?.model ?? routeOfAgent(agent)?.model)
    if (target === undefined) return decision
    const source = userLanguage()
    let changed = false
    const messages = []
    for (const message of decision.messages) {
      const replacement = message.role === 'user' && message.source?.kind === 'user' && Array.isArray(message.content)
        ? await translateUserMessage(agent.id, message, target, source, signal)
        : message
      if (replacement !== message) changed = true
      messages.push(replacement)
    }
    return changed ? { ...decision, messages } : decision
  })

  const reply = (status, value) => new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

  async function modelOfSession(sessionId) {
    let route = routes.get(sessionId)
    if (route === undefined) {
      const agent = ctx.get('agents')?.get(sessionId)
      if (agent !== undefined) route = routeOfAgent(agent)
    }
    if (route === undefined) {
      const resolved = await ctx.get('sessionController')?.resolveAgent(sessionId)
      if (resolved && 'agent' in resolved) route = routeOfAgent(resolved.agent)
    }
    return route?.model
  }

  const settingsView = () => ({
    rules: settings.rules,
    userLanguage: settings.userLanguage,
    resolvedUserLanguage: userLanguage() ?? null,
  })

  ctx.connection.fetch.register({
    path: `${API}/settings`,
    methods: ['GET', 'POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      if (request.method === 'GET') return reply(200, settingsView())
      let body
      try {
        body = await request.json()
      } catch {
        return reply(400, { error: 'invalid JSON body' })
      }
      const { rules, errors } = validateRules(body?.rules)
      const language = validateUserLanguage(body?.userLanguage)
      if (language === undefined) errors.push({ index: -1, field: 'userLanguage', code: 'invalid-language' })
      if (errors.length > 0) return reply(422, { errors })
      try {
        persist({ rules, userLanguage: language })
      } catch (error) {
        logger.warn?.(`language-bridge: could not save settings: ${error?.message ?? error}`)
        return reply(500, { error: 'could not save settings' })
      }
      return reply(200, settingsView())
    },
  })

  ctx.connection.fetch.register({
    path: `${API}/locale`,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      const locale = await request.json().then((body) => body?.locale, () => undefined)
      if (fromUiLocale(locale) === undefined) return reply(400, { error: 'invalid locale' })
      if (locale !== settings.uiLocale) {
        try {
          persist({ uiLocale: locale })
        } catch (error) {
          // Keep following the locale for this run even if it cannot be saved.
          settings = { ...settings, uiLocale: locale }
          logger.warn?.(`language-bridge: could not save the UI locale: ${error?.message ?? error}`)
        }
      }
      return reply(200, settingsView())
    },
  })

  ctx.connection.fetch.register({
    path: `${API}/translate`,
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
      const target = userLanguage()
      if (target === undefined) return reply(200, { skipped: 'no-user-language' })
      try {
        const candidates = Array.isArray(models) && models.length > 0 ? models : [await modelOfSession(sessionId)]
        const source = candidates.map(bridgeLanguage).find((language) => language !== undefined)
        if (source === undefined) return reply(200, { skipped: 'not-bridged' })
        if (!needsTranslation(text, { target, source })) return reply(200, { skipped: 'already-translated' })
        const translated = await translateText(sessionId, text, target, source, request.signal)
        if (translated === undefined) return reply(502, { error: 'translation changed code or links' })
        if (translated.trim() === text.trim()) return reply(200, { skipped: 'already-translated' })
        return reply(200, { text: translated })
      } catch (error) {
        logger.warn?.(`language-bridge: reply translation failed: ${error?.message ?? error}`)
        return reply(502, { error: error?.code ?? error?.message ?? 'translation failed' })
      }
    },
  })
}
