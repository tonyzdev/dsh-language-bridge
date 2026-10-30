window.__ModuleLoader__.load({
  id: '@local/claude-zh-bridge',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'claudeZhBridge';
    const NODE_SLOT = 'conversation.chat.node';
    const ACTION_SLOT = 'conversation.chat.assistant-actions';

    const zh = {
      showChinese: '查看中文',
      showOriginal: '查看原文',
      showChineseHint: '用 DeepSeek 译文替换这一轮回答',
      showOriginalHint: '显示模型的英文原文',
      translating: '翻译中…',
      failed: '翻译失败，点击重试',
      viewOriginal: '查看原文',
      viewEnglish: '查看英文',
      viewOriginalHint: '显示你输入的中文原文',
      viewEnglishHint: '显示实际发给模型的英文',
    };
    const en = {
      showChinese: 'View Chinese',
      showOriginal: 'View original',
      showChineseHint: 'Replace this reply with the DeepSeek translation',
      showOriginalHint: 'Show the model\'s original English',
      translating: 'Translating…',
      failed: 'Translation failed, click to retry',
      viewOriginal: 'View original',
      viewEnglish: 'View English',
      viewOriginalHint: 'Show the text you typed',
      viewEnglishHint: 'Show the English sent to the model',
    };

    // ---- Shared page-lifetime state ---------------------------------------------------
    // blocks: `${sessionId}\0${text}` -> { status: 'pending'|'ready'|'skipped'|'failed', text? }
    // views:  `${sessionId}:${turn}` -> 'zh' | 'en' (absent = 'zh', the default view)
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

    const blockKey = (sessionId, text) => `${sessionId}\u0000${text}`;
    const viewOf = (sessionId, turn) => views.get(`${sessionId}:${turn}`) ?? 'zh';
    function setView(sessionId, turn, view) {
      views.set(`${sessionId}:${turn}`, view);
      notify();
    }

    /** Start (once) the Chinese translation of one Assistant text block. */
    function ensure(sessionId, text, models) {
      const key = blockKey(sessionId, text);
      const current = blocks.get(key);
      if (current !== undefined && current.status !== 'failed') return;
      blocks.set(key, { status: 'pending' });
      fetch(new URL('api/claude-zh-bridge/translate', document.baseURI), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, text, models }),
      }).then(async (response) => {
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
    const maybeBridged = (models) => models === null || models.some((model) => /claude|gemini/i.test(model));

    // ---- Assistant reply: the shipped renderer with Chinese text in place ------------------
    function createAssistantNodeView(ctx) {
      function shippedRenderer(self) {
        let best;
        for (const entry of ctx.slots.entries(NODE_SLOT)) {
          if (entry.options.key !== 'assistant-step' || entry.component === self) continue;
          if (best === undefined || (entry.options.priority ?? 0) < (best.options.priority ?? 0)) best = entry;
        }
        return best;
      }
      function ClaudeZhAssistantNodeView(props) {
        const { node, sessionId, useTurnData } = props;
        const data = node.data;
        const turn = node.location && (node.location.kind === 'turn' || node.location.kind === 'step') ? node.location.turn : undefined;
        const turnNo = turn && turn.turn;
        const closed = turn !== undefined && turn.status === 'closed' && data.status === 'settled';
        const tail = typeof useTurnData === 'function' ? useTurnData('turn-tail') : undefined;
        const models = modelsOf(tail);
        const active = closed && typeof sessionId === 'string' && maybeBridged(models);
        const tick = useVersion();
        const view = active ? viewOf(sessionId, turnNo) : 'en';
        const modelsKey = JSON.stringify(models);

        React.useEffect(() => {
          if (!active || view !== 'zh') return;
          for (const block of data.blocks) if (isText(block)) ensure(sessionId, block.text, models);
        }, [active, view, sessionId, data.blocks, modelsKey]);

        const shown = React.useMemo(() => {
          if (view !== 'zh') return node;
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

        const shipped = shippedRenderer(ClaudeZhAssistantNodeView);
        if (shipped === undefined) return null;
        return h(shipped.component, { ...props, node: shown });
      }
      return { component: ClaudeZhAssistantNodeView, shippedRenderer };
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

    function ReplyLanguageToggle(props) {
      const { messageId, sessionId, useChat, t } = props;
      const source = useChat((snapshot) => turnOfMessage(snapshot, messageId));
      const info = React.useMemo(() => JSON.parse(source), [source]);
      useVersion();
      if (info === null || typeof sessionId !== 'string' || info.texts.length === 0 || !maybeBridged(info.models)) return null;
      const states = info.texts.map((text) => blocks.get(blockKey(sessionId, text))?.status);
      // Every block skipped (already Chinese, or the Host says this model is not bridged): nothing to switch.
      if (states.every((status) => status === 'skipped')) return null;
      const view = viewOf(sessionId, info.turn);
      const pending = view === 'zh' && states.some((status) => status === 'pending' || status === undefined);
      const failed = view === 'zh' && !pending && states.some((status) => status === 'failed');
      let label = view === 'zh' ? t('showOriginal') : t('showChinese');
      if (pending) label = t('translating');
      if (failed) label = t('failed');
      return h('button', {
        type: 'button',
        className: CHAT_CLASS.action,
        style: { ...textButton, opacity: pending ? 0.6 : undefined },
        disabled: pending,
        title: view === 'zh' ? t('showOriginalHint') : t('showChineseHint'),
        'aria-pressed': view === 'zh',
        'data-claude-zh-reply': failed ? 'failed' : pending ? 'pending' : view,
        onClick: () => {
          if (failed) retryFailed(sessionId, info.texts, info.models);
          else setView(sessionId, info.turn, view === 'zh' ? 'en' : 'zh');
        },
      }, label);
    }

    // ---- User bubble with an original/English toggle -------------------------------
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

    function originalContent(content, source) {
      const record = source && source.claudeZhBridge;
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
      return function ClaudeZhUserNodeView(props) {
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
        const toggleLabel = bridgeT(showOriginal ? 'viewEnglish' : 'viewOriginal');
        return h('div', { className: CHAT_CLASS.userRow, 'data-claude-zh-original': original === undefined ? undefined : String(showOriginal) },
          renderFactorySlot('conversation.chat.user.content', { content: prepared, loadImage, facts, interactive: true }),
          h('div', { className: CHAT_CLASS.actions, 'data-clock': 'start' },
            data.time === undefined ? null : h('span', { className: CHAT_CLASS.timeStart }, formatClock(data.time, t)),
            original !== undefined && h('button', {
              type: 'button',
              className: CHAT_CLASS.action,
              style: textButton,
              title: bridgeT(showOriginal ? 'viewEnglishHint' : 'viewOriginalHint'),
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

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, 'zh', zh));
        ctx.effect(() => ctx.locale.register(NS, 'en', en));
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
          id: 'claude-zh-bridge',
          order: 5,
          locale: NS,
        }, ReplyLanguageToggle));
      },
    };
  },
});
