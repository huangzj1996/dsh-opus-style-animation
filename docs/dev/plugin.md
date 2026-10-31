# 插件开发与安装（dsh-style-cards）

这份文档记录两件事：第三方客户端插件在 DSH 里的**契约**（怎么写才生效），以及本机把插件**装进 profile、热更、验证、禁用/卸载**的确切命令。命令于 2026-10-31 在 DSH Desktop 0.2.1-rc.5 上实测。

## 1. 插件包形态

一个 npm 包，两半：

| 文件 | 作用 |
|---|---|
| `package.json` `dsh.bundle.patch` → `cordis.patch.yml` | 往 Loader 里插一行（没有这一行，客户端半边不会装载） |
| `package.json` `dsh.client` = `{ platform: "web", immediately: true, inject: [] }` + `exports["./client"]` | 告诉宿主这是一个浏览器插件、bundle 在哪 |
| `lib/index.js` | 宿主半边：注册缩略图 prefix 路由（`export default { name, inject: ['webServer'], apply() }`） |
| `lib/client.js` | 浏览器半边：`window.__ModuleLoader__.load({ id: 包名, factory(require) { … return module.exports } })` |
| `locale/*.json`、`icon` | 插件管理器的展示元数据与图标（不激活也会读） |

构建产物的硬约束（宿主会静默拒绝，页面上不报错）：

- `id` **必须等于包名**（`<包名>/client` 也认）；
- 工厂必须返回带 `inject` + `apply` 的对象（或 `module.exports` 带这两个字段）；工厂本身不能有副作用，注册全部在 `apply(ctx)` 里；
- `require()` 只解析宿主种子表：`react`、`react/jsx-runtime`、`react-dom`、`@deepseek-ai/cordis`、`zod`、`@tanstack/react-virtual`、`@deepseek-ai/dsh-client-store`、`@deepseek-ai/dsh-client-ui-slots`、`@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-ui-dockkit`。**JSX 不能留在产物里**（构建按 CJS + `React.createElement` 输出）；
- 服务从 `inject: ['slots']` + `ctx.get(...)` 拿；`dsh.client.inject` 只是行间激活顺序，不是服务。

### 两个座位（本插件用的）

- `sidebar.footer.action`：`list` slot，宿主给条目组件的 props 只有 `{ wide: boolean }`（`false` = 56px 图标栏）。
- `shell.overlay`：`list` slot，全帧浮层，**没有 owner props**。层本身 `pointer-events:none`，但 `.overlayLayer > *` 是 `auto`，所以条目的根元素天然可点，不需要额外 opt-in。

注册必须走 `ctx.slots.inject(slot, () => ctx.slots.register(options, Component))`：直接 `register` 会因为「slot 未声明」抛错。`list` slot 的 `id` 必填。

样式：静态 bundle 没有 `styles.insert`，自己 `document.createElement('style')` + `data-plugin` 属性，在 `ctx.effect` 里返回移除函数。颜色只用主题令牌（`--dsw-alias-*`、`--dsw-radius-*`、`--dsw-elevation-*`）；`var(--token, 兜底值)` 的兜底值允许——令牌被改名时退化成中性观感，而不是整块样式失效。

## 2. 装进本机 profile

`plugin/lib/` 是构建产物、不入库，安装前先 `pnpm install && pnpm build`。

```powershell
& 'D:\software\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd' plugin --profile desktop add 'link:D:/work/traeworkspace/dsh-opus-style-animation/plugin'
```

需要能写 profile 的进程（普通 PowerShell / GUI / 本会话在 `danger-full-access` 下的 shell）。CLI 不在 PATH，路径见上。

磁盘结果（实测）：

| 位置 | 变化 |
|---|---|
| `<profile>\package.json` | `dependencies["dsh-style-cards"] = "link:D:/…/plugin"`，`dsh.profile.bundles` 末尾追加 `dsh-style-cards` |
| `<profile>\pnpm-lock.yaml` | 加一条 link importer（pnpm 重写，先备份） |
| `<profile>\node_modules\dsh-style-cards` | **junction** → `plugin/`（所以重建源目录即生效） |
| `<profile>\cordis.patch.yml` | **不用改** |
| `<profile>\.plugin-manager\logs\operation-*\pnpm.log` | 本次 pnpm 输出 |

`link:` / `file:` / 裸绝对路径三种写法都会建 junction；用 `link:` 明确表达「就地重建即生效」。跨盘（profile 在 C:、仓库在 D:）可用。

GUI 等价路径：侧栏 **Plugins → Add plugin → 本地绝对路径**。

### 实测证据（2026-10-31）

```
+ dsh-style-cards 0.1.0 <- D:\work\traeworkspace\dsh-opus-style-animation\plugin
node_modules\dsh-style-cards  Junction -> D:\work\...\plugin
client 模块图：entries 82 -> 83，dsh-style-cards PRESENT（rev 随构建变）
bundle 取回：HTTP 200（约 10.9 KB），含 __ModuleLoader__ 标记与 dsh-style-cards.overlay
```

以上是**宿主侧**证据：它证明 bundle 被装载、被服务；页面里的入口渲染与浮层开合仍要人眼确认（见 §4）。

## 3. 热更（开发循环）

| 改了什么 | 怎么生效 | 要重启吗 |
|---|---|---|
| `src/client/**` → `pnpm build`（`lib/client.js`） | 宿主 `dsh-client-hmr` 每 500ms stat 一次 `clientPath`，变化 → `/plugins/events` 推 `rebuilt` → 页面换 bundle | **不要**，也不用刷页 |
| `src/host/**`（`lib/index.js`） | 需要一次重组合：往 profile `cordis.patch.yml` 加/删一个空行，或重跑一次 `add` | **不要** |
| profile 的 `cordis.patch.yml` | HMR 直接重组合 | **不要** |

**本会话里永远不要重启宿主**：agent 会话就活在那个进程里。也要避免装坏 client bundle——启动期组合失败会让整个 UI 起不来（运行期重组合失败只是 warn + 保留旧图）。安装前先构建并跑测试，`pnpm test` 会先构建再验产物方言。

## 4. 无屏验证

`/plugins/events` 不需要认证（栅栏只管 `/` 与 `/api/*`），首帧就是完整 graph：

```powershell
curl.exe -sS -N --max-time 3 'http://127.0.0.1:51188/plugins/events'
```

判据：

- graph 里 `entries[].id === 'dsh-style-cards'` → 宿主已装载该客户端模块；
- 按 `entries[].url`（形如 `plugins/??dsh-style-cards/client.js&rev=…`）取回 200 → bundle 可服务；
- 两者都过 = **Host 侧**已生效。页面里的视觉（入口长什么样、浮层开合）需要人看一眼——页面 console 与 DOM 不在 agent 可观测范围内。

资产路由是公开资产，同样不需要认证，可以直接探：

```powershell
# 200 + image/jpeg + cache-control；穿越必须 403/404
curl.exe -sS -D - -o NUL 'http://127.0.0.1:51188/style-cards/stills/A1.jpg'
curl.exe -sS --path-as-is -o NUL -w '%{http_code}\n' 'http://127.0.0.1:51188/style-cards/stills/%2e%2e%2fLICENSES%2fLICENSE'
```

注意：宿主半边改动需要一次重组合（见 §3）后这条路由才在，客户端 bundle 的改动才走 HMR。

仓库自带一个只读验证脚本（Node 22+，无需依赖）：

```powershell
node scripts/verify-client-module.mjs dsh-style-cards
# 退出码 0 = PRESENT 且 bundle 200；2 = 不在 graph（没装/被禁用/加载失败）；3 = 在 graph 但取不到 bundle
```

## 5. 禁用 / 卸载 / 回滚

```powershell
# 禁用（文件留着，入口/浮层消失）：profile 的 cordis.patch.yml 追加两行
# - id: dsh-style-cards
#   disabled: true

# 启用：删掉上面两行

# 卸载（依赖、bundles 项、junction 一起去掉）
& 'D:\software\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd' plugin --profile desktop remove 'dsh-style-cards'
```

实测：禁用 → graph 回到 82 条、ABSENT；启用 → 83 条、PRESENT；卸载 → 82 条。全程无重启、无残留（graph rev 回到安装前的值）。

回滚到安装前：备份 profile 的 `package.json` / `pnpm-lock.yaml` / `cordis.patch.yml`，需要时覆盖回去并
`dsh plugin --profile desktop install --frozen-lockfile`。

## 6. 测试与构建期数据

```powershell
pnpm --dir plugin generate    # assets/index.json → src/data/asset-index.generated.ts
pnpm --dir plugin typecheck   # 生成数据 + tsc --noEmit
pnpm --dir plugin test        # 先构建（含生成数据），再 vitest run
```

`pnpm build` 会先跑 `scripts/generate-asset-index.mjs`：读**已提交**的 `assets/index.json`（由仓库根的
`scripts/build-assets.mjs` 从素材包生成，内联 341 份 md 原文）与 `assets/shared/_公共函数.js`，只做
「资产文件 → TS 模块」的序列化，产出 `src/data/asset-index.generated.ts`（约 1.7 MB；构建产物，gitignore）。
它不解析 md、不依赖素材包在场；新克隆只要有 `assets/` 就能构建。`DSC_ASSET_INDEX=<path>` 可指向别的索引文件。
浏览器 bundle 因此从 #20 的 ~11 KB 涨到 ~1.48 MB——这是 341 份原文 + 公共函数内置的代价，运行期只
`JSON.parse` 一次、不读盘；缩略图走同源资产路由、不访问外网。应用 A–G 代码样片时，草稿末尾会附上这份 `_公共函数.js` 全文（逐字），
并把原文里「公共的小工具函数在同一文件夹的 _公共函数.js 里。」一句删掉、改由草稿说明已添加在下方。
资产漂移用 `pnpm check:assets`（即 `node scripts/build-assets.mjs --check`）判（需要素材包在场）。

seam：资产索引（`test/asset-index.test.ts` 四类真实样本 / `catalog-data.test.ts` 全量逐字节 + 公共函数逐字）、
卡片墙（含搜索 / 系列筛选）与详情 DOM（`test/card-wall.test.ts`、`test/panel.test.ts`，jsdom）、检索打分（`test/search.test.ts`，纯函数）、首帧基线（`test/render-baseline.test.ts`）、
纯状态机与浮层还原（`test/overlay-state.test.ts`）、草稿装配（`test/compose-draft.test.ts`）、
许可署名（`test/attribution.test.ts`）、会话适配器（`test/apply-session.test.ts`：openWorkspace + beforeOpen
预填草稿、草稿冲突、失败与降级路径）、
资产路由（宿主，`test/stills-route.test.ts`：解析 + 真实 HTTP）、缩略图 DOM（`test/still.test.ts`，jsdom）、
构建产物方言与 `apply` 行为（`test/client-bundle.test.ts`）、包清单（`test/package-manifest.test.ts`）。

## 7. 已知边界

- 浮层在 `overlayLayer`（`z-index:20`）这个层叠上下文里，压不过宿主的 settings 全屏层（`z-index:1000`）；实际使用中碰不到。
- **服务取法**：外部 bundle 的客户端上下文用 `ctx.get(name)` 做可选查找（不写进 `inject`，这样服务缺席时
  插件界面仍能打开，只有点「应用」时给可读错误）。#22 已实测 `uiWorkspace` 可见；#25 起应用链路还要
   `sessions`（读当前主视图会话：`list.getSnapshot().byId[*].retainedBy.mainView`）、`workspaces`
  （读工作区与会话归属）与 `conversation`（`input.requestDraftInitialization`）。
- **应用链路（#25 起）**：`uiWorkspace.openWorkspace(workspaceId, beforeOpen)` + 在 beforeOpen 里
  `conversation.input.requestDraftInitialization(binding, { prompt, whenDraftExists })`。
  openWorkspace 的 Promise 会因创建失败或 beforeOpen 抛错而 reject，所以失败能回到详情里；
  `keep` 返回 `preserved` 时抛错中止本次打开 → 详情出现「覆盖并应用 / 取消」确认，确认后以 `replace` 重走。
  工作区解析复刻宿主 startSession：当前主视图会话所属工作区，否则最近更新的工作区。
- **降级路径**：`sessions` / `workspaces` / `conversation` 读不到时退回 #22 的
  `startSession(undefined, { prompt, whenDraftExists: "append" })`——空草稿时等价覆盖、非空时追加，
  不静默丢字；这一路拿不到失败/冲突面（宿主自己弹 notice）。
- **已真机冒烟（2026-10-31，#25）**：`sessions` / `workspaces` / `conversation` 在外部 bundle 可见，
  beforeOpen 预填草稿生效。冒烟结果：空白会话先手输一段字再应用 → 出现「覆盖并应用 / 取消」确认，
  取消后原字还在、确认后草稿被替换；普通卡与空卡（M14）都落到新会话草稿（空卡只有任务说明 + 主题）；
  入口、卡片墙、搜索、缩略图照常。
- `shell.overlay` 条目没有 owner props，也就拿不到宿主 locale；当前文案「Opus 片场」是写死的中文（v1 中文界面，符合规格）。
- 图标没有可复用的宿主图标包（禁止 import `client-ui-primitives`），全部用内联 SVG。
- 卡片墙的系列占位色是**内容色**（10 个系列各一档，写在 `styles.ts` 的 `.dsc-card[data-series=…]` 里），
  不是宿主 `--dsw-alias-*` 主题令牌；它不随深浅色切换，这是有意为之，不违反「颜色只用主题令牌」。
- 第三方 bundle 无法读到宿主页面 console，视觉回归只能靠人眼或将来加一条宿主路由做 beacon。
- **资产路由（#24）**：宿主半边注册 `prefix` 路由 `style-cards`，只服务资产目录 `assets/stills/` 的扁平 `<id>.jpg`；
  响应 `Cache-Control: public, max-age=31536000, immutable`，路径穿越/非 stills 路径 403/404。v1 靠 link 安装时
  `lib/../..` 即仓库根；将来打包分发要把 `assets/stills` 拷进包内（否则 `../assets` 失效——见 ADR-0002）。
  Electron `file://` 模式没有 `webServer`，宿主半边不激活、客户端 img 加载失败自动退化为系列色块占位。
- 浮层打开期间遮罩接管指针（点遮罩即关闭，验收判据要求）：会话本身不被重挂载、流式输出照常，关闭后原样继续；如果要求打开时也能点背后，就和「点遮罩关闭」冲突，需要先改判据。