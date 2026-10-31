// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { compareStyleIds, toggleCollapsed } from "../src/catalog/groups";
import { ASSET_INDEX } from "../src/data/asset-index.generated";
import { CardWall } from "../src/client/card-wall";

// 卡片墙的 DOM seam：不测 React 内部状态与样式，只断言「用户能看见什么」——
// 341 张卡都在、按系列分组、默认展开、组头能折叠、组内按 ID 数值序。
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const containers: HTMLElement[] = [];
const roots: Root[] = [];

/** 折叠态现在由外层持有；测试用同一套受控状态复现真实调用方的用法。 */
function WallHarness(): React.ReactElement {
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(() => new Set());
  return React.createElement(CardWall, {
    onOpen: () => undefined,
    collapsed,
    onToggle: (seriesKey: string) => setCollapsed((previous) => toggleCollapsed(previous, seriesKey)),
  });
}

async function renderWall(): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const root = createRoot(container);
  roots.push(root);
  const startedAt = performance.now();
  await act(async () => {
    root.render(React.createElement(WallHarness));
  });
  const elapsed = performance.now() - startedAt;
  // 基线只打印不断言（jsdom 无布局/绘制，远低于真浏览器；数字记进票里做参考）。
  console.log("[baseline] jsdom 渲染 341 张卡片：" + elapsed.toFixed(1) + " ms");
  return container;
}

function cardIdsIn(container: ParentNode, seriesKey: string): string[] {
  const section = container.querySelector('[data-series="' + seriesKey + '"]');
  if (section === null) return [];
  return Array.from(section.querySelectorAll("[data-card-id]")).map(
    (element) => element.getAttribute("data-card-id") ?? "",
  );
}

afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
  for (const container of containers.splice(0)) container.remove();
});

describe("卡片墙", () => {
  it("341 张卡片全部渲染，分成 10 个系列组，组内按 ID 数值序", async () => {
    const container = await renderWall();
    expect(container.querySelectorAll(".dsc-card")).toHaveLength(341);
    expect(container.querySelectorAll(".dsc-series")).toHaveLength(10);

    for (const series of ASSET_INDEX.series) {
      const ids = cardIdsIn(container, series.key);
      expect(ids).toHaveLength(series.count);
      expect(ids).toEqual([...ids].sort(compareStyleIds));
    }

    expect(cardIdsIn(container, "AG")[0]).toBe("A1");
    expect(compareStyleIds("L2", "L10")).toBeLessThan(0);
  });

  it("默认全部展开：10 个组头都是 aria-expanded=true，卡片网格都在", async () => {
    const container = await renderWall();
    const heads = Array.from(container.querySelectorAll<HTMLButtonElement>(".dsc-series-head"));
    expect(heads).toHaveLength(10);
    expect(heads.every((head) => head.getAttribute("aria-expanded") === "true")).toBe(true);
    expect(container.querySelectorAll(".dsc-cards")).toHaveLength(10);
  });

  it("组头可折叠：点 A–G 收起 26 张，再点恢复", async () => {
    const container = await renderWall();
    const head = container.querySelector<HTMLButtonElement>('[data-series="AG"] .dsc-series-head');
    expect(head).not.toBeNull();
    await act(async () => {
      head!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(head!.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelectorAll(".dsc-card")).toHaveLength(341 - 26);
    expect(cardIdsIn(container, "AG")).toHaveLength(0);

    await act(async () => {
      head!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(head!.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelectorAll(".dsc-card")).toHaveLength(341);
  });

  it("每张卡显示 ID 与名称；空卡 M14 显示兜底文案", async () => {
    const container = await renderWall();
    const a1 = container.querySelector('[data-card-id="A1"]');
    expect(a1?.querySelector(".dsc-card-id")?.textContent).toBe("A1");
    expect(a1?.querySelector(".dsc-card-name")?.textContent).toBe("字雨");

    const empty = container.querySelector('[data-card-id="M14"]');
    expect(empty?.querySelector(".dsc-card-name")?.textContent).toBe("（未命名）");
    expect(container.querySelector('[data-card-id="M14"]')?.getAttribute("aria-label")).toContain("M14");

    // 第 9 张空卡不是没名字（K22 折纸），卡片墙照常显示名字。
    expect(container.querySelector('[data-card-id="K22"] .dsc-card-name')?.textContent).toBe("折纸");
  });

  it("首帧基线会写进 window.__DSC_BASELINE__（覆盖分组 + 提交 + 首帧）", async () => {
    await renderWall();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    const baseline = window.__DSC_BASELINE__;
    expect(baseline?.cards).toBe(341);
    expect(baseline?.series).toBe(10);
    expect(baseline?.renderMs).toBeGreaterThan(0);
    console.log("[baseline] 组件自记 jsdom 首帧：" + baseline!.renderMs.toFixed(1) + " ms");
  });

  it("显示总数与系列数", async () => {
    const container = await renderWall();
    expect(container.querySelector(".dsc-wall-summary")?.textContent).toBe("341 张风格 · 10 个系列");
    expect(container.querySelector(".dsc-wall")?.getAttribute("data-card-count")).toBe("341");
  });
});