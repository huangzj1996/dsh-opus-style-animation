import { createServer, request } from "node:http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createStillsRoute, resolveStillAsset, STILLS_ROUTE_PATH } from "../src/host/stills-route";

// 宿主 prefix 路由的 seam：解析（含目录穿越/编码绕过）用纯函数断言；
// 真正的响应行为（content-type / cache-control / HEAD / 404）用 Node http server 走一次真实请求。
// 不依赖宿主、不依赖 assets/ 里的 193 张真图（夹具是临时目录里的小文件）。
let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "dsc-stills-"));
  mkdirSync(path.join(root, "stills"), { recursive: true });
  mkdirSync(path.join(root, "styles"), { recursive: true });
  mkdirSync(path.join(root, "LICENSES"), { recursive: true });
  writeFileSync(path.join(root, "stills", "A1.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02]));
  writeFileSync(path.join(root, "styles", "A1.md"), "# secret style");
  writeFileSync(path.join(root, "LICENSES", "LICENSE"), "LICENSE-TEXT");
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("resolveStillAsset", () => {
  it("只放行 /style-cards/stills/<id>.jpg", () => {
    const result = resolveStillAsset("/style-cards/stills/A1.jpg", path.join(root, "stills"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.filePath).toBe(path.join(root, "stills", "A1.jpg"));
    expect(result.contentType).toBe("image/jpeg");
  });

  it("拒绝目录穿越（原样、编码、反斜杠、空字节）", () => {
    for (const raw of [
      "/style-cards/stills/../LICENSES/LICENSE",
      "/style-cards/stills/..%2f..%2fLICENSES%2fLICENSE",
      "/style-cards/stills/%2e%2e%2fLICENSES%2fLICENSE",
      "/style-cards/stills/..\\LICENSES\\LICENSE",
      "/style-cards/stills/%00.jpg",
    ]) {
      const result = resolveStillAsset(raw, path.join(root, "stills"));
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("unexpected ok: " + raw);
      expect([403, 404]).toContain(result.status);
    }
  });

  it("只服务 stills/ 前缀，styles/ 与 LICENSES/ 不暴露", () => {
    for (const raw of ["/style-cards/styles/A1.md", "/style-cards/LICENSES/LICENSE", "/style-cards/stills/", "/style-cards/stills/A1.png"]) {
      const result = resolveStillAsset(raw, path.join(root, "stills"));
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("unexpected ok: " + raw);
      expect(result.status).toBe(404);
    }
  });
});

describe("createStillsRoute（真实 HTTP 请求）", () => {
  let close: () => Promise<void>;
  let baseUrl: string;
  let port: number;

  beforeAll(async () => {
    const route = createStillsRoute({ stillsDir: path.join(root, "stills") });
    expect(route.kind).toBe("prefix");
    expect(route.path).toBe(STILLS_ROUTE_PATH);
    const server = createServer((req, res) => {
      route.handler(req, res).catch(() => {
        if (!res.headersSent) res.writeHead(500).end();
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("no address");
    port = address.port;
    baseUrl = "http://127.0.0.1:" + address.port;
    close = () => new Promise<void>((resolve) => server.close(() => resolve()));
  });

  afterAll(async () => {
    await close();
  });

  it("GET 一张 jpg：200、image/jpeg、长缓存、字节一致", async () => {
    const response = await fetch(baseUrl + "/style-cards/stills/A1.jpg");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const bytes = Buffer.from(await response.arrayBuffer());
    expect([...bytes]).toEqual([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02]);
  });

  it("HEAD 只回头；不存在 → 404；非 GET/HEAD → 405", async () => {
    const head = await fetch(baseUrl + "/style-cards/stills/A1.jpg", { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");

    expect((await fetch(baseUrl + "/style-cards/stills/NOPE.jpg")).status).toBe(404);
    expect((await fetch(baseUrl + "/style-cards/styles/A1.md")).status).toBe(404);

    const post = await fetch(baseUrl + "/style-cards/stills/A1.jpg", { method: "POST" });
    expect(post.status).toBe(405);
    expect(post.headers.get("allow")).toBe("GET, HEAD");
  });

  /** 绕过 fetch 的 URL 归一化，按原始 path 发请求，验证真实服务端上的穿越处理。 */
  function rawRequest(rawPath: string): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const req = request({ host: "127.0.0.1", port, path: rawPath, method: "GET" }, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      });
      req.on("error", reject);
      req.end();
    });
  }

  it("真实请求上的穿越/绝对路径不泄露文件；带版本查询串仍 200", async () => {
    const encoded = await rawRequest("/style-cards/stills/%2e%2e%2f%2e%2e%2fLICENSES%2fLICENSE");
    expect([403, 404]).toContain(encoded.status);
    expect(encoded.body).not.toContain("LICENSE-TEXT");

    const dotted = await rawRequest("/style-cards/stills/../LICENSES/LICENSE");
    expect([403, 404]).toContain(dotted.status);
    expect(dotted.body).not.toContain("LICENSE-TEXT");

    const absolute = await rawRequest("/etc/passwd");
    expect(absolute.status).toBe(404);

    const versioned = await rawRequest("/style-cards/stills/A1.jpg?v=abc123abc123");
    expect(versioned.status).toBe(200);
  });
});