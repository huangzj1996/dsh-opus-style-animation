// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { recordRenderBaseline } from "../src/client/render-baseline";

// 首帧基线的记录点：票 #21 要「记一笔」供后续虚拟滚动判断，这里钉住它确实被记下来、
// 并且 window 诊断挂点能读到（页面 console 不在 agent 可观测范围，这是替代证据）。
describe("首帧渲染基线", () => {
  it("记录一次基线并挂到 window 上", () => {
    const baseline = recordRenderBaseline({ cards: 341, series: 10, parseMs: 2.5, renderMs: 42.4 });
    expect(baseline.cards).toBe(341);
    expect(baseline.series).toBe(10);
    expect(baseline.renderMs).toBe(42.4);
    expect(Date.parse(baseline.measuredAt)).not.toBeNaN();
    expect(window.__DSC_BASELINE__).toBe(baseline);
  });
});
