// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ASSET_INDEX, SHARED_HELPERS } from "../src/data/asset-index.generated";
import { StyleCardsPanel } from "../src/client/panel";
import type { ApplyDraft, ApplyOutcome, ApplyMode } from "../src/client/apply-session";
import { typeInto } from "./dom-test-helpers";

// 详情 + 返回 + 应用的 seam：用户在浮层里能看见什么、点完之后墙还在不在原处。
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

function renderPanel(
  starter: ApplyDraft,
  onApplied: (message: string) => void = () => undefined,
): HTMLElement {
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

const ok = async (): Promise<ApplyOutcome> => ({ ok: true });

afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
  for (const container of containers.splice(0)) container.remove();
});

describe("卡片详情与返回", () => {
  it("点卡片进入详情：名称、许可三档署名、原文全文、主题输入、应用按钮", async () => {
    const container = renderPanel(ok);
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
    const container = renderPanel(ok);
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
      async (draft) => {
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
    const container = renderPanel(async (draft) => {
      drafts.push(draft);
      return { ok: true };
    });
    await click(container.querySelector('[data-card-id="H10"]'));
    await click(container.querySelector(".dsc-apply"));
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toContain(byId("H10").prompt);
    expect(drafts[0]).not.toContain("_公共函数.js");
  });

  it("空卡（M14）也能打开详情并应用：草稿只有任务说明与主题", async () => {
    const drafts: string[] = [];
    const container = renderPanel(async (draft) => {
      drafts.push(draft);
      return { ok: true };
    });
    await click(container.querySelector('[data-card-id="M14"]'));
    expect(container.querySelector(".dsc-detail-title")?.textContent).toBe("（未命名）");
    const input = container.querySelector(".dsc-theme-input") as HTMLInputElement;
    await typeInto(input, "新年倒计时");
    await click(container.querySelector(".dsc-apply"));

    expect(drafts).toHaveLength(1);
    const draft = drafts[0] as string;
    expect(draft).toContain("M14");
    expect(draft).toContain("主题：新年倒计时");
    expect(draft).not.toContain("## 风格提示词");
    expect(draft.endsWith("\n")).toBe(false);
  });

  it("开新会话失败：详情里显示可读错误、通知外层不触发（浮层保持打开），重试可以成功", async () => {
    const applied: string[] = [];
    let calls = 0;
    const container = renderPanel(async () => {
      calls += 1;
      if (calls === 1) return { ok: false, reason: "error", message: "创建新会话失败：workspace gone" };
      return { ok: true };
    }, (message) => applied.push(message));
    await click(container.querySelector('[data-card-id="A1"]'));
    await click(container.querySelector(".dsc-apply"));

    expect(container.querySelector(".dsc-detail-error")?.textContent).toBe("创建新会话失败：workspace gone");
    expect(applied).toEqual([]);
    expect(container.querySelector(".dsc-detail")).not.toBeNull();

    // 错误后原地重试：浮层仍开着，点应用即可成功。
    await click(container.querySelector(".dsc-apply"));
    expect(container.querySelector(".dsc-detail-error")).toBeNull();
    expect(applied).toEqual(["已带入草稿，可编辑后发送"]);
    expect(calls).toBe(2);
  });

  it("空白会话已有草稿：先确认再覆盖，取消则不动草稿也不关浮层", async () => {
    const modes: Array<ApplyMode | undefined> = [];
    const applied: string[] = [];
    const container = renderPanel(
      async (_draft, mode) => {
        modes.push(mode);
        if (mode !== "replace") return { ok: false, reason: "draft-exists" };
        return { ok: true };
      },
      (message) => applied.push(message),
    );

    await click(container.querySelector('[data-card-id="A1"]'));
    await click(container.querySelector(".dsc-apply"));
    expect(container.querySelector('[data-role="draft-confirm"]')).not.toBeNull();
    expect(applied).toEqual([]);
    expect(container.querySelector(".dsc-detail-error")).toBeNull();

    // 取消：确认框收起，草稿没被覆盖，浮层还在。
    await click(container.querySelector('[data-role="draft-confirm-cancel"]'));
    expect(container.querySelector('[data-role="draft-confirm"]')).toBeNull();
    expect(applied).toEqual([]);
    expect(container.querySelector(".dsc-detail")).not.toBeNull();

    // 再来一次并确认覆盖：第二次以 replace 写入，成功后关浮层 + 轻提示。
    await click(container.querySelector(".dsc-apply"));
    await click(container.querySelector('[data-role="draft-confirm-ok"]'));
    expect(modes).toEqual(["keep", "keep", "replace"]);
    expect(applied).toEqual(["已带入草稿，可编辑后发送"]);
  });

  it("应用请求在途时按钮禁用，重复点击不会重复提交", async () => {
    let resolveFirst: ((outcome: ApplyOutcome) => void) | undefined;
    let calls = 0;
    const container = renderPanel(() => {
      calls += 1;
      return new Promise<ApplyOutcome>((resolve) => {
        resolveFirst = resolve;
      });
    });
    await click(container.querySelector('[data-card-id="A1"]'));
    await click(container.querySelector(".dsc-apply"));
    const button = container.querySelector<HTMLButtonElement>(".dsc-apply");
    expect(button?.disabled).toBe(true);
    expect(button?.textContent).toContain("应用中");
    await click(button);
    expect(calls).toBe(1);
    await act(async () => {
      resolveFirst?.({ ok: true });
    });
    expect(container.querySelector(".dsc-detail-error")).toBeNull();
  });

  it("详情往返后折叠状态与滚动位置都保留", async () => {
    const container = renderPanel(ok);
    const body = container.querySelector(".dsc-body") as HTMLElement;

    const agHead = container.querySelector('[data-series="AG"] .dsc-series-head') as HTMLButtonElement;
    await click(agHead);
    expect(agHead.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelectorAll(".dsc-card")).toHaveLength(341 - 26);
    body.scrollTop = 420;

    await click(container.querySelector('[data-card-id="L4"]'));
    await click(container.querySelector('[data-role="detail-back"]'));

    const agHeadAgain = container.querySelector('[data-series="AG"] .dsc-series-head') as HTMLButtonElement;
    expect(agHeadAgain.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelectorAll(".dsc-card")).toHaveLength(341 - 26);
    expect(body.scrollTop).toBe(420);
  });

  it("先筛选再进详情：返回后筛选保留，应用仍带该卡原文草稿", async () => {
    const drafts: string[] = [];
    const container = renderPanel(async (draft) => {
      drafts.push(draft);
      return { ok: true };
    });

    const search = container.querySelector<HTMLInputElement>('[data-role="search-input"]');
    expect(search).not.toBeNull();
    await typeInto(search!, "霓虹");
    await click(container.querySelector('[data-series-filter="R"]'));
    expect(container.querySelectorAll(".dsc-card")).toHaveLength(3);

    await click(container.querySelector('[data-card-id="R1"]'));
    expect(container.querySelector(".dsc-detail-title")?.textContent).toBe("霓虹雨夜 · 电影感");
    await click(container.querySelector(".dsc-apply"));
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toContain(byId("R1").prompt);

    await click(container.querySelector('[data-role="detail-back"]'));
    expect(container.querySelectorAll(".dsc-card")).toHaveLength(3);
    expect(container.querySelector<HTMLInputElement>('[data-role="search-input"]')?.value).toBe("霓虹");
    expect(container.querySelector('[data-series-filter="R"]')?.getAttribute("aria-pressed")).toBe("true");
  });
});
