/**
 * 构建 dsh-style-cards 的两半：
 *   src/client/index.ts → lib/client.js（浏览器半边，window.__ModuleLoader__ 方言）
 *   src/host/index.ts   → lib/index.js （宿主半边，ESM cordis 插件）
 *
 * 浏览器半边必须包成 ModuleLoader 方言：宿主只负责把 /plugins/.../client.js 这个脚本喂给页面，
 * 脚本自己调用 window.__ModuleLoader__.load({ id, factory(require) }) 注册工厂。
 * react 是唯一由页面提供的外部模块（external），其余全部打进来。
 *
 * 用法：node scripts/build.mjs [--watch]
 */
import fs from "node:fs";
import path from "node:path";
import { build, context } from "esbuild";

const PKG_DIR = path.resolve(import.meta.dirname, "..");
const PKG = JSON.parse(fs.readFileSync(path.join(PKG_DIR, "package.json"), "utf8"));
const PKG_NAME = PKG.name;
const OUT_DIR = path.join(PKG_DIR, "lib");
const CLIENT_OUT = path.join(OUT_DIR, "client.js");
const HOST_OUT = path.join(OUT_DIR, "index.js");

const CLIENT_MARKER = "window.__ModuleLoader__.load(";

/** 浏览器半边的 esbuild 选项；一次性构建与 watch 必须用同一份，否则两边产物会漂。 */
function clientOptions(logLevel) {
  return {
    entryPoints: [path.join(PKG_DIR, "src/client/index.ts")],
    bundle: true,
    write: false,
    format: "cjs",
    platform: "browser",
    target: "es2022",
    external: ["react"],
    legalComments: "none",
    // 页面按 UTF-8 跑；默认 ascii 会把中文转成 \\uXXXX，产物更大也更难读。
    charset: "utf8",
    logLevel,
  };
}

/** 把 esbuild 的 cjs 产物包进 ModuleLoader 方言。 */
function wrapClient(body) {
  return `// 由 scripts/build.mjs 生成——不要手改，改 src/client/** 后重新构建。
window.__ModuleLoader__.load({
  id: ${JSON.stringify(PKG_NAME)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${body}
    return module.exports;
  },
});
`;
}

/** 构建产物必须带着方言标记，否则页面根本不会注册它——构建期就把这类错误撞出来。 */
function assertClientArtifact(text) {
  if (!text.includes(CLIENT_MARKER)) {
    throw new Error("client 产物缺少 window.__ModuleLoader__.load( 方言标记");
  }
  if (!text.includes(`id: ${JSON.stringify(PKG_NAME)}`)) {
    throw new Error(`client 产物的 id 不是 ${PKG_NAME}`);
  }
  if (!text.trimEnd().endsWith("});")) {
    throw new Error("client 产物结尾缺少收口");
  }
}

/** 校验并落盘浏览器半边；一次性构建与 watch 共用这一条写路径。 */
function writeClientArtifact(body) {
  const artifact = wrapClient(body);
  assertClientArtifact(artifact);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(CLIENT_OUT, artifact);
  return artifact.length;
}

async function buildClient() {
  const result = await build(clientOptions("warning"));
  return writeClientArtifact(result.outputFiles[0].text);
}

async function buildHost() {
  const result = await build({
    entryPoints: [path.join(PKG_DIR, "src/host/index.ts")],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    target: "node20",
    legalComments: "none",
    logLevel: "warning",
  });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(HOST_OUT, result.outputFiles[0].text);
  return result.outputFiles[0].text.length;
}

async function buildOnce(reason) {
  const [clientBytes, hostBytes] = await Promise.all([buildClient(), buildHost()]);
  console.log(
    `[${new Date().toLocaleTimeString()}] ${reason}lib/client.js ${clientBytes} B, lib/index.js ${hostBytes} B`,
  );
}

if (process.argv.includes("--watch")) {
  await buildOnce("首次构建：");
  const watcher = await context({
    ...clientOptions("silent"),
    plugins: [
      {
        name: "module-loader-wrapper",
        setup(pluginBuild) {
          pluginBuild.onEnd((result) => {
            if (result.errors.length > 0) return;
            try {
              const bytes = writeClientArtifact(result.outputFiles[0].text);
              console.log(`[${new Date().toLocaleTimeString()}] 重建 lib/client.js ${bytes} B`);
            } catch (error) {
              console.error("构建失败：", error.message);
            }
          });
        },
      },
    ],
  });
  await watcher.watch();
  console.log("watch 中：改 src/client/** 会重建 lib/client.js；宿主半边改完请重跑一次 pnpm build（Ctrl+C 结束）");
} else {
  await buildOnce("");
}
