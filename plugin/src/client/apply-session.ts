/**
 * 应用适配器：点「应用」后开一个新会话，并把草稿填进那个会话的输入框（不自动发送）。
 *
 * 为什么不再直接用 `uiWorkspace.startSession`（#22 的初版做法）：
 * startSession 是 fire-and-forget（返回 void）——它把异步失败转成宿主 notice，插件侧读不到；
 * 也拿不到「空白会话里已有草稿」这件事，`clearPreviousDraft: true` 会静默覆盖用户没发出去的字。
 *
 * #25 起改走宿主自己的同一条路，但把「打开前」这一步握在自己手里：
 *   uiWorkspace.openWorkspace(workspaceId, beforeOpen)
 *     beforeOpen(sessionId) → conversation.input.requestDraftInitialization(binding, options)
 *
 * - openWorkspace 的 Promise 在创建失败 / beforeOpen 抛错时 reject（宿主契约：
 *   「a throw aborts the open and releases the retained reference」），失败因此能回到界面上；
 * - requestDraftInitialization 返回 applied / preserved / blocked。先用 `whenDraftExists: "keep"` 探测：
 *   preserved 说明空白会话里有未发送的草稿——抛 DraftConflict 中止本次打开（会话没被切走），
 *   界面弹一次轻确认；用户确认后再以 `"replace"` 走一次。
 *
 * 工作区解析复刻宿主的 startSession：当前主视图会话所属工作区，否则最近更新的工作区。
 *
 * 降级：外部 bundle 能否看到 sessions / workspaces / conversation 由运行时决定（uiWorkspace
 * 已实证，其余三个是同一客户端上下文里的服务，但没有单独实证）。拿不到时退回 #22 已验证的
 * startSession，并传 `whenDraftExists: "append"`——空白草稿为空时行为与 replace 一致，非空时追加，
 * 绝不静默丢字；代价是这一路拿不到失败面与冲突面（宿主自己弹 notice）。
 */

/** 从客户端上下文按名字取服务（生产：`(name) => ctx.get(name)`）。 */
export type ServiceGetter = (name: string) => unknown;

/** keep = 先探测；replace = 用户已确认覆盖。 */
export type ApplyMode = "keep" | "replace";

/** 应用结果：成功 / 空白会话已有草稿（等用户确认）/ 可读错误。 */
export type ApplyOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "draft-exists" }
  | { readonly ok: false; readonly reason: "error"; readonly message: string };

/** 界面依赖的形状：给一段草稿，尝试开一个新会话。 */
export type ApplyDraft = (prompt: string, mode?: ApplyMode) => Promise<ApplyOutcome>;

/** 传给宿主 requestDraftInitialization / startSession 的草稿选项。 */
export interface StartSessionOptions {
  readonly prompt: string;
  readonly whenDraftExists: ApplyMode | "append";
}

/** 宿主 uiWorkspace 服务里本模块用到的那部分。 */
interface WorkspaceStarter {
  openWorkspace?(workspaceId: string, beforeOpen?: (sessionId: string) => void): Promise<void>;
  startSession?(workspaceId: undefined, options: StartSessionOptions): unknown;
}

/** 宿主 conversation 服务的输入面（只用到预填草稿）。 */
interface DraftInitializer {
  requestDraftInitialization?(
    binding: unknown,
    options: { readonly prompt: string; readonly whenDraftExists: ApplyMode },
  ): unknown;
}

/** binding 拿不到时给用户看的原话（不套「创建失败」前缀）。 */
class DraftPreparationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DraftPreparationError";
  }
}

/** 空白会话里已有草稿：中止打开，交给界面确认。 */
class DraftConflictError extends Error {
  constructor() {
    super("draft exists");
    this.name = "DraftConflictError";
  }
}

/** 会话正在发送/处理：requestDraftInitialization 返回 blocked。 */
class DraftBlockedError extends Error {
  constructor() {
    super("draft initialization blocked");
    this.name = "DraftBlockedError";
  }
}

function errorText(error: unknown): string {
  if (error instanceof Error && error.message !== "") return error.message;
  return String(error);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

function errorOutcome(message: string): ApplyOutcome {
  return { ok: false, reason: "error", message };
}

/** 读一个客户端服务上的 list store 快照；拿不到（服务缺席 / 形状不符 / 抛错）返回 undefined。 */
function readList(service: unknown): Record<string, unknown> | undefined {
  const face = asRecord(service);
  const list = asRecord(face?.list);
  const getSnapshot = list?.getSnapshot;
  if (list === undefined || typeof getSnapshot !== "function") return undefined;
  try {
    return asRecord((getSnapshot as () => unknown).call(list));
  } catch {
    return undefined;
  }
}

/** 当前主视图会话 id：sessions.list 里 retainedBy.mainView > 0 的那一个（sidebar 同一套判据）。 */
function mainSessionId(sessionSnapshot: Record<string, unknown> | undefined): string | undefined {
  const byId = asRecord(sessionSnapshot?.byId);
  if (byId === undefined) return undefined;
  for (const entry of Object.values(byId)) {
    const record = asRecord(entry);
    if (record === undefined) continue;
    const retainedBy = asRecord(record.retainedBy);
    if (retainedBy === undefined || typeof retainedBy.mainView !== "number" || retainedBy.mainView <= 0) continue;
    if (typeof record.id === "string") return record.id;
  }
  return undefined;
}

/**
 * 复刻宿主 startSession 的工作区解析：显式目标缺席时，当前主视图会话所属工作区优先，
 * 否则取最近更新的工作区（会话 updatedAt 最大；空工作区按 createdAt）。纯函数。
 */
export function resolveTargetWorkspace(
  sessionSnapshot: Record<string, unknown> | undefined,
  workspaceSnapshot: Record<string, unknown> | undefined,
): string | undefined {
  const items = Array.isArray(workspaceSnapshot?.items) ? (workspaceSnapshot.items as unknown[]) : [];
  if (items.length === 0) return undefined;
  const byId = asRecord(sessionSnapshot?.byId);

  const currentId = mainSessionId(sessionSnapshot);
  if (currentId !== undefined) {
    for (const item of items) {
      const record = asRecord(item);
      const sessionIds = record?.sessionIds;
      if (record === undefined || !Array.isArray(sessionIds) || !sessionIds.includes(currentId)) continue;
      if (typeof record.workspaceId === "string") return record.workspaceId;
    }
  }

  let selected: string | undefined;
  let selectedTime = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    const record = asRecord(item);
    if (record === undefined || typeof record.workspaceId !== "string") continue;
    let latest = Number.NEGATIVE_INFINITY;
    const sessionIds = Array.isArray(record.sessionIds) ? (record.sessionIds as unknown[]) : [];
    for (const sessionId of sessionIds) {
      const session = asRecord(byId?.[String(sessionId)]);
      if (session !== undefined && typeof session.updatedAt === "number") latest = Math.max(latest, session.updatedAt);
    }
    if (latest === Number.NEGATIVE_INFINITY) {
      const parsed = typeof record.createdAt === "string" ? Date.parse(record.createdAt) : Number.NaN;
      latest = Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
    }
    if (selected === undefined || latest > selectedTime) {
      selected = record.workspaceId;
      selectedTime = latest;
    }
  }
  return selected;
}

/** 宿主失败文本：SessionCreateError 保留 rpc code（跨 bundle 不共享类身份，按字段读）。 */
function creationFailureText(error: unknown): string {
  const rpc = asRecord(asRecord(error)?.rpcError);
  if (rpc !== undefined && typeof rpc.code === "string") {
    const detail = typeof rpc.message === "string" && rpc.message !== "" ? rpc.message : errorText(error);
    return "创建新会话失败（" + rpc.code + "）：" + detail;
  }
  return "创建新会话失败：" + errorText(error);
}

/**
 * 用服务获取器造一个应用适配器。测试里换成任意实现；服务缺失、不是对象、
 * 形状不符都返回可读错误（降级路径见文件头），不让异常漏到界面。
 */
export function createDraftApplier(getService: ServiceGetter): ApplyDraft {
  return async (prompt: string, mode: ApplyMode = "keep"): Promise<ApplyOutcome> => {
    let uiService: unknown;
    let sessionsService: unknown;
    let workspacesService: unknown;
    let conversationService: unknown;
    try {
      uiService = getService("uiWorkspace");
      sessionsService = getService("sessions");
      workspacesService = getService("workspaces");
      conversationService = getService("conversation");
    } catch (error) {
      return errorOutcome("取会话服务失败：" + errorText(error));
    }

    const ui = asRecord(uiService) as WorkspaceStarter | undefined;
    if (ui === undefined) {
      return errorOutcome("拿不到 uiWorkspace 服务，无法创建新会话。请确认 DSH 版本支持该服务后重试。");
    }

    const sessions = asRecord(sessionsService);
    const bindingOf = sessions?.binding;
    const input = asRecord(asRecord(conversationService)?.input) as DraftInitializer | undefined;
    const sessionSnapshot = readList(sessionsService);
    const workspaceSnapshot = readList(workspacesService);
    // 能完整走「打开前预填」的条件：宿主三个服务面都在，且能读到工作区与会话清单。
    const canPrepareDraft =
      typeof ui.openWorkspace === "function" &&
      typeof bindingOf === "function" &&
      typeof input?.requestDraftInitialization === "function" &&
      sessionSnapshot !== undefined &&
      workspaceSnapshot !== undefined;

    if (!canPrepareDraft) {
      if (typeof ui.startSession !== "function") {
        return errorOutcome(
          "uiWorkspace 上找不到可用的打开会话方法（openWorkspace / startSession），无法创建新会话。",
        );
      }
      try {
        ui.startSession(undefined, {
          prompt,
          whenDraftExists: mode === "replace" ? "replace" : "append",
        });
        return { ok: true };
      } catch (error) {
        return errorOutcome("创建新会话失败：" + errorText(error));
      }
    }

    const target = resolveTargetWorkspace(sessionSnapshot, workspaceSnapshot);
    if (target === undefined) {
      return errorOutcome("还没有可用的工作区：先在侧栏新建或选择一个工作区，再回来应用。");
    }

    const openWorkspace = ui.openWorkspace;
    if (openWorkspace === undefined) {
      return errorOutcome("uiWorkspace 上找不到 openWorkspace，无法创建新会话。");
    }

    try {
      await openWorkspace.call(ui, target, (sessionId) => {
        const binding = (bindingOf as (id: string) => unknown).call(sessions, sessionId);
        if (binding === undefined) {
          throw new DraftPreparationError("会话还没准备好，暂时无法填入草稿。请稍后重试。");
        }
        const result = input!.requestDraftInitialization!(binding, { prompt, whenDraftExists: mode });
        if (result === "blocked") throw new DraftBlockedError();
        if (result === "preserved") throw new DraftConflictError();
      });
    } catch (error) {
      if (error instanceof DraftConflictError) return { ok: false, reason: "draft-exists" };
      if (error instanceof DraftBlockedError) {
        return errorOutcome("当前会话正在发送或处理消息，等它空闲后重试。");
      }
      if (error instanceof DraftPreparationError) return errorOutcome(error.message);
      return errorOutcome(creationFailureText(error));
    }
    return { ok: true };
  };
}
