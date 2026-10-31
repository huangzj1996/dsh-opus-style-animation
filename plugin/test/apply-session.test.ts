import { describe, expect, it } from "vitest";
import { createDraftApplier, type ApplyOutcome, type ServiceGetter } from "../src/client/apply-session";

// 应用适配器的 seam：界面只依赖 apply(prompt, mode)，返回「成功 / 空白会话已有草稿 / 可读错误」。
// 生产实现从客户端上下文取 uiWorkspace / sessions / workspaces / conversation；这里用假服务断言
// 「给宿主下什么指令、拿到什么结果」，真实会话创建仍留给手工冒烟（规格 #19 Testing Decisions）。

interface HostOptions {
  readonly workspaces?: readonly Record<string, unknown>[];
  readonly byId?: Record<string, Record<string, unknown>>;
  /** conversation.input.requestDraftInitialization 的返回值。 */
  readonly request?: "applied" | "preserved" | "blocked";
  /** openWorkspace 直接 reject 的错误。 */
  readonly openWorkspaceError?: unknown;
  /** 让 beforeOpen 拿不到 binding。 */
  readonly missingBinding?: boolean;
}

function makeHost(options: HostOptions = {}) {
  const calls = {
    openWorkspace: [] as Array<{ workspaceId: unknown }>,
    request: [] as Array<{ binding: unknown; options: unknown }>,
    startSession: [] as Array<{ workspaceId: unknown; options: unknown }>,
  };
  const requestResult = options.request ?? "applied";
  const services: Record<string, unknown> = {
    uiWorkspace: {
      openWorkspace(workspaceId: unknown, beforeOpen?: (sessionId: string) => void): Promise<void> {
        calls.openWorkspace.push({ workspaceId });
        if (options.openWorkspaceError !== undefined) return Promise.reject(options.openWorkspaceError);
        beforeOpen?.("session-new");
        return Promise.resolve();
      },
      startSession(workspaceId: unknown, sessionOptions: unknown): void {
        calls.startSession.push({ workspaceId, options: sessionOptions });
      },
    },
    sessions: {
      list: {
        getSnapshot: () => ({
          byId:
            options.byId ?? {
              "session-current": { id: "session-current", retainedBy: { mainView: 1 }, updatedAt: 5 },
            },
        }),
      },
      binding: (id: string) => (options.missingBinding === true ? undefined : { sessionId: id }),
    },
    workspaces: {
      list: {
        getSnapshot: () => ({
          items:
            options.workspaces ?? [
              { workspaceId: "workspace-1", sessionIds: ["session-current"], createdAt: "2026-01-01T00:00:00Z" },
            ],
        }),
      },
    },
    conversation: {
      input: {
        requestDraftInitialization: (binding: unknown, sessionOptions: unknown) => {
          calls.request.push({ binding, options: sessionOptions });
          return requestResult;
        },
      },
    },
  };
  const getService: ServiceGetter = (name) => services[name];
  return { calls, getService, services };
}

function expectError(outcome: ApplyOutcome): string {
  if (outcome.ok) throw new Error("expected an error, got ok");
  if (outcome.reason !== "error") throw new Error("expected an error, got " + outcome.reason);
  return outcome.message;
}

describe("createDraftApplier", () => {
  it("正常：用当前会话所属工作区开新会话，先以 keep 探测草稿", async () => {
    const host = makeHost();
    const outcome = await createDraftApplier(host.getService)("草稿全文");

    expect(outcome).toEqual({ ok: true });
    expect(host.calls.openWorkspace).toEqual([{ workspaceId: "workspace-1" }]);
    expect(host.calls.request).toEqual([
      { binding: { sessionId: "session-new" }, options: { prompt: "草稿全文", whenDraftExists: "keep" } },
    ]);
    expect(host.calls.startSession).toEqual([]);
  });

  it("空白会话已有草稿：返回 draft-exists，本次不打开会话（beforeOpen 里中止导航）", async () => {
    const host = makeHost({ request: "preserved" });
    const outcome = await createDraftApplier(host.getService)("草稿");

    expect(outcome).toEqual({ ok: false, reason: "draft-exists" });
    expect(host.calls.request[0]?.options).toEqual({ prompt: "草稿", whenDraftExists: "keep" });
    expect(host.calls.openWorkspace).toHaveLength(1);
  });

  it("用户确认覆盖：第二次以 replace 写入并成功", async () => {
    const host = makeHost({ request: "applied" });
    const outcome = await createDraftApplier(host.getService)("草稿", "replace");

    expect(outcome).toEqual({ ok: true });
    expect(host.calls.request[0]?.options).toEqual({ prompt: "草稿", whenDraftExists: "replace" });
  });

  it("当前会话不属于任何工作区：回退到最近更新的工作区", async () => {
    const host = makeHost({
      // 当前主视图会话 session-current 不在任何工作区里；session-fresh 更新过。
      byId: {
        "session-current": { id: "session-current", retainedBy: { mainView: 1 }, updatedAt: Date.parse("2026-01-01T00:00:01Z") },
        "session-fresh": { id: "session-fresh", retainedBy: {}, updatedAt: Date.parse("2026-01-03T00:00:00Z") },
      },
      workspaces: [
        { workspaceId: "workspace-old", sessionIds: ["session-old"], createdAt: "2026-01-01T00:00:00Z" },
        { workspaceId: "workspace-new", sessionIds: ["session-fresh"], createdAt: "2026-01-02T00:00:00Z" },
      ],
    });

    const outcome = await createDraftApplier(host.getService)("草稿");
    expect(outcome).toEqual({ ok: true });
    expect(host.calls.openWorkspace).toEqual([{ workspaceId: "workspace-new" }]);
  });

  it("一个工作区都没有：给出可读错误，浮层可以保持打开", async () => {
    const host = makeHost({ workspaces: [], byId: {} });
    const message = expectError(await createDraftApplier(host.getService)("草稿"));
    expect(message).toContain("工作区");
    expect(host.calls.openWorkspace).toEqual([]);
  });

  it("宿主拒绝创建：openWorkspace 的失败文本带出来，不吞掉", async () => {
    const host = makeHost({ openWorkspaceError: new Error("workspace gone") });
    const message = expectError(await createDraftApplier(host.getService)("草稿"));
    expect(message).toContain("workspace gone");
  });

  it("宿主 SessionCreateError：保留 rpc code 与 message", async () => {
    const refused = Object.assign(new Error("refused"), {
      name: "SessionCreateError",
      rpcError: { code: "session/create-failed", message: "host said no" },
    });
    const host = makeHost({ openWorkspaceError: refused });
    const message = expectError(await createDraftApplier(host.getService)("草稿"));
    expect(message).toContain("session/create-failed");
    expect(message).toContain("host said no");
  });

  it("草稿初始化被占用（blocked）：给出可读重试提示", async () => {
    const host = makeHost({ request: "blocked" });
    const message = expectError(await createDraftApplier(host.getService)("草稿"));
    expect(message).toContain("重试");
  });

  it("beforeOpen 拿不到 binding：可读错误", async () => {
    const host = makeHost({ missingBinding: true });
    const message = expectError(await createDraftApplier(host.getService)("草稿"));
    expect(message).toContain("会话");
  });

  it("取服务本身抛错：也变成可读错误", async () => {
    const getService: ServiceGetter = () => {
      throw new Error("service unavailable");
    };
    const message = expectError(await createDraftApplier(getService)("草稿"));
    expect(message).toContain("service unavailable");
  });

  it("拿不到 uiWorkspace：可读错误", async () => {
    const message = expectError(await createDraftApplier(() => undefined)("草稿"));
    expect(message).toContain("uiWorkspace");
  });

  it("sessions/workspaces 不可用：退回 startSession(undefined, append)，不静默丢字", async () => {
    const host = makeHost();
    // 只留 uiWorkspace：解析工作区与预填草稿需要的服务缺席。
    const services = host.services;
    delete services.sessions;
    delete services.workspaces;
    delete services.conversation;

    const outcome = await createDraftApplier(host.getService)("草稿");
    expect(outcome).toEqual({ ok: true });
    expect(host.calls.startSession).toEqual([
      { workspaceId: undefined, options: { prompt: "草稿", whenDraftExists: "append" } },
    ]);
    expect(host.calls.openWorkspace).toEqual([]);
  });
});
