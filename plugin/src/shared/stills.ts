/**
 * 资产路由的共享常量与纯函数：宿主半边注册路由、浏览器半边拼 URL 都从这里取，
 * 避免「路由路径」和「客户端 URL」各存一份（#24 复审）。
 *
 * 不依赖 node: 或 react，两半都能 import。
 */

/** dsh-host-webserver 的 prefix 路由路径（以 / 开头）。 */
export const STILLS_ROUTE_PATH = "/style-cards";

/** 浏览器同源相对 URL 的基（不带开头的 /：SPA 挂在根时相对定位即可）。 */
export const STILLS_URL_BASE = STILLS_ROUTE_PATH.slice(1) + "/";

/**
 * 索引里的 stillPath → 浏览器同源相对 URL；没有静帧时 null。
 * version 是资产索引 sha256：它进查询串，插件升级换图后浏览器不会继续命中一年期的 immutable 缓存。
 */
export function stillUrl(stillPath: string | null, version: string): string | null {
  if (stillPath === null) return null;
  const suffix = version === "" ? "" : "?v=" + version.slice(0, 12);
  return STILLS_URL_BASE + stillPath + suffix;
}

/** 这张卡有没有静帧（大图/缩略图共用）。 */
export function hasStill(style: { readonly stillPath: string | null }): boolean {
  return style.stillPath !== null;
}