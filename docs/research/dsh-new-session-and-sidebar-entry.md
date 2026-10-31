> **历史记录（调研于 2026-10-30/31）：** 本文件是当时的原始研究笔记。其中 `/anim` 命令线、指令装配、闸门、播放器的路线已在 2026-10-31 二次重锚中退场（见 [`docs/adr/0001-carry-style-source-not-compiled.md`](../adr/0001-carry-style-source-not-compiled.md)）；当前实现以仓库 [README](../../README.md) 与 `docs/adr/` 为准。

# DSH 新会话与侧栏入口 — 客户端插件能否「点卡片 → 开一个新会话并带上提示词」

Researched 2026-10-31 against the installed Electron app bundle
`D:\software\DeepSeek Harness\resources\app.asar` (182,766,714 B, header 4,760,404 B). The archive's JSON header is not at
the usual offset: this build writes two length words at 8..15 and the header JSON starts at **16**, ending at
**8 + headerSize**; `.tmp-research/asar.mjs` (list / read / grep / dump) parses it, and the packages cited below were
extracted to `.tmp-research/extract/<pkg>/`. Citations read `ASAR:<inner path>:<line>`; the extracted copy of the same
file is at `.tmp-research/extract/<pkg>/<pkg>/lib/<file>`.

**Keys.** `ASAR:` = a file inside the installed bundle. `RUNNER` = `dsh/node_modules/@deepseek-ai/dsh-cordis-client-runner`.

---

## Verdict

1. **点卡片开一个新会话、把提示词预填成草稿（不自动发送）：可行，且有一等公民 API。**
   `uiWorkspace.startSession(workspaceId?, options?: StartSessionOptions)` 就是宿主自己「新建会话」走的同一条路：它连接/复用工作区的 blank 会话、导航过去，再在打开前把 `options.prompt` 写进该会话的输入框。`options` 还带 `clearPreviousDraft` 与 `whenDraftExists`。
2. **显式创建会话：可行。** Remote `session/create`（`SessionCreateRequest` = `{ workspaceId XOR cwd, sessionId?, agentPreset? }` → `{ sessionId, agentPreset? }`），客户端门面是 `sessions.create(opts)`。但**创建不等于显示**：显示要走 `uiWorkspace.openSession(target)` 或 1 的 `startSession`。
3. **左侧栏入口 + 面板：两条路都通，但座位不同。**
   - `sidebar.panellist`（list, root）+ `main`（keyed slot）是 DSH 自己的「左栏一行 ↔ 整页面板」配对：行点击**固定**调 `ctx.layout.selectPanel(id)`，而 `selectPanel` 要求存在 `options.key === id` 的 `main` 条目，否则**抛错**。
   - 想要**浮层**（弹出来、不占主区域）只能换座位：`sidebar.footer.action`（侧栏底部一行）或 `shell.leading`（顶栏左侧）做入口，面板渲染进 `shell.overlay`（list slot，天然浮在全应用之上，未显式开启 pointer events 时点击穿透）。
4. **把文本塞进「不是当前渲染的会话」的输入框：没有直接 API。** `inputActions.setDraft` 是 composer slot 的 standard prop，只对已渲染的 composer 有效；跨会话预填的正路是 1 的 `startSession`（内部 `conversation.input.requestDraftInitialization(binding, options)`）。**不要**先 `session/create` 再自己想办法 `setDraft`——那一步没有支持的落点。

---

## Evidence

| 能力 | 结论 | 证据 |
|---|---|---|
| 新建并打开一个会话、带初始内容 | `startSession(workspaceId?, options)`：连接 blank → `replaceMain` → `beforeOpen` 钩子里 `prepareDraft` → `conversation.input.requestDraftInitialization(binding, options)`。不 submit。 | ASAR:`…/dsh-client-ui-workspace/lib/client.js:1500-1533`；RUNNER:`lib/client.js:1553-1561`（签名与「initial content / whenDraftExists」说明） |
| `StartSessionOptions` 的字段 | `{ prompt?, clearPreviousDraft?, whenDraftExists?: 'keep'\|'replace'\|'append', agentPreset? }`（字段名由实现读法确认：`options ?? {}` 解构 `agentPreset`，其余整体当 draft 选项；`requestDraftInitialization` 用 `options.prompt`/`whenDraftExists`/`clearPreviousDraft`） | ASAR:`…/dsh-client-ui-workspace/lib/client.js:1500-1503`；ASAR:`…/dsh-client-ui-conversation/lib/client.js:15110-15125` |
| 预填 ≠ 发送 | `requestDraftInitialization` 只 `setDraft` / `appendDraft`；真正的发送是 `SubmitMachine` 的 `submit`，由用户 Enter/按钮触发 | ASAR:`…/dsh-client-ui-conversation/lib/client.js:15110-15125`；同文件 `14941-14967`（`actions.submit`） |
| 打开一个已存在的会话 | `uiWorkspace.openSession(target: SessionTarget)` → `replaceMain(target, …, 'reveal')` | ASAR:`…/dsh-client-ui-workspace/lib/client.js:1471-1473`；RUNNER:`lib/client.js:1494-1500` |
| 新建会话（Remote） | `session/create`，返回 `{ sessionId, agentPreset? }`；`create` 与 `fork` 是唯一两种直接建 Agent 的操作 | ASAR:`…/dsh-api-session-controller/lib/index.js:750-790`；同包 `lib/typert.remote-client.js:1522-1550`（方法名、参数/返回 schema）；ASAR:`…/dsh-api-session-controller/lib/client.js:3315-3335`（`ClientSessions.create`） |
| 左栏面板行 | 行数据来自 `sidebar.panellist` 条目的 `{id, order, label}`，排序后成列表；点击 `selectPanel(id)` | ASAR:`…/dsh-client-ui-sidebar/lib/client.js:566-583, 597-599, 627-630` |
| 面板本体 | `main` 是 keyed slot：`renderSlot('main', {}, { entryKey: activePanelId ?? 'conversation' })`；`selectPanel` 对未注册的 key 直接抛 `main panel "…" is not registered` | ASAR:`…/dsh-client-ui-layout/lib/client.js:99-120, 454-472, 615-631` |
| 浮层 | `shell.overlay` 是 list slot，「additive, click-through until your entry opts into pointer events」；官方示例给了 `ctx.slots.register({ name:'shell.overlay', id, order, label }, Component)` | RUNNER:`lib/client.js:5481-5545`（含示例代码），`:4912`（根 `root` 不可碰的说明） |
| 侧栏还有哪些座位 | `sidebar.brand.mark/name`、`sidebar.toggle.badge`、`sidebar.panellist(.actions)`、`sidebar.workspaces`、`sidebar.settings`、`sidebar.footer.action`（list）、`shell.leading`（顶栏左侧） | ASAR:`…/dsh-client-ui-sidebar/lib/client.js:611-654` |
| 服务怎么拿 | 客户端服务是 Cordis 服务：`ctx.get('uiWorkspace')` / `ctx.inject(['uiWorkspace'], …)`；sidebar 自己就 `inject = ['slots','layout','uiWorkspace','locale','shortcuts']` | ASAR:`…/dsh-client-ui-sidebar/lib/client.js:549-561`；RUNNER:`lib/client.js:1488-1600`（`uiWorkspace` 方法目录） |

### 最省事的调用形态（据上表拼的，未实测）

```js
// 侧栏底部一个入口，点开浮层卡片墙；点卡片：
ctx.get('uiWorkspace').startSession(undefined, {
  prompt: cardText,            // 该卡片的风格原文（也可以先加一行任务说明）
  clearPreviousDraft: true,    // 覆盖 blank 会话里可能残留的草稿
});
// 若要整页面板（而不是浮层）：
ctx.slots.register({ name: 'main', key: 'style-cards' }, CardWallPage);      // 面板本体
ctx.slots.register({ name: 'sidebar.panellist', id: 'style-cards', order: 50, label: '风格卡片' }, Row); // 左栏一行
```

---

## Unknowns

- **外部 bundle 能否注入 `uiWorkspace`**：目录里它是客户端服务，sidebar 用 `inject` 拿到；但第三方 bundle 走 `dsh.bundle.patch` 装进来的上下文是否同样可见，只有装一次才知道（UNVERIFIED）。
- **`startSession` 复用 blank 会话**：它优先复用工作区里已有的 blank。`clearPreviousDraft: true` 会覆盖用户已输入的草稿——UX 上是否提示、还是先扫描 blank 再决定，未定。
- **超长 prompt**：341 份原文最大 20,877 B（`L8_电视新闻广播` 一类），一次 `setDraft` 的编辑器行为未测（UNVERIFIED；`L4` 18.8 KB 同理）。
- **`main` 面板的 keyed 条目能否由外部 bundle 注册**（沿用 `docs/research/dsh-plugin-architecture.md` 的 named-slots 结论，本包未再验证）。
- **会话创建失败的错误面**：`SessionCreateError` 携带 rpc code；`startSession` 把失败转成 Workspace notice（`draft.workspaceRequired` / `draft.initializationFailed`），插件要不要自己兜一层提示，未定。
