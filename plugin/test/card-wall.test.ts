// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { compareStyleIds, toggleCollapsed } from "../src/catalog/groups";
import { EMPTY_FILTER, type CardFilter } from "../src/catalog/search";
import { ASSET_INDEX } from "../src/data/asset-index.generated";
import { CardWall } from "../src/client/card-wall";
import { typeInto } from "./dom-test-helpers";

// 卡片墙的 DOM seam：不测 React 内部状态与样式，只断言「用户能看见什么」——
// 341 张卡都在、按系列分组、默认展开、组头能折叠、组内按 ID 数值序。
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const containers: HTMLElement[] = [];
const roots: Root[] = [];

/** 折叠态、搜索词与系列筛选都由外层持有；测试用同一套受控状态复现真实调用方的用法。 */
function WallHarness(): React.ReactElement {
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(() => new Set());
  const [filter, setFilter] = React.useState<CardFilter>(EMPTY_FILTER);
  return React.createElement(CardWall, {
    onOpen: () => undefined,
    collapsed,
    onToggle: (seriesKey: string) => setCollapsed((previous) => toggleCollapsed(previous, seriesKey)),
    filter,
    onFilterChange: setFilter,
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

describe("搜索与系列筛选", () => {
  it("搜索框输入关键词后只剩命中的卡：折纸只命中 K22，摘要与卡片数同步", async () => {
    const container = await renderWall();
    const input = container.querySelector<HTMLInputElement>('[data-role="search-input"]');
    expect(input).not.toBeNull();
    await typeInto(input!, "折纸");

    expect(container.querySelectorAll(".dsc-card")).toHaveLength(1);
    expect(container.querySelector(".dsc-card")?.getAttribute("data-card-id")).toBe("K22");
    expect(container.querySelector(".dsc-wall")?.getAttribute("data-card-count")).toBe("1");
    expect(container.querySelector(".dsc-wall-summary")?.textContent).toBe("匹配 1 张风格");
  });

  it("系列 chips：点 Z 只剩 Z 系列 15 张（按系列分组），点「全部」恢复 341 张", async () => {
    const container = await renderWall();
    await act(async () => {
      container.querySelector('[data-series-filter="Z"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const zCards = Array.from(container.querySelectorAll("[data-card-id]"));
    expect(zCards).toHaveLength(15);
    expect(zCards.every((card) => card.getAttribute("data-series") === "Z")).toBe(true);
    expect(container.querySelectorAll(".dsc-series")).toHaveLength(1);
    expect(container.querySelector('[data-series-filter="Z"]')?.getAttribute("aria-pressed")).toBe("true");

    await act(async () => {
      container.querySelector('[data-series-filter="all"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelectorAll(".dsc-card")).toHaveLength(341);
    expect(container.querySelector('[data-series-filter="all"]')?.getAttribute("aria-pressed")).toBe("true");
  });

  it("关键词与系列可叠加：霓虹 + R 系列 = 3 张，顺序沿用检索结果；清空搜索词后回到该系列全量", async () => {
    const container = await renderWall();
    const input = container.querySelector<HTMLInputElement>('[data-role="search-input"]')!;
    await typeInto(input, "霓虹");
    await act(async () => {
      container.querySelector('[data-series-filter="R"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const ids = Array.from(container.querySelectorAll("[data-card-id]")).map((card) =>
      card.getAttribute("data-card-id"),
    );
    expect(ids).toEqual(["R1", "R7", "R6"]);
    expect(container.querySelector(".dsc-wall-summary")?.textContent).toBe("匹配 3 张风格");

    await typeInto(input, "");
    expect(container.querySelectorAll(".dsc-card")).toHaveLength(7);
    expect(container.querySelectorAll(".dsc-series")).toHaveLength(1);
  });

  it("无结果时显示无结果空态，而不是一面空白的卡片墙", async () => {
    const container = await renderWall();
    const input = container.querySelector<HTMLInputElement>('[data-role="search-input"]')!;
    await typeInto(input, "zzzz不存在");
    expect(container.querySelectorAll(".dsc-card")).toHaveLength(0);
    expect(container.querySelectorAll(".dsc-series")).toHaveLength(0);
    expect(container.querySelector('[data-role="empty-state"]')?.textContent).toContain("没有匹配");
  });

  it("空态与缩略图占位各自只占内容区的一个位置，互不覆盖", async () => {
    const container = await renderWall();

    // 1) 加载失败：只把这张卡的媒体槽换成占位，墙面不会出现空态。
    const a1Slot = container.querySelector('[data-card-id="A1"] [data-role="still-slot"]');
    expect(a1Slot?.getAttribute("data-still")).toBe("image");
    act(() => {
      a1Slot?.querySelector("img")?.dispatchEvent(new Event("error"));
    });
    const failedSlot = container.querySelector('[data-card-id="A1"] [data-role="still-slot"]');
    expect(failedSlot?.getAttribute("data-still")).toBe("fallback");
    expect(failedSlot?.querySelector('[data-role="still-fallback"]')?.textContent).toBe("A1");
    expect(container.querySelectorAll('[data-role="empty-state"]')).toHaveLength(0);

    // 2) 搜索无结果：内容区只留空态，卡片与媒体槽全部退场。
    const input = container.querySelector<HTMLInputElement>('[data-role="search-input"]')!;
    await typeInto(input, "zzzz不存在");
    expect(container.querySelectorAll(".dsc-card")).toHaveLength(0);
    expect(container.querySelectorAll('[data-role="still-slot"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-role="empty-state"]')).toHaveLength(1);
    expect(container.querySelector(".dsc-wall [data-role='empty-state']")).not.toBeNull();
  });

  it("有关键词时平铺成相关度列表：DOM 顺序就是 BM25 顺序，清空后恢复系列分组", async () => {
    const container = await renderWall();
    const input = container.querySelector<HTMLInputElement>('[data-role="search-input"]')!;
    await typeInto(input, "霓虹 赛博");

    const ids = Array.from(container.querySelectorAll("[data-card-id]")).map((card) =>
      card.getAttribute("data-card-id"),
    );
    expect(ids).toHaveLength(13);
    expect(container.querySelectorAll(".dsc-series")).toHaveLength(0);
    expect(ids.slice(0, 3)).toEqual(["K34", "V8", "R6"]);
    expect(container.querySelector(".dsc-wall-summary")?.textContent).toBe("匹配 13 张风格");

    await typeInto(input, "");
    expect(container.querySelectorAll(".dsc-card")).toHaveLength(341);
    expect(container.querySelectorAll(".dsc-series")).toHaveLength(10);
  });

  it("没有关键词时系列筛选沿用折叠态：收起的组不会自己展开，点开组头能看到 15 张", async () => {
    const container = await renderWall();
    const zHead = container.querySelector<HTMLButtonElement>('[data-series="Z"] .dsc-series-head')!;
    await act(async () => {
      zHead.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelectorAll(".dsc-card")).toHaveLength(341 - 15);

    await act(async () => {
      container.querySelector('[data-series-filter="Z"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelectorAll(".dsc-card")).toHaveLength(0);
    const collapsedHead = container.querySelector<HTMLButtonElement>('[data-series="Z"] .dsc-series-head')!;
    expect(collapsedHead.getAttribute("aria-expanded")).toBe("false");

    await act(async () => {
      collapsedHead.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelectorAll(".dsc-card")).toHaveLength(15);
  });

  it("有静帧的卡片渲染懒加载缩略图；无静帧的显示系列色块 + ID", async () => {
    const container = await renderWall();
    const a1 = container.querySelector('[data-card-id="A1"]');
    expect(a1?.querySelector("img")?.getAttribute("src")).toContain("style-cards/stills/A1.jpg?v=");
    expect(a1?.querySelector("img")?.getAttribute("loading")).toBe("lazy");

    const k12 = container.querySelector('[data-card-id="K12"]');
    expect(k12?.querySelector("img")).toBeNull();
    expect(k12?.querySelector(".dsc-still-fallback")?.textContent).toBe("K12");
  });
});