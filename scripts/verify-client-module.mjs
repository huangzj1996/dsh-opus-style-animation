#!/usr/bin/env node
/**
 * 无屏验证：读运行中的 DSH GUI 的客户端模块图（/plugins/events，无需认证），
 * 看某个插件是否已装载，并把它自己的 bundle 取一遍。
 *
 * 用法：
 *   node scripts/verify-client-module.mjs [模块 id] [GUI base URL]
 *   node scripts/verify-client-module.mjs dsh-style-cards http://127.0.0.1:51188
 *
 * 退出码：0 = 在 graph 里且 bundle 200；2 = 不在 graph（没装/被禁用/加载失败）；3 = 在 graph 但取不到 bundle。
 */

const target = process.argv[2] ?? "dsh-style-cards";
const baseUrl = (process.argv[3] ?? "http://127.0.0.1:51188").replace(/\/$/, "");

function fail(message, code) {
  console.log(message);
  process.exit(code);
}

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 5000);
let text = "";
try {
  const response = await fetch(baseUrl + "/plugins/events", { signal: controller.signal });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    if (text.includes('"entries"')) {
      await reader.cancel().catch(() => undefined);
      break;
    }
  }
} catch (error) {
  if (!(error instanceof Error) || error.name !== "AbortError") fail("FETCH FAILED " + error.message, 1);
} finally {
  clearTimeout(timer);
  controller.abort();
}

const dataLine = text.split("\n").find((line) => line.startsWith("data: "));
if (dataLine === undefined) fail("NO DATA FRAME (GUI 未启动或地址不对)", 1);
const payload = JSON.parse(dataLine.slice("data: ".length));
const graph = payload.graph ?? payload;
const entries = graph.entries ?? [];
console.log("graph rev:", graph.rev, "entries:", entries.length);

const found = entries.find((entry) => entry.id === target);
if (found === undefined) fail(target + " -> ABSENT", 2);
console.log(target + " -> PRESENT rev=" + found.rev);

const url = baseUrl + "/" + String(found.url).replace(/^\.?\/?/, "");
const response = await fetch(url);
const body = await response.text();
console.log("bundle fetch status=" + response.status + " bytes=" + body.length);
console.log("has ModuleLoader marker:", body.includes("window.__ModuleLoader__.load("));
process.exit(response.status === 200 ? 0 : 3);
