/**
 * 读取单调时钟：浏览器/Node 用 performance.now()，没有 performance 的环境退回 Date.now()。
 *
 * 生成的数据模块（src/data/asset-index.generated.ts）与首帧基线共用这一份实现，
 * 避免把同一段时钟代码抄两遍。
 */
export function readClock(): number {
  return typeof performance === "object" && performance !== null ? performance.now() : Date.now();
}
