/**
 * 首帧渲染基线：卡片墙从挂载到第一帧画完花了多久。
 *
 * 票 #21 要这个数是为了给后续「要不要虚拟滚动」留一个可比较的起点；它只在运行时算一次，
 * 既写 console 也挂到 window 上，方便人看一眼（页面 console 不在 agent 可观测范围）。
 * 不保留模块级历史：值由调用方持有，诊断读 window.__DSC_BASELINE__。
 */
import { readClock } from "../catalog/clock";

export interface RenderBaseline {
  /** 卡片总数。 */
  readonly cards: number;
  /** 系列数。 */
  readonly series: number;
  /** 内置资产索引在页面启动时 JSON.parse 的耗时（毫秒）。 */
  readonly parseMs: number;
  /** 从组件开始渲染到首帧画完的耗时（毫秒）。 */
  readonly renderMs: number;
  /** 记录时刻（ISO 字符串，仅供人读）。 */
  readonly measuredAt: string;
}

/** window 上的诊断挂点；只在页面里存在，测试环境也可以读。 */
declare global {
  interface Window {
    __DSC_BASELINE__?: RenderBaseline;
  }
}

/** 记录一次基线并广播（console.info + window）。后一次记录会覆盖 window 上的值。 */
export function recordRenderBaseline(input: Omit<RenderBaseline, "measuredAt">): RenderBaseline {
  const baseline: RenderBaseline = { ...input, measuredAt: new Date().toISOString() };
  console.info(
    "[dsh-style-cards] 首帧渲染基线：" +
      Math.max(0, Math.round(baseline.renderMs)) +
      " ms（" +
      baseline.cards +
      " 张 / " +
      baseline.series +
      " 个系列，索引解析 " +
      baseline.parseMs.toFixed(1) +
      " ms）",
  );
  if (typeof window !== "undefined") window.__DSC_BASELINE__ = baseline;
  return baseline;
}
