# dsh-language-bridge

**中文** | [English](README.en.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Русский](README.ru.md) | [Português](README.pt.md)

DeepSeek Harness 本地插件：**给每个模型指定一种工作语言**。你用自己的语言输入，DeepSeek Flash 把它翻译成模型的
工作语言再发送；模型的回答再翻译回你的语言显示在原位。任何语言、任何模型都可以配置。

例如：你用西班牙语，Claude 和 Gemini 设为英语，某个中文模型设为 `zh-CN`。

<p align="center">
  <img src="docs/demo.gif" width="932" alt="用中文向 Claude 提问：模型收到英文、用英文回答，界面显示中文译文；「查看原文」「查看发送内容」可以切换">
</p>

上图中，你的语言为 `auto`（跟随中文界面），Claude 的工作语言为英语。回答结束后自动换成中文；「查看原文」显示模型的英文
回答，「查看发送内容」显示实际发给模型的英文。

## 功能

- **模型 → 语言规则**：有序列表，模型 id 用正则匹配（不区分大小写），第一条命中的生效；没有命中的模型保持原样。
- **你的语言**：任意 BCP 47 代码（`es`、`ja`、`zh-CN`…），或 `auto` 跟随界面语言。
- **输入翻译**：发送前把你写的文字翻译成工作语言。代码块、行内代码、链接、`@路径` 原样保留。
- **回答翻译**：每轮结束后把回答换成译文显示，「查看原文 / 查看译文」原位切换。思考内容不翻译。
- **保持工作语言**：对桥接的模型在系统提示里加一条规则，要求它即使收到其他语言的工具输出也用工作语言思考和回答。
- **失败可见**：翻译失败时照常发送原文，不丢这一轮，并在消息下方显示警告。
- **同语言零成本**：你的语言和模型的工作语言相同（如 `en-GB` 与 `en`）时，不翻译、不加系统提示、不产生费用。

<p align="center">
  <img src="docs/translation-failed.png" width="740" alt="翻译失败时，消息下方显示「翻译失败，模型收到的是未翻译的原文」">
</p>

## 安装

```sh
DSH="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"
"$DSH" plugin --profile desktop add link:$HOME/.dsh/local-plugins/dsh-language-bridge
```

然后重启 DeepSeek Harness 并刷新页面。

**从 `claude-zh-bridge` 迁移**：两个插件不要同时启用，否则会翻译两次。先移除旧插件再安装：

```sh
"$DSH" plugin --profile desktop remove @local/claude-zh-bridge
```

旧会话不受影响：旧插件存的原文（`source.claudeZhBridge`）照常显示，已付费的译文直接复用（见下文「兼容旧会话」）。

**移除**：在 DSH「插件」页关闭或卸载，或运行 `"$DSH" plugin --profile desktop remove dsh-language-bridge`。

## 设置

打开「插件 → 语言桥接」，保存后从下一步开始生效，不用重启。

<p align="center">
  <img src="docs/settings.gif" width="833" alt="添加规则 qwen → zh-CN：无效正则即时报错，测试模型 id 显示命中哪条规则，保存后生效">
</p>

- **你的语言**：填 `auto` 时，浏览器把界面语言上报给 Host 并保存下来；界面语言 `zh` 按 `zh-CN` 处理。
- **模型规则**：可增删、上下移动。正则和语言代码在表单里即时校验，有错误时不能保存。
- **测试模型 id**：输入一个模型 id，查看会命中哪条规则、是否需要翻译。

默认规则：

| 模型 id 正则 | 工作语言 |
| --- | --- |
| `claude` | `en` |
| `gemini` | `en` |
| `(^\|[^a-z0-9])(chat)?gpt($\|[^a-z])` | `en` |

GPT 规则带边界，匹配 `gpt-5`、`openai/gpt-4o`、`chatgpt-4o`、`gpt-oss`，不会误中 `egpt-1`、`mygpt` 这类 id。

设置保存在 `$DSH_HOME/storages/language-bridge.json`，优先级高于 `cordis.patch.yml`。也可以在
`cordis.patch.yml` 里用 `rules`、`userLanguage` 设初始值，用 `provider`（`auto` / `deepseek-official` /
`deepseek-account`）、`translateInput`、`translateOutput` 调整行为。

## 工作原理

```text
你的输入 ──► 语言检测 ──► DeepSeek Flash 翻译 ──► 模型（工作语言 + 系统提示规则）
                                                        │
你看到的回答 ◄── DeepSeek Flash 翻译 ◄── 语言检测 ◄──────┘
```

| 文件 | 位置 | 作用 |
| --- | --- | --- |
| `index.js` | Host | `agent/pre-step` 翻译输入；系统提示段落；`/api/language-bridge/*` 接口（回答翻译、设置读写、上报界面语言，仅限 owner） |
| `rules.js` | 共用 | 规则匹配、语言代码校验、设置合并、系统提示文本（纯函数） |
| `detect.js` | 共用 | 判断文本是否还需要翻译（纯函数） |
| `protect.js` | 共用 | 用占位符保护代码和链接，分块翻译 |
| `client.js` | 浏览器 | 回答原位替换和切换、用户消息的「查看发送内容 / 查看原文」和失败警告、设置页 |
| `cordis.patch.yml` | 补丁 | 插入 translator 服务行和本插件行 |

- 翻译走 dsh 自带的 `@deepseek-ai/dsh-experimental-translator`，优先 `deepseek-official`（API key），其次
  `deepseek-account`。付费结果存在会话里，重新打开不重复收费。
- 原文存在消息的 `source.languageBridge`，模型看不到，只用于界面显示。
- 只翻译你写的消息；系统注入的上下文、子代理消息不翻译。
- 翻译模型丢掉占位符时，改为只翻译占位符之间的文字，保证代码和链接不丢。
- 设置页用的是插件详情页的 `plugins.bundle.config` 槽位，没有用 Harness 自带的配置表单：后者需要 `schemastery`，
  而 `link:` 安装的本地插件解析不到这个包。

## 语言检测

`needsTranslation(text, { target, source })` 判断一段文本是否还需要翻译成 `target`，依次看：

1. **去掉非正文**：受保护片段，以及像代码的词（`parseConfig`、`foo_bar`、`src/app.ts`、`v2`、`--flag`、缩写）。
   没有剩余字母就不翻译。
2. **比较文字**：用 `Intl.Locale` 推算目标语言用的文字，不需要语言表。其他非拉丁文字占比够高就翻译。目标不是拉丁
   文字时，拉丁字母要占到 60% 以上才算外文，因为中日韩俄文里夹英文名词很常见。
3. **比较虚词**：同一种文字内的语言（如西班牙语和英语）靠内置的 17 种语言虚词表区分。其他语言明显占优就翻译，目标
   语言明显占优就不翻译。
4. **仍无法判断**：只有你的语言和目标用不同文字时才不翻译（日语用户输入 `run tests`），其他情况都翻译。

取舍是**宁可多翻译，不漏翻译**。多翻译一次只是一小笔 DeepSeek Flash 费用，而且译文和原文相同时不会替换，也不显示
切换按钮；漏翻译则是模型收到错误语言的文本，而且没人发现。代价：

- 西班牙语用户输入 `run tests` 这类没有虚词的短句，会多一次调用；
- 没有虚词表的同文字语言对（如印尼语用户、斯瓦希里语模型），每段都会调用一次；
- 只有汉字时分不清中文、日文以及简繁体，这时按需要翻译处理。

## 兼容旧会话

旧插件 `claude-zh-bridge` 把原文存在 `source.claudeZhBridge`，这个字段继续可读。翻译缓存的键包含文本片段、语言和
路由，本插件保持了相同的占位符和分块方式（有单元测试保证），所以你的语言解析为 `zh-CN` 时，旧会话的译文直接复用。

## 开发

```sh
node --test test/*.test.js
```

测试覆盖规则顺序和匹配、语言检测（拉丁↔拉丁、中日韩/西里尔/阿拉伯/天城文双向、标识符混排）、受保护片段、占位符
回退，以及旧字段的读取和失败警告的显示。

修改 `index.js` 或 `cordis.patch.yml` 后需要重启 DeepSeek Harness；修改 `client.js` 后若界面没变化，重新安装并
刷新页面。

## 已知限制

- **系统提示规则只能提高概率，不能强制。** 测试中见过模型不遵守：翻译失败、Claude 直接收到日文时，它用日文回答；
  会话中途才加规则时，已有西班牙语历史的 Gemini Flash Lite 继续用西班牙语回答。回答已经是你的语言时不会再翻译。
- 能看到的思考内容取决于模型路由，可能只是摘要；看不到时无法确认模型用什么语言思考。
- 只有代码块、行内代码、链接和 `@路径` 受保护。没加反引号的命令和引文也会被翻译，比如 `printf "..."` 里的字符串。
  不想被翻译的内容请放进反引号。英文句子里夹的一段中文也会被翻译。
- 会话日志和模型输入里是译文（插件只能在消息写入前改写）；原文只用于界面显示。
- 回答在一轮结束后才换成译文，生成过程中显示的是模型原文。
- `auto` 在浏览器上报界面语言之前无法判断是否同语言，这期间只靠语言检测。
- 每段未缓存的文本是一次付费 DeepSeek Flash 请求。
- 按钮和警告文字支持中、英、日、西、法、德、俄、葡八种语言；设置页只有中英文，其他语言显示英文。
- 与官方「推理翻译」bundle 同时启用时，两者各挂一份 translator 服务，可能冲突。
- 插件接管了用户消息的渲染，Harness 升级改动 Chat 结构后可能需要调整。
