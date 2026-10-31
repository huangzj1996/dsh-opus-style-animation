import { describe, expect, it } from "vitest";
import { ASSET_INDEX, SHARED_HELPERS } from "../src/data/asset-index.generated";
import type { StyleAsset } from "../src/catalog/types";
import { composeDraft } from "../src/client/compose-draft";

// composeDraft 的 seam：只断言「草稿文本长什么样」。上游是 assets/index.json 里的
// 逐字原文，下游只有 startSession——不碰 DOM、不碰会话。
// 时间由调用方注入，路径里的时间戳因此可 golden。
const byId = (id: string): StyleAsset => {
  const style = ASSET_INDEX.styles.find((item) => item.id === id);
  if (style === undefined) throw new Error("找不到卡片 " + id);
  return style;
};
const NOW = new Date(2026, 9, 31, 13, 15, 0); // 本地时间 2026-10-31 13:15:00

describe("composeDraft", () => {
  it("有主题的代码样片：一行任务说明 + 主题 + 原文逐字 + 公共函数全文", () => {
    const a1 = byId("A1");
    const draft = composeDraft(a1, "新年倒计时", { sharedHelpers: SHARED_HELPERS, now: NOW });

    // 路径形状：animations/<时间戳>-<ID>-<名称>/index.html
    expect(draft).toContain("animations/20261031-131500-A1-字雨/index.html");
    // 主题单独一行
    expect(draft).toContain("\n主题：新年倒计时\n");
    // 原文逐字（不是摘录、不是重排）
    expect(draft).toContain(a1.prompt);
    // 公共函数全文在末尾
    expect(draft).toContain("_公共函数.js");
    expect(draft.endsWith(SHARED_HELPERS)).toBe(true);
    // 块与块之间只有一个空行
    expect(draft.match(/\n{3,}/g) ?? []).toEqual([]);
  });

  it("空主题：不出现主题行，也不在块之间多出空行", () => {
    const a1 = byId("A1");
    const draft = composeDraft(a1, "   ", { sharedHelpers: SHARED_HELPERS, now: NOW });
    expect(draft).not.toContain("主题：");
    expect(draft).toContain(a1.prompt);
    expect(draft.endsWith(SHARED_HELPERS)).toBe(true);
    expect(draft.match(/\n{3,}/g) ?? []).toEqual([]);
  });

  it("路径形状：名称里的斜杠与空白压成连字符，空名兜底「未命名」", () => {
    const m18 = byId("M18");
    const draft = composeDraft(m18, "", { sharedHelpers: SHARED_HELPERS, now: NOW });
    expect(draft).toContain("animations/20261031-131500-M18-数学-科学讲解（3Blue1Brown-那种）/index.html");

    const m14 = byId("M14");
    const empty = composeDraft(m14, "", { sharedHelpers: SHARED_HELPERS, now: NOW });
    expect(empty).toContain("animations/20261031-131500-M14-未命名/index.html");
  });

  it("只有代码样片内联公共函数；11 节规约（L4，MIT）不带", () => {
    const l4 = byId("L4");
    const draft = composeDraft(l4, "讲一次日出", { sharedHelpers: SHARED_HELPERS, now: NOW });
    expect(draft).toContain(l4.prompt);
    expect(draft).not.toContain("_公共函数.js");
    expect(draft).not.toContain("rng / clamp / vgrad");
  });

  it("主题只占一行：换行与连续空白压成空格", () => {
    const h10 = byId("H10");
    const draft = composeDraft(h10, "  新年\n倒计时  ", { sharedHelpers: SHARED_HELPERS, now: NOW });
    expect(draft).toContain("\n主题：新年 倒计时\n");
    expect(draft).toContain(h10.prompt);
  });
});
