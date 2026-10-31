import { describe, expect, it } from "vitest";
import { CLOSED_OVERLAY, overlayReducer } from "../src/client/overlay-state";

// 浮层开关状态：侧栏入口点一下开、再点一下关；关闭按钮 / 点遮罩 / ESC 都能关。
// 这层只断言状态迁移，不碰 DOM、不碰 React。
describe("浮层开关状态", () => {
  it("初始是关着的", () => {
    expect(CLOSED_OVERLAY.open).toBe(false);
  });

  it("点侧栏入口打开浮层", () => {
    expect(overlayReducer(CLOSED_OVERLAY, "entry-click").open).toBe(true);
  });

  it("浮层开着时再点侧栏入口会把它关上", () => {
    const opened = overlayReducer(CLOSED_OVERLAY, "entry-click");
    expect(overlayReducer(opened, "entry-click").open).toBe(false);
  });

  it("点关闭按钮关掉浮层", () => {
    const opened = overlayReducer(CLOSED_OVERLAY, "entry-click");
    expect(overlayReducer(opened, "close-click").open).toBe(false);
  });

  it("点遮罩关掉浮层", () => {
    const opened = overlayReducer(CLOSED_OVERLAY, "entry-click");
    expect(overlayReducer(opened, "backdrop-click").open).toBe(false);
  });

  it("按 ESC 关掉浮层", () => {
    const opened = overlayReducer(CLOSED_OVERLAY, "escape-pressed");
    expect(opened.open).toBe(false);
  });

  it("浮层已经关着时再按 ESC，仍是关着", () => {
    expect(overlayReducer(CLOSED_OVERLAY, "escape-pressed").open).toBe(false);
  });

  it("关掉之后还能再打开", () => {
    const opened = overlayReducer(CLOSED_OVERLAY, "entry-click");
    const closed = overlayReducer(opened, "escape-pressed");
    expect(overlayReducer(closed, "entry-click").open).toBe(true);
  });
});
