/**
 * 构建期资产索引生成：把已提交的 `assets/index.json` 序列化成客户端用的 TS 模块。
 *
 * 单一真相是 `assets/index.json`（由仓库根的 `scripts/build-assets.mjs` 从素材包确定性生成，
 * 内联 341 份 md 原文 + 元数据 + 许可 + 静帧路径）；代码样片共用的 `assets/shared/_公共函数.js`
 * 也逐字内联成常量（应用时附进草稿，见 ADR-0002）。这里**不解析 md、不读素材包**，只做
 * 「资产文件 → TS 模块」的序列化，这样新克隆只要有 `assets/` 就能构建，不会和资产生成器各解析一遍。
 *
 * 用法：
 *   node scripts/generate-asset-index.mjs                    # 默认读 <repo>/assets/index.json 与 assets/shared/_公共函数.js
 *   DSC_ASSET_INDEX=<path> node scripts/generate-asset-index.mjs
 *
 * 构建脚本（scripts/build.mjs）会在打包前调用这里的 `generateAssetIndex()`。
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PKG_DIR = path.resolve(import.meta.dirname, "..");
const REPO_ROOT = path.resolve(PKG_DIR, "..");
const DEFAULT_INDEX_FILE = path.join(REPO_ROOT, "assets", "index.json");
const DEFAULT_SHARED_HELPERS_FILE = path.join(REPO_ROOT, "assets", "shared", "_公共函数.js");
const GENERATED_FILE = path.join(PKG_DIR, "src", "data", "asset-index.generated.ts");

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

/** 生成器只认这一个索引版本；升级索引 shape 时显式改这里。 */
const SUPPORTED_VERSION = 1;

/**
 * 核对索引内部一致性。索引是已提交的生成物，这里不重复校验素材包（那是
 * `node scripts/build-assets.mjs --check` 的职责），只保证插件拿到的这份 JSON 自洽：
 * 计数对得上、原文哈希对得上、prompt 确实是 md 原文而不是提示词段。
 *
 * @param {import("../src/catalog/types").StyleAssetIndex} index
 * @param {number} indexBytes
 */
export function assertIndexConsistent(index, indexBytes) {
  if (index.version !== SUPPORTED_VERSION) {
    throw new Error("assets/index.json 版本不支持：" + index.version + "（期望 " + SUPPORTED_VERSION + "）");
  }
  if (!Array.isArray(index.styles) || !Array.isArray(index.series)) {
    throw new Error("assets/index.json 缺少 styles[] 或 series[]");
  }
  if (index.counts.styles !== index.styles.length) {
    throw new Error("counts.styles 与 styles.length 不一致：" + index.counts.styles + " vs " + index.styles.length);
  }
  if (index.series.length !== 10) {
    throw new Error("系列数不是 10：" + index.series.length);
  }

  const ids = new Set();
  const computed = {
    stills: 0,
    emptyPayload: 0,
    withReferenceImpl: 0,
    codeSample: 0,
    spec: 0,
    short: 0,
    mit: 0,
    freeShareNoSell: 0,
  };
  const perSeries = new Map();
  for (const style of index.styles) {
    if (ids.has(style.id)) throw new Error("卡片 ID 重复：" + style.id);
    ids.add(style.id);
    if (typeof style.prompt !== "string" || style.prompt.length === 0) {
      throw new Error("卡片 " + style.id + " 没有 md 原文");
    }
    const promptBytes = Buffer.byteLength(style.prompt, "utf8");
    if (promptBytes !== style.bytes.prompt) {
      throw new Error("卡片 " + style.id + " 的原文字节数不对：" + promptBytes + " vs " + style.bytes.prompt);
    }
    if (sha256(style.prompt) !== style.sha256.prompt) {
      throw new Error("卡片 " + style.id + " 的原文 sha256 不对");
    }
    // prompt 必须是整份 md（以标题行开头），而不是从 `## 风格提示词` 起截出来的一段。
    if (!style.prompt.startsWith("# " + style.id)) {
      throw new Error("卡片 " + style.id + " 的 prompt 不是整份 md（没有以 \"# " + style.id + "\" 开头）");
    }
    if (!style.prompt.includes("\n## 风格提示词")) {
      throw new Error("卡片 " + style.id + " 的 prompt 不是整份 md（没有 ## 风格提示词 段）");
    }

    if (style.stillPath !== null) {
      computed.stills += 1;
      if (style.bytes.still <= 0 || style.sha256.still === null) {
        throw new Error("卡片 " + style.id + " 有 stillPath 但缺少静帧字节/哈希");
      }
    } else if (style.bytes.still !== 0 || style.sha256.still !== null) {
      throw new Error("卡片 " + style.id + " 没有 stillPath 却带静帧字节/哈希");
    }

    if (style.payloadKind === "empty") computed.emptyPayload += 1;
    if (style.payloadKind === "code-sample") {
      computed.codeSample += 1;
      computed.withReferenceImpl += 1;
    }
    if (style.payloadKind === "spec") computed.spec += 1;
    if (style.payloadKind === "short") computed.short += 1;
    if (style.license === "MIT") computed.mit += 1;
    else if (style.license === "free-share-no-sell") computed.freeShareNoSell += 1;
    else throw new Error("卡片 " + style.id + " 的许可值未知：" + style.license);

    perSeries.set(style.series, (perSeries.get(style.series) ?? 0) + 1);
  }

  for (const [key, value] of Object.entries(computed)) {
    if (index.counts[key] !== value) {
      throw new Error("counts." + key + " 与逐条统计不一致：" + index.counts[key] + " vs " + value);
    }
  }
  for (const series of index.series) {
    const count = perSeries.get(series.key) ?? 0;
    if (series.count !== count) {
      throw new Error("系列 " + series.key + " 的 count 不一致：" + series.count + " vs " + count);
    }
    const stills = index.styles.filter((style) => style.series === series.key && style.stillPath !== null).length;
    if (series.stills !== stills) {
      throw new Error("系列 " + series.key + " 的 stills 不一致：" + series.stills + " vs " + stills);
    }
  }
  const seriesTotal = index.series.reduce((sum, series) => sum + series.count, 0);
  if (seriesTotal !== index.styles.length) {
    throw new Error("系列计数之和与卡片数不一致：" + seriesTotal + " vs " + index.styles.length);
  }
  if (typeof indexBytes === "number" && indexBytes <= 0) throw new Error("assets/index.json 是空文件");
}

/** 读索引、核对、返回对象（还没写盘）。 */
export function readAssetIndex(indexFile = DEFAULT_INDEX_FILE) {
  if (!fs.existsSync(indexFile)) {
    throw new Error(
      "找不到资产索引：" + indexFile + "\n" +
        "插件构建依赖已提交的 assets/index.json；如果它缺失，先跑 node scripts/build-assets.mjs 重新生成。",
    );
  }
  const raw = fs.readFileSync(indexFile);
  /** @type {import("../src/catalog/types").StyleAssetIndex} */
  const index = JSON.parse(raw.toString("utf8"));
  assertIndexConsistent(index, raw.byteLength);
  return { index, raw };
}

/**
 * 读代码样片共用的 _公共函数.js（已提交的 assets/shared/_公共函数.js）。
 * 它随资产包一起提交；应用代码样片时必须逐字内联进草稿，否则 rng / clamp / vgrad 未定义。
 */
export function readSharedHelpers(file = DEFAULT_SHARED_HELPERS_FILE) {
  if (!fs.existsSync(file)) {
    throw new Error(
      "找不到公共函数原文：" + file + "\n" +
        "插件构建依赖已提交的 assets/shared/_公共函数.js；如果它缺失，先跑 node scripts/build-assets.mjs 重新生成。",
    );
  }
  const sharedHelpers = fs.readFileSync(file, "utf8");
  if (sharedHelpers.trim() === "") throw new Error("公共函数原文是空文件：" + file);
  return sharedHelpers;
}

/**
 * 把索引渲染成 TS 模块：一段 JSON 字符串 + JSON.parse，避免 tsc 去推导 1.5 MB 的字面量类型。
 * 共享函数原文以普通 JSON 字符串常量输出（2.6 KB，逐字保留）。
 */
export function renderAssetIndexModule(index, indexSha256, sharedHelpers) {
  const json = JSON.stringify(index);
  const chunkSize = 8192;
  /** @type {string[]} */
  const chunks = [];
  for (let offset = 0; offset < json.length; offset += chunkSize) {
    chunks.push(json.slice(offset, offset + chunkSize));
  }
  const body = chunks.map((chunk) => "  " + JSON.stringify(chunk) + ",").join("\n");
  return (
    "// 由 plugin/scripts/generate-asset-index.mjs 生成——不要手改；改来源后跑 pnpm build。\n" +
    "// 数据源：assets/index.json（sha256 " + indexSha256 + "，" +
    index.counts.styles + " 张卡片 / " + index.counts.stills + " 张静帧）。\n" +
    'import type { StyleAssetIndex } from "../catalog/types";\n' +
    'import { readClock } from "../catalog/clock";\n' +
    "\n" +
    "const CHUNKS: readonly string[] = [\n" +
    body +
    "\n];\n" +
    "\n" +
    "/** 代码样片卡片共用、应用时内联进草稿的 _公共函数.js 原文（逐字）。 */\n" +
    "export const SHARED_HELPERS: string = " + JSON.stringify(sharedHelpers) + ";\n" +
    "\n" +
    "const parseStartedAt = readClock();\n" +
    "/** 341 条风格资产（索引 + 逐字 md 原文）；只读内存，不读文件系统、不联网。 */\n" +
    'export const ASSET_INDEX: StyleAssetIndex = JSON.parse(CHUNKS.join(""));\n' +
    "/** 这份数据在页面启动时 JSON.parse 花了多久（毫秒）；首帧渲染基线会把它算进去。 */\n" +
    "export const ASSET_INDEX_PARSE_MS: number = readClock() - parseStartedAt;\n"
  );
}

/**
 * 生成并写盘。内容没变化时不动文件，避免 HMR 空转与无意义的 mtime 变化。
 * @param {{ indexFile?: string, sharedHelpersFile?: string, outFile?: string, log?: (message: string) => void }} [options]
 */
export async function generateAssetIndex(options = {}) {
  const startedAt = Date.now();
  const outFile = options.outFile ?? GENERATED_FILE;
  const log = options.log ?? ((message) => console.log(message));
  const { index, raw } = readAssetIndex(options.indexFile);
  const indexSha256 = sha256(raw);
  const sharedHelpers = readSharedHelpers(options.sharedHelpersFile);
  const source = renderAssetIndexModule(index, indexSha256, sharedHelpers);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  let changed = true;
  if (fs.existsSync(outFile)) {
    changed = fs.readFileSync(outFile, "utf8") !== source;
  }
  if (changed) fs.writeFileSync(outFile, source);

  log(
    (changed ? "生成 " : "未变化 ") +
      path.relative(PKG_DIR, outFile) +
      "：" + index.counts.styles + " 张卡片、" + Buffer.byteLength(source) + " B、" +
      (Date.now() - startedAt) + " ms" +
      (changed ? "" : "（内容一致，跳过写盘）") +
      "、公共函数 " + Buffer.byteLength(sharedHelpers) + " B",
  );
  return { index, changed, bytes: Buffer.byteLength(source), outFile, indexSha256 };
}

const isMain =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  generateAssetIndex({ indexFile: process.env.DSC_ASSET_INDEX })
    .then((result) => {
      console.log(
        "来源 assets/index.json sha256=" + result.indexSha256 +
          "（" + result.index.counts.styles + " 张 / " + result.index.counts.emptyPayload + " 张空卡）",
      );
    })
    .catch((error) => {
      console.error("生成目录失败：", error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}