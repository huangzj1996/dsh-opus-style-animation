# dsh-opus-style-animation

把 341 份预置的「代码动画风格」做成 DSH 左侧栏底部的 **Opus 片场** 入口：点开挑一张风格卡片，就在新会话里按那种风格开工。

状态：施工中。规格 [#19](https://github.com/huangzj1996/dsh-opus-style-animation/issues/19)，实施票 #20（插件壳）/ #21（卡片墙）/ #22（详情 + 应用）。
当前已交付 **#20 插件壳**：侧栏底部一行「Opus 片场」+ 空浮层（遮罩 / 关闭按钮 / ESC），当前会话不被打断。

## 仓库结构

| 路径 | 是什么 |
|---|---|
| `plugin/` | DSH 客户端插件包 `dsh-style-cards`（宿主半边 no-op + 浏览器半边） |
| `docs/` | 研究、ADR、agent 文档；插件契约与开发循环见 [`docs/dev/plugin.md`](docs/dev/plugin.md) |
| `code-animation-341-styles-main/` | 上游 341 份风格原文（#21 的构建期数据源） |
| `animations/` | 手工生成的动画产物 |

插件本身是**一个 npm 包**：`package.json` 声明 `dsh.bundle.patch`（Loader 行）与 `dsh.client`（浏览器半边），
`lib/client.js` 是 `window.__ModuleLoader__.load({ id, factory(require) })` 方言的 classic script。

## 开发

需要 Node 22+ 与 pnpm 11（本机 pnpm 不在 PATH 时用 DSH 自带的那份，见 [`docs/dev/plugin.md`](docs/dev/plugin.md)）。

```powershell
pnpm install        # 根目录一次装齐（workspace: plugin/）
pnpm test           # 先构建，再跑 vitest（状态机 / 构建产物方言 / 包清单）
pnpm typecheck      # tsc --noEmit
pnpm build          # lib/client.js + lib/index.js
```

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

## 无屏验证

`/plugins/events` 不需要认证，可以直接读运行中的客户端模块图：

```powershell
# 判据：条目 PRESENT 且 bundle 返回 200 = 宿主已装载；页面里的视觉仍要人看一眼
node scripts/verify-client-module.mjs dsh-style-cards
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

`plugin/test/` 三个文件 14 条：

- `overlay-state.test.ts` — 浮层开/关状态机（入口点按切换、关闭按钮 / 点遮罩 / ESC 关闭、关着时 ESC 无事发生、关掉还能再开）；
- `client-bundle.test.ts` — 构建产物的方言（`__ModuleLoader__.load` + 包名 id + `{ inject, apply }`），以及 `apply` 模拟宿主上下文不抛、两条登记交给对的 slot；
- `package-manifest.test.ts` — `dsh.bundle.patch` / `dsh.client` / 展示元数据 / 图标齐全。

视觉、缩略图加载、真实会话创建按规格留给手工冒烟（规格 #19 的 Testing Decisions）。