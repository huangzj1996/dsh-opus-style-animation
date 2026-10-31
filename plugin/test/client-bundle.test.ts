import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

// 构建产物是插件唯一真正交给宿主的文件：它必须带 ModuleLoader 方言，执行后注册一个
// 「id = 包名、factory 返回 { inject, apply }」的工厂。宿主不会替我们检查这件事，
// 方言写错了页面只会静静地什么都不做——所以在构建产物这一层钉一条断言。
const bundlePath = path.resolve(import.meta.dirname, "..", "lib", "client.js");

interface RegisteredFactory {
  id?: string;
  factory?: (require: (id: string) => unknown) => unknown;
}

function loadBundle(extraGlobals: Record<string, unknown> = {}): RegisteredFactory {
  const code = readFileSync(bundlePath, "utf8");
  const registered: RegisteredFactory = {};
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load: (definition: RegisteredFactory) => {
          Object.assign(registered, definition);
        },
      },
    },
    console,
    ...extraGlobals,
  };
  vm.runInNewContext(code, sandbox);
  return registered;
}

describe("浏览器半边产物", () => {
  it("用包名注册一个工厂", () => {
    const registered = loadBundle();
    expect(registered.id).toBe("dsh-style-cards");
    expect(typeof registered.factory).toBe("function");
  });

  it("工厂返回带 slots 注入与 apply 的插件对象", () => {
    const registered = loadBundle();
    const plugin = registered.factory!((id) =>
      id === "react" ? { memo: (component: unknown) => component } : undefined,
    ) as {
      inject?: string[];
      apply?: unknown;
    };
    expect(plugin.inject).toEqual(["slots"]);
    expect(typeof plugin.apply).toBe("function");
  });
});

describe("浏览器半边在宿主里跑起来", () => {
  it("apply 不会抛：两条登记都递给了 slots.inject，样式表也进了 head", () => {
    const styleElements: Array<{ removed: boolean }> = [];
    const appendedToHead: unknown[] = [];
    const fakeDocument = {
      createElement: () => {
        const element = {
          removed: false,
          attributes: {} as Record<string, string>,
          textContent: "",
          setAttribute(name: string, value: string) {
            this.attributes[name] = value;
          },
          remove() {
            this.removed = true;
          },
        };
        styleElements.push(element as never);
        return element;
      },
      head: {
        appendChild: (element: unknown) => {
          appendedToHead.push(element);
        },
      },
    };
    const fakeReact = {
      createElement: (...args: unknown[]) => args,
      memo: (component: unknown) => component,
      useRef: () => ({ current: null }),
      useEffect: () => undefined,
      useSyncExternalStore: () => ({ open: false }),
    };
    const injectedSlots: string[] = [];
    const registeredEntries: string[] = [];
    const disposers: Array<() => void> = [];
    const context = {
      slots: {
        inject: (slotName: string, callback: () => unknown) => {
          injectedSlots.push(slotName);
          callback();
        },
        register: (options: { id: string }) => {
          registeredEntries.push(options.id);
        },
      },
      get: (name: string) => (name === "uiWorkspace" ? { startSession: () => undefined } : undefined),
      effect: (setup: () => void | (() => void)) => {
        const cleanup = setup();
        if (typeof cleanup === "function") disposers.push(cleanup);
      },
    };
    const registered = loadBundle({ document: fakeDocument });
    const livePlugin = registered.factory!((id) => (id === "react" ? fakeReact : undefined)) as {
      apply: (ctx: unknown) => void;
    };
    expect(() => livePlugin.apply(context)).not.toThrow();
    expect(injectedSlots).toEqual(["sidebar.footer.action", "shell.overlay"]);
    expect(registeredEntries).toEqual(["dsh-style-cards.entry", "dsh-style-cards.overlay"]);
    expect(styleElements).toHaveLength(1);
    expect(appendedToHead).toEqual(styleElements);
    expect(styleElements[0]?.removed).toBe(false);

    // 卸载 = ctx 帮我们调 effect 的清理函数：样式表必须被摘掉（「不留残影」）。
    for (const dispose of disposers) dispose();
    expect(styleElements[0]?.removed).toBe(true);
  });
});
describe("内置资产索引", () => {
  it("341 份原文随 bundle 一起发出去，运行期不读盘、不联网", () => {
    const code = readFileSync(bundlePath, "utf8");
    // 抽三份原文里的独有字符串：A1 的代码样片、L4 的 11 节规约、O 系列的中文。
    expect(code).toContain("字雨");
    expect(code).toContain("延时摄影交响");
    expect(code).toContain("电视新闻包装");
    expect(code).not.toContain("node:fs");
    expect(code).not.toContain("readFileSync");
    expect(code).not.toContain("XMLHttpRequest");
    expect(code).not.toMatch(/\bfetch\(/);
  });
});

describe("#22 应用链路（详情 + 新会话草稿）", () => {
  it("bundle 里带着 uiWorkspace 适配器、startSession 参数与公共函数全文", () => {
    const code = readFileSync(bundlePath, "utf8");
    expect(code).toContain("uiWorkspace");
    expect(code).toContain("startSession");
    expect(code).toContain("clearPreviousDraft");
    expect(code).toContain("已带入草稿，可编辑后发送");
    expect(code).toContain("function rng(seed)");
    expect(code).toContain("_公共函数.js");
  });
});
