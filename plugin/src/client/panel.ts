/**
 * 浮层主体：卡片墙 ↔ 详情两个视图、返回时恢复滚动位置、应用动作的接线。
 *
 * 这一层只做界面状态（选中哪张、主题文本、错误文本、应用在途、草稿冲突确认、滚动位置），
 * 草稿文本交给 composeDraft（纯函数），开新会话交给注入的 ApplyDraft 适配器。
 * 适配器自 #25 起是异步的，并把结果分成三种：成功 / 空白会话已有草稿（要用户确认）/ 可读错误。
 */
import * as React from "react";
import { toggleCollapsed } from "../catalog/groups";
import { EMPTY_FILTER, type CardFilter } from "../catalog/search";
import type { StyleAsset } from "../catalog/types";
import type { ApplyDraft, ApplyMode, ApplyOutcome } from "./apply-session";
import { CardWall } from "./card-wall";
import { composeDraft } from "./compose-draft";
import { StyleDetail } from "./detail";

export interface StyleCardsPanelProps {
  /** 开新会话并预填草稿（生产：ctx.get 适配器）。 */
  readonly starter: ApplyDraft;
  /** 应用成功后通知外层：关浮层 + 轻提示。 */
  readonly onApplied: (message: string) => void;
  /** _公共函数.js 全文（构建期内联）。 */
  readonly sharedHelpers: string;
  /** 时间源，只为测试注入确定性；生产用 new Date()。 */
  readonly now?: () => Date;
}

/** 应用成功后给用户看的轻提示文案（逐字，验收判据）。 */
const APPLIED_HINT = "已带入草稿，可编辑后发送";

export function StyleCardsPanel(props: StyleCardsPanelProps): React.ReactElement {
  const { starter, onApplied, sharedHelpers, now } = props;
  const bodyRef = React.useRef<HTMLDivElement | null>(null);
  const savedScrollTop = React.useRef(0);
  const [selected, setSelected] = React.useState<StyleAsset | null>(null);
  const [theme, setTheme] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [applying, setApplying] = React.useState(false);
  // 空白会话已有未发送草稿：先确认，再以 replace 写一次（#25 拍板，见 specs #19）。
  const [confirmDraft, setConfirmDraft] = React.useState(false);
  // 折叠态、搜索词与系列筛选放在详情这一层之上：进详情会卸载卡片墙，回来时筛选与折叠都要与离开前一致。
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(() => new Set());
  const [filter, setFilter] = React.useState<CardFilter>(EMPTY_FILTER);
  const toggleSeries = React.useCallback((seriesKey: string) => {
    setCollapsed((previous) => toggleCollapsed(previous, seriesKey));
  }, []);

  const resetApplyState = React.useCallback(() => {
    setError(null);
    setApplying(false);
    setConfirmDraft(false);
  }, []);

  const openDetail = React.useCallback(
    (style: StyleAsset) => {
      savedScrollTop.current = bodyRef.current?.scrollTop ?? 0;
      setSelected(style);
      setTheme("");
      resetApplyState();
    },
    [resetApplyState],
  );

  const backToWall = React.useCallback(() => {
    setSelected(null);
    resetApplyState();
  }, [resetApplyState]);

  // 回到卡片墙后把滚动容器拨回进详情前的位置（详情视图会把它滚到别处）。
  React.useLayoutEffect(() => {
    if (selected === null && bodyRef.current !== null) {
      bodyRef.current.scrollTop = savedScrollTop.current;
    }
  }, [selected]);

  const runApply = React.useCallback(
    (mode: ApplyMode): void => {
      if (selected === null || applying) return;
      const stamp = now === undefined ? new Date() : now();
      const draft = composeDraft(selected, theme, { sharedHelpers, now: stamp });
      setApplying(true);
      setConfirmDraft(false);
      setError(null);
      const settle = (outcome: ApplyOutcome): void => {
        setApplying(false);
        if (outcome.ok) {
          setConfirmDraft(false);
          onApplied(APPLIED_HINT);
          return;
        }
        if (outcome.reason === "draft-exists") {
          setConfirmDraft(true);
          return;
        }
        setError(outcome.message);
      };
      starter(draft, mode).then(settle, (failure: unknown) => {
        settle({
          ok: false,
          reason: "error",
          message: "应用失败：" + (failure instanceof Error ? failure.message : String(failure)),
        });
      });
    },
    [selected, applying, theme, sharedHelpers, now, starter, onApplied],
  );

  const apply = React.useCallback(() => runApply("keep"), [runApply]);
  const confirmApply = React.useCallback(() => runApply("replace"), [runApply]);
  const cancelConfirm = React.useCallback(() => setConfirmDraft(false), []);

  return React.createElement(
    "div",
    { className: "dsc-body", ref: bodyRef },
    selected === null
      ? React.createElement(CardWall, {
          onOpen: openDetail,
          collapsed,
          onToggle: toggleSeries,
          filter,
          onFilterChange: setFilter,
        })
      : React.createElement(StyleDetail, {
          style: selected,
          theme,
          error,
          applying,
          confirmDraft,
          onThemeChange: setTheme,
          onApply: apply,
          onConfirmApply: confirmApply,
          onCancelApply: cancelConfirm,
          onBack: backToWall,
        }),
  );
}
