# Style constants (WIDTH / HEIGHT / DURATION / SEED) — measured extraction coverage over 341 style prompts

Researched 2026-10-31 against **XiaoyeCodes/code-animation-prompts @ main** (`pushed_at` 2026-10-29T13:20:54Z).
Records come from `skills/code-animation-prompts/references/catalog.json`; texts from the raw host at
`.../main/skills/code-animation-prompts/<file>`. All 341 `<ID>_<name>.md` were fetched (1,432,189 bytes, **0
failures**, 11 s at concurrency 12). The copy vendored in this repo (`code-animation-341-styles-main/风格提示词/`)
is byte-identical for 341/341 files, so the numbers describe both. Every claim below was produced by a throwaway
Node script that read all 341 texts, not by reading samples; quoted lines are the matched lines, verbatim.

**Question.** Can the plugin fill a skeleton CONFIG (`WIDTH/HEIGHT`, `DURATION`, `SEED`) from each style's
markdown by regex — or must it ask an agent, or fall back to defaults? Measure, don't estimate.

---

## Verdict

**Hybrid — regex first, then a deterministic default; the agent is a third step for DURATION only.**

| Option | Measured outcome |
|---|---|
| Pure regex | canvas **35/341 (10.3%)**, duration **29/341 (8.5%)**, seed **18/341 (5.3%)**; **291/341 (85.3%) yield none of the three** |
| Agent fills CONFIG | 8 files have an empty prompt body and 61 more are one-liners ≤60 chars — nothing to fill *from*; on the rest the agent would re-derive the house default for canvas at token cost |
| Hybrid (recommended) | 100% of files get values; 35 canvases and 29 durations are *checked* rather than assumed |

The deciding number is 85.3%. Nine files in ten carry no machine-readable constant, so a regex-only pipeline is
not a pipeline — it is a defaults table with a parser attached. But the inverse is also false: canvas is a house
constant (340/341 are 16:9, exactly one file V15 is portrait), so asking an agent per file to "decide" 1920×1080
buys nothing and costs a call. Duration is the only field where the prose actually decides, and it is stated by
5.9% of the corpus — exactly the case for "regex first, agent fills the gap".

---

## 1. Method & measured corpus

- `catalog.json` → 341 records, each with a repo-relative `file`. Every `file` was fetched verbatim with retries;
  **no file is guessed or approximated**. (A first pass used the repo root as the prefix instead of
  `skills/code-animation-prompts/` and produced 341×404 — caught by checking one URL before the batch, then fixed.)
- Detection ran over all 341 texts with the ordered rules in §3; each hit stores its matched line, which is what
  is quoted below. Numbers per rule were also taken *independently* (each rule alone), so the table shows real
  yield, not residue after an earlier rule.
- Corpus shape, measured:

| Slice | Count |
|---|---|
| records / catalog series | 341 / 10 — AG 26, H 12, K 38, L 59, M 40, O 98, R 7, V 15, X 31, Z 15 |
| **规约型** (≥2 of the five headings) | **4** — B3, M1, Z5, H1. The other 337 match **zero** of the five |
| empty `## 风格提示词` body | 8 — M14–M17, M26, M35, M39–M40 |
| one-line body (≤60 chars) | 61 — H2–H12, K2–K38, Z1–Z4, Z6–Z14 |
| body 60–200 / 200–1000 / >1000 chars | 26 / 23 / 223 (median 1,669) |

**The ticket's four samples are not four formats of one corpus.** B6 is not in the 341 at all — the catalog has
B1–B5 only; B6 is the demo `示例/B6_光速穿梭·爆炸·重聚_同一份提示词/提示词.md`. Its format
(`W=1920，H=1080，屏幕中心 (960,540)` … `总长 12 秒` … `mulberry32(7)`) matches **0 of 341** files: `W =` occurs
0 times and `总长` occurs 0 times in the corpus. B3 and Z5 are two of the four 规约型 files; R1 is 308 chars of
prose with no constant at all. The formats do differ wildly — but the distribution is 4 rich files, 1 English-spec
series (V), a handful of English specs that name a frame (L), one code series (AG), and ~200 bare prose files.

---

## 2. Coverage — overall and per series

Counts are files for which the ordered rules produce a value. **dur (+code)** adds the 9 durations recoverable
from the reference implementation's loop expression (§4), which no prose regex can see.

| Series | N | canvas | duration | dur (+code) | seed |
|---|---|---|---|---|---|
| AG (A–G code samples) | 26 | 1 | 1 | 10 | 15 |
| H | 12 | 1 | 1 | 1 | 1 |
| K | 38 | 0 | 0 | 0 | 0 |
| L | 59 | 12 | 0 | 0 | 0 |
| M | 40 | 1 | 2 | 2 | 1 |
| O | 98 | 4 | 0 | 0 | 0 |
| R | 7 | 0 | 0 | 0 | 0 |
| V | 15 | 15 | 15 | 15 | 0 |
| X | 31 | 0 | 0 | 0 | 0 |
| Z | 15 | 1 | 1 | 1 | 1 |
| **total** | **341** | **35 (10.3%)** | **20 (5.9%)** | **29 (8.5%)** | **18 (5.3%)** |

AG detail: seed 15/26 (A1, A5, B1–B5, C1, C4, D1–D4, F3, G1; B3 is `mulberry32(2026)`, the other 14 are `rng(N)`
inside the reference implementation). Canvas and duration are 1/26 (B3 only). K (38), X (31) and R (7) yield **nothing** on all three fields; inside
AG, the E samples E1–E3 do too.

### 2.1 Cross-tab: 规约型 vs 灵感型

| Regime | N | canvas | duration | dur (+code) | seed | all three fields |
|---|---|---|---|---|---|---|
| 规约型 (≥2 headings) | 4 | 4 (100%) | 4 (100%) | 4 | 4 | 4 |
| 灵感型 | 337 | 31 (9.2%) | 16 (4.7%) | 25 | 14 (4.2%) | 0 |

The gap is total, not gradual: the regimes are "has a spec block" vs "has none". All four 规约型 files use the
same three phrasings, which is why they are 100%: `canvas 固定 1920×1080` (B3, M1, Z5, H1), `总时长：{{秒，默认 N}}`
(M1 = 20, Z5 = 12, H1 = 6), and `mulberry32(2026 | seed)`. Of the 19 files that state both canvas and duration,
15 are V1–V15 and the other 4 are those files.

---

## 3. Regex rule table (ordered; first match wins)

| # | Regex | What it matches | Hits (alone) | Example (verbatim, with id) |
|---|---|---|---|---|
| C1 | `\bcanvas\s*(?:固定\|大小\|尺寸)?\s*[:：]?\s*(\d{3,4})\s*[×xX*]\s*(\d{3,4})` | the 规约型 template | 4 | B3: `2. canvas 固定 1920×1080；用 CSS 让它在窗口里等比缩放并居中，多出来的部分是黑边。` |
| C2 | `(\d{3,4})\s*[×xX]\s*(\d{3,4})\s*[,，]\s*\d+\s*fps` | English delivery spec line | 15 | V2: `- 1920×1080, 30 fps, exactly 10.000 s (300 frames), H.264 MP4 with stereo AAC audio (48 kHz), mastered to −14 LUFS` |
| C3 | `\*\*原片\*\*[^\n]*?(\d{3,4})\s*[×xX]\s*(\d{3,4})` | V-series header line (redundant here) | 15 | V1: `**原片**：手作 HAND MADE · 1920×1080 · 24 fps · 10 秒 · AI 评审终评 8.07 / 10` |
| C4 | `(?:Frame and layout\|版面)[^\n]*?(\d{3,4})\s*[×xX]\s*(\d{3,4})` | L-spec frame heading, H 版面 heading | 4 | L1: `## 2. Frame and layout (1920×1080)` |
| C5 | `(?<![\d×xX])(1920\|1080)\s*[×xX]\s*(1080\|1920)(?![\d×xX])` | catch-all 16:9 pair | 35 | O31: `…1920×1080 下点径一到三像素…` |
| D1 | `总循环\s*(\d+(?:\.\d+)?)\s*秒` | stated total loop | 1 | B3: `N = 5000 颗粒子；每个形状一个周期 PER = 4.8 秒，共 4 个形状，总循环 19.2 秒；…` |
| D2 | `总时长[^\n]{0,12}?默认\s*(\d+(?:\.\d+)?)` | template placeholder default | 3 | Z5: `- 总时长：{{秒，默认 12}}` (M1 → 20, H1 → 6) |
| D3 | `exactly\s+(\d+(?:\.\d+)?)\s*(?:s\|sec)\b` | English exact length | 15 | V2 (same line as C2): `exactly 10.000 s (300 frames)` |
| D4 | `\*\*原片\*\*[^\n]{0,90}?(\d+(?:\.\d+)?)\s*秒` | V header `N 秒` | 15 | V1: same line, `· 10 秒 ·` |
| D5 | `(?:做\|总时长\|时长\|全片\|整段\|片长)[^\n]{0,6}?约?\s*(\d+(?:\.\d+)?)\s*秒` | anchored loose total | 1 | M34: `做一个约 60 秒、好看好懂的动态图形，像新闻快讯那样介绍…` |
| D6 | `\b(?:Length|Duration)\s*[:：]\s*(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)\s*s\b` | stated range | 1 | L4: `- Length: 30–90 s; one brake at least; one hard stop always.` |
| D7 | `\bt\s*%\s*(\d+(?:\.\d+)?)` (only inside js blocks) | loop period in the reference implementation — **derivable, not stated** | 8 | A5: `const q = t % 9; c.fillStyle = '#07070a'; c.fillRect(0, 0, w, h);` |
| S1 | `mulberry32\s*\(\s*(\d+)\s*\)` | literal seed | 1 | B3: `所有随机都用带种子的 mulberry32(2026)，并且只在启动时生成一次` |
| S2 | `mulberry32\s*\(\s*seed\s*\)` | symbolic seed ("you choose") | 3 | Z5: `需要随机就用带种子的 mulberry32(seed)` (also M1, H1) |
| S3 | `\brng\s*\(\s*(\d+)\s*\)` | seed embedded in reference code | 14 | A1: `if (!s.init) { s.init = 1; s.r = rng(3); s.drops = []; …` |

> Alternation pipes are escaped as `\|` so the table renders; strip the backslash before compiling. Everything else is copy-exact.
>
> The B6 template `\bW\s*=\s*(\d{3,4})\s*[,，]\s*H\s*=\s*(\d{3,4})` scores **0/341** — it exists only in
> `示例/`, never in the catalog. Add it to the table the day upstream migrates the corpus.

**Guards that the measurement forced** (each was a false positive caught in the corpus, not a hypothetical):

- Never use bare `\d+\s*秒`: 722 distinct lines contain a `秒` number and most are beat timings — O45
  `抚猫一下约 4 秒`, O67 `两次翻页（约 2.7 秒和 4.2 秒）`, O86 `2.5 秒一刀不剪`, M1 `一笔 0.4–1.2 秒`. An
  unanchored rule turned 4 of these into "total duration" (2, 2.7, 3, 4 s) before D5 was anchored on
  `做|总|时长|全片|整段|片长`.
- Do **not** exclude lines containing `年代`: an early guard against L2's title `# L2 1920 年代新闻片` also killed
  the two real hits O31 (`美好年代`) and O61 (`80 年代喷枪插画`). The title never matches anyway — it has no `×`.
- V1–V14 contain `1080×1920` in a portrait *suggestion* (`想换成自己的内容…比如竖屏 1080×1920`); C2's `…, N fps`
  anchor keeps the suggestion from overriding the spec. V15 is genuinely `1080×1920` on the spec line — the only
  portrait style in 341.

---

## 4. Derivable cases

Four derivation paths exist; only the second adds files that no prose rule reaches, and it lives in the code.

1. **PER × N** — B3: `每个形状一个周期 PER = 4.8 秒，共 4 个形状，总循环 19.2 秒` → 4.8 × 4 = 19.2, which also
   cross-checks D1. Net gain: 0 (the same file states the total). It is the only `PER` in the corpus.
2. **Loop period in the reference implementation** (`t % N` and one `TAU*t/N`): A5 `const q = t % 9;`,
   C1 `const tm = t % 10;`, C2 `const tm = t % 10,`, D4 `const p = (t % 12) / 12,`, E1 `const tm = t % 6.5,`,
   F1 `const tm = t % 8.5,`, F2 `const tm = t % 10,`, G2 `const tm = t % 5,`, B5
   `Math.cos(TAU * t / 8)`. **9 files** → 5, 6.5, 8, 8.5, 9, 10, 10, 10, 12 s. This is the single largest
   derivable population and the reason "dur (+code)" exists in §2.
3. **Range** — L4 `Length: 30–90 s` (D6). One file; a pipeline must pick a bound (60 mid / 90 top) and say which.
4. **Loose total** — M34 `做一个约 60 秒` (D5). One file.

Not derivable, despite looking like it should be: **summing beat lists**. H1's beats end at 2.8 s plus
`结尾 0.5 秒`, yet the file's own default is **6**; Z5's beats end at 4.4 s (`0–0.8 … 4–4.4 秒`) yet its default is
**12**. Beat-sum under-reads by 2–3×; do not ship it as a rule.

---

## 5. Failure population

**Canvas — 306 files** (no size stated): A1–A5, B1–B2, B4–B5, C1–C4, D1–D4, E1–E3, F1–F3, G1–G2, H2–H12,
K1–K38, L3, L6, L9–L30, L32, L34–L44, L46–L51, L55–L59, M2–M40, O1–O30, O32–O56, O58, O60, O62–O98, R1–R7,
X1–X31, Z1–Z4, Z6–Z15.

*Default 1920×1080 silently means:* "this is a 16:9 landscape film". Defensible — 340/341 are, and the one
exception (V15, portrait) is caught by C2. What it hides is a future portrait/square style in the same corpus:
nothing in 306 files constrains it.

**Duration — 321 files** (no stated total; 312 after the 9 code-period recoveries): A1–A5, B1–B2, B4–B5, C1–C4,
D1–D4, E1–E3, F1–F3, G1–G2, H2–H12, K1–K38, L1–L59, M2–M33, M35–M40, O1–O98, R1–R7, X1–X31, Z1–Z4, Z6–Z15.

*Default 12 s silently means:* "the loop is 12 s". Measured stated values are 6, 10 (×15), 12, 19.2, 20, 60, and
code periods 5/6.5/8/8.5/9/10×3/12. A 12 s default matches exactly 2 of the 29 known values (Z5, and D4's
`t % 12`) and is wrong for the other 27 — including the largest single family (V1–V15, all 10.000 s). The
empirical mode is **10**, not 12; a default of 12 is a choice, not a measurement.

**Seed — 323 files** (no literal, no symbolic seed): A2–A4, C2–C3, E1–E3, F1–F2, G2, H2–H12, K1–K38, L1–L59,
M2–M40, O1–O98, R1–R7, V1–V15, X1–X31, Z1–Z4, Z6–Z15.

*Default hash(id) silently means:* "reproducible, style-parameterised randomness". Harmless:
3 files (M1, Z5, H1) explicitly delegate the choice with `mulberry32(seed)`, and the 15 literal seeds
(A1=3, A5=9, B1=5, B2=7, B3=2026, B4=13, B5=17, C1=23, C4=29, D1=31, D2=37, D3=41, D4=43, F3=53, G1=59) only
matter if the plugin wants the *authoring* look byte-for-byte; any seed still renders a valid variant.

**Nothing at all — 291 files (85.3%)**. Among them, 8 have an empty body (M14–M17, M26, M35, M39–M40 — M14 is
literally `# M14` + a category line + an empty `## 风格提示词`) and 61 are one-liners (K5:
`corporate memphis, flat vector people`). For those 69 files an agent-fill step is *inventing* a style, not
extracting one — defaults are cheaper and more consistent.

---

## 6. Recommendation

**Regex → default → (duration only) agent override.** Concretely:

1. Run §3 in order. Record `source` per field (`regex:C2`, `code:t%N`, `default`, `agent`) so coverage stays
   auditable against this document.
2. Fill gaps from a fixed table: `WIDTH=1920`, `HEIGHT=1080`, `DURATION=12`, `SEED=hash32(id)`. Canvas and seed
   defaults need no agent: exactly one style (V15) departs from 16:9, and a seed is a free parameter in every
   file that does not name one.
3. Only for `DURATION` with `source=default`, and only when the body is >200 chars, let the writing agent propose
   a value **if it can quote the line**; the plugin accepts, clamps to 1–60 s, and keeps the citation. This is
   the one field where the prose decides (17 explicit + 3 template defaults + 9 code periods spread 5–60 s).

Expected after the hybrid: canvas 341/341 (35 checked, 306 default), duration 341/341 (29 checked, 312
default-or-agent), seed 341/341 (18 checked, 323 hash). Checked-vs-assumed is the number to watch: **10.3% /
8.5% / 5.3%**.

Do **not**: let the agent pick WIDTH/HEIGHT (house constant, 340/341); let it invent a numeric SEED (breaks the
"seed is a style parameter" contract and reproducibility); ship regex-only (291 files get nothing); ship
agent-only (69 files have nothing to read, and the 29 durations that are written down or derivable would become
guesses).

---

## UNVERIFIED

- **Agent-fill accuracy.** No LLM run in this ticket. The recommendation rests on the *ceiling* (what text
  exists), not on a trial of how well an agent picks a duration from prose.
- **Fractional durations.** 19.2 (B3), 6.5 / 8.5 (E1 / F1) are stated or derivable; whether the skeleton's
  CONFIG accepts non-integers was not checked against plugin code.
- **`t % N` == DURATION.** Nothing in the markdown calls the code period a duration; reading it as the loop
  period is an inference from the reference implementation, plausible for all 9 but not asserted by the text.
- **The 5 inner-frame cases.** L2 (`1480 × 1080 inside 1920 × 1080`), L45 and L53 (`1440×1080`), L7
  (`960×1080`), L32 (`1000×1500 u` poster units) were classified by reading the line, not by a rule; L32 was
  excluded as a unit, the others counted as 1920×1080 because the outer frame is stated on the same line.
- **Corpus drift.** The catalog is dated 2026-10-29 and already lags `示例/` (B6 uses a newer template that no
  catalog file uses). If upstream migrates the 341 to the B6 template, C1/D1/S1 would jump from 4/1/1 hits to
  potentially all 341 — re-run this script then.
