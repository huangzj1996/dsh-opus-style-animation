/**
 * 卡片墙的数据形状：与已提交的 `assets/index.json` 逐字段对应。
 *
 * 单一真相是 `assets/index.json`（由 `scripts/build-assets.mjs` 从素材包确定性生成，内联 341 份 md 原文）。
 * 插件构建期只做「JSON → TS 模块」的序列化，不再自己解析 md；运行期拿到的是打包进 bundle 的常量，
 * 不读文件系统、不联网。
 */

/** 许可：MIT（L / V / X 三个第三方系列）或合集自述的 free-share-no-sell（其余七个系列）。 */
export type LicenseId = "MIT" | "free-share-no-sell";

/** 提示词类型：带参考实现的代码样片 / 11 节规约 / 一句话 / 空卡（索引字段 payloadKind = empty；提示词 ≤ 5 字符）。 */
export type PayloadKind = "code-sample" | "spec" | "short" | "empty";

/** 一条风格资产（`assets/index.json` 的 `styles[]`）。 */
export interface StyleAsset {
  /** 编号：A1 / M10 / O98 …… */
  readonly id: string;
  /** 风格名；9 张空卡没有名字，这里是空串。 */
  readonly name: string;
  /** 系列 key：AG / M / K / Z / H / L / V / X / R / O。 */
  readonly series: string;
  /** 素材包里的系列目录名。 */
  readonly seriesDir: string;
  /** 系列展示名，例如 `A–G 代码样片`。 */
  readonly category: string;
  /** 子类，例如 `A 字`。 */
  readonly subcategory: string;
  /** 适合什么内容（一句话）。 */
  readonly fit: string;
  /** 关键词。 */
  readonly keywords: readonly string[];
  /** 许可档位。 */
  readonly license: LicenseId;
  /** 素材包内相对路径（来源）。 */
  readonly source: string;
  /** 提示词类型。 */
  readonly payloadKind: PayloadKind;
  /** 是否引用同目录的 `_公共函数.js`（代码样片）。 */
  readonly hasSharedHelpers: boolean;
  /** md 原文，逐字保留——不是 `## 风格提示词` 段。 */
  readonly prompt: string;
  /** 资产目录内 md 路径，例如 `styles/A1.md`。 */
  readonly promptPath: string;
  /** 资产目录内静帧路径，例如 `stills/A1.jpg`（v1 = 仓库根 assets/）；没有静帧时为 null。 */
  readonly stillPath: string | null;
  /** 原文与静帧的字节数。 */
  readonly bytes: { readonly prompt: number; readonly still: number };
  /** 原文与静帧的 sha256；没有静帧时 still 为 null。 */
  readonly sha256: { readonly prompt: string; readonly still: string | null };
}

/** 一个系列（`assets/index.json` 的 `series[]`）。 */
export interface SeriesAsset {
  /** 系列 key，与卡片上的 `series` 对应。 */
  readonly key: string;
  /** 素材包目录名。 */
  readonly dir: string;
  /** 展示名。 */
  readonly label: string;
  /** 本系列卡片数。 */
  readonly count: number;
  /** 本系列带静帧的卡片数。 */
  readonly stills: number;
}

/** 索引的来源信息。 */
export interface AssetIndexSource {
  /** 上游仓库（owner/repo）。 */
  readonly repo: string;
  /** 上游 tree 短哈希。 */
  readonly tree: string;
  /** 素材包目录名。 */
  readonly pack: string;
  /** 随包的许可文件（相对 `assets/`）。 */
  readonly licenseFiles: readonly string[];
}

/** 索引里的分类计数。 */
export interface AssetIndexCounts {
  readonly styles: number;
  readonly stills: number;
  readonly emptyPayload: number;
  readonly withReferenceImpl: number;
  readonly codeSample: number;
  readonly spec: number;
  readonly short: number;
  readonly mit: number;
  readonly freeShareNoSell: number;
}

/** 构建期序列化、运行期内置的整份风格资产索引。 */
export interface StyleAssetIndex {
  readonly version: number;
  readonly source: AssetIndexSource;
  readonly counts: AssetIndexCounts;
  readonly series: readonly SeriesAsset[];
  /** 341 条风格，顺序即发布顺序（系列顺序 + 组内 ID 数值序）。 */
  readonly styles: readonly StyleAsset[];
}

/** 卡片墙按系列分组后的视图。 */
export interface SeriesGroup {
  readonly series: SeriesAsset;
  readonly styles: readonly StyleAsset[];
}