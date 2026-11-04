# dsh-language-bridge

DeepSeek Harness 本地插件：按模型设置工作语言。用 DeepSeek Flash 把你的输入翻译成该模型的工作语言再发送，把
回答翻译成你的语言显示，并在系统提示里要求模型用工作语言思考和回答。适用于任何语言、任何模型。

- `index.js`（Host）：
  - `agent/pre-step`：当前模型命中规则时，把用户输入翻译成工作语言；原文存在消息 `source.languageBridge`
    （模型不可见），供界面「查看原文」使用。系统注入的上下文、子代理消息不翻译。翻译失败时照常发送原文，并把
    警告写进同一字段，界面显示在这条消息下方。
  - 系统提示段落：要求模型用工作语言思考和回答，包括指令或工具输出是其他语言时。这只能提高概率，不能强制。
  - 仅限 owner 的 `POST /api/language-bridge/translate`：浏览器请求一段回答的译文。
  - 仅限 owner 的 `GET|POST /api/language-bridge/settings`、`POST /api/language-bridge/locale`：设置页读写，
    以及上报 `auto` 要跟随的界面语言。
  - 翻译走 dsh 自带的 `@deepseek-ai/dsh-experimental-translator`（`deepseek-official` 优先，其次
    `deepseek-account`），付费结果存在会话里，重新打开不重复收费。
- `rules.js`：规则匹配、语言代码校验、设置合并、系统提示文本。纯函数。
- `detect.js`：判断一段文本是否还需要翻译。纯函数，见下文「语言检测」。
- `protect.js`：占位符保护（代码块、行内代码、链接、`@路径`）和分块翻译。
- `client.js`（浏览器）：
  - 包一层 Chat 自带的 `assistant-step` 渲染器，只把 text block 换成译文，排版完全是原生的。回答操作栏的
    「查看原文 / 查看译文」原位切换。思考内容不翻译。
  - 接管 Chat 的 `user` / `steering` 渲染，消息下方加「查看发送内容 / 查看原文」切换和翻译失败警告。
  - 在插件详情页（`plugins.bundle.config`）提供设置表单。
- `cordis.patch.yml`：插入 translator 行和本插件行；可配置 `provider`、`translateInput`、`translateOutput`，
  也可以用 `rules`、`userLanguage` 设初始值。

## 设置

在「插件 → 语言桥接」里编辑，保存后从下一步开始生效，不用重启。

- **你的语言**：任意 BCP 47 代码，或 `auto` 跟随界面语言。翻译服务本身不处理 `auto`，所以由本插件解析：浏览器把
  界面语言上报给 Host，并保存下来。界面语言 `zh` 按 `zh-CN` 处理。
- **模型规则**：有序列表，每条是「模型 id 正则（不区分大小写）→ 工作语言」，第一条命中的生效，没有命中的模型不
  桥接。默认 `claude`、`gemini`、GPT 系列都是 `en`。表单会校验正则和语言代码，也可以填一个模型 id 试匹配结果。
- 工作语言和你的语言相同时（只比较语言和文字，`en-US` 与 `en-GB` 算相同），不翻译、不加系统提示、不产生费用。

设置保存在 `$DSH_HOME/storages/language-bridge.json`，优先级高于 `cordis.patch.yml`。没有用 Harness 自带的设置
表单：那需要 `schemastery` 声明 `.volatile()` 字段，而 `link:` 安装的本地插件解析不到这个包。

## 语言检测

`needsTranslation(text, { target, source })` 判断文本是否还需要翻译成 `target`，依次看：

1. **去掉非正文**：受保护片段，以及像代码的词（`parseConfig`、`foo_bar`、`src/app.ts`、`v2`、`--flag`、缩写）。
   没有剩余字母就不翻译。
2. **比较文字**：用 `Intl.Locale` 推算目标语言的文字，不需要语言表。其他非拉丁文字占比够高就翻译；目标不是拉丁文
   时，拉丁字母要占到 60% 以上才算外文，因为中日韩俄文里夹英文名词很常见。
3. **比较虚词**：同一文字内的语言（西班牙语和英语）靠内置的 17 种语言虚词表判断。其他语言明显占优就翻译；目标语言
   明显占优就不翻译。
4. **仍无法判断**：只有用户语言的文字和目标不同时才不翻译（日语用户输入 `run tests`），否则翻译。

取舍：**宁可多翻译，不漏翻译**。多翻译一次只是一小笔 DeepSeek Flash 费用，译文和原文相同时不会替换也不显示切换
按钮；漏翻译则是模型收到错误语言的文本且没人发现。代价是西班牙语用户输入 `run tests` 这种没有虚词的短句会多一次
调用，没有虚词表的同文字语言对（如印尼语用户、斯瓦希里语模型）每段都会调用一次。汉字是否属于日文或简繁体同样无法
区分，这些情况都按需要翻译处理。

## 兼容旧会话

旧插件 `claude-zh-bridge` 把原文存在 `source.claudeZhBridge`，这个字段继续可读。翻译缓存的键包含文本片段、语言和
路由，本插件保持了相同的占位符和分块方式，所以你的语言解析为 `zh-CN` 时旧会话的译文直接复用，不重复收费。

## 安装

```sh
DSH="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"
"$DSH" plugin --profile desktop add link:$HOME/.dsh/local-plugins/dsh-language-bridge
```

**不要和 `claude-zh-bridge` 同时启用，否则会翻译两次。** 先移除旧插件：

```sh
"$DSH" plugin --profile desktop remove @local/claude-zh-bridge
```

改 Host 代码或 `cordis.patch.yml` 后重启 DeepSeek Harness 生效；改 `client.js` 后若界面没变化，重新安装并刷新
页面。移除：在 DSH「插件」页关闭或移除，或 `"$DSH" plugin --profile desktop remove dsh-language-bridge`。

## 测试

```sh
node --test test/*.test.js
```

## 已知限制

- 系统提示只能提高模型使用工作语言的概率。测试中见过模型不遵守：翻译失败、模型直接收到日文时，Claude Opus 仍用日文
  回答；会话中途才加规则时，历史是西班牙语的 Gemini Flash Lite 继续用西班牙语回答。回答已经是你的语言时不会再翻译。
- 能看到的思考内容取决于模型路由，可能是摘要；看不到时无法确认它用的语言。
- 只有代码块、行内代码、链接和 `@路径` 受保护。没用反引号的命令和引用也会被翻译，比如 `printf "..."` 里的字符串。
  不想被翻译的文字请放进反引号。英文句子里夹一段中文时，这段中文也会被翻译。
- 会话日志与模型输入里是译文（只能在消息写入前改写）；原文只用于界面显示。
- 译文在一轮结束后才替换上去，生成过程中显示模型原文。
- `auto` 在浏览器上报界面语言之前无法判断是否相同，这期间只靠语言检测。
- 每段未缓存文本是一次付费 DeepSeek Flash 请求。
- 按钮和警告文字有中英日西法德俄葡八种语言，设置页只有中英文，其他语言显示英文。
- 与官方「推理翻译」bundle 同时启用时会各挂一份 translator 服务，可能冲突。
- 接管了用户消息渲染，Harness 升级改动 Chat 结构后可能需要调整。
