/**
 * 点「应用」时写进新会话输入框的草稿文本。纯函数：不碰 React、不碰 DOM、不碰会话服务。
 *
 * 组成（规格 #19 的 Implementation Decisions）：
 *   一行任务说明（含产物路径 animations/<时间戳>-<ID>-<名称>/index.html）
 *   + 主题（非空时单独一行）
 *   + 风格原文（逐字，不做任何改写）
 *   + hasSharedHelpers 时追加 _公共函数.js 全文（md 里「同一文件夹」的引用在用户工作区里没有落点，
 *     不内联的话 rng/clamp/vgrad 直接未定义——ADR-0002）
 *
 * 内联时原文那句「公共的小工具函数在同一文件夹的 _公共函数.js 里。」要删掉——它在新会话里已是错的；
 * 改为在草稿里说明公共函数已添加在下方（用户 2026-10-31 冒烟后拍板）。这一步只作用于代码样片，
 * 其他卡片的原文仍然逐字保留。
 *
 * 时间与公共函数文本都由调用方注入：测试可以 golden，生产由浮层传 new Date() 与内置常量。
 */
import type { StyleAsset } from "../catalog/types";

/** 只依赖参与草稿的那几个字段，测试可以用更小的夹具。 */
export type DraftStyle = Pick<StyleAsset, "id" | "name" | "prompt" | "hasSharedHelpers">;

export interface ComposeDraftOptions {
  /** _公共函数.js 全文（逐字）。 */
  readonly sharedHelpers: string;
  /** 产物路径里的时间戳；由调用方给，函数保持确定性。 */
  readonly now: Date;
}

/** A–G 代码样片原文里那句「公共函数在同一文件夹」；内联全文后草稿里要删掉。 */
const SHARED_HELPERS_SENTENCE = "公共的小工具函数在同一文件夹的 _公共函数.js 里。";

/** 删掉原文里「公共函数在同一文件夹」那句（只该在确实内联了全文时调用）。 */
function stripSharedHelpersSentence(prompt: string): string {
  return prompt.split(SHARED_HELPERS_SENTENCE).join("");
}

/** 时间戳格式：本地时间 YYYYMMDD-HHmmss（目录名里不用冒号与空格）。 */
function formatDraftStamp(now: Date): string {
  const two = (value: number): string => String(value).padStart(2, "0");
  return (
    String(now.getFullYear()) +
    two(now.getMonth() + 1) +
    two(now.getDate()) +
    "-" +
    two(now.getHours()) +
    two(now.getMinutes()) +
    two(now.getSeconds())
  );
}

/**
 * 把名称压成一个安全的路径片段：去掉 Windows 不允许的字符与空白，空名兜底「未命名」。
 * 例如「数学/科学讲解（3Blue1Brown 那种）」→「数学-科学讲解（3Blue1Brown-那种）」。
 */
function draftPathSegment(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned === "" ? "未命名" : cleaned;
}

/** 产物目录（相对工作区）：animations/<时间戳>-<ID>-<名称>/。 */
function draftOutputDir(style: Pick<DraftStyle, "id" | "name">, now: Date): string {
  return "animations/" + formatDraftStamp(now) + "-" + style.id + "-" + draftPathSegment(style.name) + "/";
}

/**
 * 按块拼草稿：**块内一个字符都不改**，块与块之间只留一个空行。
 * 原文块（prompt）通常以换行结尾，所以分隔符按前一块已有的换行数收口——
 * 既不改原文，也不在拼接处再叠出连续空行。若原文自己以空行开头，那些换行是
 * 源内容的一部分，照原样保留（宁可多一个空行，也不删原文的字）。
 */
function joinBlocks(blocks: readonly string[]): string {
  let out = "";
  for (const block of blocks) {
    if (block === "") continue;
    if (out === "") {
      out = block;
      continue;
    }
    if (out.endsWith("\n\n")) out += block;
    else if (out.endsWith("\n")) out += "\n" + block;
    else out += "\n\n" + block;
  }
  return out;
}

/** 生成草稿全文（见文件头）。 */
export function composeDraft(style: DraftStyle, theme: string, options: ComposeDraftOptions): string {
  const themeLine = theme.replace(/\s+/g, " ").trim();
  const blocks: string[] = [
    "按下面的风格提示词做一段代码动画，产物写到 " + draftOutputDir(style, options.now) + "index.html。",
  ];
  if (themeLine !== "") blocks.push("主题：" + themeLine);
  const inlineHelpers = style.hasSharedHelpers && options.sharedHelpers !== "";
  blocks.push(inlineHelpers ? stripSharedHelpersSentence(style.prompt) : style.prompt);
  if (inlineHelpers) {
    blocks.push(
      "公共函数已添加在下方（_公共函数.js 全文，rng / clamp / vgrad 等都在里面）；请把它与 index.html 放在同一目录：",
    );
    blocks.push(options.sharedHelpers);
  }
  return joinBlocks(blocks);
}