/**
 * 卡片墙的派生视图：分组、排序、折叠。全是纯函数，不碰 React、不碰 DOM。
 *
 * 数据来自 `assets/index.json`（见 src/catalog/types.ts）：这里只按索引里的系列顺序分组，
 * 组内按 ID 数值序重排，并把折叠态算成集合。
 */
import type { SeriesGroup, StyleAsset, StyleAssetIndex } from "./types";

/** 把 ID 拆成字母前缀与数字后缀：A1 → ["A", 1]，M10 → ["M", 10]。 */
function splitId(id: string): { prefix: string; digits: number } | null {
  const match = /^([A-Za-z]*)(\d+)$/.exec(id);
  if (match === null) return null;
  return { prefix: match[1] ?? "", digits: Number(match[2]) };
}

/**
 * 组内排序：先按字母前缀（A–G 系列里有 A–G 六个前缀），再按数字大小。
 * 这样 A2 在 A10 前面、L2 在 L10 前面——朴素的字符串排序会把它们排反。
 * 解析不了的 ID 退回字符串比较，保证任何输入都有确定顺序。
 */
export function compareStyleIds(a: string, b: string): number {
  const left = splitId(a);
  const right = splitId(b);
  if (left !== null && right !== null) {
    if (left.prefix !== right.prefix) return left.prefix < right.prefix ? -1 : 1;
    if (left.digits !== right.digits) return left.digits - right.digits;
  }
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** 按索引里的系列顺序分组，组内按 ID 数值序。系列里没有卡片时也给一个空组。 */
export function groupStyles(index: StyleAssetIndex): readonly SeriesGroup[] {
  const bySeries = new Map<string, StyleAsset[]>();
  for (const style of index.styles) {
    const bucket = bySeries.get(style.series);
    if (bucket === undefined) bySeries.set(style.series, [style]);
    else bucket.push(style);
  }
  return index.series.map((series) => ({
    series,
    styles: (bySeries.get(series.key) ?? []).slice().sort((a, b) => compareStyleIds(a.id, b.id)),
  }));
}

/** 切换一个系列的折叠态：返回新的集合，不修改传入的集合。 */
export function toggleCollapsed(collapsed: ReadonlySet<string>, seriesKey: string): ReadonlySet<string> {
  const next = new Set(collapsed);
  if (next.has(seriesKey)) next.delete(seriesKey);
  else next.add(seriesKey);
  return next;
}

/** 默认展开：只有出现在折叠集合里的系列才是收起的。 */
export function isCollapsed(collapsed: ReadonlySet<string>, seriesKey: string): boolean {
  return collapsed.has(seriesKey);
}

/** 空卡没有名称：界面与测试共用这一条兜底文案。 */
export const UNNAMED_CARD_LABEL = "（未命名）";

/** 卡片展示名：空卡用兜底文案，其余原样。 */
export function styleLabel(style: Pick<StyleAsset, "id" | "name">): string {
  const name = style.name.trim();
  return name === "" ? UNNAMED_CARD_LABEL : name;
}
