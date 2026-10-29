# dsh-claude-zh-bridge

DeepSeek Harness 本地插件：使用 Claude 系列模型时，用 DeepSeek Flash 把中文输入翻译成英文再发给
Claude，并在每轮 Claude 回答下方显示中文翻译卡片。

- `index.js`（Host）：
  - `agent/pre-step`：当前模型 id 匹配 `modelPattern`（默认 `claude`）时，把用户输入里的中文翻成英文；
    代码块、行内代码、链接、`@路径` 用占位符保护、原样保留。中文原文存在消息 `source.claudeZhBridge`
    （模型不可见），供界面「查看原文」使用。系统注入的上下文、子代理消息不翻译。
  - 仅限 owner 的 `POST /api/claude-zh-bridge/translate`：浏览器请求一轮回答的中文译文。
  - 翻译走 dsh 自带的 `@deepseek-ai/dsh-experimental-translator`（`deepseek-official` 优先，其次
    `deepseek-account`），付费结果存在会话里，重新打开不重复收费。
- `client.js`（浏览器）：
  - 以 `priority: -10` 包一层 Chat 自带的 `assistant-step` 渲染器（通过 `ctx.slots.entries` 取到原组件，
    原样传入 props/children/inject），只把 text block 换成中文译文，所以 Markdown、代码块、表格等排版
    完全是原生的。每轮结束后默认显示中文；回答操作栏（复制按钮旁）的「查看原文 / 查看中文」原位切换。
    译文按 text block 逐段请求、页面内缓存。
  - 以 `priority: -10` 接管 Chat 的 `user` / `steering` 渲染，消息下方加「查看英文 / 查看原文」切换。
- `cordis.patch.yml`：插入 translator 行和本插件行；可配置 `provider`（`auto` / `deepseek-official` /
  `deepseek-account`）、`modelPattern`、`translateInput`、`translateOutput`。

## 安装

```sh
DSH="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"
"$DSH" plugin --profile desktop add link:$HOME/.dsh/local-plugins/claude-zh-bridge
```

改 Host 代码后重启 DeepSeek Harness 生效；`client.js` 改动可热更新。移除：在 DSH「插件」页关闭或移除，或
`"$DSH" plugin --profile desktop remove @local/claude-zh-bridge`。

## 已知限制

- 会话日志与模型输入里是英文（只能在消息写入前改写）；中文原文只用于界面显示。
- 译文在一轮结束后才替换上去，生成过程中显示英文。
- 改 `client.js` 后若界面没变化，刷新页面（重新安装 bundle 后必须刷新）。
- 每段未缓存文本是一次付费 DeepSeek Flash 请求。
- 与官方「推理翻译」bundle 同时启用时会各挂一份 translator 服务，可能冲突。
- 接管了用户消息渲染，Harness 升级改动 Chat 结构后可能需要调整。
