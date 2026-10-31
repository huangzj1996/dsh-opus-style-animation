# 目录检索基线 — what the two upstream searchers actually do, and what the 341 records support

Researched 2026-10-31 against `XiaoyeCodes/code-animation-prompts@main` (tree `69ccbeaf0b821591a40936572c2f559d8f4cfb68`, catalog
sha256 `df4df079…430a`). Builds on `docs/research/assets-and-licensing.md` (catalog shape, 159,373 B, 341 records) and
`docs/research/composer-takeover.md` (`/anim` is a host command). Ticket #14 asks how to score a one-line prompt against
the bundled catalog; this note records what upstream matches, what the corpus contains, and what a local scorer costs —
facts, not design.

**Keys.** `REPO/path:NN` = file in the upstream repo, line numbers of the raw file. **M:** = measured on this host by the
named script in `.tmp-research/`. **DSH:** = measured by running the installed Electron binary as Node (`ELECTRON_RUN_AS_NODE=1`).

---

## Verdict

- **Neither upstream searcher scores anything.** Both are filter-only substring matchers over one lowercased
  concatenated haystack; result order is catalog order unless the query *equals* a style id. REPO/styles.py:31-39,
  REPO/picker:194,346-353.
- The picker searches the **full prompt text** and the English fields; `styles.py` does not — yet on ten realistic
  Chinese queries both returned **identical counts**, because "the whole input must occur as one contiguous string"
  binds before haystack width does (M: `.tmp-research/matching3.mjs`).
- **Tags cannot carry the search:** only **124/341** records have any, only 2 of 10 series, 83 distinct, 75 singletons,
  top tag `2D` (62×); **0 of 10** realistic Chinese queries hit a tag (M:).
- **7 of 10 realistic Chinese queries return zero rows** under raw substring; the rest return 1, 2 and 3 of 341 (M:).
- Character bigrams are the cheapest thing that actually works here: 1–17 records per query, plausible top-3, and a
  BM25 rerank over those bigrams fixes the series-order tie (`Z4 山水` ahead of `Z1 水墨`). Cost is ~24 µs per query —
  JSON parse of the whole catalog is 1.3 ms (M: `.tmp-research/bench.cjs`).

---

## Q1 — upstream reference behaviour

### `styles.py` (2,381 B) — the CLI the SKILL.md tells the agent to use

```python
31:  query = args.query.casefold().strip()
32:  if args.command == "show":
33:      rows = [e for e in rows if e["id"].casefold() == query]
34:  elif args.command == "search":
35:      terms = query.split()
36:      rows = [e for e in rows if all(t in " ".join([
37:          e["id"], e["name"], e["category"], e["description"],
38:          e["fit"], *e["tags"]]).casefold() for t in terms)]
39:      rows.sort(key=lambda e: e["id"].casefold() != query)
```
REPO/styles.py:31-39

| Property | Behaviour | Evidence |
|---|---|---|
| Fields searched | `id name category description fit tags` — joined with spaces, casefolded. No `en`/`desc_en`/`prompt` (they are not in catalog.json). | styles.py:36-38 |
| Tokenisation | `query.split()` — **whitespace only**. A Chinese phrase has no spaces, so it stays **one term**. | styles.py:35 |
| Matching | Substring, **AND across terms** (`all(t in …)`). Not tokenised on the record side, so a term may straddle two fields' junction. | styles.py:36-38 |
| Ranking / score | None. One sort key: "is the query exactly this record's id"; everything else keeps **catalog order**. No score anywhere in the file (57 lines). | styles.py:39 |
| No match | `No matching styles. B6 is an example, not a catalog entry.` to stderr, exit 1. | styles.py:40-42 |
| `list` / `show` | `list` ignores the query, filters by `--series`, `--limit` default 20; `show` is exact-id and prints the md body. | styles.py:14-26,32-33,44-51 |

Measured consequences (M: `.tmp-research/matching2.mjs`): a Chinese query must appear **verbatim** in those six fields, and
splitting it into two terms makes it an **AND**, not an OR — `水墨 山水` → **0**, `文字 雨` → **0**, `霓虹 赛博` → 4, `粒子 聚形` → 1.
Catalog order is series order **AG, M, K, Z, H, L, V, X, R, O** (M: `A1…` first, `…O98` last), so broad queries always front-load A–G.

### The offline picker — `assets/library/风格挑选.html` (479,831 B; app JS is 14,498 chars, lines 154-417)

```js
194:  hay[e.id] = [e.id, e.name, e.en, e.cat, e.desc, e.desc_en, e.fit, (e.tags || []).join(' '), e.prompt, e.year].join(' ').toLowerCase();
...
347:  var q = state.q.trim().toLowerCase(); visible = [];
350:      (!state.img || (state.img === 'y' ? !!e.img : !e.img)) && (!state.only || picks.has(e.id)) && (!q || hay[e.id].indexOf(q) !== -1);
```
REPO/picker:194,347-353

- Haystack is **wider** than `styles.py`: it adds `en` (202 records), `desc_en` (90), `prompt` (141, median 327 chars, max
  2,825) and `year` — the catalog drops all five fields (M: `.tmp-research/matching3.mjs`; REPO/build_catalog.py:24).
- Matching is **one raw `indexOf` of the whole trimmed input** — no tokenisation at all, so `水墨 山水` matches nothing even
  though both words exist; `styles.py` at least splits on the space.
- **No score, no ranking, no limit**: every matching card stays in DOM (catalog) order; the only state is the visible set,
  recomputed on every `input` event (REPO/picker:355).
- Filtering is orthogonal: series, category, has-still, picked-only (REPO/picker:346-353). Measured: on all ten test
  queries the wider haystack returned the **same count** as the catalog-only one — the phrase constraint dominates (M:).

**Who owns the data:** `scripts/build_catalog.py` rebuilds the catalog **from the picker** — it regex-extracts
`<script id="data" type="application/json">`, maps `s→series, cat→category, desc→description`, copies `fit`/`tags` verbatim and
asserts counts against `_统计.json` (REPO/build_catalog.py:14-31). Our bundle is a projection; the picker is authoritative.

---

## Q2 — what is actually in `catalog.json`

159,373 B, 341 entries, 193 with `image` (148 text-only), keys = `id name series category description fit tags file image`.
Our local copy is byte-identical to upstream (sha256 `df4df079…430a`, M: `.tmp-research/fetch.py`).

Verbatim records from four of the ten series (M: `.tmp-research/catalog-stats.json`; `…` elides file/image paths):

```json
{"id":"A1","name":"字雨","series":"AG","category":"A 字","description":"话像雨一样落下来，越积越多。","fit":"被说教、重复的话、压力","tags":["字雨","落下","堆积"],…}
{"id":"Z1","name":"水墨","series":"Z","category":"中国风","description":"水墨晕染，留白，竹林 / ink wash, negative space","fit":"","tags":[],"image":"",…}
{"id":"R1","name":"霓虹雨夜 · 电影感","series":"R","category":"赛博朋克（第一批）","description":"一点透视的雨夜窄街，两边挂满竖招牌，青色的雾越远越浓，街尽头一团暖光；湿地面上的倒影占了半个画面。","fit":"","tags":[],…}
{"id":"O40","name":"炎热的夜晚","series":"O","category":"摇摆年代 1960–1969","description":"三色 Risograph 印刷：深蓝、海报橙红、荧光粉，带网点、颗粒和套色错位；光是用「少上墨」印出来的。…","fit":"三色 Risograph 夜景","tags":["2D"],…}
```

### `tags` vocabulary (M: `.tmp-research/analyze.mjs`)

| Measure | Value |
|---|---|
| Records with ≥1 tag | **124 / 341 (36.4 %)** — all 26 AG, all 98 O, **0 of the other 217** (M, K, Z, H, L, V, X, R) |
| Tag instances / distinct | 176 / **83** |
| Singleton tags | **75 of 83**; frequency tail: 62, 13, 13, 4, 3, 2, 2, 2, then 75×1 |
| Script | 75 CJK, **4 pure-ASCII** (`2D` 62, `3D` 13, `2.5D` 3, `2D (B&W screen)` 1 = 79/176 instances, 44.9 %), 0 mixed |
| Multi-token tags | 5 use `·`/space: `2D·B&W` 13, `3D·B&W` 4, `2.5D·B&W`, `2D·Sepia`, `2D (B&W screen)` |
| Tag char length | median 2, p90 3, max 15 |

Then 75 singletons such as `字雨`, `砸下来`, `宣纸`, `漏光`, `扁平`, `剪纸`; `聚成`/`散开`/`生长` twice each.

**How tags are assigned:** authored upstream inside the picker's embedded JSON; the rebuild script only copies them
(REPO/build_catalog.py:24) and no script in the repo derives them — grep `tags` in `scripts/build_visuals.py` = 0 hits (M:).
The two populated series carry visibly different tag idioms: AG = 2–3 Chinese motion/noun terms per style
(`字雨/落下/堆积`, `聚成/形状/散开`), O = one format label per film (`2D`, `3D·B&W`). Treat tags as a partial,
hand-curated facet, not an index.

### Names, descriptions, fits (M:)

| Field | empty | min | median | p90 | max | mean |
|---|---|---|---|---|---|---|
| `name` (chars) | 8 | 0 | 4 | 9 | 23 | 5 |
| `description` | 54 | 0 | 29 | 80 | 117 | 37 |
| `fit` | 50 | 0 | 9 | 19 | 57 | 10 |
| whole searchable text (`name+desc+fit+tags`) | 8 | 0 | 45 | 99 | 146 | 53 |

- Name shapes: short Chinese nouns (`水墨`, `剪纸`, `字雨`); 8 use `·`; 35 contain ASCII (`BlockFrame`, `等距 2.5D`); 8 M-series
  entries have **no name at all**, and those same 8 (`M14-M17, M26, M35, M39, M40`) have name+description+fit+tags **all empty**.
- `description` is the only field with real vocabulary; `fit` is a short use-case phrase. 46 of the 54 empty descriptions are
  V (15) + X (31) — those series carry only a `fit` line.

### Series and categories (M:)

| Series | AG | M | K | Z | H | L | V | X | R | O |
|---|---|---|---|---|---|---|---|---|---|---|
| Styles | 26 | 40 | 38 | 15 | 12 | 59 | 15 | 31 | 7 | 98 |
| With tags | 26 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 98 |

41 distinct `category` values; largest are `code-video` 31, `画面风格` 30, `中国风` 15, `mg-styles-15` 15, `现成版式` 12,
the ten O decade buckets ~10 each. Category is a series-local facet, not a cross-series taxonomy.

---

## Q3 — Chinese matching, measured on this host

Runtime for all of Q3/Q4: Node `v24.21.0`, ICU **78.3**, `Intl.Segmenter` present (M:); the DSH host runtime is
Electron 44.7.0 / Node 24.21.0 / ICU **78.2** and behaves identically (DSH:).

### `Intl.Segmenter` word mode is the wrong tool for this corpus

| Input | `granularity:'word'` (isWordLike) | graphemes | char bigrams |
|---|---|---|---|
| 赛博朋克 | `赛 / 博 / 朋 / 克` (4 single chars) | 4 | 赛博, 博朋, 朋克 |
| 霓虹雨夜赛博朋克城市 | 霓虹 / 雨夜 / 赛 / 博 / 朋 / 克 / 城市 | 10 | 9 |
| 粒子聚形 | 粒子 / 聚 / 形 | 4 | 粒子, 子聚, 聚形 |
| 极简线条 | 极 / 简 / 线条 | 4 | 极简, 简线, 线条 |
| 电影感 | 电影 / 感 | 3 | 电影, 影感 |
| 水墨 / 星空 | 水墨 / 星空 (correct) | 2 | 1 each |

ICU's zh dictionary splits compounds that are exactly the style vocabulary we need (`赛博朋克`, `极简`), while the
catalog's own names are compounds (`极简线条`, `粒子聚形`). Grapheme segmentation just yields 1-char tokens. **Character
bigrams need no ICU at all** and produced every usable result below (M: `.tmp-research/matching.mjs`).

### Coverage of ten realistic queries (M:)

`a` = raw substring over the `styles.py` field set; `b` = records sharing ≥1 char bigram with the query over
`name+description+fit+tags`; `c` = substring hits in `tags` only.

| Query | (a) substring | (b) bigram | (c) tag |
|---|---|---|---|
| 霓虹雨夜赛博朋克城市 | 0 | 17 | 0 |
| 水墨山水 | 0 | 6 | 0 |
| 粒子聚形 | 1 (`B3`) | 5 | 0 |
| 中国风剪纸 | 0 | 8 | 0 |
| 光速穿梭爆炸 | 0 | 1 (`L14`) | 0 |
| 卡通猫咪 | 0 | 6 | 0 |
| 极简线条 | 2 (`K4`,`K30`) | 17 | 0 |
| 文字雨 | 0 | 4 | 0 |
| 星空 | 3 (`B4`,`L58`,`O57`) | 3 | 0 |
| 电影感 | 3 (`M28`,`L50`,`R1`) | 15 | 0 |

`光速穿梭爆炸` is the repo's own flagship example (B6), and SKILL.md:27 states B6 is **not** a catalog entry — the query
still finds only one weak row (`L14 爆炸图拆解`, 1 bigram of 5). Raw substring recall on this corpus is effectively zero.

### Top-3 per approach, four queries (M: `.tmp-research/matching.json`)

| Query | (a) substring rows | (b) bigram top-3 [shared/query bigrams] | (d) BM25 over the same bigrams (score) |
|---|---|---|---|
| 霓虹雨夜赛博朋克城市 | — | `V8 赛博朋克界面` [3/9], `R1 霓虹雨夜 · 电影感` [3/9], `K34 赛博霓虹` [2/9] | V8 22.4, R1 12.2, K34 10.8 |
| 水墨山水 | — | `C1 水墨晕开` [1/3], `Z1 水墨` [1/3], `Z4 山水` [1/3] | **Z4 7.9**, Z1 6.1, Z13 5.6 |
| 中国风剪纸 | — | `L26 红色窗花剪纸` [3/4], `C1 水墨晕开` [1/4], `E2 剪纸层叠` [1/4] | L26 14.5, **Z5 剪纸 6.0**, C1 5.6 |
| 文字雨 | — | `A1 字雨` [1/2], `M10 把一个抽象概念…` [1/2], `M3 文字建筑` [1/2] | A1 6.2, **L33 瑞士动态排版 4.5**, M10 3.9 |

Bigram counts tie constantly (a 6-char query yields 5 bigrams), so **catalog order decides the top-3** — hence `C1` leading
`Z1`/`Z4`. BM25 on the same tokens breaks ties by IDF and moves `Z4 山水`/`Z5 剪纸` to the front, but also pulls in `L33` for 文字雨.
Neither approach was tuned.

**English / ASCII.** 44.9 % of tag instances are ASCII, but they are format labels (`2D`, `3D`), and no test query produced one. The catalog has
**no English name field** — upstream's `en` (202) and `desc_en` (90) are dropped by `build_catalog.py` — so the only ASCII in the
record text sits inside 35 names, 85 descriptions and 46 fits. Cross-language matching would need a synonym layer; nothing upstream has one.

---

## Q4 — failure modes

- **Too few / nothing.** 7/10 realistic queries → 0 rows, because matching is on the *whole input* (`styles.py`: one term
  after `.split()`; picker: one `indexOf`). Any multi-clause Chinese prompt is guaranteed to fail.
- **Too many.** Single-character or generic words flood: `光` → **65** records, `画面` → **31**, `电影` → 15, `动画` → 6,
  `风格` → 2, `炫酷` → **0** (M:). There is no length floor and no IDF in either upstream searcher, so nothing separates a
  65-row answer from a 1-row one.
- **Reachability via tags.** 124/341 records carry a tag at all, and a query must contain the tag **verbatim** (tags are not
  tokenised against the query either): `水墨` hits exactly one tag (`C1`), `赛博`/`粒子`/`文字`/`猫`/`星空`/`爆炸` hit **none**. The five
  `·`-bearing tags are unreachable from any natural sentence.
- **Empty records.** 8 M-series records have no name/description/fit/tags, so they can never be returned by any text query;
  46 V/X records have no description (fit only); 54 records have no description, 50 no fit.
- **`description` vs `fit`.** `description` is the richer field (median 29 vs 9 chars, 287 vs 291 non-empty) and produced bigram
  matches in 8 of 10 queries; `fit` in 7 of 10 and never alone. `fit` answers *"what is this for"* ("回忆、旧时光"),
  `description` *"what does it look like"*. Names are densest per character (median 4 chars; 10/10 queries matched one).
- **Series bias.** Ties fall back to catalog order, so an unscored scan puts an A–G entry first in 2 of the 4 top-3
  tables above even when the better answer is in Z or L.

---

## Q5 — where the scorer can run

| Fact | Value | Evidence |
|---|---|---|
| `/anim` is handled by a **host command** whose handler runs in the host process | yes; handler gets `{agent, rawInput, attachments}` | `docs/research/composer-takeover.md` (Verdict; ASAR:dsh-commands) |
| Host runtime | the app binary with `ELECTRON_RUN_AS_NODE=1` — i.e. **Electron's Node**, not a separate `node.exe` | `resources/runtime/bin/node.cmd` (2 lines) |
| Versions (DSH:) | Electron **44.7.0**, Node **24.21.0**, Chromium **152.0.7977.130**, ICU **78.2** | `ELECTRON_RUN_AS_NODE=1 '…\DeepSeek Harness.exe' -e "console.log(process.versions)"` |
| Bundled runtime manifest | `node 24.21.0`, `pnpm 11.28.5` | `resources/runtime/versions.json` |
| Full ICU in the host | ICU **78.2**, `Intl.Segmenter` = function, `new Intl.Segmenter('zh',{granularity:'word'})` segments 赛博朋克 → 赛/博/朋/克 | DSH (same probe) |
| Chromium renderer | Chromium 152; `icudtl.dat` 10,875,024 B ships beside the exe; `Intl.Segmenter` is Baseline "widely available" (Chrome supported) | file listing; MDN Intl.Segmenter |
| Cost of a full scan | JSON.parse 159,373 B = **1.32 ms**; substring over 341 records × 10 queries = **0.186 ms** (≈19 µs/query); bigram index scan × 10 = **0.241 ms** (≈24 µs/query) | M: `.tmp-research/bench.cjs` under Electron-as-Node |

- A host-side scorer reads the bundled `catalog.json` with `fs` at activation — no RPC route, no second copy of the 159,373 B
  file. A client-side scorer would have to ship it again inside `dsh.client` (35,410 B gzip) or add a fetch route.
- `Intl.Segmenter` exists in both halves, but per Q3 its zh word output is the wrong granularity; a bigram scorer needs no
  ICU, so scoring stays portable to a small-ICU build. At 341 records, scoring every record on every keystroke is free.

---

## UNVERIFIED & open questions

- **Picker behaviour in a real browser** — the JS was read statically (lines 154-417) and re-implemented in Node for the
  counts; the file itself was not opened in a browser (it needs the 193 jpgs alongside).
- **Whether the picker's `prompt` field changes recall on prompts-only terms** — the whole-phrase constraint masked any
  difference on all ten queries; a per-word test was not run.
- **Origin of the tags** — no script in the repo writes them; that they are hand-authored inside the picker's JSON is an
  inference from build_catalog.py:24 plus the AG/O-only distribution.
- **Chromium renderer `Intl.Segmenter` behaviour** was not executed in the renderer (only Chromium 152's presence and MDN's
  Baseline status are documented here).
- **Which series a "best" answer should prefer** is a judgement call; this note only reports that unscored ordering
  prefers A–G, and that IDF reranking changes the answer.

## Sources

Primary, fetched 2026-10-31 into `.tmp-research/` from `https://raw.githubusercontent.com/XiaoyeCodes/code-animation-prompts/main/`:
`…/scripts/styles.py` (2,381 B) · `…/references/catalog.json` (159,373 B) · `…/SKILL.md` (1,884 B) · `scripts/build_catalog.py`
(2,691 B) · the picker `…/assets/library/风格挑选.html` (479,831 B, in 90 KB ranges; app JS at `.tmp-research/picker-app.js`).
Tree: <https://api.github.com/repos/XiaoyeCodes/code-animation-prompts/git/trees/main?recursive=1>.

Measured: `fetch.py` (ranged downloader — host pwsh TLS fails, Python + unverified SSL + `Range` works) ·
`analyze.mjs`→`catalog-stats.json` · `matching.mjs`→`matching.json` · `matching2.mjs`→`matching2.json` ·
`matching3.mjs`→`matching3.json` · `bench.cjs` (timings under `ELECTRON_RUN_AS_NODE`).

Runtime: `…\resources\runtime\versions.json`, `…\resources\runtime\bin\node.cmd`; MDN `Intl.Segmenter` —
<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter>.
