/**
 * 目录检索：把 341 张卡片做成客户端内存里的可检索集合（票 #23）。
 *
 * 两段式：
 *   1. 粗筛 —— 字符 unigram/bigram 倒排，只留与 query 至少共享一个 token 的卡片；
 *   2. 重排 —— 对粗筛结果跑 BM25（k1 = 1.2，b = 0.75），同分时按墙上的顺序。
 *
 * 纯函数，不碰 React、不碰 DOM；同输入同输出，不依赖随机或时间。
 * 依据见 docs/research/catalog-search-baseline.md：中文 raw substring 召回几乎为 0，
 * 字符二元组能命中，BM25 能把「Z4 山水」排到「Z1 水墨」前面。
 */
import { groupStyles } from "./groups";
import type { StyleAsset, StyleAssetIndex } from "./types";

/** BM25 参数：取常见默认值，够 341 条语料用。 */
const BM25_K1 = 1.2;
const BM25_B = 0.75;
/** 提示词正文从第一个二级标题开始；之前是元数据（分类 / 长什么样 / 适合 / 关键词）。 */
const HEADER_HEADING = "\n## ";

/** 一条可检索卡片的文档记录。 */
interface SearchDocument {
  readonly style: StyleAsset;
  /** 文档 token 总数，BM25 的长度归一化用。 */
  readonly length: number;
}

/** 某个 token 在某张卡里的出现次数。 */
interface Posting {
  readonly document: number;
  readonly frequency: number;
}

/** 构建一次、反复查询的检索索引；卡片墙懒建一次后全局复用。 */
interface StyleSearchIndex {
  /** 不筛选时卡片墙的顺序：系列序 + 组内 ID 数字序。 */
  readonly wallOrder: readonly StyleAsset[];
  readonly documents: readonly SearchDocument[];
  readonly postings: ReadonlyMap<string, readonly Posting[]>;
  /** 平均文档长度；空目录时为 0。 */
  readonly averageLength: number;
}

/** 大小写与全半角归一：查询与文档走同一套。 */
function normalize(text: string): string {
  return text.normalize("NFKC").toLowerCase();
}

/** 按非字母数字切成段：中文整段连着走，ASCII 单词与数字各自成段。 */
function segments(text: string): string[] {
  return normalize(text).split(/[^\p{L}\p{N}]+/u).filter((segment) => segment.length > 0);
}

/**
 * 文档 token：每段里的每个字（unigram）+ 每对相邻字（bigram）。
 * 单字查询（「雨」）靠 unigram，多字中文查询（「水墨」）靠 bigram；
 * 正文里的空格与标点不会拼出跨词的假 bigram。
 */
function documentTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const segment of segments(text)) {
    const chars = Array.from(segment);
    for (let index = 0; index < chars.length; index += 1) {
      const char = chars[index];
      if (char === undefined) continue;
      tokens.push(char);
      const next = chars[index + 1];
      if (next !== undefined) tokens.push(char + next);
    }
  }
  return tokens;
}

/** 查询 token：单字段用 unigram 匹配单字，多字段用相邻 bigram 匹配；query 里的空格是分词符。 */
function queryTokens(query: string): string[] {
  const tokens = new Set<string>();
  for (const segment of segments(query)) {
    const chars = Array.from(segment);
    if (chars.length === 1) {
      tokens.add(chars[0] ?? "");
    } else {
      for (let index = 0; index + 1 < chars.length; index += 1) {
        const left = chars[index];
        const right = chars[index + 1];
        if (left !== undefined && right !== undefined) tokens.add(left + right);
      }
    }
  }
  tokens.delete("");
  return [...tokens];
}

/**
 * 提示词头部的「长什么样」一行，就是结构化字段里缺的 description。
 * 只取第一个二级标题之前那一行，不把几千字的正文混进检索面；分类行是系列 facet，不参与检索。
 */
function promptDescription(prompt: string): string {
  const end = prompt.indexOf(HEADER_HEADING);
  const header = end === -1 ? prompt : prompt.slice(0, end);
  const line = header.split(/\r?\n/).find((candidate) => candidate.startsWith("- 长什么样："));
  return line === undefined ? "" : line.slice("- 长什么样：".length);
}

/**
 * 一张卡参与检索的文字，对齐检索基线的语料：name + description + fit + tags。
 * id / category / subcategory 是导航用的 facet，不混进 BM25，避免「赛博」靠系列类目污染排序。
 */
function searchableText(style: StyleAsset): string {
  return [style.name, promptDescription(style.prompt), style.fit, style.keywords.join(" ")].join(" ");
}

/** 从内置目录建检索索引。 */
export function buildStyleSearchIndex(catalog: StyleAssetIndex): StyleSearchIndex {
  const wallOrder = groupStyles(catalog).flatMap((group) => group.styles);
  const documents: SearchDocument[] = [];
  const postingMap = new Map<string, Posting[]>();
  let totalLength = 0;

  wallOrder.forEach((style, documentIndex) => {
    const tokens = documentTokens(searchableText(style));
    documents.push({ style, length: tokens.length });
    totalLength += tokens.length;
    const frequencies = new Map<string, number>();
    for (const token of tokens) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
    for (const [token, frequency] of frequencies) {
      const list = postingMap.get(token);
      if (list === undefined) postingMap.set(token, [{ document: documentIndex, frequency }]);
      else list.push({ document: documentIndex, frequency });
    }
  });

  return {
    wallOrder,
    documents,
    postings: postingMap,
    averageLength: documents.length === 0 ? 0 : totalLength / documents.length,
  };
}

/** 关键词检索：空 query（或只有标点）返回全量墙顺序；否则粗筛 + BM25 重排。 */
function searchStyles(index: StyleSearchIndex, query: string): readonly StyleAsset[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return index.wallOrder;
  const documentCount = index.documents.length;
  if (documentCount === 0) return [];

  const scores = new Map<number, number>();
  for (const token of tokens) {
    const postings = index.postings.get(token);
    if (postings === undefined) continue;
    // 含该 token 的卡片越少权重越高：「山水」比「画面」更能定位。
    const idf = Math.log(1 + (documentCount - postings.length + 0.5) / (postings.length + 0.5));
    for (const posting of postings) {
      const document = index.documents[posting.document];
      if (document === undefined) continue;
      const denominator =
        posting.frequency + BM25_K1 * (1 - BM25_B + (BM25_B * document.length) / index.averageLength);
      const contribution = (idf * (posting.frequency * (BM25_K1 + 1))) / denominator;
      scores.set(posting.document, (scores.get(posting.document) ?? 0) + contribution);
    }
  }

  return [...scores.entries()]
    .sort((left, right) => {
      if (left[1] !== right[1]) return right[1] - left[1];
      // 同分按墙上的顺序，保证确定性。
      return left[0] - right[0];
    })
    .flatMap((entry) => {
      const document = index.documents[entry[0]];
      return document === undefined ? [] : [document.style];
    });
}

/** 卡片墙的筛选状态：关键词 + 系列（null = 全部）。 */
export interface CardFilter {
  readonly query: string;
  readonly series: string | null;
}

/** 未筛选：全量、墙顺序。 */
export const EMPTY_FILTER: CardFilter = { query: "", series: null };

/**
 * 查询里有没有可检索的字/词。纯标点或纯空白视为空查询——
 * 界面（摘要、折叠、空态）与检索本身必须用同一个判定，不能各写一套。
 */
export function hasQueryTerms(query: string): boolean {
  return queryTokens(query).length > 0;
}

/** 按筛选状态筛出卡片；空 query + 无系列 = 全量墙顺序（清空即恢复）。 */
export function filterStyles(index: StyleSearchIndex, filter: CardFilter): readonly StyleAsset[] {
  const matched = searchStyles(index, filter.query);
  if (filter.series === null) return matched;
  return matched.filter((style) => style.series === filter.series);
}
