/**
 * 轻提示：应用成功后浮层关闭时出现的一行短提示（GLOSSARY：轻提示，避免叫 toast）。
 *
 * 生命周期只在这里：show → 自动消失 → 组件卸载时清理定时器。
 * 浮层入口只负责「什么时候 show」，不再自己管 state / timer / cleanup 三处。
 */
import * as React from "react";

/** 轻提示停留时长。 */
const HINT_MS = 3200;

export interface LightHintController {
  readonly message: string | null;
  show(message: string): void;
}

/** 轻提示的状态与定时器；离开页面时清理，不留下悬挂的 timeout。 */
export function useLightHint(durationMs: number = HINT_MS): LightHintController {
  const [message, setMessage] = React.useState<string | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = React.useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const show = React.useCallback(
    (next: string) => {
      clear();
      setMessage(next);
      timer.current = setTimeout(() => {
        timer.current = null;
        setMessage(null);
      }, durationMs);
    },
    [clear, durationMs],
  );

  React.useEffect(() => clear, [clear]);

  return { message, show };
}

/** 轻提示本体；没有消息时什么都不占。 */
export function LightHint(props: { readonly message: string | null }): React.ReactElement | null {
  if (props.message === null) return null;
  return React.createElement(
    "div",
    { className: "dsc-hint", role: "status", "aria-live": "polite" },
    props.message,
  );
}
