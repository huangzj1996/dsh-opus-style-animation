# 风格资产本地化：内置 `assets/`，缩略图走宿主路由

**Status**: accepted (2026-10-31)

v1 的 341 份风格原文与 193 张缩略图随插件包内置在 `assets/`，由 `scripts/build-assets.mjs` 从随仓的 `code-animation-341-styles-main/` 确定性生成；`assets/index.json` 内联每份 **md 原文**（不是装配后的指令）、元数据、许可与缩略图相对路径，作为客户端唯一数据源。风格原文随客户端 chunk 动态加载，**缩略图不塞进 bundle**：插件包带一个 host half，用 `dsh-host-webserver` 的 `prefix` 路由（`style-cards`）从资产目录 `assets/stills/`（v1 link 安装 = 仓库根；不是 npm 包内的 assets）读文件流，客户端用同源相对 URL（`style-cards/stills/<id>.jpg`）。**#24 已按此落地并实测**。

## 为什么

- 离线可用、版本固定：不再依赖 `raw.githubusercontent.com`，插件版本即资产版本。
- 12.2 MB 的图片不可能进 client bundle；宿主路由是 DSH 自己给插件留的静态服务位（`webServer.register({ kind: 'prefix', path, handler })`，命名路由不会被 SPA 兜底抢走）。
- 风格原文只有 1.40 MB 且是**关键正确性数据**，内联进客户端、按需加载：即使宿主路由不可用（Electron `file://` 模式），卡片墙、详情、应用仍然完整可用，只是缩略图全部退化成占位。

## 考虑过的替代

- **缩略图继续走上游 raw**：零宿主代码，但离线不可用、上游改动会漂移。
- **缩略图转 data URI / 生成小图塞 bundle**：即使压到 480 px webp 仍是 2–4 MB 的启动负担，且要做图像管线。
- **`assets/` 只生不提交（gitignore）**：仓库更小，但 clone 后不能直接构建；v1 只本机自用，提交更省事，代价是公开仓库构成对第三方素材的再分发——需要 `LICENSES/` 随附并在 README 说明。

## 后果

- 插件包与仓库增加约 15.2 MB（`assets/`：1.57 MB 索引 + 341 md + 193 jpg + 许可）。
- 缩略图依赖 host half；Electron 模式下退化为占位，功能不受影响。
- **#24 实现补充（2026-10-31）**：宿主半边从 `<包根>/../assets/stills` 读文件（v1 用 link 安装，`lib/../..` 即仓库根）。
  只服务 `stills/` 前缀的扁平 `<id>.jpg`，拒绝目录穿越（原样 / 编码 / 反斜杠 / 空字节）；响应带
  `public, max-age=31536000, immutable`。**将来打包分发**必须把 `assets/stills` 拷进包内，或在 `pnpm build` 里做 —— v1 不做，留给 #26。
- `assets/` 是生成物，手改会被 `node scripts/build-assets.mjs --check` 判为漂移；改素材必须先改素材包再重生成。
- 应用 A–G 的代码样片卡片时，草稿附上 `_公共函数.js` 全文（md 里「同一文件夹」的引用在用户工作区里没有落点）。
  **2026-10-31 补充（用户冒烟后拍板）**：既然全文已内联，草稿里要删掉原文那句「公共的小工具函数在同一文件夹的 _公共函数.js 里。」，
  改由草稿说明「公共函数已添加在下方」。其他卡片的原文仍逐字保留。
- **源包保留策略（B 档瘦身，2026-10-31）**：`code-animation-341-styles-main/` 从 74.6 MB 降到 **13.7 MB**——删掉 `示例/**/*.mp4`（59.8 MB）、`示例/**/*.png`（0.6 MB）与 `风格挑选.html`（0.48 MB），保留 `风格提示词/`（生成器唯一输入）、`示例/` 里的 html/svg/md（B6、X7 夹具本体，约 90 KB）与根许可原件。整个包加入 `.gitignore`，不入库；`assets/` 仍是唯一已提交的分发内容。
- **`--check` 的边界**：包在场时 `node scripts/build-assets.mjs --check` 是权威判据；包被删掉后该命令会报错——这是有意的，宁可失败也不静默通过。新克隆只带 `assets/`，因此校验必须跑在保留着包的机器上。