/**
 * 风格卡片 · 浏览器半边入口。
 *
 * 只做两件事（票 #20 的范围）：
 *   1. 在左侧栏底部（sidebar.footer.action）挂一行「风格卡片」；
 *   2. 在整帧浮层（shell.overlay）里挂一个遮罩 + 面板：点遮罩、按 ESC、点关闭按钮都能关。
 * 卡片墙本身（341 张、搜索、详情、应用）留给 #21 / #22，这里先是一个诚实的空态。
 *
 * 契约要点（来自宿主 shipped 代码，见 .scratch/20/api-scout.md）：
 * - 本文件构建后是 classic script，自己调用 window.__ModuleLoader__.load 注册 CJS 工厂；
 * - 工厂必须无副作用，注册全部发生在 apply(ctx) 里，并挂在 ctx.effect / ctx.slots 上；
 * - 不能用 ctx.slots.register 直连（slot 未声明会抛），一律 ctx.slots.inject(slot, () => register(...))；
 * - 两个座位都是 list slot：侧栏行只收到 { wide }，浮层没有 owner props；
 * - 浮层不需要为 pointer events 做任何事（宿主 .overlayLayer > * 已是 auto）。
 */
import * as React from "react";
import {
  CLOSED_OVERLAY,
  overlayReducer,
  type OverlayEvent,
  type OverlayState,
} from "./overlay-state";
import { STYLE_CARDS_CSS } from "./styles";

const PLUGIN_ID = "dsh-style-cards";
const ENTRY_ID = "dsh-style-cards.entry";
const OVERLAY_ID = "dsh-style-cards.overlay";
const ENTRY_SLOT = "sidebar.footer.action";
const OVERLAY_SLOT = "shell.overlay";
const LABEL = "风格卡片";
const EMPTY_HINT = "卡片墙还没接上：下一步会把这 341 张风格卡片按系列铺进这里。";

/** 宿主提供给插件的 slots 服务里，本插件用到的那两个方法。 */
interface SlotsService {
  inject(ownerKey: string, callback: () => unknown): unknown;
  register(
    options: { name: string; id: string; order?: number; label?: string },
    Component: React.ComponentType<Record<string, unknown>>,
  ): unknown;
}

/** 插件 apply 收到的客户端 cordis 上下文里，本插件用到的那部分。 */
interface PluginContext {
  slots?: SlotsService;
  effect?(setup: () => void | (() => void), label?: string): void;
}

interface OverlayStore {
  getState(): OverlayState;
  subscribe(listener: () => void): () => void;
  dispatch(event: OverlayEvent): void;
}

/**
 * 把纯 reducer 包成 React 能订阅的小 store：入口行与浮层是同一个 slot 下的两条独立登记，
 * 靠它共享「开/关」这一份状态。状态对象无变化时保持同一引用，useSyncExternalStore 不会空转。
 */
function createOverlayStore(): OverlayStore {
  let state: OverlayState = CLOSED_OVERLAY;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch(event: OverlayEvent): void {
      const next = overlayReducer(state, event);
      if (next === state) return;
      state = next;
      for (const listener of [...listeners]) {
        try {
          listener();
        } catch (error) {
          console.error("[" + PLUGIN_ID + "] listener failed", error);
        }
      }
    },
  };
}

/** 入口行左侧的图标：三张叠起来的卡片，用 currentColor 跟随行颜色。 */
function cardsIcon(): React.ReactElement {
  return React.createElement(
    "svg",
    {
      width: 16,
      height: 16,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.7,
      strokeLinecap: "round",
      "aria-hidden": true,
      style: { flex: "none" },
    },
    React.createElement("rect", { key: "a", x: 3, y: 3, width: 7, height: 7, rx: 1.5 }),
    React.createElement("rect", { key: "b", x: 14, y: 3, width: 7, height: 7, rx: 1.5 }),
    React.createElement("rect", { key: "c", x: 3, y: 14, width: 7, height: 7, rx: 1.5 }),
    React.createElement("rect", { key: "d", x: 14, y: 14, width: 7, height: 7, rx: 1.5 }),
  );
}

/** 关闭按钮的叉。 */
function closeIcon(): React.ReactElement {
  return React.createElement(
    "svg",
    { viewBox: "0 0 16 16", width: 14, height: 14, "aria-hidden": true, focusable: false },
    React.createElement("path", {
      d: "M4 4l8 8M12 4l-8 8",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.6,
      strokeLinecap: "round",
    }),
  );
}

/** 一次性把样式表塞进 document.head；卸载插件时随 ctx 一起被移除。 */
function insertStyles(ctx: PluginContext): void {
  const install = (): (() => void) | void => {
    if (typeof document === "undefined") return;
    const style = document.createElement("style");
    style.setAttribute("data-plugin", PLUGIN_ID);
    style.textContent = STYLE_CARDS_CSS;
    document.head.appendChild(style);
    return () => {
      if (style.parentNode !== null) style.parentNode.removeChild(style);
    };
  };
  if (typeof ctx.effect === "function") ctx.effect(install, PLUGIN_ID + ": styles");
  else install();
}

export const inject = ["slots"];

export function apply(ctx: PluginContext): void {
  const slots = ctx.slots;
  if (slots === undefined) return;
  insertStyles(ctx);

  const store = createOverlayStore();

  /** 左侧栏底部的一行。宿主只把列状态作为 wide 传进来：收起成图标栏时只画图标。 */
  function StyleCardsEntry(props: { wide?: boolean }): React.ReactElement {
    const state = React.useSyncExternalStore(store.subscribe, store.getState);
    const wide = props.wide !== false;
    return React.createElement(
      "button",
      {
        type: "button",
        className: wide ? "dsc-row" : "dsc-row dsc-rail",
        title: LABEL,
        "aria-label": LABEL,
        "aria-haspopup": "dialog",
        "aria-expanded": state.open,
        onClick: () => store.dispatch("entry-click"),
      },
      cardsIcon(),
      wide ? React.createElement("span", { className: "dsc-row-label" }, LABEL) : null,
    );
  }

  /** 整帧浮层：只在开着时画遮罩与面板，关着时什么都不占（背后的会话照常渲染）。 */
  function StyleCardsOverlay(): React.ReactElement | null {
    const state = React.useSyncExternalStore(store.subscribe, store.getState);
    const panelRef = React.useRef<HTMLDivElement | null>(null);
    const restoreRef = React.useRef<Element | null>(null);

    React.useEffect(() => {
      if (!state.open) return;
      restoreRef.current = typeof document === "undefined" ? null : document.activeElement;
      const onKeyDown = (event: KeyboardEvent): void => {
        // 抄宿主 modal 层的 Esc 语义：只认 Escape（不带 Shift），长按的 repeat 只吞不关。
        if (event.key !== "Escape" || event.shiftKey) return;
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) store.dispatch("escape-pressed");
      };
      document.addEventListener("keydown", onKeyDown, true);
      panelRef.current?.focus();
      return () => {
        document.removeEventListener("keydown", onKeyDown, true);
        const previous = restoreRef.current;
        if (previous !== null && previous.isConnected && typeof (previous as HTMLElement).focus === "function") {
          (previous as HTMLElement).focus();
        }
      };
    }, [state.open]);

    if (!state.open) return null;
    return React.createElement(
      "div",
      {
        className: "dsc-overlay",
        role: "presentation",
        onClick: (event: React.MouseEvent<HTMLDivElement>) => {
          if (event.target !== event.currentTarget) return;
          store.dispatch("backdrop-click");
        },
      },
      React.createElement(
        "div",
        {
          ref: panelRef,
          tabIndex: -1,
          className: "dsc-panel",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": LABEL,
          "data-shortcut-modal": PLUGIN_ID,
          onClick: (event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation(),
        },
        React.createElement(
          "div",
          { className: "dsc-head" },
          React.createElement("div", { className: "dsc-title" }, LABEL),
          React.createElement(
            "button",
            {
              type: "button",
              className: "dsc-close",
              title: "关闭（ESC）",
              "aria-label": "关闭",
              onClick: () => store.dispatch("close-click"),
            },
            closeIcon(),
          ),
        ),
        React.createElement(
          "div",
          { className: "dsc-body" },
          React.createElement("p", { className: "dsc-empty" }, EMPTY_HINT),
        ),
      ),
    );
  }

  slots.inject(ENTRY_SLOT, () =>
    slots.register(
      { name: ENTRY_SLOT, id: ENTRY_ID, order: 100, label: LABEL },
      StyleCardsEntry as React.ComponentType<Record<string, unknown>>,
    ),
  );
  slots.inject(OVERLAY_SLOT, () =>
    slots.register(
      { name: OVERLAY_SLOT, id: OVERLAY_ID, order: 100, label: LABEL },
      StyleCardsOverlay as React.ComponentType<Record<string, unknown>>,
    ),
  );
}
