# 插件开发与安装（dsh-style-cards）

这份文档记录两件事：第三方客户端插件在 DSH 里的**契约**（怎么写才生效），以及本机把插件**装进 profile、热更、验证、禁用/卸载**的确切命令。命令于 2026-10-31 在 DSH Desktop 0.2.1-rc.5 上实测。

## 1. 插件包形态

一个 npm 包，两半：

| 文件 | 作用 |
|---|---|
| `package.json` `dsh.bundle.patch` → `cordis.patch.yml` | 往 Loader 里插一行（没有这一行，客户端半边不会装载） |
| `package.json` `dsh.client` = `{ platform: "web", immediately: true, inject: [] }` + `exports["./client"]` | 告诉宿主这是一个浏览器插件、bundle 在哪 |
| `lib/index.js` | 宿主半边：`export default { name, apply() {} }`，可为空实现 |
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

样式：静态 bundle 没有 `styles.insert`，自己 `document.createElement('style')` + `data-plugin` 属性，在 `ctx.effect` 里返回移除函数。颜色只用主题令牌（`--dsw-alias-*`、`--dsw-radius-*`、`--dsw-elevation-*`）。

## 2. 装进本机 profile

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
client 模块图：entries 82 -> 83，dsh-style-cards PRESENT rev=491e08b15e6a
bundle 取回：HTTP 200 / 10916 B，含 __ModuleLoader__ 标记与 dsh-style-cards.overlay
```

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

## 6. 测试

```powershell
pnpm --dir plugin typecheck   # tsc --noEmit
pnpm --dir plugin test        # 先构建，再 vitest run
```

三条 seam：纯状态机（`src/client/overlay-state.ts`）、构建产物方言与 `apply` 行为（`test/client-bundle.test.ts`）、包清单（`test/package-manifest.test.ts`）。

## 7. 已知边界

- 浮层在 `overlayLayer`（`z-index:20`）这个层叠上下文里，压不过宿主的 settings 全屏层（`z-index:1000`）；实际使用中碰不到。
- `shell.overlay` 条目没有 owner props，也就拿不到宿主 locale；当前文案「风格卡片」是写死的中文（v1 中文界面，符合规格）。
- 图标没有可复用的宿主图标包（禁止 import `client-ui-primitives`），全部用内联 SVG。
- 第三方 bundle 无法读到宿主页面 console，视觉回归只能靠人眼或将来加一条宿主路由做 beacon。