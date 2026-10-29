window.__ModuleLoader__.load({
  id: '@local/claude-zh-bridge',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'claudeZhBridge';
    const SLOT = 'conversation.chat.turnTail';
    const MARKDOWN_FACTORY = 'conversation.chat.reasoning.content';

    const zh = {
      title: '中文翻译 · DeepSeek',
      translating: '正在翻译…',
      failed: '翻译失败',
      retry: '重试',
      collapse: '收起',
      expand: '展开',
      copy: '复制',
      copied: '已复制',
      codeTitle: '代码',
      wrap: '自动换行',
      unwrap: '取消换行',
      footnotes: '脚注',
      viewOriginal: '查看原文',
      viewEnglish: '查看英文',
      viewOriginalHint: '显示你输入的中文原文',
      viewEnglishHint: '显示实际发给 Claude 的英文',
    };
    const en = {
      title: 'Chinese translation · DeepSeek',
      translating: 'Translating…',
      failed: 'Translation failed',
      retry: 'Retry',
      collapse: 'Collapse',
      expand: 'Expand',
      copy: 'Copy',
      copied: 'Copied',
      codeTitle: 'Code',
      wrap: 'Wrap',
      unwrap: 'Unwrap',
      footnotes: 'Footnotes',
      viewOriginal: 'View original',
      viewEnglish: 'View English',
      viewOriginalHint: 'Show the text you typed',
      viewEnglishHint: 'Show the English sent to Claude',
    };

    // One request per exact Turn text; results survive remounts while the page lives.
    const results = new Map();
    function translate(sessionId, text, models) {
      const key = JSON.stringify([sessionId, text, models]);
      let task = results.get(key);
      if (task === undefined) {
        task = fetch(new URL('api/claude-zh-bridge/translate', document.baseURI), {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId, text, models }),
        }).then(async (response) => {
          const value = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(value.error || `HTTP ${response.status}`);
          return value;
        });
        results.set(key, task);
        task.catch(() => {
          if (results.get(key) === task) results.delete(key);
        });
      }
      return task;
    }

    /** Stable string selector: every Assistant text of one Turn plus its attributed models. */
    function turnSource(snapshot, turnNo) {
      const texts = [];
      let models = null;
      for (const key of snapshot.locations.getTurn(turnNo)) {
        const node = snapshot.nodes.get(key);
        if (node === undefined) continue;
        if (node.kind === 'assistant-step') {
          for (const block of node.data.blocks) {
            if (block.kind === 'text' && block.text.trim() !== '') texts.push(block.text);
          }
        } else if (node.kind === 'turn-tail') {
          const routes = node.data && node.data.tokenUsage && node.data.tokenUsage.routes;
          if (Array.isArray(routes)) models = routes.map((route) => route.model);
        }
      }
      return JSON.stringify({ text: texts.join('\n\n'), models });
    }

    const styles = {
      card: {
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 12,
        background: 'var(--dsw-alias-bg-layer-1)',
        padding: '8px 14px 10px',
        color: 'var(--dsw-alias-label-primary)',
      },
      header: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        lineHeight: '20px',
        color: 'var(--dsw-alias-label-secondary)',
      },
      title: { flex: 1, minWidth: 0 },
      button: {
        border: 'none',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        font: 'inherit',
        padding: '0 6px',
        borderRadius: 6,
        cursor: 'pointer',
      },
      error: { color: 'var(--dsw-alias-state-error-primary)' },
      body: { marginTop: 4 },
      plain: { whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.7 },
    };

    function TurnTranslation(props) {
      const { turn, sessionId, useChat, t, renderFactorySlot } = props;
      const turnNo = typeof turn === 'number' ? turn : turn && turn.turn;
      const open = typeof turn === 'object' && turn !== null && turn.status === 'open';
      const source = useChat((snapshot) => (typeof turnNo === 'number' ? turnSource(snapshot, turnNo) : '{"text":""}'));
      const { text, models } = React.useMemo(() => JSON.parse(source), [source]);
      const [state, setState] = React.useState({ kind: 'idle' });
      const [collapsed, setCollapsed] = React.useState(false);
      const [attempt, setAttempt] = React.useState(0);

      React.useEffect(() => {
        if (open || text.trim() === '' || typeof sessionId !== 'string') {
          setState({ kind: 'idle' });
          return undefined;
        }
        let live = true;
        setState({ kind: 'pending' });
        translate(sessionId, text, models).then(
          (value) => {
            if (!live) return;
            setState(typeof value.text === 'string' ? { kind: 'ready', text: value.text } : { kind: 'skipped' });
          },
          (error) => {
            if (live) setState({ kind: 'failed', message: String((error && error.message) || error) });
          },
        );
        return () => {
          live = false;
        };
      }, [sessionId, text, source, open, attempt]);

      if (state.kind === 'idle' || state.kind === 'skipped') return null;

      const labels = {
        code: {
          copyLabel: t('copy'),
          copiedLabel: t('copied'),
          toolbarLabels: { codeLabel: t('codeTitle'), wrapLabel: t('wrap'), unwrapLabel: t('unwrap') },
        },
        footnotes: t('footnotes'),
      };
      const renderBody = (markdown) => (typeof renderFactorySlot === 'function'
        ? renderFactorySlot(MARKDOWN_FACTORY, { text: markdown, running: false, labels })
        : h('div', { style: styles.plain }, markdown));

      return h('section', {
        style: styles.card,
        'data-claude-zh-bridge': state.kind,
        lang: 'zh-CN',
      },
      h('div', { style: styles.header },
        h('span', { style: styles.title }, t('title')),
        state.kind === 'pending' && h('span', { role: 'status' }, t('translating')),
        state.kind === 'failed' && h('span', { role: 'status', style: styles.error, title: state.message }, t('failed')),
        state.kind === 'failed' && h('button', {
          type: 'button',
          style: styles.button,
          onClick: () => setAttempt((value) => value + 1),
        }, t('retry')),
        state.kind === 'ready' && h('button', {
          type: 'button',
          style: styles.button,
          'aria-expanded': !collapsed,
          onClick: () => setCollapsed((value) => !value),
        }, t(collapsed ? 'expand' : 'collapse'))),
      state.kind === 'ready' && !collapsed && h('div', { style: styles.body }, renderBody(state.text)));
    }

    // ---- User bubble with an original/English toggle -------------------------------
    // Replaces Chat's `user` and `steering` renderers. The bubble body still comes from
    // the shipped `conversation.chat.user.content` Factory; class names below are the
    // shipped ui-chat CSS modules, so a renamed class only degrades spacing.
    const CHAT_CLASS = {
      userRow: 'AkCqbG_userRow',
      actions: 'ZITbJG_actions',
      action: 'ZITbJG_action',
      timeStart: 'ZITbJG_timeStart',
    };

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
              style: { width: 'auto', padding: '0 8px', fontSize: 12, whiteSpace: 'nowrap' },
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
          ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
            name: 'conversation.chat.node',
            key,
            locale: 'chat',
            // Lower wins; shipped renderers use 0.
            priority: -10,
          }, UserNodeView));
        }
        ctx.slots.inject(SLOT, () => ctx.slots.register({
          name: SLOT,
          id: 'claude-zh-bridge',
          order: 1,
          locale: NS,
        }, TurnTranslation));
      },
    };
  },
});
