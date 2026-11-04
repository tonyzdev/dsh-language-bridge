window.__ModuleLoader__.load({
  id: 'dsh-language-bridge',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'languageBridge';
    const BUNDLE_NAME = 'dsh-language-bridge';
    const NODE_SLOT = 'conversation.chat.node';
    const ACTION_SLOT = 'conversation.chat.assistant-actions';
    const CONFIG_SLOT = 'plugins.bundle.config';

    // Bubble and toggle labels follow the UI locale; the settings page falls back to English
    // outside en and zh.
    const zh = {
      showTranslation: '查看译文',
      showOriginal: '查看原文',
      showTranslationHint: '用 DeepSeek 译文替换这一轮回答',
      showOriginalHint: '显示模型的原始回答',
      translating: '翻译中…',
      failed: '翻译失败，点击重试',
      viewOriginal: '查看原文',
      viewSent: '查看发送内容',
      viewOriginalHint: '显示你输入的原文',
      viewSentHint: '显示实际发给模型的文本',
      inputFailed: '⚠ 翻译失败，模型收到的是未翻译的原文',
      'settings.intro': '为模型设置工作语言：输入先翻译成该语言再发给模型，回答翻译成你的语言显示。规则从上到下匹配，第一条命中的生效；没有命中的模型不做桥接。保存后从下一步开始生效，无需重启。',
      'settings.userLanguage': '你的语言',
      'settings.userLanguageHint': 'BCP 47 代码（如 es、ja、zh-CN），或 auto 跟随界面语言',
      'settings.resolved': '当前：{name}',
      'settings.rules': '模型规则',
      'settings.match': '模型 id 正则（不区分大小写）',
      'settings.language': '工作语言',
      'settings.add': '添加规则',
      'settings.remove': '删除',
      'settings.up': '上移',
      'settings.down': '下移',
      'settings.empty': '没有规则：所有模型都不桥接',
      'settings.test': '测试模型 id',
      'settings.testNone': '没有命中规则：不桥接',
      'settings.testRule': '命中第 {n} 条：工作语言 {name}',
      'settings.testSame': '命中第 {n} 条：与你的语言相同，不翻译也不产生费用',
      'settings.save': '保存',
      'settings.discard': '放弃',
      'settings.saved': '已保存',
      'settings.saveFailed': '保存失败：{error}',
      'settings.invalidRegex': '不是有效的正则表达式',
      'settings.emptyMatch': '不能为空',
      'settings.invalidLanguage': '不是有效的 BCP 47 语言代码',
      'settings.summary': '{n} 条规则 · 你的语言：{name}',
      'settings.loadFailed': '无法读取设置',
    };
    const en = {
      showTranslation: 'View translation',
      showOriginal: 'View original',
      showTranslationHint: 'Replace this reply with the DeepSeek translation',
      showOriginalHint: 'Show the model\'s original reply',
      translating: 'Translating…',
      failed: 'Translation failed, click to retry',
      viewOriginal: 'View original',
      viewSent: 'View sent text',
      viewOriginalHint: 'Show the text you typed',
      viewSentHint: 'Show the text sent to the model',
      inputFailed: '⚠ Translation failed: the model received your original text',
      'settings.intro': 'Set the language each model works in: your input is translated into it before sending, and replies are translated into your language. Rules are checked top to bottom and the first match wins; a model with no match is not bridged. Saved changes apply from the next step, with no restart.',
      'settings.userLanguage': 'Your language',
      'settings.userLanguageHint': 'A BCP 47 code (es, ja, zh-CN), or auto to follow the UI language',
      'settings.resolved': 'Currently: {name}',
      'settings.rules': 'Model rules',
      'settings.match': 'Model id regex (case-insensitive)',
      'settings.language': 'Working language',
      'settings.add': 'Add rule',
      'settings.remove': 'Remove',
      'settings.up': 'Move up',
      'settings.down': 'Move down',
      'settings.empty': 'No rules: no model is bridged',
      'settings.test': 'Test a model id',
      'settings.testNone': 'No rule matches: not bridged',
      'settings.testRule': 'Rule {n} matches: works in {name}',
      'settings.testSame': 'Rule {n} matches: same as your language, so no translation and no cost',
      'settings.save': 'Save',
      'settings.discard': 'Discard',
      'settings.saved': 'Saved',
      'settings.saveFailed': 'Could not save: {error}',
      'settings.invalidRegex': 'Not a valid regular expression',
      'settings.emptyMatch': 'Required',
      'settings.invalidLanguage': 'Not a valid BCP 47 language code',
      'settings.summary': '{n} rules · your language: {name}',
      'settings.loadFailed': 'Could not read settings',
    };
    const bubbleLabels = {
      ja: { showTranslation: '翻訳を表示', showOriginal: '原文を表示', showTranslationHint: 'この回答を DeepSeek の翻訳に置き換えます', showOriginalHint: 'モデルの元の回答を表示します', translating: '翻訳中…', failed: '翻訳に失敗しました。クリックで再試行', viewOriginal: '原文を表示', viewSent: '送信内容を表示', viewOriginalHint: '入力した原文を表示します', viewSentHint: 'モデルに送信したテキストを表示します', inputFailed: '⚠ 翻訳に失敗しました。モデルには原文が送信されました' },
      es: { showTranslation: 'Ver traducción', showOriginal: 'Ver original', showTranslationHint: 'Sustituir esta respuesta por la traducción de DeepSeek', showOriginalHint: 'Mostrar la respuesta original del modelo', translating: 'Traduciendo…', failed: 'Error de traducción, haz clic para reintentar', viewOriginal: 'Ver original', viewSent: 'Ver texto enviado', viewOriginalHint: 'Mostrar el texto que escribiste', viewSentHint: 'Mostrar el texto enviado al modelo', inputFailed: '⚠ Error de traducción: el modelo recibió tu texto original' },
      fr: { showTranslation: 'Voir la traduction', showOriginal: 'Voir l\'original', showTranslationHint: 'Remplacer cette réponse par la traduction DeepSeek', showOriginalHint: 'Afficher la réponse originale du modèle', translating: 'Traduction…', failed: 'Échec de la traduction, cliquez pour réessayer', viewOriginal: 'Voir l\'original', viewSent: 'Voir le texte envoyé', viewOriginalHint: 'Afficher le texte saisi', viewSentHint: 'Afficher le texte envoyé au modèle', inputFailed: '⚠ Échec de la traduction : le modèle a reçu votre texte original' },
      de: { showTranslation: 'Übersetzung anzeigen', showOriginal: 'Original anzeigen', showTranslationHint: 'Diese Antwort durch die DeepSeek-Übersetzung ersetzen', showOriginalHint: 'Originalantwort des Modells anzeigen', translating: 'Wird übersetzt…', failed: 'Übersetzung fehlgeschlagen, zum Wiederholen klicken', viewOriginal: 'Original anzeigen', viewSent: 'Gesendeten Text anzeigen', viewOriginalHint: 'Deinen eingegebenen Text anzeigen', viewSentHint: 'An das Modell gesendeten Text anzeigen', inputFailed: '⚠ Übersetzung fehlgeschlagen: Das Modell hat deinen Originaltext erhalten' },
      ru: { showTranslation: 'Показать перевод', showOriginal: 'Показать оригинал', showTranslationHint: 'Заменить этот ответ переводом DeepSeek', showOriginalHint: 'Показать исходный ответ модели', translating: 'Перевод…', failed: 'Ошибка перевода, нажмите, чтобы повторить', viewOriginal: 'Показать оригинал', viewSent: 'Показать отправленный текст', viewOriginalHint: 'Показать введённый вами текст', viewSentHint: 'Показать текст, отправленный модели', inputFailed: '⚠ Ошибка перевода: модель получила ваш исходный текст' },
      pt: { showTranslation: 'Ver tradução', showOriginal: 'Ver original', showTranslationHint: 'Substituir esta resposta pela tradução do DeepSeek', showOriginalHint: 'Mostrar a resposta original do modelo', translating: 'Traduzindo…', failed: 'Falha na tradução, clique para tentar novamente', viewOriginal: 'Ver original', viewSent: 'Ver texto enviado', viewOriginalHint: 'Mostrar o texto que você digitou', viewSentHint: 'Mostrar o texto enviado ao modelo', inputFailed: '⚠ Falha na tradução: o modelo recebeu seu texto original' },
    };
    const settingsLabels = Object.fromEntries(Object.entries(en).filter(([key]) => key.startsWith('settings.')));

    // ---- Settings shared with the Host ------------------------------------------------
    // Mirrors rules.js for display decisions only; the Host validates and decides.
    const api = (path) => new URL(`api/language-bridge/${path}`, document.baseURI);
    const postJson = (path, value) => fetch(api(path), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(value),
    });
    let settings;
    let compiled = [];
    function adoptSettings(value) {
      settings = value;
      compiled = value.rules.map((rule) => ({ pattern: new RegExp(rule.match, 'i'), language: rule.language }));
      notify();
    }
    // Another tab or a restart can change settings; the Host stays authoritative.
    const refreshSettings = () => fetch(api('settings'), { credentials: 'same-origin' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .then(adoptSettings)
      .catch(() => {});
    const sameLanguage = (a, b) => {
      try {
        const left = new Intl.Locale(a).maximize();
        const right = new Intl.Locale(b).maximize();
        return left.language === right.language && left.script === right.script;
      } catch {
        return false;
      }
    };
    const canonicalLanguage = (tag) => {
      try {
        const canonical = Intl.getCanonicalLocales(tag.trim())[0];
        return /^[a-z]{2,3}(-|$)/.test(canonical) ? canonical : undefined;
      } catch {
        return undefined;
      }
    };
    const languageName = (tag, locale) => {
      try {
        return new Intl.DisplayNames([locale, 'en'], { type: 'language' }).of(tag) ?? tag;
      } catch {
        return tag;
      }
    };
    const bridgedByRules = (model) => {
      const rule = compiled.find(({ pattern }) => pattern.test(model));
      if (rule === undefined) return false;
      const user = settings.resolvedUserLanguage;
      return user === null || !sameLanguage(user, rule.language);
    };

    // ---- Shared page-lifetime state ---------------------------------------------------
    // blocks: `${language}\0${sessionId}\0${text}` -> { status: 'pending'|'ready'|'skipped'|'failed', text? }
    // views:  `${sessionId}:${turn}` -> 'translated' | 'original' (absent = 'translated', the default view)
    const blocks = new Map();
    const views = new Map();
    const listeners = new Set();
    let version = 0;
    const notify = () => {
      version += 1;
      for (const listener of listeners) listener();
    };
    const subscribe = (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    const useVersion = () => React.useSyncExternalStore(subscribe, () => version);

    // Keyed by language so changing it in settings asks again instead of showing the old one.
    const blockKey = (sessionId, text) => `${settings?.resolvedUserLanguage ?? ''}\u0000${sessionId}\u0000${text}`;
    const viewOf = (sessionId, turn) => views.get(`${sessionId}:${turn}`) ?? 'translated';
    function setView(sessionId, turn, view) {
      views.set(`${sessionId}:${turn}`, view);
      notify();
    }

    /** Start (once) the translation of one Assistant text block into the user's language. */
    function ensure(sessionId, text, models) {
      const key = blockKey(sessionId, text);
      const current = blocks.get(key);
      if (current !== undefined && current.status !== 'failed') return;
      blocks.set(key, { status: 'pending' });
      postJson('translate', { sessionId, text, models }).then(async (response) => {
        const value = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(value.error || `HTTP ${response.status}`);
        blocks.set(key, typeof value.text === 'string' ? { status: 'ready', text: value.text } : { status: 'skipped' });
      }).catch(() => {
        blocks.set(key, { status: 'failed' });
      }).finally(notify);
    }
    function retryFailed(sessionId, texts, models) {
      for (const text of texts) {
        if (blocks.get(blockKey(sessionId, text))?.status === 'failed') ensure(sessionId, text, models);
      }
      notify();
    }

    const isText = (block) => block.kind === 'text' && typeof block.text === 'string' && block.text.trim() !== '';
    const modelsOf = (tail) => {
      const routes = tail && tail.tokenUsage && tail.tokenUsage.routes;
      return Array.isArray(routes) ? routes.map((route) => route.model) : null;
    };
    // Unknown attribution lets the Host decide from the Session's model.
    const maybeBridged = (models) => settings !== undefined && (models === null || models.some(bridgedByRules));

    // ---- Assistant reply: the shipped renderer with translated text in place ---------------
    function createAssistantNodeView(ctx) {
      function shippedRenderer(self) {
        let best;
        for (const entry of ctx.slots.entries(NODE_SLOT)) {
          if (entry.options.key !== 'assistant-step' || entry.component === self) continue;
          if (best === undefined || (entry.options.priority ?? 0) < (best.options.priority ?? 0)) best = entry;
        }
        return best;
      }
      function BridgeAssistantNodeView(props) {
        const { node, sessionId, useTurnData } = props;
        const data = node.data;
        const turn = node.location && (node.location.kind === 'turn' || node.location.kind === 'step') ? node.location.turn : undefined;
        const turnNo = turn && turn.turn;
        const closed = turn !== undefined && turn.status === 'closed' && data.status === 'settled';
        const tail = typeof useTurnData === 'function' ? useTurnData('turn-tail') : undefined;
        const models = modelsOf(tail);
        const active = closed && typeof sessionId === 'string' && maybeBridged(models);
        const tick = useVersion();
        const view = active ? viewOf(sessionId, turnNo) : 'original';
        const language = settings?.resolvedUserLanguage;
        const modelsKey = JSON.stringify(models);

        React.useEffect(() => {
          if (!active || view !== 'translated') return;
          for (const block of data.blocks) if (isText(block)) ensure(sessionId, block.text, models);
        }, [active, view, sessionId, data.blocks, modelsKey, language]);

        const shown = React.useMemo(() => {
          if (view !== 'translated') return node;
          let changed = false;
          const replaced = data.blocks.map((block) => {
            if (!isText(block)) return block;
            const cached = blocks.get(blockKey(sessionId, block.text));
            if (cached === undefined || cached.status !== 'ready') return block;
            changed = true;
            return { ...block, text: cached.text };
          });
          return changed ? { ...node, data: { ...data, blocks: replaced } } : node;
        }, [node, view, sessionId, tick]);

        const shipped = shippedRenderer(BridgeAssistantNodeView);
        if (shipped === undefined) return null;
        return h(shipped.component, { ...props, node: shown });
      }
      return { component: BridgeAssistantNodeView, shippedRenderer };
    }

    // ---- Toggle in the reply's action row (next to Copy) ----------------------------------
    /** Stable string selector: the Turn closed by one assistant message, its texts and models. */
    function turnOfMessage(snapshot, messageId) {
      const order = snapshot.timeline.turnOrder;
      for (let index = order.length - 1; index >= 0; index--) {
        const turnNo = order[index];
        const keys = snapshot.locations.getTurn(turnNo);
        let tail;
        const texts = [];
        for (const key of keys) {
          const node = snapshot.nodes.get(key);
          if (node === undefined) continue;
          if (node.kind === 'turn-tail') tail = node.data;
          else if (node.kind === 'assistant-step') for (const block of node.data.blocks) if (isText(block)) texts.push(block.text);
        }
        const finalNode = tail && tail.closing && tail.closing.finalNode;
        if (finalNode && finalNode.messageId === messageId) return JSON.stringify({ turn: turnNo, texts, models: modelsOf(tail) });
      }
      return 'null';
    }

    const CHAT_CLASS = {
      userRow: 'AkCqbG_userRow',
      actions: 'ZITbJG_actions',
      action: 'ZITbJG_action',
      timeStart: 'ZITbJG_timeStart',
    };
    const textButton = { width: 'auto', padding: '0 8px', fontSize: 12, whiteSpace: 'nowrap' };
    const WARNING_COLOR = '#d97706';

    function ReplyLanguageToggle(props) {
      const { messageId, sessionId, useChat, t } = props;
      const source = useChat((snapshot) => turnOfMessage(snapshot, messageId));
      const info = React.useMemo(() => JSON.parse(source), [source]);
      useVersion();
      if (info === null || typeof sessionId !== 'string' || info.texts.length === 0 || !maybeBridged(info.models)) return null;
      const states = info.texts.map((text) => blocks.get(blockKey(sessionId, text))?.status);
      // Every block skipped (already translated, or the Host says this model is not bridged): nothing to switch.
      if (states.every((status) => status === 'skipped')) return null;
      const view = viewOf(sessionId, info.turn);
      const pending = view === 'translated' && states.some((status) => status === 'pending' || status === undefined);
      const failed = view === 'translated' && !pending && states.some((status) => status === 'failed');
      let label = view === 'translated' ? t('showOriginal') : t('showTranslation');
      if (pending) label = t('translating');
      if (failed) label = t('failed');
      return h('button', {
        type: 'button',
        className: CHAT_CLASS.action,
        style: { ...textButton, opacity: pending ? 0.6 : undefined, color: failed ? WARNING_COLOR : undefined },
        disabled: pending,
        title: view === 'translated' ? t('showOriginalHint') : t('showTranslationHint'),
        'aria-pressed': view === 'translated',
        'data-language-bridge-reply': failed ? 'failed' : pending ? 'pending' : view,
        onClick: () => {
          if (failed) retryFailed(sessionId, info.texts, info.models);
          else setView(sessionId, info.turn, view === 'translated' ? 'original' : 'translated');
        },
      }, label);
    }

    // ---- User bubble with an original/sent-text toggle -----------------------------
    // Replaces Chat's `user` and `steering` renderers. The bubble body still comes from
    // the shipped `conversation.chat.user.content` Factory; class names below are the
    // shipped ui-chat CSS modules, so a renamed class only degrades spacing.
    function contentParts(content) {
      const texts = [];
      const attachments = [];
      const rest = [];
      for (const block of content) {
        if (block.type === 'text' && typeof block.text === 'string') texts.push(block.text);
        else if (block.type === 'image' && block.attachment !== undefined) attachments.push({ type: 'image', image: { attachment: block.attachment } });
        else if (block.type === 'file' && block.attachment !== undefined) attachments.push({ type: 'file', file: block.attachment });
        else rest.push(block);
      }
      return { text: texts.join(''), attachments, rest };
    }

    // Sessions from the Chinese-only bridge stored their originals under `claudeZhBridge`.
    const bridgeRecord = (source) => source && (source.languageBridge || source.claudeZhBridge);
    const bridgeWarnings = (source) => {
      const warnings = bridgeRecord(source)?.warnings;
      return Array.isArray(warnings) ? warnings : [];
    };

    function originalContent(content, source) {
      const record = bridgeRecord(source);
      if (!record || !Array.isArray(record.originals) || record.originals.length === 0) return undefined;
      const replaced = content.slice();
      for (const { index, text } of record.originals) {
        const block = replaced[index];
        if (block && block.type === 'text' && typeof text === 'string') replaced[index] = { ...block, text };
      }
      return replaced;
    }

    const pad2 = (value) => String(value).padStart(2, '0');
    function formatClock(time, t) {
      const d = new Date(time);
      const n = new Date();
      const clock = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      if (d.toDateString() === n.toDateString()) return clock;
      const params = { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
      return `${t(d.getFullYear() === n.getFullYear() ? 'clock.md' : 'clock.ymd', params)} ${clock}`;
    }

    const svg = (path) => h('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, path);
    const copyIcon = () => svg([h('rect', { key: 'a', x: 5.5, y: 5.5, width: 8, height: 8, rx: 1.6 }), h('path', { key: 'b', d: 'M10.5 5.5V3.6c0-.9-.7-1.6-1.6-1.6H3.6C2.7 2 2 2.7 2 3.6v5.3c0 .9.7 1.6 1.6 1.6h1.9' })]);
    const checkIcon = () => svg(h('path', { d: 'M3 8.5 6.5 12 13 4.5' }));

    function createUserNodeView(bridgeT) {
      return function BridgeUserNodeView(props) {
        const { node, renderFactorySlot, loadImage, t } = props;
        const data = node.data;
        const original = React.useMemo(() => originalContent(data.content, data.source), [data.content, data.source]);
        const [showOriginal, setShowOriginal] = React.useState(true);
        const [copied, setCopied] = React.useState(false);
        const content = original !== undefined && showOriginal ? original : data.content;
        const prepared = React.useMemo(() => {
          const parts = contentParts(content);
          return {
            text: parts.text,
            attachments: parts.attachments,
            extraBlocks: parts.rest,
            ...(data.referenceLabels === undefined ? {} : { referenceLabels: data.referenceLabels }),
          };
        }, [content, data.referenceLabels]);
        const facts = React.useMemo(() => ({
          ...(data.referenceLabels === undefined ? {} : { sessionLabels: data.referenceLabels }),
          ...(data.skillNames === undefined ? {} : { skillNames: data.skillNames }),
        }), [data.referenceLabels, data.skillNames]);
        React.useEffect(() => {
          if (!copied) return undefined;
          const timer = setTimeout(() => setCopied(false), 1000);
          return () => clearTimeout(timer);
        }, [copied]);
        const onCopy = () => {
          if (navigator.clipboard) navigator.clipboard.writeText(prepared.text).then(() => setCopied(true), () => {});
        };
        const toggleLabel = bridgeT(showOriginal ? 'viewSent' : 'viewOriginal');
        const warned = bridgeWarnings(data.source).length > 0;
        return h('div', { className: CHAT_CLASS.userRow, 'data-language-bridge-original': original === undefined ? undefined : String(showOriginal) },
          renderFactorySlot('conversation.chat.user.content', { content: prepared, loadImage, facts, interactive: true }),
          warned && h('div', {
            role: 'status',
            'data-language-bridge-warning': 'input',
            style: { fontSize: 12, color: WARNING_COLOR, textAlign: 'right', marginTop: 4 },
          }, bridgeT('inputFailed')),
          h('div', { className: CHAT_CLASS.actions, 'data-clock': 'start' },
            data.time === undefined ? null : h('span', { className: CHAT_CLASS.timeStart }, formatClock(data.time, t)),
            original !== undefined && h('button', {
              type: 'button',
              className: CHAT_CLASS.action,
              style: textButton,
              title: bridgeT(showOriginal ? 'viewSentHint' : 'viewOriginalHint'),
              'aria-pressed': showOriginal,
              onClick: () => setShowOriginal((value) => !value),
            }, toggleLabel),
            h('button', {
              type: 'button',
              className: CHAT_CLASS.action,
              title: copied ? t('copied') : t('copy'),
              'aria-label': copied ? t('copied') : t('copy'),
              onClick: onCopy,
            }, copied ? checkIcon() : copyIcon())));
      };
    }

    // ---- Settings on the plugin's own page ------------------------------------------
    const fieldStyle = { width: '100%', boxSizing: 'border-box', padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(128, 128, 128, 0.45)', background: 'transparent', color: 'inherit', font: 'inherit', fontSize: 13 };
    const hintStyle = { fontSize: 12, opacity: 0.7, margin: '4px 0 0' };
    const errorStyle = { fontSize: 12, color: WARNING_COLOR, margin: '4px 0 0' };
    const buttonStyle = { padding: '2px 10px', borderRadius: 6, border: '1px solid rgba(128, 128, 128, 0.45)', background: 'transparent', color: 'inherit', font: 'inherit', fontSize: 12, cursor: 'pointer' };

    function draftErrors(draft) {
      const rows = draft.rules.map((rule) => {
        const errors = {};
        if (rule.match.trim() === '') errors.match = 'settings.emptyMatch';
        else {
          try {
            new RegExp(rule.match, 'i');
          } catch {
            errors.match = 'settings.invalidRegex';
          }
        }
        if (canonicalLanguage(rule.language) === undefined) errors.language = 'settings.invalidLanguage';
        return errors;
      });
      const user = draft.userLanguage.trim();
      const userError = user.toLowerCase() === 'auto' || canonicalLanguage(user) !== undefined ? undefined : 'settings.invalidLanguage';
      return { rows, userError, any: userError !== undefined || rows.some((row) => Object.keys(row).length > 0) };
    }
    const nextRowId = (() => {
      let id = 0;
      return () => ++id;
    })();
    const draftOf = (value) => ({
      userLanguage: value.userLanguage,
      rules: value.rules.map((rule) => ({ ...rule, id: nextRowId() })),
    });

    function testResult(draft, model, t, locale) {
      const rows = draft.rules;
      for (let index = 0; index < rows.length; index++) {
        let pattern;
        try {
          pattern = new RegExp(rows[index].match, 'i');
        } catch {
          continue;
        }
        if (!pattern.test(model)) continue;
        const user = draft.userLanguage.trim().toLowerCase() === 'auto' ? settings?.resolvedUserLanguage : draft.userLanguage;
        if (user && sameLanguage(user, rows[index].language)) return t('settings.testSame', { n: index + 1 });
        return t('settings.testRule', { n: index + 1, name: languageName(rows[index].language, locale) });
      }
      return t('settings.testNone');
    }

    function createSettingsView(ctx) {
      const useLocale = () => React.useSyncExternalStore((listener) => ctx.locale.subscribe(listener), () => ctx.locale.getSnapshot().active);
      return function BridgeSettings(props) {
        const t = ctx.locale.bind(NS);
        const locale = useLocale();
        useVersion();
        React.useEffect(() => {
          if (props.view !== 'summary') refreshSettings();
        }, [props.view]);
        if (settings === undefined) return props.view === 'summary' ? null : h('p', { style: hintStyle }, t('settings.loadFailed'));
        const shownLanguage = settings.resolvedUserLanguage ? languageName(settings.resolvedUserLanguage, locale) : settings.userLanguage;
        if (props.view === 'summary') return h('span', null, t('settings.summary', { n: settings.rules.length, name: shownLanguage }));
        return h(SettingsForm, { t, locale });
      };
    }

    function SettingsForm({ t, locale }) {
      const [draft, setDraft] = React.useState(() => draftOf(settings));
      const [status, setStatus] = React.useState(null);
      const [saving, setSaving] = React.useState(false);
      const [probe, setProbe] = React.useState('');
      const errors = draftErrors(draft);
      const accepted = JSON.stringify({ userLanguage: settings.userLanguage, rules: settings.rules });
      const base = React.useRef(accepted);
      React.useEffect(() => {
        if (base.current === accepted) return;
        const untouched = base.current === JSON.stringify({ userLanguage: draft.userLanguage, rules: draft.rules.map(({ match, language }) => ({ match, language })) });
        base.current = accepted;
        if (untouched) setDraft(draftOf(settings));
      }, [accepted]);
      const clean = accepted
        === JSON.stringify({ userLanguage: draft.userLanguage, rules: draft.rules.map(({ match, language }) => ({ match, language })) });
      const edit = (rules) => {
        setStatus(null);
        setDraft({ ...draft, rules });
      };
      const patchRow = (index, patch) => edit(draft.rules.map((rule, at) => (at === index ? { ...rule, ...patch } : rule)));
      const moveRow = (index, by) => {
        const rules = draft.rules.slice();
        const [row] = rules.splice(index, 1);
        rules.splice(index + by, 0, row);
        edit(rules);
      };
      const save = () => {
        setSaving(true);
        setStatus(null);
        const body = { userLanguage: draft.userLanguage.trim(), rules: draft.rules.map(({ match, language }) => ({ match: match.trim(), language: language.trim() })) };
        postJson('settings', body).then(async (response) => {
          const value = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(value.error || (value.errors ? JSON.stringify(value.errors) : `HTTP ${response.status}`));
          adoptSettings(value);
          setDraft(draftOf(value));
          setStatus({ ok: true, text: t('settings.saved') });
        }).catch((error) => {
          setStatus({ ok: false, text: t('settings.saveFailed', { error: error.message }) });
        }).finally(() => setSaving(false));
      };
      const label = (text) => h('div', { style: { fontSize: 12, opacity: 0.7, marginBottom: 2 } }, text);
      const userLanguage = draft.userLanguage.trim();
      const resolved = userLanguage.toLowerCase() === 'auto' ? settings.resolvedUserLanguage : canonicalLanguage(userLanguage);
      return h('div', { 'data-language-bridge-settings': '', style: { display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 } },
        h('p', { style: { margin: 0, opacity: 0.8 } }, t('settings.intro')),
        h('section', null,
          h('h4', { style: { margin: '0 0 6px', fontSize: 13 } }, t('settings.userLanguage')),
          h('input', {
            'data-language-bridge-field': 'userLanguage',
            'aria-label': t('settings.userLanguage'),
            'aria-invalid': errors.userError !== undefined || undefined,
            style: { ...fieldStyle, maxWidth: 200 },
            value: draft.userLanguage,
            onChange: (event) => {
              setStatus(null);
              setDraft({ ...draft, userLanguage: event.target.value });
            },
          }),
          errors.userError
            ? h('p', { style: errorStyle }, t(errors.userError))
            : h('p', { style: hintStyle }, `${t('settings.userLanguageHint')}${resolved ? ` · ${t('settings.resolved', { name: languageName(resolved, locale) })}` : ''}`)),
        h('section', null,
          h('h4', { style: { margin: '0 0 6px', fontSize: 13 } }, t('settings.rules')),
          draft.rules.length === 0 && h('p', { style: hintStyle }, t('settings.empty')),
          draft.rules.map((rule, index) => h('div', {
            key: rule.id,
            'data-language-bridge-rule': index,
            style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px auto', gap: 8, alignItems: 'start', marginBottom: 8 },
          },
          h('div', null,
            index === 0 && label(t('settings.match')),
            h('input', {
              'aria-label': t('settings.match'),
              'aria-invalid': errors.rows[index].match !== undefined || undefined,
              'data-language-bridge-field': 'match',
              style: { ...fieldStyle, fontFamily: 'ui-monospace, monospace' },
              value: rule.match,
              onChange: (event) => patchRow(index, { match: event.target.value }),
            }),
            errors.rows[index].match && h('p', { style: errorStyle }, t(errors.rows[index].match))),
          h('div', null,
            index === 0 && label(t('settings.language')),
            h('input', {
              'aria-label': t('settings.language'),
              'aria-invalid': errors.rows[index].language !== undefined || undefined,
              'data-language-bridge-field': 'language',
              style: fieldStyle,
              value: rule.language,
              onChange: (event) => patchRow(index, { language: event.target.value }),
            }),
            errors.rows[index].language && h('p', { style: errorStyle }, t(errors.rows[index].language))),
          h('div', { style: { display: 'flex', gap: 4, marginTop: index === 0 ? 18 : 0 } },
            h('button', { type: 'button', style: buttonStyle, disabled: index === 0, title: t('settings.up'), 'aria-label': t('settings.up'), onClick: () => moveRow(index, -1) }, '↑'),
            h('button', { type: 'button', style: buttonStyle, disabled: index === draft.rules.length - 1, title: t('settings.down'), 'aria-label': t('settings.down'), onClick: () => moveRow(index, 1) }, '↓'),
            h('button', { type: 'button', style: buttonStyle, title: t('settings.remove'), 'aria-label': t('settings.remove'), onClick: () => edit(draft.rules.filter((_, at) => at !== index)) }, '×')))),
          h('button', {
            type: 'button',
            style: buttonStyle,
            'data-language-bridge-action': 'add',
            onClick: () => edit([...draft.rules, { id: nextRowId(), match: '', language: 'en' }]),
          }, t('settings.add'))),
        h('section', null,
          h('h4', { style: { margin: '0 0 6px', fontSize: 13 } }, t('settings.test')),
          h('input', {
            'aria-label': t('settings.test'),
            'data-language-bridge-field': 'probe',
            style: { ...fieldStyle, maxWidth: 360, fontFamily: 'ui-monospace, monospace' },
            placeholder: 'claude/claude-opus-5-5',
            value: probe,
            onChange: (event) => setProbe(event.target.value),
          }),
          probe.trim() !== '' && h('p', { style: hintStyle, 'data-language-bridge-probe': '' }, testResult(draft, probe.trim(), t, locale))),
        h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
          h('button', { type: 'button', style: buttonStyle, 'data-language-bridge-action': 'save', disabled: clean || errors.any || saving, onClick: save }, t('settings.save')),
          h('button', {
            type: 'button',
            style: buttonStyle,
            disabled: clean || saving,
            onClick: () => {
              setStatus(null);
              setDraft(draftOf(settings));
            },
          }, t('settings.discard')),
          status && h('span', { role: 'status', style: status.ok ? hintStyle : errorStyle }, status.text)));
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, 'zh', zh));
        ctx.effect(() => ctx.locale.register(NS, 'en', en));
        for (const [locale, labels] of Object.entries(bubbleLabels)) {
          ctx.effect(() => ctx.locale.register(NS, locale, { ...settingsLabels, ...labels }));
        }
        // The Host follows the UI locale for `auto`; report it now and whenever it changes.
        let reported;
        const reportLocale = () => {
          const locale = ctx.locale.getSnapshot().active;
          if (locale === reported) return;
          reported = locale;
          postJson('locale', { locale })
            .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
            .then(adoptSettings)
            .catch(() => {
              reported = undefined;
            });
        };
        ctx.effect(() => ctx.locale.subscribe(reportLocale));
        refreshSettings().finally(reportLocale);
        const onVisible = () => {
          if (document.visibilityState === 'visible') refreshSettings();
        };
        document.addEventListener('visibilitychange', onVisible);
        ctx.effect(() => () => document.removeEventListener('visibilitychange', onVisible));
        const SettingsView = createSettingsView(ctx);
        ctx.slots.inject(CONFIG_SLOT, () => ctx.slots.register({
          name: CONFIG_SLOT,
          key: BUNDLE_NAME,
          locale: NS,
        }, SettingsView));
        const UserNodeView = createUserNodeView(ctx.locale.bind(NS));
        for (const key of ['user', 'steering']) {
          ctx.slots.inject(NODE_SLOT, () => ctx.slots.register({
            name: NODE_SLOT,
            key,
            locale: 'chat',
            // Lower wins; shipped renderers use 0.
            priority: -10,
          }, UserNodeView));
        }
        // Wrap (not reimplement) the shipped reply renderer: same options, same props,
        // only the text blocks of `node` are swapped for their translations.
        const assistant = createAssistantNodeView(ctx);
        // The shipped entry owns the child slot declarations. Declaring them again makes
        // the shipped registration throw ("already declared") and blanks every reply, and
        // releasing them on unload would undeclare the shipped ones. This proxy has no own
        // keys (register/release see nothing) but answers `children[key]`, the only check
        // `renderSlot` makes, with the shipped entry's live declaration.
        const borrowedChildren = new Proxy({}, {
          get(_target, key) {
            const shipped = assistant.shippedRenderer(assistant.component);
            return shipped && shipped.children ? shipped.children[key] : undefined;
          },
        });
        ctx.slots.inject(NODE_SLOT, () => {
          return ctx.slots.register({
            name: NODE_SLOT,
            key: 'assistant-step',
            locale: 'chat',
            priority: -10,
            children: borrowedChildren,
            inject: (...args) => {
              const current = assistant.shippedRenderer(assistant.component);
              return current && typeof current.inject === 'function' ? current.inject(...args) : {};
            },
          }, assistant.component);
        });
        ctx.slots.inject(ACTION_SLOT, () => ctx.slots.register({
          name: ACTION_SLOT,
          id: 'language-bridge',
          order: 5,
          locale: NS,
        }, ReplyLanguageToggle));
      },
    };
  },
});
