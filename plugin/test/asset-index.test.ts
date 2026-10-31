import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ASSET_INDEX } from "../src/data/asset-index.generated";
import type { StyleAsset } from "../src/catalog/types";

// 索引读取的 seam：内置数据来自已提交的 assets/index.json，这里对四类真实样本逐字段断言，
// 并用 assets/styles/<id>.md 做独立参照（原文必须是整份 md，不是 `## 风格提示词` 段）。
const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const assetsRoot = path.join(repoRoot, "assets");

function byId(id: string): StyleAsset {
  const style = ASSET_INDEX.styles.find((item) => item.id === id);
  if (style === undefined) throw new Error("找不到卡片 " + id);
  return style;
}

function sourceMarkdown(id: string): string {
  return readFileSync(path.join(assetsRoot, "styles", id + ".md"), "utf8");
}

describe("风格资产索引（四类真实样本）", () => {
  it("带参考实现的代码样片：A1 字雨", () => {
    const style = byId("A1");
    expect(style.name).toBe("字雨");
    expect(style.series).toBe("AG");
    expect(style.subcategory).toBe("A 字");
    expect(style.keywords).toEqual(["字雨", "落下", "堆积"]);
    expect(style.license).toBe("free-share-no-sell");
    expect(style.payloadKind).toBe("code-sample");
    expect(style.hasSharedHelpers).toBe(true);
    expect(style.stillPath).toBe("stills/A1.jpg");
    expect(style.bytes.prompt).toBe(1980);
    expect(style.prompt).toBe(sourceMarkdown("A1"));
    expect(style.prompt).toContain("S.A1 =");
    expect(style.prompt).toContain("```js");
  });

  it("11 节英文规约：L4 延时摄影交响（MIT 系列）", () => {
    const style = byId("L4");
    expect(style.name).toBe("延时摄影交响（Time-lapse Symphony）");
    expect(style.series).toBe("L");
    expect(style.subcategory).toBe("剪辑与纪实");
    expect(style.license).toBe("MIT");
    expect(style.payloadKind).toBe("spec");
    expect(style.stillPath).toBe("stills/L4.jpg");
    expect(style.bytes.prompt).toBe(18786);
    expect(style.prompt).toBe(sourceMarkdown("L4"));
    // prompt 是整份 md，所以 11 节规约必须一节不少地带着。
    const headings = style.prompt.match(/^## \d+\./gm) ?? [];
    expect(headings).toHaveLength(11);
    expect(style.prompt).toContain("## 1. Essence, and what it is not");
    expect(style.prompt).toContain("## 11. Variation space");
  });

  it("「一句话」风格：H10 Creative Mode", () => {
    const style = byId("H10");
    expect(style.name).toBe("Creative Mode");
    expect(style.series).toBe("H");
    expect(style.subcategory).toBe("现成版式");
    expect(style.keywords).toEqual([]);
    expect(style.license).toBe("free-share-no-sell");
    expect(style.payloadKind).toBe("short");
    expect(style.stillPath).toBeNull();
    expect(style.bytes.prompt).toBe(203);
    expect(style.prompt).toBe(sourceMarkdown("H10"));
    expect(style.prompt).toContain("奶油底，饱和糖果色，Archivo Black 大字");
  });

  it("空卡：M14 没有名字、提示词段为空；9 张空卡都在", () => {
    const style = byId("M14");
    expect(style.name).toBe("");
    expect(style.series).toBe("M");
    expect(style.subcategory).toBe("其他特别的风格");
    expect(style.keywords).toEqual([]);
    expect(style.license).toBe("free-share-no-sell");
    expect(style.payloadKind).toBe("empty");
    expect(style.stillPath).toBeNull();
    expect(style.bytes.prompt).toBe(81);
    expect(style.prompt).toBe(sourceMarkdown("M14"));
    const afterPromptHeading = style.prompt.slice(style.prompt.indexOf("## 风格提示词") + "## 风格提示词".length);
    expect(afterPromptHeading.trim()).toBe("");

    const empty = ASSET_INDEX.styles.filter((item) => item.payloadKind === "empty").map((item) => item.id);
    expect(empty).toEqual(["M14", "M15", "M16", "M17", "M26", "M35", "M39", "M40", "K22"]);
    // 第 9 张不是「没名字」，而是提示词很短（≤5 字符）——索引把它归进空卡（字段 emptyPayload），卡片墙一视同仁。
    expect(byId("K22").name).toBe("折纸");
  });
});