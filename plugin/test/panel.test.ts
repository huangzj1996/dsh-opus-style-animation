// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ASSET_INDEX, SHARED_HELPERS } from "../src/data/asset-index.generated";
import { StyleCardsPanel } from "../src/client/panel";
import type { ApplyDraft } from "../src/client/apply-session";

// 详情 + 返回的 seam：用户在浮层里能看见什么、点完之后墙还在不在原处。
// 不测 React 内部状态与样式；真实会话创建不在这一层（适配器 seam + 手工冒烟覆盖）。
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const HELPERS_SENTENCE = "公共的小工具函数在同一文件夹的 _公共函数.js 里。";
const byId = (id: string) => {
  const style = ASSET_INDEX.styles.find((item) => item.id === id);
  if (style === undefined) throw new Error("找不到卡片 " + id);
  return style;
};

const containers: HTMLElement[] = [];
const roots: Root[] = [];

function renderPanel(starter: ApplyDraft, onApplied: (message: string) => void = () => undefined): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => {
    root.render(
      React.createElement(StyleCardsPanel, {
        starter,
        onApplied,
        sharedHelpers: SHARED_HELPERS,
        now: () => new Date(2026, 9, 31, 13, 15, 0),
      }),
    );
  });
  return container;
}

async function click(element: Element | null): Promise<void> {
  expect(element).not.toBeNull();
  await act(async () => {
    element!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}


async function typeInto(input: HTMLInputElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  expect(typeof setter).toBe("function");
  await act(async () => {
    setter!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
  for (const container of containers.splice(0)) container.remove();
});

describe("卡片详情与返回", () => {
  it("点卡片进入详情：名称、许可三档署名、原文全文、主题输入、应用按钮", async () => {
    const container = renderPanel(() => ({ ok: true }));
    expect(container.querySelector(".dsc-detail")).toBeNull();

    await click(container.querySelector('[data-card-id="A1"]'));
    expect(container.querySelector(".dsc-detail")).not.toBeNull();
    expect(container.querySelector(".dsc-detail-title")?.textContent).toBe("字雨");

    const attribution = container.querySelector('[data-license="free-share-no-sell"]');
    expect(attribution?.querySelector(".dsc-license-badge")?.textContent).toBe("free-share-no-sell");
    expect(attribution?.querySelector(".dsc-license-copyright")?.textContent).toContain("俯仰观照");
    expect(attribution?.querySelector(".dsc-license-source")?.textContent).toContain(
      "风格提示词/A-G_代码样片/A1_字雨.md",
    );

    // 原文全文、逐字：不是摘录
    expect(container.querySelector('[data-role="detail-prompt"]')?.textContent).toBe(byId("A1").prompt);
    expect(container.querySelector(".dsc-theme-input")).not.toBeNull();
    expect(container.querySelector(".dsc-apply")?.textContent).toBe("应用");
  });

  it("从详情返回：回到卡片墙，并恢复原来的滚动位置", async () => {
    const container = renderPanel(() => ({ ok: true }));
    const body = container.querySelector(".dsc-body") as HTMLElement;
    body.scrollTop = 420;

    await click(container.querySelector('[data-card-id="L4"]'));
    expect(container.querySelector(".dsc-detail-badge")?.textContent).toContain("L4 · L Lemo-Opuscar");
    expect(container.querySelector('[data-license="MIT"]')).not.toBeNull();
    expect(container.querySelector(".dsc-license-copyright")?.textContent).toContain("LemoLab");

    await click(container.querySelector('[data-role="detail-back"]'));
    expect(container.querySelector(".dsc-detail")).toBeNull();
    expect(container.querySelectorAll(".dsc-card")).toHaveLength(341);
    expect(body.scrollTop).toBe(420);
  });

  it("点应用：草稿含主题与公共函数全文，成功后通知外层（轻提示）", async () => {
    const drafts: string[] = [];
    const applied: string[] = [];
    const container = renderPanel(
      (draft) => {
        drafts.push(draft);
        return { ok: true };
      },
      (message) => applied.push(message),
    );

    await click(container.querySelector('[data-card-id="A1"]'));
    const input = container.querySelector(".dsc-theme-input") as HTMLInputElement;
    await typeInto(input, "新年倒计时");
    await click(container.querySelector(".dsc-apply"));

    expect(drafts).toHaveLength(1);
    const draft = drafts[0] as string;
    expect(draft).toContain("animations/20261031-131500-A1-字雨/index.html");
    expect(draft).toContain("主题：新年倒计时");
    expect(draft).toContain(byId("A1").prompt.split(HELPERS_SENTENCE).join(""));
    expect(draft).not.toContain(HELPERS_SENTENCE);
    expect(draft.endsWith(SHARED_HELPERS)).toBe(true);
    expect(applied).toEqual(["已带入草稿，可编辑后发送"]);
    expect(container.querySelector(".dsc-detail-error")).toBeNull();
  });

  it("非代码样片应用：草稿不带公共函数", async () => {
    const drafts: string[] = [];
    const container = renderPanel((draft) => {
      drafts.push(draft);
      return { ok: true };
    });
    await click(container.querySelector('[data-card-id="H10"]'));
    await click(container.querySelector(".dsc-apply"));
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toContain(byId("H10").prompt);
    expect(drafts[0]).not.toContain("_公共函数.js");
  });

  it("开新会话失败：详情里显示可读错误、通知外层不触发（浮层保持打开）", async () => {
    const applied: string[] = [];
    const container = renderPanel(() => ({ ok: false, message: "创建新会话失败：workspace gone" }), (message) =>
      applied.push(message),
    );
    await click(container.querySelector('[data-card-id="A1"]'));
    await click(container.querySelector(".dsc-apply"));

    expect(container.querySelector(".dsc-detail-error")?.textContent).toBe("创建新会话失败：workspace gone");
    expect(applied).toEqual([]);
    expect(container.querySelector(".dsc-detail")).not.toBeNull();
  });
});