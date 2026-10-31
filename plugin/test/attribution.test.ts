import { describe, expect, it } from "vitest";
import { ASSET_INDEX } from "../src/data/asset-index.generated";
import type { StyleAsset } from "../src/catalog/types";
import { styleAttribution } from "../src/client/attribution";

// 许可署名的 seam：详情页三档署名的唯一来源。数据只取索引里的 license / series / source，
// 文案是给用户看的，逐字钉住（#12 的标注：MIT 105 / free-share-no-sell © 俯仰观照 236 / 逐条来源）。
const byId = (id: string): StyleAsset => {
  const style = ASSET_INDEX.styles.find((item) => item.id === id);
  if (style === undefined) throw new Error("找不到卡片 " + id);
  return style;
};

describe("styleAttribution", () => {
  it("free-share-no-sell：© 俯仰观照，免费分享、禁止售卖", () => {
    const attribution = styleAttribution(byId("A1"));
    expect(attribution.badge).toBe("free-share-no-sell");
    expect(attribution.copyright).toContain("俯仰观照");
    expect(attribution.note).toContain("不得");
    expect(attribution.note).toContain("售卖");
    expect(attribution.source).toBe("风格提示词/A-G_代码样片/A1_字雨.md");
  });

  it("MIT 三个系列的版权人各自正确（L / V / X）", () => {
    expect(styleAttribution(byId("L4")).badge).toBe("MIT");
    expect(styleAttribution(byId("L4")).copyright).toContain("LemoLab");
    expect(styleAttribution(byId("V1")).copyright).toContain("Vincentwei1021");
    expect(styleAttribution(byId("X1")).copyright).toContain("Bae-ChangHyun");
    expect(styleAttribution(byId("L4")).note).toContain("MIT");
  });

  it("来源始终指回素材包里的那一份 md", () => {
    for (const id of ["A1", "L4", "V1", "X1", "M14"]) {
      const style = byId(id);
      expect(styleAttribution(style).source).toBe(style.source);
    }
  });
});
