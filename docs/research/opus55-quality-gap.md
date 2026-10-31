> **历史记录（调研于 2026-10-30/31）：** 本文件是当时的原始研究笔记。其中 `/anim` 命令线、指令装配、闸门、播放器的路线已在 2026-10-31 二次重锚中退场（见 [`docs/adr/0001-carry-style-source-not-compiled.md`](../adr/0001-carry-style-source-not-compiled.md)）；当前实现以仓库 [README](../../README.md) 与 `docs/adr/` 为准。

# Opus 5.5 vs DeepSeek-V4.1-Flash on B6 — quality gap, prompt anatomy, render contract

**Question.** For one and the same prompt, what does Opus 5.5 actually do that DeepSeek-V4.1-Flash does not — and what would a plugin have to enforce to reproduce it?

**Method.** Downloaded both HTML files, the prompt, and the two comparison screenshots from `XiaoyeCodes/code-animation-prompts@main`; measured them statically (byte/line counts, comment and function counts, numeric-literal sets, feature greps); read three further style prompts and the export pipeline end to end. Citations use `KEY:line`; full paths and raw URLs are in **Sources**. Claims I could not verify are marked **UNVERIFIED**.

## Summary

- The pair does **not** show a technology gap. Both are a single self-contained HTML file, Canvas 2D, 1920×1080, 4000 particles, 12 s, seeded `mulberry32(7)`, no external library/font/image, no `Math.random`, no `Date.now`. Neither uses WebGL, three.js, SVG or CSS keyframes; neither implements bloom, chromatic aberration, film grain or depth of field.
- The prompt is a **full written spec** (formulas, constants, palette, per-step draw order). Both models therefore converge on the same algorithm; the repo author states the effect himself: the more precisely colour/timing/camera are written down, the closer different models land (SHUOMING:43).
- Size runs **against** the premise: Opus 12,351 B / 332 lines; DeepSeek 14,731 B / 513 lines (+19 % bytes, +54 % lines) for the **same 14 functions** and almost the same number set (478 literals / 128 unique vs 503 / 136).
- Opus adds a **machine-driveable surface**: `window.__draw` + `window.__canvas` (OPUS:312). DeepSeek exposes nothing — 0 hits for `renderAt` and 0 for `export` in both files, so Opus is one line away from the render contract and DeepSeek is not.
- Opus keeps **time a pure function**: `draw` normalises any `t` itself (OPUS:174) and playback feeds wall-clock seconds (OPUS:325). DeepSeek integrates per-frame deltas with a 50 ms clamp (DS:502–505) and clamps `?t=` instead of wrapping (DS:486) — playback speed becomes frame-rate dependent, out-of-range stills render black.
- Opus is **signposted**: 16 comment lines, 8 section headers, 7 numbered draw passes (OPUS:17–315). DeepSeek: **0 comment lines** in 457 non-blank lines.
- Opus **parameterises the copy** — `TITLE`, `SUBTITLE`, `FONT` consts (OPUS:20–22). DeepSeek inlines the title 3× (DS:6, 127, 441).
- The deliverable gap is larger than the code gap: Opus's folder ships `index.html` + mp4 + **9 timestamped stills** (t1, 2.8, 3.65, 5.3, 5.7, 6.4, 7.5, 9.5, 10.8); DeepSeek's session shows only `index.html` (+513 lines, "用时 10 秒").
- DeepSeek is **ahead** in three small places: off-screen bbox culling (DS:342–343), `willReadFrequently` on the sampling canvas (DS:121), and per-frame 2-colour batching instead of 4000 `rgb()` string builds (DS:240–273, 316). A plugin should copy these, not drop them.

## The pair at a glance (measured, not estimated)

| Metric | Opus 5.5 | DeepSeek-V4.1-Flash | Evidence |
|---|---|---|---|
| Bytes / lines | 12,351 / 332 | 14,731 / 513 | file headers; `read` totals |
| Non-blank lines | 310 | 457 | counted |
| Comment lines | 16 (8 section headers + 7 numbered passes + 1 inline) | **0** | counted |
| Functions / `ctx.*` calls | 14 / 68 | 14 / 76 | counted |
| Numeric literals (unique) | 478 (128) | 503 (136) | regex extraction |
| Longest line / avg code line | 132 / 34 ch | 111 / 26 ch | counted |
| Render tech | Canvas 2D, one file | Canvas 2D, one file | OPUS:170 / DS:84 |
| Particles / rings | 4,000 / 5 × 96 segments | 4,000 / 5 × 96 segments | OPUS:19,237 / DS:37,366 |
| Duration / loop | 12 s, `t % TOTAL` | 12 s, `(elapsed) % DURATION` | OPUS:174 / DS:505 |
| Motion blur | 2-sample streak, DT=0.03→0.06 s | identical | OPUS:204–226 / DS:306–350 |
| Glow / vignette / flash | additive `lighter` + radial vignette + exponential flash | identical | OPUS:200–308 / DS:303–471 |
| Bloom / CA / grain / DOF | **absent** | **absent** | feature grep |
| Seeded RNG | `mulberry32(7)`, once | `mulberry32(7)`, once | OPUS:33 / DS:82 |
| Export surface | `window.__draw`, `window.__canvas` | none | OPUS:312 / grep = 0 |
| `?t=` handling | any float, wrapped by draw | clamped to [0,12] | OPUS:316 / DS:482–488 |
| External deps | none | none | `http`, `@font-face` = 0 |

## Ranked gap list

Ranked by leverage for a plugin — i.e. how much of the observed difference one enforceable rule buys.

| # | What Opus 5.5 does | Evidence | How a plugin could enforce it |
|---|---|---|---|
| 1 | Exposes the render surface on `window` (`__draw`, `__canvas`) so a host can step frames without touching internals; its `draw` is the documented pure function | OPUS:312; DeepSeek has no equivalent (grep `__draw`/`renderAt` = 0 in DS) | Generated file must end with `window.renderAt = async t => draw(t); window.__draw = draw; window.__canvas = cv;` and an `?export=1` branch that skips rAF. Post-gen check: `typeof window.renderAt === 'function'` in headless page (this is exactly RV:68–69). |
| 2 | Time is a pure function of the clock: `t = (now-start)/1000` and `draw` normalises `((t%12)+12)%12` internally, so any `t` — negative, >12, fractional — yields a valid frame | OPUS:174, 315–316, 324–326 | Lint: ban `elapsed +=` / per-frame integration; require `draw(t)` to wrap `t` at its top; test `renderAt(1.4)` twice → identical PNG; test `renderAt(-1)` and `renderAt(13)` → non-black, matching t=11 and t=1. |
| 3 | Ships verification artifacts: 9 stills at beat boundaries taken from the output folder, not just the final video | screenshot `截图_Opus5.5的出图文件夹.png` (t1 … t10.8 + mp4 + index.html); the prompt's checklist names t=2.8/5.3/5.7/9.5/10.8 (PROMPT:89–94) | Pipeline step after generation: render stills at the beat list, write a contact sheet + `frames/`, refuse "done" until every timestamp is non-blank and consecutive frames differ (catches frozen/black renders). |
| 4 | Single source of truth for copy: `TITLE`/`SUBTITLE`/`FONT` consts used by both the offscreen sampler and the final text draw | OPUS:20–22, 104, 293–299 vs DS:6, 127, 441, 454 (title literal 3×) | Template rule: one `const CONFIG = {title, subtitle, duration, seed, palette}`; lint duplicates of any CJK string of length ≥2. |
| 5 | Structural signposting: 8 labelled sections + numbered draw passes, 16 comment lines | OPUS:17, 24, 39, 76, 95, 127, 168, 314 | Emit a fixed skeleton (CONFIG → utils → camera → particles → targets → place → draw 1..7 → playback → export) and require ≥6 section headers; reviewers then diff semantics, not formatting. |
| 6 | Guards degenerate streaks: endpoint nudged by `+0.01` px so a zero-length segment still paints (matters at exactly t=5.6 where tp==t) | OPUS:225; DS:349 has no guard | Provide a `segment(ctx,x1,y1,x2,y2)` helper in the template that adds the epsilon; lint raw `lineTo` in particle loops. |
| 7 | Keeps still-export robust across the loop boundary (`?t=13` → frame at t=1) | OPUS:316; DS:486 clamps to 12 → fade-to-black frame | Same test as #2; treat "still at t=duration" as a bug, not an edge case. |

**Where DeepSeek matches or leads (do not regress these):** bbox culling before stroking (DS:342–343), `willReadFrequently` on the 1200×400 sampling canvas (DS:121), two-colour palette computed once per frame with particles drawn group-wise (DS:240–273, 314–316) instead of 4000 `rgb()` strings per frame (OPUS:221), and a `fit()` resize handler (DS:474–480) where Opus relies on CSS aspect-ratio only (OPUS:10).

**Not a difference, despite expectation:** particle count (4000 both), easing vocabulary (`smoothstep`, `1-(1-τ)³`, `exp` decays — identical), beat timing (identical to the millisecond), colour pipeline (identical four-stage ramp: cool/warm → white → orange → magenta → warm white). The two files are the *same renderer* with different bookkeeping.

## How the three beats are structured (identical in both)

- **0–5.6 s, light-speed tunnel.** Camera `z1(t)=80t+2520·(3/3.2)·(min(t,3)/3)^2.2+2600·max(0,t−3)` (PROMPT:26–27); five rings at world `z=Z3+2600·(0.3+0.42k)`, crossed at `tk=3.3+0.42k` (PROMPT:37); each crossing kicks focal length by `260·exp(−9Δt)` (PROMPT:38). Particles are 3D points projected as `sx=960+f·X/d` (PROMPT:45), drawn as a **streak between t−DT and t** (DT 0.03 s, PROMPT:69) — the only "motion blur" in the file.
- **5.0–5.6 s, brake + implosion.** Camera decelerates with `u−u²/2` (PROMPT:31) while particle radius is scaled by `k=1−0.92·smoothstep(5.0,5.6,t)` (PROMPT:61); white core light grows as `140000/dc` (PROMPT:74).
- **5.6–8 s, explosion.** Flash `0.95·exp(−9(t−5.6))` plus `0.3·exp(−14(t−tk))` per ring (PROMPT:77); shockwave radius `3600·(1−(1−ts)³)` over 1.2 s (PROMPT:75); particles fly out as `g=1−(1−τ)³` (PROMPT:62); camera recoils 2200 units (PROMPT:32).
- **8–12 s, reassembly.** `e=smoothstep(8,10,t)` interpolates each particle from its explosion point to its title target while rotating by `θ=sin(πe)·sw` (PROMPT:63); title fades in 9.7–10.3 s, subtitle 9.6–10.4 s, both out by 11.4 s; black fade completes at 12 s (PROMPT:78–81).
- **No fps, no keyframes, no timeline objects.** Every value is a closed-form function of `t`; the same `t` always paints the same frame (PROMPT:16). That is the property the export pipeline depends on.

## Prompt anatomy (B3, Z5, R1, B6)

Common skeleton — B6 and B3 are near-isomorphic; Z5 swaps two domain sections; R1 is the thin extreme.

| Section | B6 | B3 | Z5 | R1 |
|---|---|---|---|---|
| `# ID 名称` | ✔ (PROMPT:1) | ✔ (B3:1) | ✔ (Z5:1) | ✔ (R1:1) |
| metadata bullets (分类 / 长什么样 / 适合 / 关键词) | – | ✔ (B3:3–6) | ✔ (Z5:3–4) | ✔ (R1:3–4) |
| `## 风格提示词` + one-paragraph role brief | ✔ (PROMPT:5) | ✔ (B3:8–12) | ✔ (Z5:6–10) | ✔ (R1:6–8) |
| `## 内容` with `{{ }}` slots | ✔ (PROMPT:7–10) | ✔ (B3:14–17) | ✔ (Z5:12–16) | – |
| `## 输出要求（必须照做）` — 4 numbered rules | ✔ (PROMPT:12–17) | ✔ (B3:19–24) | ✔ (Z5:18–23) | – |
| domain constants (canvas, N, duration, seed, colours) | ✔ (PROMPT:19–22) | ✔ (B3:26–28) | ✔ (Z5:25–27) | – |
| `## 怎么画` / `## 每帧怎么画` numbered recipe | ✔ 7 steps (PROMPT:65–81) | ✔ 6 steps (B3:56–63) | ✔ 4 steps (Z5:29–44) | – |
| `## 不要` negative list | ✔ (PROMPT:85–87) | ✔ (B3:65–67) | ✔ (Z5:67–69) | – |
| `## 写完后自己过一遍（不要输出）` | ✔ (PROMPT:89–94) | ✔ (B3:69–73) | ✔ (Z5:71–76) | – |
| `## 补充` (reference image / old id / 定死的画法) | – | – | – | ✔ (R1:10–22) |

**Placeholders.** Only the "content" slots are parameterised: `{{默认：俯仰观照}}`, `{{四句，用｜分开。默认：…}}`, `{{秒，默认 12}}`, `{{默认"囍"}}` (PROMPT:9–10, B3:17, Z5:15–16); the templates state plainly that `{{ }}` is the reader's to fill (B3:10).

**Prescriptive vs free.** Prescriptive: canvas size and letterboxing, seed value and generator, the exact `draw(t)` contract, durations and beat timestamps, camera formulas, particle counts, per-particle parameter distributions, hex/RGB colours down to the digit, composite operation, and even the font stack (`bold 280px "Noto Serif SC","Songti SC","SimSun",serif`, PROMPT:57). Free: the fill-in content, the model's code organisation, and — for R1 — essentially everything, since R1 gives a one-sentence image plus a paragraph of "定死的画法" and no canvas/seed/export rules at all (R1:8, 22).

**"Only output code" constraints.** All three detailed prompts open the output rules with the same sentence: *"只输出一个 html 代码块，不要解释"* (PROMPT:14, B3:21, Z5:20), plus "no ellipses / no 'rest is the same'". The skill itself notes these are *local template* constraints and must not override the current delivery requirement (SKILL:33) — i.e. a plugin that writes files is allowed to ignore them, but a plugin that chats must honour them.

**Self-check as spec.** Each detailed prompt ends with a timestamped QA list ("t=2.8 … t=5.3 … t=5.7 … t=9.5 … t=10.8", PROMPT:92–94). Opus's output folder is exactly this list, densified — the self-check became artifacts; DeepSeek treated it as prose.

## Render contract (what an HTML must satisfy to become MP4)

- **`window.renderAt = async (t) => { … }` must exist.** The renderer hard-fails with "Missing window.renderAt(t)" otherwise (RENDER:8–12, RV:68–69). It is driven as `renderAt(frame / fps)` (RV:78).
- **`?export=1` must suppress playback.** On that URL the page must not start rAF or timers or CSS autoplay; `renderAt` is the only clock (RENDER:14; RV:66 loads `?export=1`).
- **Determinism.** Seeded RNG at startup, or values computed from index+time; async assets resolved before `renderAt` returns (RENDER:14).
- **Canvas/viewport identity.** Canvas pixel size == CSS viewport == output size, no player chrome; the renderer screenshots the full viewport at device scale 1 (RENDER:14; RV:63, 81). Output width/height must be positive **even** numbers (RV:34–35).
- **Frame maths.** `frame_count = ceil(duration × fps)`, `t = frame / fps`, H.264 / yuv420p, CRF 18, `+faststart`, audio padded or trimmed, silent by default (RENDER:39; RV:52, 70–73).
- **Serving.** A local HTTP server on `127.0.0.1`:`random port`, rooted at the HTML's directory — dependencies must live beside the HTML (RENDER:39; RV:53–54). Output file must not already exist (RV:39–40).
- **Dependencies.** Python 3.10+ stdlib for search/show (`styles.py` reads only `references/catalog.json`, STYLES:20); for video: `pip install playwright`, `playwright install chromium`, and `ffmpeg` on PATH (RENDER:20–28; RV:45–51).
- **Minimal conforming example.** `STARTER` shows the whole shape: `window.renderAt = t => draw(t)` (STARTER:37), `?t` still, `?export` → `draw(0)`, otherwise rAF (STARTER:38–45).
- **The B6 examples do not conform.** Both start rAF unconditionally when there is no `?t`; neither defines `renderAt` nor checks `export` (grep: 0 hits each). RENDER:16 says so generally — shipped examples must be copied and adapted, originals untouched. Opus needs a one-line adapter (`window.renderAt = t => __draw(t)`); DeepSeek needs its IIFE opened up, because nothing is exported.

## What this implies for a prompt-to-animation plugin

1. **The spec is the product, not the code volume.** B6's prompt already pins every formula; the model's job is faithful execution plus contract glue. A plugin should ship a *spec compiler* (content slots → constants + timeline) rather than a "write more code" instruction.
2. **Emit the contract, don't hope for it.** `renderAt`, `?export=1`, seeded RNG, t-normalisation and the `?t` still path belong in a fixed epilogue the model may not rewrite. That single rule closes gap #1 and #2 deterministically.
3. **Make the self-check executable.** Turn the prompt's "写完后自己过一遍" list into a gate: render the beat timestamps, assert non-blank and frame-to-frame change, and ship the stills. This is the cheapest way to buy Opus's most visible advantage (#3).
4. **Config-first skeleton.** One `CONFIG` object plus labelled sections (#4, #5) makes every later edit a one-line change and makes generated files diffable across models.
5. **Keep DeepSeek's optimisations in the template** (culling, batching, `willReadFrequently`, resize fit) — they are free and they raise the ceiling on particle count for the same frame budget.
6. **Two prompt tiers must be supported.** Detailed prompts (B6/B3/Z5) behave like a compiler target; vibe prompts (R1) are a brief. A plugin that assumes formulas will fail on R1; one that assumes freedom will under-deliver on B6.
7. **Budget for verification, not generation.** Both models generated a working 12 s piece; only one shipped evidence that it works. For a quality-reproduction plugin, the verification harness is the differentiator.

## Sources

All paths are repo-relative in `XiaoyeCodes/code-animation-prompts` (`main`); raw form is `https://raw.githubusercontent.com/XiaoyeCodes/code-animation-prompts/main/<path>`.

| Key | Path |
|---|---|
| OPUS | `skills/code-animation-prompts/assets/library/示例/B6_光速穿梭·爆炸·重聚_同一份提示词/Opus5.5_High.html` |
| DS | `skills/code-animation-prompts/assets/library/示例/B6_光速穿梭·爆炸·重聚_同一份提示词/DeepSeek-V4.1-Flash_High.html` |
| PROMPT | `skills/code-animation-prompts/assets/library/示例/B6_光速穿梭·爆炸·重聚_同一份提示词/提示词.md` |
| B3 | `skills/code-animation-prompts/assets/library/风格提示词/A-G_代码样片/B3_粒子聚形.md` |
| Z5 | `skills/code-animation-prompts/assets/library/风格提示词/Z_中国风/Z5_剪纸.md` |
| R1 | `skills/code-animation-prompts/assets/library/风格提示词/R_照参考学来的/R1_霓虹雨夜 · 电影感.md` |
| RENDER | `skills/code-animation-prompts/references/rendering.md` |
| STARTER | `skills/code-animation-prompts/assets/starter/index.html` |
| RV | `skills/code-animation-prompts/scripts/render_video.py` |
| STYLES | `skills/code-animation-prompts/scripts/styles.py` |
| SKILL | `skills/code-animation-prompts/SKILL.md` |
| SHUOMING | `skills/code-animation-prompts/assets/library/说明.md` |
| screenshots | `…/B6_…/截图_Opus5.5的出图文件夹.png`, `…/B6_…/截图_DeepSeek做出的B6.png` |

## Unverified

- **Pixel-level frame equality.** Could not render either file: headless Chrome/Edge abort in this sandbox at Mojo channel creation ("platform_channel.cc … 拒绝访问"), so no frame diff exists. Static analysis says the two renderers are equivalent up to RNG consumption order — Opus draws particle params *before* shuffling title targets (OPUS:77–125), DeepSeek builds targets *first* (DS:169–201), so the same seed produces **different** particle assignments; the images should be statistically, not pixel, identical. **UNVERIFIED** without a browser.
- **MP4 metadata** (fps, duration, bitrate) — no `ffmpeg`/`ffprobe` on this host; only file sizes were compared (22,644,006 B Opus vs 22,684,106 B DeepSeek, i.e. within 0.2 %).
- **Exact title-target point count** produced by the 1200×400 / 3 px sampling grid (PROMPT:57) — requires running the sampler. Both use the same grid, so it cancels out.
- **How Opus's 9 stills were produced** (same renderer, script, or manual) — inferred from filenames only.
