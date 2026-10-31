# dsh-opus-style-animation

把 341 份预置的「代码动画风格」做成 DSH 左侧栏底部的 **Opus 片场** 入口：点开挑一张风格卡片，就在新会话里按那种风格开工。

状态：施工中。规格 [#19](https://github.com/huangzj1996/dsh-opus-style-animation/issues/19)，实施票 #20（插件壳）/ #21（卡片墙）/ #22（详情 + 应用）/ #23（搜索与系列筛选）/ #24（缩略图与缺图占位）。
当前已交付 **#20 插件壳**、**#21 卡片墙**、**#22 详情 + 应用**、**#23 搜索与系列筛选** 与 **#24 缩略图与缺图占位**：侧栏底部一行「Opus 片场」；点开浮层里是 341 张风格卡，
按 10 个系列平铺、组头可折叠、可滚动。墙顶可输入关键词（字符二元组粗筛 + BM25 重排，客户端内存，单次查询约 5 µs），
也可按系列筛选；两者可叠加，无结果给空态，清空恢复全量。193 张有静帧的卡片显示缩略图（懒加载），其余 148 张
显示系列色块 + ID，单张失败只退化为自己的占位。点任意卡片进详情（大图、许可三档署名、风格原文全文、可选主题），
点「应用」会在当前/最近工作区打开新会话并把草稿填进输入框（不自动发送），浮层关闭并给一条轻提示。

## 仓库结构

| 路径 | 是什么 |
|---|---|
| `plugin/` | DSH 客户端插件包 `dsh-style-cards`（宿主半边：缩略图 prefix 路由；浏览器半边：入口 + 浮层） |
| `plugin/src/data/asset-index.generated.ts` | 构建期从 `assets/index.json` + `assets/shared/_公共函数.js` 序列化出的资产索引（gitignore，`pnpm generate` 生成） |
| `assets/` | 已提交的风格资产：`index.json`（341 份 md 原文 + 元数据）、`styles/`、`stills/`、`LICENSES/`；由 `scripts/build-assets.mjs` 生成 |
| `docs/` | 研究、ADR、agent 文档；插件契约与开发循环见 [`docs/dev/plugin.md`](docs/dev/plugin.md) |
| `code-animation-341-styles-main/` | 上游素材包（gitignore，只在本机用于重生成/校验 `assets/`） |
| `animations/` | 手工生成的动画产物 |

插件本身是**一个 npm 包**：`package.json` 声明 `dsh.bundle.patch`（Loader 行）与 `dsh.client`（浏览器半边），
`lib/client.js` 是 `window.__ModuleLoader__.load({ id, factory(require) })` 方言的 classic script。

## 开发

需要 Node 22+ 与 pnpm 11（本机 pnpm 不在 PATH 时用 DSH 自带的那份，见 [`docs/dev/plugin.md`](docs/dev/plugin.md)）。

```powershell
pnpm install        # 根目录一次装齐（workspace: plugin/）
pnpm generate       # assets/index.json → plugin/src/data/asset-index.generated.ts
pnpm check:assets   # 校验 assets/ 与素材包一致（需要素材包在场）
pnpm test           # 先构建，再跑 vitest（资产索引 / 卡片墙 / 状态机 / 产物方言 / 包清单）
pnpm typecheck      # 生成资产索引 + tsc --noEmit
pnpm build          # 生成资产索引 + lib/client.js + lib/index.js
```

构建只依赖已提交的 `assets/`，新克隆不需要素材包。生成的模块里同时逐字内联了代码样片共用的
`assets/shared/_公共函数.js`（应用 A–G 代码样片时附进草稿）。素材包只用于重生成/校验资产：
`node scripts/build-assets.mjs` 重新生成 `assets/`，`node scripts/build-assets.mjs --check` 校验漂移。
生成的资产索引模块与 `plugin/lib/` 一样是构建产物，不入库。

## 装进本机 profile（Desktop）

`plugin/lib/` 是构建产物、不入库，**装之前先构建**：

```powershell
pnpm install
pnpm build
```

再执行安装（需要能写 profile 的 shell；agent 沙箱里跑不动这步）：

```powershell
& 'D:\software\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd' plugin --profile desktop add 'link:D:/work/traeworkspace/dsh-opus-style-animation/plugin'
```

它做三件事：`pnpm add` 在 profile 里建一个指向 `plugin/` 的 junction；把 `dsh-style-cards` 追加进 profile
`package.json` 的 `dsh.profile.bundles`；**不需要改 profile 自己的 `cordis.patch.yml`**（插入行在插件包自带的
`cordis.patch.yml` 里）。装完约 1 秒内运行中的宿主就会把它装进客户端模块图（见下面的无屏验证），不需要重启宿主。
页面里的入口/浮层长什么样由浏览器渲染，agent 观测不到，需要人看一眼（本轮验收就是这样收的口）。

GUI 路径等价：侧栏 **Plugins → Add plugin → 填本地绝对路径**。

## 热更（开发循环）

- **改 `plugin/src/client/**`（日常 90%）**：`pnpm build` 后宿主每 500ms stat 一次 `lib/client.js`（junction 指向源目录），
  变化就通过 `/plugins/events` 推 `rebuilt`，页面自动换 bundle——**不重启、不刷页**。
- **改 `plugin/src/host/**`**：先 `pnpm build`（`build.mjs` 的 watch 只盯 `src/client/**`），再触发一次重组合：
  往 profile `cordis.patch.yml` 加/删一个空行，或重跑一次 `dsh plugin ... add`。
- **不要重启宿主**：当前 agent 会话就活在那个进程里，重启等于掐掉会话。

## 卡片墙（#21）

- **数据**：单一真相是已提交的 `assets/index.json`（341 份 md 原文 + 元数据 + 许可 + 静帧路径）。
  构建期 `plugin/scripts/generate-asset-index.mjs` 只做「JSON → TS 模块」的序列化，**不再自己解析 md**；
  运行期只读内存，不读文件系统、不联网。生成文件头记录索引 sha256（本次 341 张、193 张带静帧、
  sha256 `1c53b7f3…`）；`node scripts/build-assets.mjs --check` 是资产漂移的判据。
- **界面**：按规格的系列顺序（A–G / M / K / Z / H / L / V / X / R / O）分组，组内按 ID 数值序
  （A2 在 A10 前、L2 在 L10 前）；组头可折叠、默认全部展开；浮层主体滚动。
  #21 时卡片只有系列色占位块 + ID + 名称；#24 起有静帧的卡片改显示缩略图，其余仍是色块 + ID。
  索引里的 9 张空卡（字段 `emptyPayload`）中，8 张没有名字、显示「（未命名）」（第 9 张 K22 只是提示词很短，仍显示名字）。
- **首帧基线**：卡片墙挂载后记录「分组开始 → 首帧画完」的耗时，显示在墙顶摘要旁（`首帧渲染 X ms`），
  同时写 `console.info` 与 `window.__DSC_BASELINE__`。这个数字供后续判断是否需要虚拟滚动，
  本轮实测记录见票 [#21](https://github.com/huangzj1996/dsh-opus-style-animation/issues/21)。
- **测试**：`plugin/test/asset-index.test.ts` 覆盖四类真实样本（代码样片 / 11 节英文规约 L4 / 一句话 / 空卡）；
  `catalog-data.test.ts` 断言 341 张、10 组、193 张带静帧、许可分档，并把 341 份内置原文与 `assets/styles/*.md`
  **逐字节**对比；`card-wall.test.ts` 在 jsdom 里渲染出 341 张卡并验证折叠。

## 详情与应用（#22）

- **详情**：点任意卡片进入。显示名称、三档许可署名（徽标 + 版权人 + 一句话条款 + 逐条来源）、
  assets/index.json 里 prompt 的**全文**（只读、逐字）、可选「主题」输入与「应用」按钮；
- **返回**：详情里点「← 返回卡片墙」回到卡片墙，并恢复进详情前的滚动位置。
- **草稿**：composeDraft（纯函数）拼一行任务说明（含产物路径 animations/<时间戳>-<ID>-<名称>/index.html）
  + 主题（非空时一行）+ 风格原文（逐字）；代码样片（索引 hasSharedHelpers: true，25 张）再追加
  _公共函数.js 全文，保证参考实现里的 rng / clamp / vgrad 可直接跑。内联时会把原文里
  「公共的小工具函数在同一文件夹的 _公共函数.js 里。」那句删掉（新会话里它已是错的），
  改由草稿说明「公共函数已添加在下方」（用户 2026-10-31 冒烟后拍板）。块之间只留一个空行。
- **应用**：uiWorkspace.startSession(undefined, { prompt, clearPreviousDraft: true })——在当前/最近工作区
  开新会话并把草稿填进输入框，**不自动发送**；成功后浮层关闭并出现轻提示「已带入草稿，可编辑后发送」。
  拿不到服务或同步失败时，详情里显示可读错误、浮层保持打开（不吞错）。
- **外部 bundle 的 uiWorkspace 注入**：客户端插件上下文用 ctx.get('uiWorkspace') 做可选查找；
  2026-10-31 真机实测通过：用户点「应用」后新会话 `session-e78b5fc9-…` 落在当前工作区、session 日志
  0 turn（草稿未自动发送），证据记在票 #22。
- **失败面**：startSession 是 fire-and-forget，异步失败由宿主自己弹 notice；插件侧只兜取服务失败 /
  同步抛错（会显示在详情里、浮层不关）。失败重试与更细的错误面留给 #25。

## 缩略图与缺图占位（#24）

- **宿主路由**：宿主半边 `plugin/src/host/index.ts` 通过 `dsh-host-webserver` 注册 `prefix` 路由 `style-cards`，
  从包内 `assets/stills/` 读扁平 `<id>.jpg` 流给浏览器；客户端用同源相对 URL `style-cards/stills/<id>.jpg`。
  只服务 `stills/` 前缀，`styles/`、`LICENSES/` 不暴露；拒绝目录穿越（原样 / 编码 / 反斜杠 / 空字节）；
  响应带 `Cache-Control: public, max-age=31536000, immutable` 与 `X-Content-Type-Options: nosniff`。
- **客户端**：`StillImage`（`plugin/src/client/still.ts`）用 `loading="lazy"` / `decoding="async"`，加载失败只把
  **这一张**退化为系列色块 + ID；详情大图用同一个 `stillUrl()` 来源，不出现两张不同版本。
- **路径前提**：v1 用 link 安装，`lib/../..` 即仓库根，所以宿主半边能读到 `<repo>/assets/stills`；将来打包分发，
  必须把 `assets/stills` 拷进包内（见 ADR-0002 的后果，留给 #26 的 README）。
- **实测（2026-10-31）**：宿主半边重组合后，浏览器同源 GET `style-cards/stills/A1.jpg` → 200 `image/jpeg`、
  148,625 B、与本地 `assets/stills/A1.jpg` sha256 一致；`stills/../LICENSES/LICENSE` → 404、
  编码穿越 `%2e%2e%2f` → 403、`styles/A1.md` → 404、HEAD → 200。
## 无屏验证

`/plugins/events` 不需要认证，可以直接读运行中的客户端模块图：

```powershell
# 判据：条目 PRESENT 且 bundle 返回 200 = 宿主已装载；页面里的视觉仍要人看一眼
node scripts/verify-client-module.mjs dsh-style-cards
```

缩略图路由可以直接同源探针（不需要浏览器 cookie；`/plugins/*` 与静态资产是公开的）：

```powershell
# 判据：200 + image/jpeg；路径穿越必须 403/404，styles/ 必须 404
curl.exe -sS -D - -o NUL 'http://127.0.0.1:51188/style-cards/stills/A1.jpg'
curl.exe -sS --path-as-is -o NUL -w '%{http_code}\n' 'http://127.0.0.1:51188/style-cards/stills/%2e%2e%2fLICENSES%2fLICENSE'
```

具体脚本与退出码见 [`docs/dev/plugin.md`](docs/dev/plugin.md)。

## 禁用 / 卸载

```powershell
# 禁用（文件留着，入口/浮层消失）：profile 的 cordis.patch.yml 追加
# - id: dsh-style-cards
#   disabled: true

# 卸载
& 'D:\software\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd' plugin --profile desktop remove 'dsh-style-cards'
```

实测（2026-10-31）：禁用 → 客户端模块图回落到 82 条且本插件 ABSENT；启用 → 83 条且 PRESENT；卸载 → 82 条；
整轮无重启、无残留。

## 测试

`plugin/test/` 十四个文件、88 条（#24 后）：

- `asset-index.test.ts` — 四类真实样本的索引读取（A1 代码样片、L4 11 节英文规约、H10 一句话、M14 空卡）；
- `catalog-data.test.ts` — 与 `assets/index.json` 完全一致、341 张 / 10 系列 / 193 张带静帧 / 9 张空卡、字段与许可分档，以及 341 份内置原文与
  `assets/styles/*.md` 逐字节对比；
- `card-wall.test.ts` — jsdom 里渲染 341 张卡、默认展开、10 个组头可折叠、组内数值序、空卡兜底文案、首帧基线写进 window；
- `render-baseline.test.ts` — 首帧基线的记录点；
- `overlay-state.test.ts` — 浮层开/关状态机（入口点按切换、关闭按钮 / 点遮罩 / ESC 关闭、关着时 ESC 无事发生、关掉还能再开）；
- `client-bundle.test.ts` — 构建产物方言、`apply` 模拟宿主上下文、内置数据与「不读盘 / 不联网」；
- `package-manifest.test.ts` — `dsh.bundle.patch` / `dsh.client` / 展示元数据 / 图标齐全；
- `compose-draft.test.ts` — 草稿文本 golden：空/有主题、路径形状、原文逐字、代码样片内联公共函数并删掉「同一文件夹」那句、块间只留一个空行；
- `attribution.test.ts` — 三档许可署名（free-share-no-sell © 俯仰观照；MIT 的 L/V/X 各自版权人；逐条来源）；
- `apply-session.test.ts` — 适配器断言 startSession(undefined, { prompt, clearPreviousDraft: true })，失败返回可读错误；
- `panel.test.ts` — jsdom：点卡片进详情、返回恢复滚动位置、应用草稿含主题/公共函数、失败时错误留在详情里；
- `search.test.ts` — 二元组粗筛 + BM25 的纯函数用例（#23）；
- `stills-route.test.ts` — 宿主 prefix 路由：解析（含编码/反斜杠/空字节穿越）与真实 HTTP（200 / 404 / 405 / HEAD / 长缓存）；
- `still.test.ts` — jsdom：URL 形状、懒加载 img、无图与加载失败退化、详情大图同源。

浮层的真实视觉、真实会话创建按规格留给手工冒烟（规格 #19 的 Testing Decisions）；
#22 的端到端路径与 #24 的缩略图都已真机冒烟/探针取证。