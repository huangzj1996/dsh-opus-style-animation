/**
 * 卡片墙：把内置的 341 张风格卡按系列铺进浮层。
 *
 * 这一票（#21）只做「都在、都能看见」：每张卡只有 ID + 名称 + 占位块，
 * 不做缩略图、不做搜索、不做详情——那些留给后面的票。
 *
 * 数据来自构建期序列化的 `src/data/asset-index.generated.ts`（源头是已提交的 `assets/index.json`）；
 * 运行期只读内存。分组、数值序、折叠都是纯函数（src/catalog/groups.ts），这里只负责画。
 */
import * as React from "react";
import { readClock } from "../catalog/clock";
import { groupStyles, styleLabel, toggleCollapsed } from "../catalog/groups";
import type { SeriesGroup, StyleAsset } from "../catalog/types";
import { ASSET_INDEX, ASSET_INDEX_PARSE_MS } from "../data/asset-index.generated";
import { recordRenderBaseline, type RenderBaseline } from "./render-baseline";

/** 一张卡：占位块 + ID + 名称。没有名字的空卡显示统一的兜底文案。 */
function StyleCardTile(style: StyleAsset): React.ReactElement {
  const label = styleLabel(style);
  return React.createElement(
    "article",
    {
      key: style.id,
      className: "dsc-card",
      "data-card-id": style.id,
      "data-series": style.series,
      "aria-label": style.id + " " + label,
    },
    React.createElement("div", {
      className: "dsc-card-thumb",
      "aria-hidden": "true",
    }),
    React.createElement(
      "div",
      { className: "dsc-card-meta" },
      React.createElement("span", { className: "dsc-card-id" }, style.id),
      React.createElement(
        "span",
        { className: "dsc-card-name", title: style.name === "" ? undefined : style.name },
        label,
      ),
    ),
  );
}

/**
 * 一个系列：可折叠的组头 + 卡片网格。默认全部展开（折叠集合初始为空）。
 * memo 之后，打开浮层后写入首帧基线的那次重渲染不会再把 341 张卡重算一遍。
 */
const SeriesSection = React.memo(function SeriesSection(props: {
  readonly group: SeriesGroup;
  readonly collapsed: boolean;
  readonly onToggle: (seriesKey: string) => void;
}): React.ReactElement {
  const { group, collapsed, onToggle } = props;
  const key = group.series.key;
  const cardsId = "dsc-series-cards-" + key;
  return React.createElement(
    "section",
    { className: "dsc-series", "data-series": key },
    React.createElement(
      "button",
      {
        type: "button",
        className: "dsc-series-head",
        "aria-expanded": !collapsed,
        "aria-controls": cardsId,
        onClick: () => onToggle(key),
      },
      React.createElement(
        "span",
        { className: "dsc-series-caret", "data-collapsed": collapsed || undefined, "aria-hidden": "true" },
        "▸",
      ),
      React.createElement("span", { className: "dsc-series-name" }, group.series.label),
      React.createElement("span", { className: "dsc-series-count" }, group.styles.length + " 张"),
    ),
    collapsed
      ? null
      : React.createElement(
          "div",
          { id: cardsId, className: "dsc-cards" },
          group.styles.map((style) => StyleCardTile(style)),
        ),
  );
});

/** 卡片墙根组件。只在浮层打开时挂载，避免关着的时候白渲染 341 张卡。 */
export function CardWall(): React.ReactElement {
  // 基线从分组开始之前起算：341 张卡的分组 + 元素树 + 提交都算在「一次渲染」里。
  const [renderStartedAt] = React.useState(() => readClock());
  const groups = React.useMemo(() => groupStyles(ASSET_INDEX), []);
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(() => new Set());
  const [baseline, setBaseline] = React.useState<RenderBaseline | null>(null);

  // 首帧基线：两个 rAF 之后才回调，确保第一帧已经画完（单个 rAF 在绘制之前）。
  // jsdom / 无 rAF 环境退回 setTimeout(0)。
  React.useEffect(() => {
    let cancelled = false;
    const frames: number[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (): void => {
      if (cancelled) return;
      setBaseline(
        recordRenderBaseline({
          cards: ASSET_INDEX.styles.length,
          series: ASSET_INDEX.series.length,
          parseMs: ASSET_INDEX_PARSE_MS,
          renderMs: readClock() - renderStartedAt,
        }),
      );
    };
    if (typeof requestAnimationFrame === "function") {
      frames.push(
        requestAnimationFrame(() => {
          if (!cancelled) frames.push(requestAnimationFrame(finish));
        }),
      );
    } else {
      timer = setTimeout(finish, 0);
    }
    return () => {
      cancelled = true;
      for (const frame of frames) cancelAnimationFrame(frame);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [renderStartedAt]);

  const onToggle = React.useCallback((seriesKey: string) => {
    setCollapsed((previous) => toggleCollapsed(previous, seriesKey));
  }, []);

  const baselineText =
    baseline === null ? null : Math.max(1, Math.round(baseline.renderMs)) + " ms";

  return React.createElement(
    "div",
    { className: "dsc-wall", "data-card-count": ASSET_INDEX.styles.length },
    React.createElement(
      "div",
      { className: "dsc-wall-bar" },
      React.createElement(
        "span",
        { className: "dsc-wall-summary" },
        ASSET_INDEX.styles.length + " 张风格 · " + ASSET_INDEX.series.length + " 个系列",
      ),
      baselineText === null
        ? null
        : React.createElement(
            "span",
            {
              className: "dsc-wall-baseline",
              title: "从挂载到首帧画完的耗时，供后续判断是否需要虚拟滚动",
            },
            "首帧渲染 " + baselineText,
          ),
    ),
    groups.map((group) =>
      React.createElement(SeriesSection, {
        key: group.series.key,
        group,
        collapsed: collapsed.has(group.series.key),
        onToggle,
      }),
    ),
  );
}
