# dsh-style-cards 许可与署名

本包（`plugin/`，npm 包名 `dsh-style-cards`，界面名「Opus 片场」）是 **DSH 客户端插件**，v1 只装本机
profile、**免费分发、不设付费层**。它同时包含两类内容，许可不同，**不要用一句「MIT」概括整个包**：

## 一、插件代码 —— MIT

`src/`、`scripts/` 与构建产物 `lib/` 是本仓库自己写的代码，适用仓库根目录
[`LICENSE`](../LICENSE)（MIT，Copyright (c) 2026 huang）。

## 二、风格素材 —— 三档标注

插件运行期从仓库 `assets/` 读取素材，构建期把 341 份风格原文内联进 `lib/client.js`。它们的许可
随附在 [`assets/LICENSES/`](../assets/LICENSES/)，按卡片逐条标注：

| `license` 值 | 覆盖 | 依据 / 版权 |
|---|---|---|
| `MIT` | **105 条**（L 59 / V 15 / X 31） | Copyright (c) 2026 LemoLab / Vincentwei1021 / Bae-ChangHyun；三份 MIT 原文逐字随附 |
| `free-share-no-sell` | **236 条**（A–G / M / K / Z / H / R / O） | © wqb578 / 俯仰观照；素材包自定义**非商业**许可（[`assets/LICENSES/LICENSE`](../assets/LICENSES/LICENSE)）——可免费使用、修改、免费再分发，禁止包装成课程、付费 skills 或其他收费产品出售 |
| 逐条 `source` | 全部 341 条 | [`assets/SOURCES.md`](../assets/SOURCES.md) 每张卡片一行，指回素材包里的原始 `.md` |

来源标注（再分发时必须保留）：

> **来源：来自俯仰观照博主的动画画风整理**

注意：`assets/LICENSES/NOTICE.md` 与 `许可与来源.md` 是素材包原文，文中「本仓库 / 根目录的 `LICENSE`」指
**素材包**的自定义非商业许可（现位于 `assets/LICENSES/LICENSE`），不是本仓代码的 MIT `LICENSE`。

## 三、再分发约束

- 本包与 `assets/` **都不是 npm 发布物**：v1 只通过本地 `link:` 装进本机 profile（见仓库 README）。
- 仓库是公开的，`assets/` 提交进仓库本身**已构成对第三方素材的再分发**——因此整套
  `assets/LICENSES/`（自定义许可、`NOTICE.md`、`许可与来源.md` 与三份第三方 MIT 原文）与
  `assets/SOURCES.md` 必须随附，不得删除。
- 不得把 `free-share-no-sell` 的 236 条标注成 MIT，也不得把它们用于任何收费产品；L / V / X
  三个 MIT 系列单独分发时，保留各自的版权声明与 MIT 原文即可。
- 将来真要把插件打包分发给别人（含 npm、把 `assets/stills` 拷进包内），先按
  [#12](https://github.com/huangzj1996/dsh-opus-style-animation/issues/12) 的结论复核这三点：
  三份 MIT 是否逐字携带、合集是否被误标 MIT、是否混入付费层。
