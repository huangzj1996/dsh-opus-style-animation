import { describe, expect, it } from "vitest";
import { hasStill, stillUrl } from "../src/shared/stills";

// 资产 URL 的纯函数 seam：不需要 DOM，跑在 node 环境（与仍需 jsdom 的 StillImage 分开）。
describe("资产 URL", () => {
  it("stillPath → 同源相对 URL + 版本串；没有静帧时 null", () => {
    const version = "a".repeat(64);
    expect(stillUrl("stills/A1.jpg", version)).toBe("style-cards/stills/A1.jpg?v=" + "a".repeat(12));
    expect(stillUrl("stills/A1.jpg", "")).toBe("style-cards/stills/A1.jpg");
    expect(stillUrl(null, version)).toBeNull();
  });

  it("hasStill 只看 stillPath", () => {
    expect(hasStill({ stillPath: "stills/A1.jpg" })).toBe(true);
    expect(hasStill({ stillPath: null })).toBe(false);
  });
});