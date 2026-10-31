import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareStyleIds, groupStyles } from "../src/catalog/groups";
import { ASSET_INDEX } from "../src/data/asset-index.generated";

// 构建期序列化的资产索引是这张票的交付物：341 张一张不漏、原文逐字一致、字段齐全、系列与许可对得上。
// 这里读已提交的 assets/styles/*.md 做独立参照，而不是拿索引自己的哈希自证。
const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const assetsRoot = path.join(repoRoot, "assets");
const rawIndex = JSON.parse(readFileSync(path.join(assetsRoot, "index.json"), "utf8")) as unknown;
const EXPECTED_SERIES = [
  { key: "AG", label: "A–G 代码样片", count: 26, stills: 26 },
  { key: "M", label: "M 动态风格", count: 40, stills: 1 },
  { key: "K", label: "K 卡通画风", count: 38, stills: 0 },
  { key: "Z", label: "Z 中国风", count: 15, stills: 1 },
  { key: "H", label: "H 现成版式", count: 12, stills: 1 },
  { key: "L", label: "L Lemo-Opuscar", count: 59, stills: 59 },
  { key: "V", label: "V mg-styles-15", count: 15, stills: 0 },
  { key: "X", label: "X code-video", count: 31, stills: 0 },
  { key: "R", label: "R 照参考学来的", count: 7, stills: 7 },
  { key: "O", label: "O 奥斯卡 98 部", count: 98, stills: 98 },
] as const;

describe("内置资产索引（构建期序列化）", () => {
  it("与 assets/index.json 完全一致（序列化保真）", () => {
    expect(ASSET_INDEX).toEqual(rawIndex);
  });

  it("341 张 / 10 个系列 / 193 张带静帧 / 9 张空卡（索引字段 emptyPayload）", () => {
    expect(ASSET_INDEX.version).toBe(1);
    expect(ASSET_INDEX.styles).toHaveLength(341);
    expect(ASSET_INDEX.series).toHaveLength(10);
    expect(ASSET_INDEX.counts).toMatchObject({
      styles: 341,
      stills: 193,
      emptyPayload: 9,
      withReferenceImpl: 25,
      codeSample: 25,
      spec: 59,
      short: 248,
      mit: 105,
      freeShareNoSell: 236,
    });
  });

  it("系列顺序、展示名、数量与静帧数一致", () => {
    expect(
      ASSET_INDEX.series.map((series) => ({
        key: series.key,
        label: series.label,
        count: series.count,
        stills: series.stills,
      })),
    ).toEqual(EXPECTED_SERIES);
    expect(ASSET_INDEX.series.reduce((sum, series) => sum + series.count, 0)).toBe(341);
  });

  it("341 份原文与 assets/styles/*.md 逐字节一致（含 A1 与最大文件 L8）", () => {
    const mismatches: string[] = [];
    for (const style of ASSET_INDEX.styles) {
      const source = readFileSync(path.join(assetsRoot, "styles", style.id + ".md"));
      const embedded = Buffer.from(style.prompt, "utf8");
      if (!source.equals(embedded)) {
        mismatches.push(style.id + "（源 " + source.length + " B / 内置 " + embedded.length + " B）");
      }
      expect(style.bytes.prompt).toBe(source.length);
      expect(style.sha256.prompt).toBe(createHash("sha256").update(source).digest("hex"));
    }
    expect(mismatches).toEqual([]);

    const byId = (id: string) => ASSET_INDEX.styles.find((style) => style.id === id);
    expect(Buffer.byteLength(byId("A1")!.prompt, "utf8")).toBe(1980);
    expect(Buffer.byteLength(byId("L8")!.prompt, "utf8")).toBe(20877);
    const largest = [...ASSET_INDEX.styles].sort(
      (left, right) => Buffer.byteLength(right.prompt, "utf8") - Buffer.byteLength(left.prompt, "utf8"),
    )[0];
    expect(largest?.id).toBe("L8");
  });

  it("索引字段齐全，来源指回素材包、静帧路径与索引一致", () => {
    for (const style of ASSET_INDEX.styles) {
      expect(style.id).toMatch(/^[A-Za-z]+\d+$/);
      expect(typeof style.name).toBe("string");
      expect(EXPECTED_SERIES.some((series) => series.key === style.series)).toBe(true);
      expect(typeof style.subcategory).toBe("string");
      expect(Array.isArray(style.keywords)).toBe(true);
      expect(typeof style.fit).toBe("string");
      expect(["MIT", "free-share-no-sell"]).toContain(style.license);
      expect(style.source.startsWith("风格提示词/")).toBe(true);
      expect(style.promptPath).toBe("styles/" + style.id + ".md");
      expect(style.prompt.startsWith("# " + style.id)).toBe(true);
      expect(style.prompt).toContain("\n## 风格提示词");
      if (style.stillPath === null) {
        expect(style.bytes.still).toBe(0);
        expect(style.sha256.still).toBeNull();
      } else {
        expect(style.stillPath).toBe("stills/" + style.id + ".jpg");
        expect(style.bytes.still).toBeGreaterThan(0);
        expect(style.sha256.still).toMatch(/^[0-9a-f]{64}$/);
      }
    }
  });

  it("许可分档：L / V / X 是 MIT（105 张），其余七个系列是 free-share-no-sell（236 张）", () => {
    const mitSeries = new Set(["L", "V", "X"]);
    for (const style of ASSET_INDEX.styles) {
      expect(style.license).toBe(mitSeries.has(style.series) ? "MIT" : "free-share-no-sell");
    }
    expect(ASSET_INDEX.counts.mit).toBe(105);
    expect(ASSET_INDEX.counts.freeShareNoSell).toBe(236);
  });

  it("分组：10 组、共 341 张、组内 ID 数值序", () => {
    const groups = groupStyles(ASSET_INDEX);
    expect(groups).toHaveLength(10);
    expect(groups.reduce((sum, group) => sum + group.styles.length, 0)).toBe(341);
    for (const group of groups) {
      const ids = group.styles.map((style) => style.id);
      expect(ids).toEqual([...ids].sort(compareStyleIds));
    }
    expect(compareStyleIds("L2", "L10")).toBeLessThan(0);
    expect(compareStyleIds("O9", "O10")).toBeLessThan(0);
    expect(compareStyleIds("A2", "B1")).toBeLessThan(0);
  });
});