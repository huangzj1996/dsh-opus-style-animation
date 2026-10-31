/**
 * 宿主半边的缩略图路由：把包内 assets/stills/ 的静帧用同源 GET 发给浏览器。
 *
 * 契约（ADR-0002）：
 * - 注册成 dsh-host-webserver 的 prefix 路由 /style-cards，只有 stills/ 前缀暴露给浏览器；
 * - 只服务扁平 <id>.jpg，拒绝目录穿越（原样 / 编码 / 反斜杠 / 空字节），其余一律 404；
 * - 资产随插件版本固定，响应带长缓存（public, max-age=31536000, immutable）；
 * - 不写宿主磁盘、不联网、不加自定义缓存层。
 */
import { createReadStream, promises as fs } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

/** prefix 路由的路径；客户端按 <base>/style-cards/stills/<id>.jpg 取图。 */
export const STILLS_ROUTE_PATH = "/style-cards";
/** 浏览器可见的 URL 前缀。 */
export const STILLS_URL_PREFIX = STILLS_ROUTE_PATH + "/stills/";
/** 路由只服务扁平的 <id>.jpg（索引里的 stillPath 都是这个形状）。 */
const STILL_FILE_NAME = /^[A-Za-z0-9_-]+\.jpg$/;

export interface StillResolutionOk {
  readonly ok: true;
  readonly fileName: string;
  readonly filePath: string;
  readonly contentType: "image/jpeg";
}

export interface StillResolutionError {
  readonly ok: false;
  readonly status: 400 | 403 | 404;
  readonly reason: string;
}

export type StillResolution = StillResolutionOk | StillResolutionError;

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * 把请求 pathname 解析成 stillsDir 里的一个文件。纯函数，不读盘。
 * 先解码再判：编码过的 .. / 反斜杠 / 空字节都按穿越处理；不在 stills/ 下的一律 404。
 */
export function resolveStillAsset(pathname: string, stillsDir: string): StillResolution {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return { ok: false, status: 400, reason: "路径编码不合法" };
  }
  if (decoded.includes("\0")) return { ok: false, status: 403, reason: "空字节" };
  if (decoded.includes("\\")) return { ok: false, status: 403, reason: "反斜杠路径" };
  if (decoded.split("/").some((segment) => segment === ".." || segment === ".")) {
    return { ok: false, status: 403, reason: "目录穿越" };
  }
  if (!decoded.startsWith(STILLS_URL_PREFIX)) return { ok: false, status: 404, reason: "不在 stills/ 前缀下" };
  const fileName = decoded.slice(STILLS_URL_PREFIX.length);
  if (!STILL_FILE_NAME.test(fileName)) return { ok: false, status: 404, reason: "不是静帧文件名" };
  const resolvedDir = path.resolve(stillsDir);
  const filePath = path.resolve(resolvedDir, fileName);
  if (path.dirname(filePath) !== resolvedDir) return { ok: false, status: 403, reason: "越出 stills 目录" };
  return { ok: true, fileName, filePath, contentType: "image/jpeg" };
}

export interface StillsRouteOptions {
  /** 包内 assets/stills 的绝对路径（由宿主半边按安装形态解析后传入）。 */
  readonly stillsDir: string;
  readonly logger?: { warn(message: string, error?: unknown): void };
}

export interface StillsRoute {
  readonly kind: "prefix";
  readonly path: string;
  handler(req: IncomingMessage, res: ServerResponse): Promise<void>;
}

/** 造一条可注册进 ctx.webServer 的 prefix 路由；handler 自己拥有响应生命周期。 */
export function createStillsRoute(options: StillsRouteOptions): StillsRoute {
  const stillsDir = path.resolve(options.stillsDir);
  const warn = options.logger?.warn ?? ((message: string, error?: unknown) => console.warn(message, error));

  async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? "GET";
    if (method !== "GET" && method !== "HEAD") {
      res.writeHead(405, { ...NO_STORE, Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
      res.end("method not allowed");
      return;
    }

    let pathname: string;
    try {
      pathname = new URL(req.url ?? "/", "http://style-cards.local").pathname;
    } catch {
      res.writeHead(400, NO_STORE);
      res.end("bad request");
      return;
    }

    const resolved = resolveStillAsset(pathname, stillsDir);
    if (!resolved.ok) {
      res.writeHead(resolved.status, { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" });
      res.end(resolved.status === 403 ? "forbidden" : "not found");
      return;
    }

    let stat;
    try {
      stat = await fs.stat(resolved.filePath);
    } catch {
      res.writeHead(404, { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" });
      res.end("not found");
      return;
    }
    if (!stat.isFile()) {
      res.writeHead(404, { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" });
      res.end("not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": resolved.contentType,
      "Content-Length": String(stat.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    });
    if (method === "HEAD") {
      res.end();
      return;
    }

    await new Promise<void>((resolve) => {
      const stream = createReadStream(resolved.filePath);
      let settled = false;
      const settle = (): void => {
        if (settled) return;
        settled = true;
        resolve();
      };
      stream.on("error", (error) => {
        warn("style-cards stills: 读文件失败 " + resolved.filePath, error);
        res.destroy();
        settle();
      });
      res.on("close", () => {
        stream.destroy();
        settle();
      });
      stream.on("end", settle);
      stream.pipe(res);
    });
  }

  return { kind: "prefix", path: STILLS_ROUTE_PATH, handler };
}
