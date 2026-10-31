import { describe, expect, it } from "vitest";
import { createDraftApplier } from "../src/client/apply-session";

// 应用适配器的 seam：组件只依赖这个函数，生产实现从 ctx.get('uiWorkspace') 拿服务。
// 这里断言它传给宿主的参数逐字正确、失败时给出可读错误（不吞掉），
// 至于真实会话是否创建成功，属于手工冒烟（规格 #19 Testing Decisions）。
describe("createDraftApplier", () => {
  it("调用 startSession(undefined, { prompt, clearPreviousDraft: true })，receiver 是服务本身", () => {
    const calls: Array<{ workspaceId: unknown; options: unknown; receiver: unknown }> = [];
    const service = {
      startSession(this: unknown, workspaceId?: unknown, options?: unknown) {
        calls.push({ workspaceId, options, receiver: this });
      },
    };
    const apply = createDraftApplier(() => service);

    expect(apply("草稿全文")).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.workspaceId).toBeUndefined();
    expect(calls[0]?.options).toEqual({ prompt: "草稿全文", clearPreviousDraft: true });
    expect(calls[0]?.receiver).toBe(service);
  });

  it("拿不到 uiWorkspace：返回可读错误而不是抛异常", () => {
    const result = createDraftApplier(() => undefined)("草稿");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.message).toContain("uiWorkspace");
  });

  it("服务上没有 startSession：返回可读错误", () => {
    const result = createDraftApplier(() => ({}))("草稿");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.message).toContain("startSession");
  });

  it("startSession 同步抛错：错误文本原样带出，不吞掉", () => {
    const result = createDraftApplier(() => ({
      startSession() {
        throw new Error("workspace gone");
      },
    }))("草稿");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.message).toContain("workspace gone");
  });

  it("取服务本身抛错：也变成可读错误", () => {
    const result = createDraftApplier(() => {
      throw new Error("service unavailable");
    })("草稿");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.message).toContain("service unavailable");
  });
});
