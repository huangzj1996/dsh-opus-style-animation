/**
 * 卡片墙：把内置的 341 张风格卡按系列铺进浮层。
 *
 * #21 交付了「都在、都能看见」，#22 把每张卡变成可点的入口（点开详情），
 * #23 在墙顶加了关键词搜索与系列筛选：纯函数检索在 src/catalog/search.ts，
 * 这里只负责画筛选后的卡片、计数与空态。数据只读内存、不访问外网；缩略图走同源资产路由（#24）。
 */
import * as React from "react";
import { readClock } from "../catalog/clock";
import { groupFilteredStyles, styleLabel } from "../catalog/groups";
import { buildStyleSearchIndex, filterStyles, hasQueryTerms, type CardFilter } from "../catalog/search";
import type { SeriesGroup, StyleAsset } from "../catalog/types";
import { ASSET_INDEX, ASSET_INDEX_PARSE_MS } from "../data/asset-index.generated";
import { recordRenderBaseline, type RenderBaseline } from "./render-baseline";
import { StillImage } from "./still";

/**
 * 检索索引懒建一次、全局复用：进详情会卸载卡片墙，回到墙时不该再花几毫秒重建索引；
 * 也避免把首次建索引进「首帧渲染」基线。
 */
let searchIndexCache: ReturnType<typeof buildStyleSearchIndex> | null = null;
function getSearchIndex(): ReturnType<typeof buildStyleSearchIndex> {
  if (searchIndexCache === null) searchIndexCache = buildStyleSearchIndex(ASSET_INDEX);
  return searchIndexCache;
}

/** 一张卡：占位块 + ID + 名称，整张卡是一个按钮（点开详情）。没有名字的空卡显示统一的兜底文案。 */
function StyleCardTile(style: StyleAsset, onOpen: (style: StyleAsset) => void): React.ReactElement {
  const label = styleLabel(style);
  return React.createElement(
    "button",
    {
      key: style.id,
      type: "button",
      className: "dsc-card",
      "data-card-id": style.id,
      "data-series": style.series,
      "aria-label": style.id + " " + label + "，查看详情",
      onClick: () => onOpen(style),
    },
    React.createElement(StillImage, { style, className: "dsc-card-thumb" }),
    React.createElement(
      "span",
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
  readonly onOpen: (style: StyleAsset) => void;
}): React.ReactElement {
  const { group, collapsed, onToggle, onOpen } = props;
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
          group.styles.map((style) => StyleCardTile(style, onOpen)),
        ),
  );
});

export interface CardWallProps {
  /** 点任意一张卡：把这张风格资产交给详情视图。 */
  readonly onOpen: (style: StyleAsset) => void;
  /** 折叠态由外层持有：进详情再返回时，卡片墙重挂载也不会把折叠状态丢掉。 */
  readonly collapsed: ReadonlySet<string>;
  readonly onToggle: (seriesKey: string) => void;
  /** 搜索词与系列筛选也由外层持有（一个值对象），进详情再返回不会丢。 */
  readonly filter: CardFilter;
  readonly onFilterChange: (filter: CardFilter) => void;
}

/** 墙顶的筛选条：搜索框 + 系列 chips。受控组件，状态全在外层。 */
function FilterBar(props: {
  readonly filter: CardFilter;
  readonly onFilterChange: (filter: CardFilter) => void;
}): React.ReactElement {
  const { filter, onFilterChange } = props;
  const seriesOptions = [
    { key: null, label: "全部" },
    ...ASSET_INDEX.series.map((series) => ({ key: series.key, label: series.label })),
  ];
  return React.createElement(
    "div",
    { className: "dsc-filter" },
    React.createElement("input", {
      type: "search",
      className: "dsc-search",
      "data-role": "search-input",
      "aria-label": "搜索风格",
      placeholder: "搜索风格：水墨、霓虹、粒子…",
      value: filter.query,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        onFilterChange({ ...filter, query: event.target.value }),
    }),
    React.createElement(
      "div",
      { className: "dsc-series-filters", role: "group", "aria-label": "按系列筛选" },
      seriesOptions.map((option) =>
        React.createElement(
          "button",
          {
            key: option.key ?? "all",
            type: "button",
            className: "dsc-series-chip",
            "data-series-filter": option.key ?? "all",
            "aria-pressed": filter.series === option.key,
            onClick: () => onFilterChange({ ...filter, series: option.key }),
          },
          option.label,
        ),
      ),
    ),
  );
}

/**
 * 空态：搜索/筛选没有命中时，卡片墙内容区里唯一的那一块状态。
 * 与卡片自己的缩略图占位一样，都只占「内容区」这一个位置——两者不会同时出现、也不会互相盖住。
 */
function WallEmptyState(): React.ReactElement {
  return React.createElement(
    "div",
    { className: "dsc-wall-empty", "data-role": "empty-state", role: "status" },
    React.createElement("p", { className: "dsc-wall-empty-title" }, "没有匹配的风格"),
    React.createElement("p", { className: "dsc-wall-empty-hint" }, "换个关键词，或点「全部」清空系列筛选。"),
  );
}

/** 卡片墙根组件。只在浮层打开、且没进详情时挂载。 */
export function CardWall(props: CardWallProps): React.ReactElement {
  // 基线从分组开始之前起算：341 张卡的分组 + 元素树 + 提交都算在「一次渲染」里。
  const [renderStartedAt] = React.useState(() => readClock());
  // 检索索引懒建一次、全局复用（341 条 + 提示词头部元数据）；之后每次输入只做打分。
  const searchIndex = React.useMemo(() => getSearchIndex(), []);
  const visible = React.useMemo(() => filterStyles(searchIndex, props.filter), [searchIndex, props.filter]);
  const groups = React.useMemo(() => groupFilteredStyles(ASSET_INDEX, visible), [visible]);
  const searching = hasQueryTerms(props.filter.query);
  const filtering = searching || props.filter.series !== null;
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

  const baselineText = baseline === null ? null : Math.max(1, Math.round(baseline.renderMs)) + " ms";
  const summary = filtering
    ? "匹配 " + visible.length + " 张风格"
    : ASSET_INDEX.styles.length + " 张风格 · " + ASSET_INDEX.series.length + " 个系列";

  return React.createElement(
    "div",
    { className: "dsc-wall", "data-card-count": visible.length },
    React.createElement(
      "div",
      { className: "dsc-wall-bar" },
      React.createElement("span", { className: "dsc-wall-summary" }, summary),
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
    React.createElement(FilterBar, { filter: props.filter, onFilterChange: props.onFilterChange }),
    visible.length === 0
      ? React.createElement(WallEmptyState)
      : searching
        ? // 有关键词时平铺成相关度列表：BM25 的全局顺序不能被系列分组打散。
          React.createElement(
            "div",
            { className: "dsc-cards dsc-results" },
            visible.map((style) => StyleCardTile(style, props.onOpen)),
          )
        : groups.map((group) =>
            React.createElement(SeriesSection, {
              key: group.series.key,
              group,
              collapsed: props.collapsed.has(group.series.key),
              onToggle: props.onToggle,
              onOpen: props.onOpen,
            }),
          ),
  );
}