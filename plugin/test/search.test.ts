import { describe, expect, it } from "vitest";
import { buildStyleSearchIndex, filterStyles } from "../src/catalog/search";
import { ASSET_INDEX } from "../src/data/asset-index.generated";

// 检索 seam：只测纯函数的可观察行为——给定 query 与 series，返回哪些卡片 id、什么顺序。
// 不断言 BM25 的中间分数（词频 / IDF / 字段权重都是实现细节），但排序结果本身是验收判据，
// 所以 query / series / 空 query / 无结果 四类都锁定完整的有序 id 序列（回归契约，不是实现快照）。
const SEARCH = buildStyleSearchIndex(ASSET_INDEX);

/** 独立于实现的期望顺序：系列顺序（索引里的 series[]）+ 组内 ID 数字序。 */
function expectedWallOrder(): string[] {
  const order = (a: string, b: string): number => {
    const left = /^([A-Za-z]*)(\d+)$/.exec(a);
    const right = /^([A-Za-z]*)(\d+)$/.exec(b);
    if (left === null || right === null) return a < b ? -1 : a > b ? 1 : 0;
    if (left[1] !== right[1]) return (left[1] ?? "") < (right[1] ?? "") ? -1 : 1;
    return Number(left[2]) - Number(right[2]);
  };
  return ASSET_INDEX.series.flatMap((series) =>
    ASSET_INDEX.styles
      .filter((style) => style.series === series.key)
      .map((style) => style.id)
      .sort(order),
  );
}

const idsOf = (styles: readonly { id: string }[]): string[] => styles.map((style) => style.id);

describe("目录检索", () => {
  it("空 query、无系列筛选：返回全量 341 张，按系列序与组内 ID 数字序", () => {
    const ids = idsOf(filterStyles(SEARCH, { query: "", series: null }));
    expect(ids).toHaveLength(341);
    expect(ids).toEqual(expectedWallOrder());
    expect(ids[0]).toBe("A1");
    expect(ids.indexOf("O9")).toBeLessThan(ids.indexOf("O10"));
  });

  it("只选系列、空 query：只剩该系列，顺序仍是组内 ID 数字序", () => {
    expect(idsOf(filterStyles(SEARCH, { query: "", series: "Z" }))).toEqual([
      "Z1", "Z2", "Z3", "Z4", "Z5", "Z6", "Z7", "Z8", "Z9", "Z10",
      "Z11", "Z12", "Z13", "Z14", "Z15",
    ]);
    expect(idsOf(filterStyles(SEARCH, { query: "", series: "NOPE" }))).toEqual([]);
  });

  it("中文关键词：字符二元组召回 + BM25 重排，能命中 raw substring 漏掉的查询", () => {
    // 前提：带空格的整串在目录里不存在，raw substring 一条都搜不到。
    const haystack = ASSET_INDEX.styles
      .map((style) => style.name + style.fit + style.keywords.join(" "))
      .join("\n");
    expect(haystack).not.toContain("水墨 山水");

    // C1 / Z1 / Z13 / L19 / R6 命中「水墨」，Z4 命中「山水」；按 BM25 分数降序、同分按墙顺序。
    expect(idsOf(filterStyles(SEARCH, { query: "水墨 山水", series: null }))).toEqual([
      "C1", "Z1", "Z13", "Z4", "L19", "R6",
    ]);

    // A1「字雨」= 字 + 雨；D1「雨窗」命中单字「雨」；M3「文字建筑」命中「文字」。
    expect(idsOf(filterStyles(SEARCH, { query: "文字 雨", series: null }))).toEqual([
      "A1", "D1", "M3", "R1", "M10", "L33", "R5", "L18", "L36", "L20", "L46", "O61", "O65",
    ]);
  });

  it("「霓虹 赛博」：同时命中两个词的卡排最前，结果按 BM25 分数降序", () => {
    const ids = idsOf(filterStyles(SEARCH, { query: "霓虹 赛博", series: null }));
    expect(ids).toEqual([
      "K34", "V8", "R6", "X12", "L46", "R5", "O97", "V12", "R1", "R7", "O61", "O78", "O75",
    ]);
    // K34「赛博霓虹」是唯一同时含两个词的卡，排第一；V8 / R1 / R7 是单侧相关的代表。
    expect(ids[0]).toBe("K34");
    expect(new Set(ids.slice(0, 10))).toContain("V8");
    expect(ids).toContain("R1");
    expect(ids).toContain("R7");
  });

  it("关键词与系列叠加：先检索再按系列过滤，顺序沿用检索结果", () => {
    expect(idsOf(filterStyles(SEARCH, { query: "水墨", series: "Z" }))).toEqual(["Z1", "Z13"]);
    expect(idsOf(filterStyles(SEARCH, { query: "霓虹", series: "R" }))).toEqual(["R1", "R7", "R6"]);
    expect(idsOf(filterStyles(SEARCH, { query: "", series: "R" }))).toHaveLength(7);
  });

  it("纯标点或空白按空 query 处理：与检索、摘要共用同一个「有没有词」判定", () => {
    expect(idsOf(filterStyles(SEARCH, { query: "，。 ！", series: null }))).toEqual(expectedWallOrder());
  });

  it("无结果返回空数组；同输入同输出（确定性）", () => {
    expect(idsOf(filterStyles(SEARCH, { query: "zzzz不存在", series: null }))).toEqual([]);
    const first = idsOf(filterStyles(SEARCH, { query: "霓虹 赛博", series: null }));
    const second = idsOf(filterStyles(SEARCH, { query: "霓虹 赛博", series: null }));
    expect(second).toEqual(first);

    // 只打印不断言：341 条上线，单次查询的成本要远低于一帧（票里给的基线是 ~24 µs）。
    const startedAt = performance.now();
    for (let round = 0; round < 200; round += 1) {
      filterStyles(SEARCH, { query: "水墨 山水", series: null });
    }
    const perQueryUs = ((performance.now() - startedAt) / 200) * 1000;
    console.log("[perf] 341 条单次检索：" + perQueryUs.toFixed(1) + " µs");
  });
});
