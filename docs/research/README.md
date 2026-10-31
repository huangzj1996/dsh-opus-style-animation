# 研究笔记（2026-10-30 / 10-31）

这些是 `/research` 产出的**原始笔记**，按主题记录当时查到的事实与结论。**它们不是当前实现的说明书**：
2026-10-31 的二次重锚把 v1 从「`/anim` 装配指令 + 面板播放器」改成「侧栏卡片启动器 → 新会话带原文」，
一部分路线已退场（见 [`docs/adr/0001-carry-style-source-not-compiled.md`](../adr/0001-carry-style-source-not-compiled.md)）。
当前实现以仓库 [README](../../README.md) 与 `docs/adr/` 为准；各文件顶部也有一行历史提示。

| 文件 | 记了什么 | 对 v1 的状态 |
|---|---|---|
| [`dsh-plugin-architecture.md`](dsh-plugin-architecture.md) | DSH 插件形态、named slots、Fetch 路由、热更 | **仍有效**（#20 落地） |
| [`dsh-new-session-and-sidebar-entry.md`](dsh-new-session-and-sidebar-entry.md) | 新会话创建/导航/草稿预填 API、侧栏入口座位 | **仍有效**（#22/#25 落地；最终链路见规格 #19） |
| [`catalog-search-baseline.md`](catalog-search-baseline.md) | 341 条 catalog 的检索基线与 BM25 实测 | **仍有效**（#23 落地） |
| [`assets-and-licensing.md`](assets-and-licensing.md) | 素材结构、三档许可、分发风险 | **部分有效**：许可结论有效；运行期 raw 直取被 [ADR-0002](../adr/0002-local-assets-and-host-route.md) 取代 |
| [`dsh-panel-rendering.md`](dsh-panel-rendering.md) | 面板里渲染动画的沙箱与取像素路径 | 随播放器退场，**历史** |
| [`composer-takeover.md`](composer-takeover.md) | `/anim` 前缀与 composer 接管 | `/anim` 已退场，**历史** |
| [`opus55-quality-gap.md`](opus55-quality-gap.md) | B6 对照与质量差距、可强制规则 | 随闸门退场，**历史**（B6 校准夹具背景） |
| [`leaferjs-fit.md`](leaferjs-fit.md) | LeaferJS 等第三方渲染引擎评估 | 结论「默认不用」仍成立，**历史** |
| [`style-constants-extraction.md`](style-constants-extraction.md) | 风格常量抽取 | 随指令装配退场，**历史** |
