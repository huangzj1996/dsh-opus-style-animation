/**
 * 浮层的开关状态。纯函数，不碰 React、不碰 DOM——界面层只负责把事件送进来、把结果画出去。
 *
 * 事件来源（对应票 #20 的验收判据）：
 * - entry-click：点侧栏底部的「Opus 片场」入口。开着的浮层再点一次入口就关上（常见抽屉行为）。
 * - close-click：点浮层里的关闭按钮。
 * - backdrop-click：点浮层外的遮罩。
 * - escape-pressed：按 ESC。
 * - apply-succeeded：点「应用」且新会话已打开；浮层收起，交给轻提示说明结果。
 */
export type OverlayEvent =
  | "entry-click"
  | "close-click"
  | "backdrop-click"
  | "escape-pressed"
  | "apply-succeeded";

/** 浮层状态。目前只有开/关两态；卡片墙的选中卡、搜索词留给 #21/#22，不塞进这里。 */
export interface OverlayState {
  readonly open: boolean;
}

/** 初始状态：浮层是关着的（打开 DSH 时不该看到它）。 */
export const CLOSED_OVERLAY: OverlayState = { open: false };

/**
 * 状态迁移。关闭类事件无论当前是什么状态都收敛到「关」，因此重复按 ESC、
 * 关闭动画期间再点一次遮罩之类的重复事件都是安全的。
 */
export function overlayReducer(
  state: OverlayState,
  event: OverlayEvent,
): OverlayState {
  if (event === "entry-click") {
    return state.open ? CLOSED_OVERLAY : { open: true };
  }
  return CLOSED_OVERLAY;
}