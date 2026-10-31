// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ASSET_INDEX, ASSET_INDEX_SHA256 } from "../src/data/asset-index.generated";
import type { StyleAsset } from "../src/catalog/types";
import { StillImage } from "../src/client/still";
import { StyleDetail } from "../src/client/detail";

// 缩略图的 seam：URL 形状是纯函数；有图/无图/加载失败三种界面结果在 jsdom 里断言。
// 真实图片加载与路由由宿主路由测试 + 无屏探针覆盖。
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const byId = (id: string): StyleAsset => {
  const style = ASSET_INDEX.styles.find((item) => item.id === id);
  if (style === undefined) throw new Error("找不到卡片 " + id);
  return style;
};

const containers: HTMLElement[] = [];
const roots: Root[] = [];

function render(element: React.ReactElement): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => root.render(element));
  return container;
}

afterEach(() => {
  act(() => {
    for (const root of roots.splice(0)) root.unmount();
  });
  for (const container of containers.splice(0)) container.remove();
});

describe("StillImage", () => {
  it("有静帧：img 懒加载、src 与索引 stillPath 对应", () => {
    const container = render(React.createElement(StillImage, { style: byId("A1"), className: "dsc-card-thumb" }));
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("style-cards/stills/A1.jpg?v=" + ASSET_INDEX_SHA256.slice(0, 12));
    expect(img?.getAttribute("loading")).toBe("lazy");
    expect(img?.getAttribute("decoding")).toBe("async");
    expect(img?.getAttribute("alt")).toBe("");
  });

  it("无静帧：没有 img，退化为系列色块上的 ID（占位落在媒体槽里）", () => {
    const container = render(React.createElement(StillImage, { style: byId("K12"), className: "dsc-card-thumb" }));
    expect(container.querySelector("img")).toBeNull();
    const slot = container.querySelector('[data-role="still-slot"]');
    expect(slot?.getAttribute("data-still")).toBe("fallback");
    expect(slot?.querySelector('[data-role="still-fallback"]')?.textContent).toBe("K12");
  });

  it("加载失败：只把这一张退化为占位，不影响其它卡", () => {
    const container = render(
      React.createElement(
        "div",
        null,
        React.createElement(StillImage, { style: byId("A1"), className: "dsc-card-thumb" }),
        React.createElement(StillImage, { style: byId("L4"), className: "dsc-card-thumb" }),
      ),
    );
    const images = Array.from(container.querySelectorAll("img"));
    expect(images).toHaveLength(2);
    act(() => {
      images[0]!.dispatchEvent(new Event("error"));
    });
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(container.querySelector("img")?.getAttribute("src")).toContain("stills/L4.jpg");
    // 与「无静帧」同一个占位位置：媒体槽 + ID。
    const failed = container.querySelector('[data-still="fallback"]');
    expect(failed?.getAttribute("data-role")).toBe("still-slot");
    expect(failed?.querySelector('[data-role="still-fallback"]')?.textContent).toBe("A1");
  });
});

describe("详情大图", () => {
  const renderDetail = (id: string): HTMLElement =>
    render(
      React.createElement(StyleDetail, {
        style: byId(id),
        theme: "",
        error: null,
        applying: false,
        confirmDraft: false,
        onThemeChange: () => undefined,
        onApply: () => undefined,
        onConfirmApply: () => undefined,
        onCancelApply: () => undefined,
        onBack: () => undefined,
      }),
    );

  it("与卡片缩略图同一个 URL 来源", () => {
    const container = renderDetail("A1");
    const image = container.querySelector('[data-role="detail-still"] img');
    expect(image?.getAttribute("src")).toBe("style-cards/stills/A1.jpg?v=" + ASSET_INDEX_SHA256.slice(0, 12));
    expect(image?.getAttribute("loading")).toBe("lazy");
  });

  it("详情大图加载失败：在同一个媒体槽里退化为系列色块 + ID", () => {
    const container = renderDetail("A1");
    act(() => {
      container.querySelector('[data-role="detail-still"] img')?.dispatchEvent(new Event("error"));
    });
    const slot = container.querySelector('[data-role="detail-still"] [data-still="fallback"]');
    expect(slot?.getAttribute("data-role")).toBe("still-slot");
    expect(slot?.querySelector('[data-role="still-fallback"]')?.textContent).toBe("A1");
  });

  it("无静帧的卡片详情里没有大图", () => {
    const container = renderDetail("K12");
    expect(container.querySelector('[data-role="detail-still"]')).toBeNull();
  });
});