/**
 * 应用适配器：把「打开新会话并预填草稿」包成一个注入式函数。
 *
 * 主界面只依赖 ApplyDraft 这个形状；生产实现从客户端 cordis 上下文取 uiWorkspace 服务
 * （外部 bundle 能否拿到它由票 #22 实证），测试用假服务断言参数。
 *
 * 宿主口径（已由 docs/research/dsh-new-session-and-sidebar-entry.md 实证到 shipped 代码）：
 *   uiWorkspace.startSession(workspaceId?, options?: StartSessionOptions)
 *   options = { prompt?, clearPreviousDraft?, whenDraftExists?, agentPreset? }
 * startSession 自己不抛异步错误：它把失败转成宿主 notice（createFailed / draft.*）。
 * 所以这里只兜「取服务失败 / 同步抛错」这两类，并且绝不把错误吞成静默。
 */

/** 传给 startSession 的草稿选项（本票只用这两个字段）。 */
export interface StartSessionDraftOptions {
  readonly prompt: string;
  readonly clearPreviousDraft: true;
}

/** 宿主 uiWorkspace 服务里本票用到的那一部分。 */
export interface WorkspaceStarter {
  startSession(workspaceId: undefined, options: StartSessionDraftOptions): unknown;
}

export type ApplyResult = { readonly ok: true } | { readonly ok: false; readonly message: string };

/** 界面依赖的形状：给一段草稿，尽力开一个新会话。 */
export type ApplyDraft = (prompt: string) => ApplyResult;

function errorText(error: unknown): string {
  if (error instanceof Error && error.message !== "") return error.message;
  return String(error);
}

/**
 * 用服务获取器造一个适配器。获取器在生产是 () => ctx.get("uiWorkspace")，
 * 测试里换成任意实现；服务缺失、不是对象、没有 startSession 都返回可读错误。
 */
export function createDraftApplier(getService: () => unknown): ApplyDraft {
  return (prompt: string): ApplyResult => {
    let service: unknown;
    try {
      service = getService();
    } catch (error) {
      return { ok: false, message: "取会话服务失败：" + errorText(error) };
    }
    if (service === undefined || service === null) {
      return {
        ok: false,
        message: "拿不到 uiWorkspace 服务，无法创建新会话。请确认 DSH 版本支持该服务后重试。",
      };
    }
    const startSession = (service as Partial<WorkspaceStarter>).startSession;
    if (typeof startSession !== "function") {
      return { ok: false, message: "uiWorkspace 上找不到 startSession，无法创建新会话。" };
    }
    try {
      startSession.call(service, undefined, { prompt, clearPreviousDraft: true });
      return { ok: true };
    } catch (error) {
      return { ok: false, message: "创建新会话失败：" + errorText(error) };
    }
  };
}
