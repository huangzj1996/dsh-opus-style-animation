/**
 * Opus 片场（风格卡片启动器）· 浏览器半边入口。
 *
 * 座位与契约：
 *   1. 左侧栏底部（sidebar.footer.action）一行「Opus 片场」；
 *   2. 整帧浮层（shell.overlay）里一个遮罩 + 面板：点遮罩、按 ESC、点关闭按钮都能关；
 *   3. #22 起，面板里点卡片进详情，点「应用」调用 uiWorkspace.startSession 打开新会话并预填草稿。
 *
 * 宿主契约要点（见 docs/dev/plugin.md）：
 * - 构建后是 classic script，自己调用 window.__ModuleLoader__.load 注册 CJS 工厂；
 * - 工厂无副作用，注册全部发生在 apply(ctx) 里，并挂在 ctx.effect / ctx.slots 上；
 * - 不能用 ctx.slots.register 直连（slot 未声明会抛），一律 ctx.slots.inject(slot, () => register(...))；
 * - 两个座位都是 list slot：侧栏行只收到 { wide }，浮层没有 owner props；
 * - uiWorkspace 用 ctx.get 做可选查找（外部 bundle 的上下文能看到客户端服务；拿不到时界面给可读错误）。
 */
import * as React from "react";
import {
  CLOSED_OVERLAY,
  overlayReducer,
  type OverlayEvent,
  type OverlayState,
} from "./overlay-state";
import { STYLE_CARDS_CSS } from "./styles";
import { createDraftApplier } from "./apply-session";
import { StyleCardsPanel } from "./panel";
import { SHARED_HELPERS } from "../data/asset-index.generated";

const PLUGIN_ID = "dsh-style-cards";
const ENTRY_ID = "dsh-style-cards.entry";
const OVERLAY_ID = "dsh-style-cards.overlay";
const ENTRY_SLOT = "sidebar.footer.action";
const OVERLAY_SLOT = "shell.overlay";
const LABEL = "Opus 片场";
/** 轻提示停留时长。 */
const TOAST_MS = 3200;

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
  /** cordis 的可选服务查找：拿不到返回 undefined，不会抛。 */
  get?(name: string): unknown;
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
      style.remove();
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
  // 应用适配器：每次点击时才去取服务，拿不到就返回可读错误（不抛、不吞）。
  const startSession = createDraftApplier(() => ctx.get?.("uiWorkspace"));

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

  /** 整帧浮层：只在开着时画遮罩与面板；轻提示在浮层关掉后还能再停留一会儿。 */
  function StyleCardsOverlay(): React.ReactElement | null {
    const state = React.useSyncExternalStore(store.subscribe, store.getState);
    const panelRef = React.useRef<HTMLDivElement | null>(null);
    const restoreRef = React.useRef<Element | null>(null);
    const [toast, setToast] = React.useState<string | null>(null);
    const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = React.useCallback((message: string) => {
      setToast(message);
      if (toastTimer.current !== null) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => {
        toastTimer.current = null;
        setToast(null);
      }, TOAST_MS);
    }, []);

    React.useEffect(
      () => () => {
        if (toastTimer.current !== null) clearTimeout(toastTimer.current);
      },
      [],
    );

    React.useEffect(() => {
      if (!state.open) return;
      restoreRef.current = typeof document === "undefined" ? null : document.activeElement;
      const onKeyDown = (event: KeyboardEvent): void => {
        // 抄宿主 modal 层的 Esc 语义：只认 Escape（不带 Shift），长按的 repeat 只吞不关。
        if (event.key === "Escape") {
          if (event.shiftKey) return;
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) store.dispatch("escape-pressed");
          return;
        }
        // 声明了 aria-modal 就得自己把 Tab 关在面板里（宿主 modal 有焦点陷阱，我们不能 import 它）。
        if (event.key !== "Tab") return;
        const panel = panelRef.current;
        if (panel === null) return;
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusables.length === 0) {
          event.preventDefault();
          panel.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (first === undefined || last === undefined) return;
        const active = document.activeElement;
        if (event.shiftKey && (active === first || active === panel)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
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

    const handleApplied = React.useCallback(
      (message: string) => {
        // 先关浮层再看提示：用户回到会话，提示说明草稿已经进去了。
        store.dispatch("apply-succeeded");
        showToast(message);
      },
      [showToast],
    );

    if (!state.open && toast === null) return null;
    return React.createElement(
      React.Fragment,
      null,
      state.open
        ? React.createElement(
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
              React.createElement(StyleCardsPanel, {
                starter: startSession,
                onApplied: handleApplied,
                sharedHelpers: SHARED_HELPERS,
              }),
            ),
          )
        : null,
      toast === null
        ? null
        : React.createElement(
            "div",
            { className: "dsc-toast", role: "status", "aria-live": "polite" },
            toast,
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
