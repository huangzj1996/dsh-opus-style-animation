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
// 内联公共函数后，原文里这句「在同一文件夹」是错的——用户 2026-10-31 拍板：删掉这句，
// 在草稿末尾说明公共函数已经附在下方。这里用字面量当预期，不 import 被测函数。
const HELPERS_SENTENCE = "公共的小工具函数在同一文件夹的 _公共函数.js 里。";

describe("composeDraft", () => {
  it("有主题的代码样片：一行任务说明 + 主题 + 原文逐字 + 公共函数全文", () => {
    const a1 = byId("A1");
    const draft = composeDraft(a1, "新年倒计时", { sharedHelpers: SHARED_HELPERS, now: NOW });

    // 路径形状：animations/<时间戳>-<ID>-<名称>/index.html
    expect(draft).toContain("animations/20261031-131500-A1-字雨/index.html");
    // 主题单独一行
    expect(draft).toContain("\n主题：新年倒计时\n");
    // 原文删掉「同一文件夹的 _公共函数.js」那句后逐字保留（不是摘录、不是重排）
    expect(draft).not.toContain(HELPERS_SENTENCE);
    expect(draft).toContain(a1.prompt.split(HELPERS_SENTENCE).join(""));
    // 末尾说明公共函数已添加在下方
    expect(draft).toContain("公共函数已添加在下方");
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
    expect(draft).toContain(a1.prompt.split(HELPERS_SENTENCE).join(""));
    expect(draft).not.toContain(HELPERS_SENTENCE);
    expect(draft.endsWith(SHARED_HELPERS)).toBe(true);
    expect(draft.match(/\n{3,}/g) ?? []).toEqual([]);
  });

  it("代码样片：删掉原文「同一文件夹」那句；非代码样片的原文不动", () => {
    const a1 = byId("A1");
    expect(a1.prompt).toContain(HELPERS_SENTENCE);
    const draft = composeDraft(a1, "", { sharedHelpers: SHARED_HELPERS, now: NOW });
    expect(draft).not.toContain(HELPERS_SENTENCE);
    expect(draft).toContain("公共函数已添加在下方");
    expect(draft.endsWith(SHARED_HELPERS)).toBe(true);

    const h10 = byId("H10");
    const plain = composeDraft(h10, "", { sharedHelpers: SHARED_HELPERS, now: NOW });
    expect(plain).toContain(h10.prompt);
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

  it("完整 golden：一句话风格、空主题时就是「任务说明 + 空行 + 原文」", () => {
    const h10 = byId("H10");
    const draft = composeDraft(h10, "", { sharedHelpers: SHARED_HELPERS, now: NOW });
    expect(draft).toBe(
      "按下面的风格提示词做一段代码动画，产物写到 animations/20261031-131500-H10-Creative-Mode/index.html。" +
        "\n\n" +
        h10.prompt,
    );
  });

  it("原文块逐字保留：即使原文以空行开头也不删字", () => {
    const fixture = {
      id: "X1",
      name: "测试",
      prompt: "\n\n\n# X1 测试\n\n## 风格提示词\n\n正文\n",
      hasSharedHelpers: false,
      payloadKind: "short" as const,
    };
    const draft = composeDraft(fixture, "", { sharedHelpers: SHARED_HELPERS, now: NOW });
    expect(draft).toContain(fixture.prompt);
    expect(draft.endsWith(fixture.prompt)).toBe(true);
  });

  it("空卡（payloadKind = empty）：草稿只有任务说明与主题，不带空的原文段落", () => {
    const m14 = byId("M14");
    const draft = composeDraft(m14, "新年倒计时", { sharedHelpers: SHARED_HELPERS, now: NOW });
    expect(draft).toContain("animations/20261031-131500-M14-未命名/index.html");
    expect(draft).toContain("主题：新年倒计时");
    expect(draft).toContain("M14");
    expect(draft).not.toContain("## 风格提示词");
    expect(draft).not.toContain("_公共函数.js");
    expect(draft.match(/\n{3,}/g) ?? []).toEqual([]);
    expect(draft.endsWith("\n")).toBe(false);
  });

  it("9 张空卡：都不出现空的原文段落、不留连续空行；无主题时只剩任务说明", () => {
    const empties = ASSET_INDEX.styles.filter((style) => style.payloadKind === "empty");
    expect(empties).toHaveLength(9);
    for (const style of empties) {
      const draft = composeDraft(style, "", { sharedHelpers: SHARED_HELPERS, now: NOW });
      expect(draft).toContain("animations/20261031-131500-" + style.id + "-");
      expect(draft).not.toContain(style.prompt);
      expect(draft.match(/\n{3,}/g) ?? []).toEqual([]);
      expect(draft.endsWith("\n")).toBe(false);
    }
  });

  it("K22 这类空卡把名称写进任务说明", () => {
    const k22 = byId("K22");
    const draft = composeDraft(k22, "", { sharedHelpers: SHARED_HELPERS, now: NOW });
    expect(draft).toContain("K22");
    expect(draft).toContain("折纸");
  });

  it("全量 341 张：草稿都不出现三个连续换行", () => {
    for (const style of ASSET_INDEX.styles) {
      const draft = composeDraft(style, "", { sharedHelpers: SHARED_HELPERS, now: NOW });
      expect(draft.match(/\n{3,}/g) ?? []).toEqual([]);
    }
  });
});