/**
 * 浮层主体：卡片墙 ↔ 详情两个视图、返回时恢复滚动位置、应用动作的接线。
 *
 * 这一层只做界面状态（选中哪张、主题文本、错误文本、滚动位置），
 * 草稿文本交给 composeDraft（纯函数），开新会话交给注入的 ApplyDraft 适配器。
 */
import * as React from "react";
import { toggleCollapsed } from "../catalog/groups";
import { EMPTY_FILTER, type CardFilter } from "../catalog/search";
import type { StyleAsset } from "../catalog/types";
import type { ApplyDraft } from "./apply-session";
import { CardWall } from "./card-wall";
import { composeDraft } from "./compose-draft";
import { StyleDetail } from "./detail";

export interface StyleCardsPanelProps {
  /** 开新会话并预填草稿（生产：ctx.get("uiWorkspace") 适配器）。 */
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
  // 折叠态、搜索词与系列筛选放在详情这一层之上：进详情会卸载卡片墙，回来时筛选与折叠都要与离开前一致。
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(() => new Set());
  const [filter, setFilter] = React.useState<CardFilter>(EMPTY_FILTER);
  const toggleSeries = React.useCallback((seriesKey: string) => {
    setCollapsed((previous) => toggleCollapsed(previous, seriesKey));
  }, []);

  const openDetail = React.useCallback((style: StyleAsset) => {
    savedScrollTop.current = bodyRef.current?.scrollTop ?? 0;
    setSelected(style);
    setTheme("");
    setError(null);
  }, []);

  const backToWall = React.useCallback(() => {
    setSelected(null);
    setError(null);
  }, []);

  // 回到卡片墙后把滚动容器拨回进详情前的位置（详情视图会把它滚到别处）。
  React.useLayoutEffect(() => {
    if (selected === null && bodyRef.current !== null) {
      bodyRef.current.scrollTop = savedScrollTop.current;
    }
  }, [selected]);

  const apply = React.useCallback(() => {
    if (selected === null) return;
    const stamp = now === undefined ? new Date() : now();
    const draft = composeDraft(selected, theme, { sharedHelpers, now: stamp });
    const result = starter(draft);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    onApplied(APPLIED_HINT);
  }, [selected, theme, sharedHelpers, now, starter, onApplied]);

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
          onThemeChange: setTheme,
          onApply: apply,
          onBack: backToWall,
        }),
  );
}