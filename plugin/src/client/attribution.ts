/**
 * 详情页的许可署名。纯函数：只把索引里的 license / series / source 翻成给用户看的文案。
 *
 * 三档标注来自决议 #12：MIT 105 条（L / V / X，各有自己的版权人）+
 * free-share-no-sell 236 条（© 俯仰观照，免费分享、禁止售卖）+ 逐条 source。
 * 不虚构许可：这里只显示索引里已有的值，不把 free-share-no-sell 说成 MIT。
 */
import type { LicenseId, StyleAsset } from "../catalog/types";

export interface StyleAttribution {
  /** 徽标上逐字显示的许可值：MIT / free-share-no-sell。 */
  readonly badge: LicenseId;
  /** 许可的一句话结论。 */
  readonly note: string;
  /** 版权人。 */
  readonly copyright: string;
  /** 逐条来源（素材包内相对路径）。 */
  readonly source: string;
}

/**
 * MIT 三个系列各自的版权人（权威来源是 assets/LICENSES/NOTICE.md）。
 * 索引里的 license/series 是数据；版权人姓名是三条固定的上游署名，不随样式数据变化，
 * 因此留在这里而不是进索引；新增 MIT 系列会被 attribution.test 的「每个 MIT 系列都有署名」兜住。
 */
const MIT_COPYRIGHT: Readonly<Record<string, string>> = {
  L: "Copyright (c) 2026 LemoLab",
  V: "Copyright (c) 2026 Vincentwei1021",
  X: "Copyright (c) 2026 Bae-ChangHyun",
};

/** 把一条风格资产翻成详情页的署名三行 + 徽标。 */
export function styleAttribution(style: Pick<StyleAsset, "license" | "series" | "source">): StyleAttribution {
  if (style.license === "MIT") {
    return {
      badge: "MIT",
      note: "MIT 许可：可商用、可修改、可再分发，保留版权与许可声明即可。",
      copyright: MIT_COPYRIGHT[style.series] ?? "版权人见 assets/LICENSES/第三方许可/",
      source: style.source,
    };
  }
  return {
    badge: "free-share-no-sell",
    note: "免费使用、免费转发；不得包装成课程、付费 skills 或任何收费产品售卖。",
    copyright: "© 俯仰观照（动画画风整理）",
    source: style.source,
  };
}