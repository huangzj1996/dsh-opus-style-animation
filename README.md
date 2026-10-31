# dsh-opus-style-animation

把 341 份预置的「代码动画风格」做成 DSH 左侧栏底部的 **Opus 片场** 入口：点开挑一张风格卡片，就在新会话里按那种风格开工。

状态：**v1 已交付（2026-10-31）**。规格 [#19](https://github.com/huangzj1996/dsh-opus-style-animation/issues/19)；实施票
[#20](https://github.com/huangzj1996/dsh-opus-style-animation/issues/20) 插件壳 /
[#21](https://github.com/huangzj1996/dsh-opus-style-animation/issues/21) 卡片墙 /
[#22](https://github.com/huangzj1996/dsh-opus-style-animation/issues/22) 详情 + 应用 /
[#23](https://github.com/huangzj1996/dsh-opus-style-animation/issues/23) 搜索与系列筛选 /
[#24](https://github.com/huangzj1996/dsh-opus-style-animation/issues/24) 缩略图与缺图占位 /
[#25](https://github.com/huangzj1996/dsh-opus-style-animation/issues/25) 边界兜底 /
[#26](https://github.com/huangzj1996/dsh-opus-style-animation/issues/26) 文档与收尾。

当前形态：侧栏底部一行「Opus 片场」；点开浮层里是 341 张风格卡，按 10 个系列平铺、组头可折叠、可滚动。墙顶可输入关键词
（字符二元组粗筛 + BM25 重排，客户端内存，单次查询约 5 µs），也可按系列筛选；两者可叠加，无结果给空态，清空恢复全量。
193 张有静帧的卡片显示缩略图（懒加载），其余 148 张显示系列色块 + ID，单张失败只退化为自己的占位。点任意卡片进详情
（大图、三档许可署名、风格原文全文、可选主题），点「应用」会在当前/最近工作区打开新会话并把草稿填进输入框（不自动发送），
浮层关闭并给一条轻提示；空白会话里已有未发送草稿时先确认再覆盖（#25）。

v1 **不做**：指令装配、骨架、闸门、播放器、npm 分发（为什么砍，见 [`docs/adr/0001-carry-style-source-not-compiled.md`](docs/adr/0001-carry-style-source-not-compiled.md)）；
旧路线的调研与决定保留在 [`docs/research/`](docs/research/) 与地图 [#1](https://github.com/huangzj1996/dsh-opus-style-animation/issues/1) 的「历史」里，不再施工。

## 仓库结构

| 路径 | 是什么 |
|---|---|
| `plugin/` | DSH 客户端插件包 `dsh-style-cards`（宿主半边：缩略图 prefix 路由；浏览器半边：入口 + 浮层）；许可说明见 [`plugin/LICENSE.md`](plugin/LICENSE.md) |
| `plugin/src/data/asset-index.generated.ts` | 构建期从 `assets/index.json` + `assets/shared/_公共函数.js` 序列化出的资产索引（gitignore，`pnpm generate` 生成） |
| `assets/` | 已提交的风格资产：`index.json`（341 份 md 原文 + 元数据）、`styles/`、`stills/`、`shared/`、`LICENSES/`、`SOURCES.md`；由 `scripts/build-assets.mjs` 生成 |
| `assets/LICENSES/` | 素材包许可随附：自定义非商业许可 `LICENSE`、`NOTICE.md`、`许可与来源.md`、`第三方许可/`（三份 MIT） |
| `docs/` | 研究、ADR、agent 文档；插件契约与开发循环见 [`docs/dev/plugin.md`](docs/dev/plugin.md) |
| `code-animation-341-styles-main/` | 上游素材包（gitignore，只在本机用于重生成/校验 `assets/`） |
| `animations/` | agent 生成的动画产物（gitignore，每次新建子目录） |
| `LICENSE` | 仓库**代码**的 MIT 许可；素材许可见 `assets/LICENSES/` 与 [`plugin/LICENSE.md`](plugin/LICENSE.md) |

插件本身是**一个 npm 包**：`package.json` 声明 `dsh.bundle.patch`（Loader 行）与 `dsh.client`（浏览器半边），
`lib/client.js` 是 `window.__ModuleLoader__.load({ id, factory(require) })` 方言的 classic script。

## 开发

需要 Node 22+ 与 pnpm 11+（本机在 PATH 上的 pnpm 实测 12.16.1；`dsh plugin` 安装命令内部用的是 DSH 自带的
pnpm 11.28.5。本机 pnpm 不在 PATH 时用 DSH 自带的那份，见 [`docs/dev/plugin.md`](docs/dev/plugin.md)）。

```powershell
pnpm install        # 根目录一次装齐（workspace: plugin/）
pnpm generate       # assets/index.json → plugin/src/data/asset-index.generated.ts
pnpm check:assets   # 校验 assets/ 与素材包一致（需要素材包在场）
pnpm test           # 先构建，再跑 vitest
pnpm typecheck      # 生成资产索引 + tsc --noEmit
pnpm build          # 生成资产索引 + lib/client.js + lib/index.js
```

构建只依赖已提交的 `assets/`，新克隆不需要素材包。生成的模块里同时逐字内联了代码样片共用的
`assets/shared/_公共函数.js`（应用 A–G 代码样片时附进草稿）。生成的资产索引模块与 `plugin/lib/` 一样是构建产物，不入库。

## 素材与许可（#26）

### `assets/` 是生成物，不要手改

`assets/` 由 `scripts/build-assets.mjs` 从**素材包** `code-animation-341-styles-main/` 确定性生成（同一素材包重跑
逐字节一致）：

```powershell
node scripts/build-assets.mjs          # 生成/重生成 assets/
node scripts/build-assets.mjs --check  # 校验漂移；不一致时退出码 2
pnpm check:assets                      # 同上（根 package.json 的脚本）
```

- **手改 `assets/` 会被判漂移**：任何直接改 `assets/` 文件的行为都会在 `--check` 时报 `drift: <路径>`；改素材必须先改素材包再重生成。
- 素材包路径是仓库根的 `code-animation-341-styles-main/`（**gitignore、不入库**，B 档瘦身后 13.7 MB）；新克隆只要有已提交的
  `assets/` 就能构建，但 `--check` 需要素材包在场——包被删掉时该命令会报错，这是有意的（宁可失败也不静默通过）。

### 随附许可（`assets/LICENSES/`）

| 文件 | 内容 |
|---|---|
| `LICENSE` | 素材包**自定义非商业许可**全文（中英对照，作者 wqb578 / 俯仰观照） |
| `NOTICE.md` | 三个 MIT 系列（L / V / X，共 105 条）的清单、版权人与覆盖范围声明 |
| `许可与来源.md` | 作者自述哪些是自己整理/制作、哪些来自网络 |
| `第三方许可/` | Lemo-Opuscar、mg-styles-15、code-video 三份 MIT 许可**原文**（未修改） |
| `assets/SOURCES.md` | **逐条来源表**：341 张卡片每行一条（id / 名称 / 系列 / 许可 / 指回素材包的原始 md 路径） |

### 三档署名（与 #12 结论一致）

| `license` 值 | 数量 | 署名 |
|---|---|---|
| `MIT` | **105**（L 59 / V 15 / X 31） | © 2026 LemoLab / Vincentwei1021 / Bae-ChangHyun；保留版权声明与 MIT 原文即可 |
| `free-share-no-sell` | **236**（A–G / M / K / Z / H / R / O） | © 俯仰观照；免费使用、免费再分发，**禁止**包装成课程、付费 skills 或其他收费产品出售 |
| 逐条 `source` | 全部 341 条 | 指回 `许可与来源.md` 与素材包里的原始 `.md`；UI 详情逐卡显示 |

插件包自己的 `license` 字段是 **`SEE LICENSE IN LICENSE.md`**，**绝不写 MIT**（`plugin/package.json`）：
`plugin/LICENSE.md` 分开说明「插件代码 = 仓库根 LICENSE 的 MIT」与「风格素材 = 上述三档」，并写明再分发时必须整套保留
`assets/LICENSES/` 与 `assets/SOURCES.md`。

**公开仓库内即再分发、非商业**：`assets/`（341 份原文 + 193 张静帧）提交进这个公开仓库，本身**已经构成对第三方素材的再分发**。
在该许可下这是允许的（保留署名与相同许可、免费分享），但**不得商业化**；v1 不发 npm、不设付费层。将来真要把插件打包分发
（npm 或把 `assets/stills` 拷进包内）之前，按 [#12](https://github.com/huangzj1996/dsh-opus-style-animation/issues/12) 的结论复核
「三份 MIT 是否逐字携带、合集是否被误标 MIT、是否混入付费层」。

来源标注（再分发必须保留）：

> **来源：来自俯仰观照博主的动画画风整理**

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
`cordis.patch.yml` 里）。装完约 1 秒内运行中的宿主就会把它装进客户端模块图，不需要重启宿主。
页面里的入口/浮层长什么样由浏览器渲染，agent 观测不到，需要人看一眼（见下面的从零验收）。

GUI 路径等价：侧栏 **Plugins → Add plugin → 填本地绝对路径**。

### 从零验收：装 → 开 → 用 → 卸

按 README 从零走一遍，每步都有可复核的判据（**无屏** = 命令/HTTP 可验，**人眼** = 页面里看一眼）：

1. **构建**：`pnpm install`、`pnpm build`，退出码 0。
2. **安装**：跑上面的 `dsh plugin ... add` 命令，退出码 0。
3. **无屏**：`node scripts/verify-client-module.mjs dsh-style-cards` 退出码 **0**（条目 PRESENT、bundle 200）；
   资产路由 `curl.exe -sS -D - -o NUL 'http://127.0.0.1:51188/style-cards/stills/A1.jpg'` 返回 **200 + image/jpeg**。
4. **人眼**：侧栏底部出现「Opus 片场」；点它 → 浮层卡片墙可开、341 张、有搜索框与系列分组、缩略图/占位正常。
5. **人眼**：点一张卡 → 详情（大图、三档许可署名、原文全文、主题框）→ 点「应用」→ 打开**新会话**，输入框里已有
   「任务说明 + 原文」草稿且**未发送**，浮层关闭并出现轻提示。
6. **卸载**：跑下面的卸载命令（或先按「禁用」验证）。无屏判据：`verify-client-module.mjs` 退出码 **2**（ABSENT）、
   资产路由 **404**；人眼判据：侧栏入口消失。
7. **重装**：再跑一次安装命令，回到第 3 步的 PRESENT/200，入口与卡片墙恢复。

**实测（2026-10-31，#26 从零）**：卸载 → 客户端模块图 82 条 / `dsh-style-cards` ABSENT / 资产路由 404；
重装 → 83 条 / PRESENT / 路由 200。禁用 → 82 条 / ABSENT / 404；启用 → 83 条 / PRESENT / 200。
页面视觉（入口、卡片墙、应用后新会话草稿、卸载后入口消失）按上面的「人眼」判据确认。

## 热更（开发循环）

- **改 `plugin/src/client/**`（日常 90%）**：`pnpm build` 后宿主每 500ms stat 一次 `lib/client.js`（junction 指向源目录），
  变化就通过 `/plugins/events` 推 `rebuilt`，页面自动换 bundle——**不重启、不刷页**。
- **改 `plugin/src/host/**`**：先 `pnpm build`（`build.mjs` 的 watch 只盯 `src/client/**`），再触发一次重组合：
  往 profile `cordis.patch.yml` 加/删一个空行，或重跑一次 `dsh plugin ... add`。
- **不要重启宿主**：当前 agent 会话就活在那个进程里，重启等于掐掉会话。

## 卡片墙（#21）

- **数据**：单一真相是已提交的 `assets/index.json`（341 份 md 原文 + 元数据 + 许可 + 静帧路径）。
  构建期 `plugin/scripts/generate-asset-index.mjs` 只做「JSON → TS 模块」的序列化，**不再自己解析 md**；
  运行期只读内存、不读盘、不访问外网（缩略图走同源资产路由，见 #24）。生成文件头记录索引 sha256（本次 341 张、193 张带静帧、
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

## 详情与应用（#22、#25）

- **详情**：点任意卡片进入。显示名称、三档许可署名（徽标 + 版权人 + 一句话条款 + 逐条来源）、
  assets/index.json 里 prompt 的**全文**（只读、逐字）、可选「主题」输入与「应用」按钮；
- **返回**：详情里点「← 返回卡片墙」回到卡片墙，并恢复进详情前的滚动位置。
- **草稿**：composeDraft（纯函数）拼一行任务说明（含产物路径 animations/<时间戳>-<ID>-<名称>/index.html）
  + 主题（非空时一行）+ 风格原文（逐字）；代码样片（索引 hasSharedHelpers: true，25 张）再追加
  _公共函数.js 全文，保证参考实现里的 rng / clamp / vgrad 可直接跑。内联时会把原文里
  「公共的小工具函数在同一文件夹的 _公共函数.js 里。」那句删掉（新会话里它已是错的），
  改由草稿说明「公共函数已添加在下方」（用户 2026-10-31 冒烟后拍板）。块之间只留一个空行。
- **9 张空卡（#25）**：原文只有表格元数据、`## 风格提示词` 一节是空的（K22 只有 5 个字），照抄进草稿
  会在末尾留下空段落与连续空行。草稿因此只给「任务说明（带卡片 ID 与名称）+ 主题」，不在空卡上
  内联公共函数；详情页仍展示原文全文。
- **应用（#25 起）**：先解析当前/最近工作区，再用 `uiWorkspace.openWorkspace(workspaceId, beforeOpen)`
  打开新会话，在 beforeOpen 里用 `conversation.input.requestDraftInitialization(binding, options)`
  预填草稿，**不自动发送**；成功后浮层关闭并出现轻提示「已带入草稿，可编辑后发送」。
  - **空白会话已有草稿**（拍板：先确认再覆盖）：第一次用 `whenDraftExists: "keep"` 探测——宿主回
    preserved 说明那份草稿还在，就中止本次打开（会话不切走），详情里出现「覆盖并应用 / 取消」确认条；
    用户确认后再以 `"replace"` 走一次。不静默覆盖、不丢用户已输入的字。
  - **失败面**：`openWorkspace` 的 Promise 在创建失败或 beforeOpen 抛错时 reject，详情里显示可读错误、
    浮层保持打开，原地点「应用」即可重试（重试成功才关浮层 + 轻提示）。
  - **降级**：sessions / workspaces / conversation 三个服务面读不到时，退回 #22 验证过的
    `startSession(undefined, { prompt, whenDraftExists: "append" })`：空白草稿为空时等价于覆盖，
    非空时追加、绝不静默丢字；这一路拿不到失败/冲突面（宿主自己弹 notice）。
- **外部 bundle 的 uiWorkspace 注入**：客户端插件上下文用 ctx.get('uiWorkspace') 做可选查找；
  2026-10-31 真机实测通过（#22）：用户点「应用」后新会话 `session-e78b5fc9-…` 落在当前工作区、
  session 日志 0 turn（草稿未自动发送）。#25 的 sessions / workspaces / conversation 访问、
  beforeOpen 预填草稿与草稿覆盖确认也已由 #25 真机冒烟复核通过（覆盖确认 / 取消 / 覆盖后替换、空卡应用）。

## 缩略图与缺图占位（#24）

- **资产路由（宿主半边）**：`plugin/src/host/index.ts` 通过 `dsh-host-webserver` 注册 `prefix` 路由 `style-cards`，
  从资产目录 `assets/stills/`（v1 link 安装时 = 仓库根，`lib/../..`）读扁平 `<id>.jpg` 流给浏览器；客户端用同源相对 URL `style-cards/stills/<id>.jpg`。
  只服务 `stills/` 前缀，`styles/`、`LICENSES/` 不暴露；拒绝目录穿越（原样 / 编码 / 反斜杠 / 空字节）；
  响应带 `Cache-Control: public, max-age=31536000, immutable` 与 `X-Content-Type-Options: nosniff`。
- **客户端**：`StillImage`（`plugin/src/client/still.ts`）用 `loading="lazy"` / `decoding="async"`，加载失败只把
  **这一张**退化为系列色块 + ID；卡片缩略图与详情大图共用同一个媒体槽与同一套系列色变量（`--dsc-series-a/b`），
  详情大图失败时也在原位退化为 ID 占位，不出现空框。两者用同一个 `stillUrl()` 来源，不出现两张不同版本。
- **路径前提**：v1 用 link 安装，`lib/../..` 即仓库根，所以宿主半边能读到 `<repo>/assets/stills`；**这不是「包内的 assets」**
  （`plugin/package.json` 的 `files` 不含 assets）。将来打包分发必须把 `assets/stills` 拷进包内（见 ADR-0002 的后果）——
  **本票（#26）不做**，留给真正要分发的那次工作。
- **实测（2026-10-31）**：宿主半边重组合后，浏览器同源 GET `style-cards/stills/A1.jpg` → 200 `image/jpeg`、
  148,625 B、与本地 `assets/stills/A1.jpg` sha256 一致；`stills/../LICENSES/LICENSE` → 404、
  编码穿越 `%2e%2e%2f` → 403、`styles/A1.md` → 404、HEAD → 200。

## 无屏验证

`/plugins/events` 不需要认证，可以直接读运行中的客户端模块图：

```powershell
# 判据：条目 PRESENT 且 bundle 返回 200 = 宿主已装载；页面里的视觉仍要人看一眼
node scripts/verify-client-module.mjs dsh-style-cards
```

资产路由可以直接同源探针（不需要浏览器 cookie；`/plugins/*` 与静态资产是公开的）：

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

# 启用：删掉上面两行（宿主会在约 1 秒内重组合）

# 卸载（依赖与 bundles 项一起移除）
& 'D:\software\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd' plugin --profile desktop remove 'dsh-style-cards'
```

实测（2026-10-31）：禁用 → 客户端模块图回落到 82 条且本插件 ABSENT、资产路由 404；启用 → 83 条且 PRESENT、路由 200；
卸载 → 82 条 / ABSENT / 404。整轮无重启。**已知边界**：Windows 上宿主打开着 bundle 时，`plugin remove` 可能留下
`profile/node_modules/dsh-style-cards` 的 junction（依赖与 bundles 项已移除、入口已消失）；重装会覆盖它，需要时也可手删。

## 测试

`plugin/test/` 十六个文件（#26 后）：

- `asset-index.test.ts` — 四类真实样本的索引读取（A1 代码样片、L4 11 节英文规约、H10 一句话、M14 空卡）；
- `catalog-data.test.ts` — 与 `assets/index.json` 完全一致、341 张 / 10 系列 / 193 张带静帧 / 9 张空卡、字段与许可分档，以及 341 份内置原文与
  `assets/styles/*.md` 逐字节对比；
- `licenses.test.ts`（#26）— 包 license 字段指向 `LICENSE.md`、许可说明覆盖三档、`assets/LICENSES/` 随附四类许可文件、
  `assets/SOURCES.md` 341 行与索引逐条一致；
- `card-wall.test.ts` — jsdom 里渲染 341 张卡、默认展开、10 个组头可折叠、组内数值序、空卡兜底文案、首帧基线写进 window、
  搜索/筛选、空态与缩略图占位各自只占内容区一个位置；
- `render-baseline.test.ts` — 首帧基线的记录点；
- `overlay-state.test.ts` — 浮层开/关状态机（入口点按切换、关闭按钮 / 点遮罩 / ESC 关闭、关着时 ESC 无事发生、关掉还能再开）；
- `client-bundle.test.ts` — 构建产物方言、`apply` 模拟宿主上下文、内置数据与「不读盘 / 不联网」；
- `package-manifest.test.ts` — `dsh.bundle.patch` / `dsh.client` / 展示元数据 / 图标齐全；
- `compose-draft.test.ts` — 草稿文本 golden：空/有主题、路径形状、原文逐字、代码样片内联公共函数并删掉「同一文件夹」那句、
  块间只留一个空行、9 张空卡只有任务说明与主题（全量 341 张无三连换行）；
- `attribution.test.ts` — 三档许可署名（free-share-no-sell © 俯仰观照；MIT 的 L/V/X 各自版权人；逐条来源）；
- `apply-session.test.ts` — 适配器：openWorkspace + beforeOpen 用 keep 探测草稿、preserved → draft-exists、
  确认后 replace、宿主拒绝/SessionCreateError/workspace 缺失 → 可读错误、服务缺席 → 退回 startSession(append)；
- `panel.test.ts` — jsdom：点卡片进详情、返回恢复滚动位置、应用草稿含主题/公共函数、空卡应用、
  失败时错误留在详情里且重试成功、草稿冲突先确认再覆盖、在途禁用防重复提交；
- `search.test.ts` — 二元组粗筛 + BM25 的纯函数用例（#23）；
- `stills-route.test.ts` — 宿主 prefix 路由：解析（含编码/反斜杠/空字节穿越）与真实 HTTP（200 / 404 / 405 / HEAD / 长缓存）；
- `still-url.test.ts` — 纯函数：stillPath → 同源 URL、hasStill（node 环境）；
- `still.test.ts` — jsdom：懒加载 img、无图与加载失败退化、详情大图同源。

浮层的真实视觉、真实会话创建按规格留给手工冒烟（规格 #19 的 Testing Decisions）；
#22 的端到端路径、#24 的缩略图与 #25/#26 的装/卸/禁用已真机冒烟或探针取证。
