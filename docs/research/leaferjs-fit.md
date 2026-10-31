> **历史记录（调研于 2026-10-30/31）：** 本文件是当时的原始研究笔记。其中 `/anim` 命令线、指令装配、闸门、播放器的路线已在 2026-10-31 二次重锚中退场（见 [`docs/adr/0001-carry-style-source-not-compiled.md`](../adr/0001-carry-style-source-not-compiled.md)）；当前实现以仓库 [README](../../README.md) 与 `docs/adr/` 为准。

# LeaferJS as a rendering backend — fit check for generated animations

Researched 2026-10-30 against **leafer / leafer-ui 2.3.3** (npm `leafer-ui@2.3.3`, published 2026-10-30; the
integration repo `leaferjs/LeaferJS` is at commit `ae28098` = "v2.3.3"). Sources: cloned source of
`github.com/leaferjs/leafer`, `github.com/leaferjs/leafer-ui`, `github.com/leaferjs/docs`,
`github.com/leaferjs/canvas-benchmark`, plus the npm registry and `npm pack` tarballs.

**Citation keys.** **K:** = `packages/…:line` in `leaferjs/leafer` (core engine). **UI:** = `packages/…:line` in
`leaferjs/leafer-ui`. **DOC:** = `zh/…` in `leaferjs/docs` (source of www.leaferjs.com). **M:** = measured on this
host on 2026-10-30 by the command shown. **UNVERIFIED** = could not be executed here (see §1 note).

---

## Verdict

**Do not use — not as the default rendering backend.** There is no documented pause/step API: `stop()` freezes both
render *and* layout, and the documented synchronous draw path (`forceRender(bounds, true)`) is a no-op while stopped
(K:`partner/renderer/src/Renderer.ts:85-86`; UI:`display/src/Leafer.ts:183-190,207-213`), so "same `t` → same frame"
survives only if the engine is left *running* and driven by one synchronous full render per call — workable, but a
convention, not a contract. Combined with the 222 KB single-file build (M:) and a rewrite of all 341 draw recipes, the
fidelity cost exceeds the benefit.

---

## 1. Deterministic frame driving — **partial; no documented step API**

| Question | Finding | Cite |
|---|---|---|
| Pause the internal loop? | `leafer.stop()` → renderer/watcher/layouter stop. Docs: "停止渲染、布局，仍会收集元素变化数据待用" | UI:`display/src/Leafer.ts:183-190`; DOC:`reference/display/Leafer.md:231-235`; K:`partner/renderer/src/Renderer.ts:55-57` |
| Render one frame on demand? | `forceRender(bounds?, sync?)`; docs: "当 sync 参数设为 true 时，表示立即同步渲染" | UI:`display/src/Leafer.ts:207-213`; DOC:`reference/display/Leafer.md:211-217` |
| …while paused? | **No.** `render()` begins `if (!(this.running && this.canvas.view)) return this.update()` — with `running === false` it only re-schedules; `checkRender()` draws nothing | K:`partner/renderer/src/Renderer.ts:85-86,68-83` |
| Step alternative | `stop()` → mutate → `start()`: `start()` renders synchronously once (`this.renderer.render()`) | UI:`display/src/Leafer.ts:173-181` |
| Frame hook | `nextRender(item)` / `removeNextRender` — waits for the *next* render frame (asynchronous) | UI:`display/src/Leafer.ts:386-395`; DOC:`reference/UI/nextRender.md:1-13` |
| Is there a ticker? | No free-running ticker: rAF is scheduled by `update()` only when data changed or `requestRender()` is called; the callback renders once if `changed` | K:`partner/renderer/src/Renderer.ts:59-62,235-260`; K:`partner/watcher/src/Watcher.ts:56-70` |
| Layout synchronous with the draw? | Yes: `renderOnce()` calls `requestLayout()` → `LayoutEvent.REQUEST` → `Layouter.layout()` (synchronous) before drawing | K:`partner/renderer/src/Renderer.ts:116-146`; K:`partner/layouter/src/Layouter.ts:54-68,195` |

**What breaks "same t → same frame".**

1. **Partial rendering is ON by default** (`config.usePartRender` default `true`, `maxFPS: 120`). From the 2nd render on,
   Leafer repaints only dirty rectangles computed against the *previous* frame, so output depends on render history, not
   only on scene state. Fix: `usePartRender: false` (documented config). K:`partner/renderer/src/Renderer.ts:24-28,141-145`;
   DOC:`reference/config/app/base.md:31-33`; DOC:`guide/advanced/partRender.md:1-21`.
2. **Time-based plugins**: `@leafer-in/animate` (Animate/Transition) keep their own clocks/state; any `transition: true`
   or `Animate.run()` breaks purity. Not used ⇒ no state. DOC:`plugin/in/animate/index.md:129`.
3. Nothing else in the render path reads wall-clock time except FPS sampling (`frames[]`, cosmetic). K:`partner/renderer/src/Renderer.ts:242-252`.
4. Canvas-pool reuse is safe: a recycled offscreen canvas is cleared/cropped on return, so pooled layers carry no pixels
   from earlier frames. K:`canvas/canvas/src/LeaferCanvasBase.ts:328-345`.

**UNVERIFIED (execution).** Pixel identity of repeated `renderAt(t)` was not measured: a headless-Chrome probe was written
and attempted, but under this host's file sandbox Chrome 157 produced no `--dump-dom` output and wrote no `--screenshot`
file (Edge aborts with `ProcessSingleton … Error code: 5`). Browser route blocked, not disproved.

---

## 2. Expressiveness vs the Canvas 2D idioms the 341 prompts use

| Canvas idiom | Leafer equivalent | Status | Cite |
|---|---|---|---|
| `destination-out` erase | `eraser: true` on an element inside a `Group`; mapped internally to `'destination-out'` | **Equivalent, but Group-scoped**: erases only lower siblings of the same Group, not the whole frame | K:`display-module/data/src/LeafData.ts:30-34`; K:`display-module/display-module/src/LeafRender.ts:22-31`; DOC:`reference/UI/eraser.md:13-23` |
| `globalCompositeOperation='lighter'` | **Not in the documented or typed blend list.** The setter passes the value straight to `ctx.globalCompositeOperation`, so `'lighter'` works if cast — undocumented, untyped | **Passthrough only** | K:`interface/src/display/ILeaf.ts:111-138`; K:`canvas/canvas/src/Canvas.ts:44-47`; DOC:`reference/UI/blendMode.md:18-47` (lists `destination-out` and `lighten`; no `lighter`) |
| Offscreen-canvas layer caching (`drawImage` of a cached sprite) | No public API to composite an arbitrary `HTMLCanvasElement`/ImageBitmap as a scene layer. `getSameCanvas` pooling is engine-internal for blend/eraser/mask; user-level caching means data-URL `Image` elements | **Not equivalent** | K:`canvas/canvas/src/LeaferCanvasBase.ts:328-337` |
| `getImageData` glyph sampling | Raw access is documented: `leafer.canvas.view` (HTMLCanvasElement), `leafer.canvas.context` (CanvasRenderingContext2D); the engine itself samples pixels with `context.getImageData` for grayscale masks | **Available** on the final canvas; mid-composition sampling must use your own canvas | DOC:`code/display/Leafer/canvas.ts:1-9`; K:`canvas/canvas/src/LeaferCanvasBase.ts:249` |
| Alpha masks | `mask: 'pixel' / 'path' / 'grayscale' / 'clipping' / 'clipping-path'` on a Group child | **Equivalent** | DOC:`reference/UI/mask.md:19-27`; UI:`partner/mask/src/index.ts:76-113` |

Cost caveat: an element using `blendMode` or `eraser` is drawn into a pooled temp canvas and then composited — one extra
offscreen acquisition + copy **per such element per frame** (K:`display-module/display-module/src/LeafRender.ts:22-31`;
UI:`partner/mask/src/index.ts:90-113`). Raw Canvas 2D does the same with one `globalCompositeOperation` assignment and no
allocation. Magnitude: UNVERIFIED (no upstream benchmark for this shape).

---

## 3. Size — the only inlinable file is **222,003 B raw / 71,846 B gzip** (M:)

Measured with `npm pack leafer-ui@2.3.3 @leafer-ui/core@2.3.3 --registry https://registry.npmjs.org`, then file size and
`.NET GZipStream(Optimal)` on every shipped JS file (M:, 2026-10-30):

| Artifact | Raw B | Gzip B | Self-contained? |
|---|---|---|---|
| `leafer-ui/dist/web.min.js` (UMD, global `LeaferUI`) | **222,003** | **71,846** | **Yes** — shapes, Text, interaction included |
| `leafer-ui/dist/web.esm.min.js` | 53,416 | 19,483 | No — first line is `import{Debug as t,…}`; ~15 external packages |
| `@leafer-ui/core/lib/core.esm.min.js` | 28,065 | 9,642 | No — ESM with externals; **no UMD build exists** |
| `leafer-ui/dist/web.min.cjs` | 56,076 | — | No (CJS, externals) |
| `leafer-editor` / `leafer` npm `unpackedSize` | 4,789,400 / 6,400,914 | — | editor/UI-heavy, irrelevant here |

The 53 KB and 28 KB ESM files are **not** "smaller builds you can inline": they re-export `@leafer/core`, `@leafer-ui/draw`,
`@leafer/interface`, `@leafer-ui/app` … as separate packages, so any sub-222 KB artifact needs a bundler run. The README's
"轻量 (70KB min+gzip)" claim (README.md:24) matches the measured 71,846 B gzip of the full UMD build. Per-artifact cost of
adopting Leafer: +222 KB of inlined JS on **every** generated file, versus ~0 for raw Canvas 2D.

---

## 4. Licence — MIT, but shipped bundles carry **no** notice (M:)

MIT, "Copyright (c) 2023-present, Chao (Leafer) Wan" (`leafer-ui/LICENSE:1-3`, `leafer/LICENSE:1-3`). MIT requires the
copyright + permission notice in all copies or substantial portions; inlining the library into a generated artifact is
distribution, so the notice must travel with the artifact.

Measured: **none** of `web.min.js`, `web.js`, `web.esm.min.js`, `web.module.min.js` contains "Copyright", "MIT License"
or "Chao" (M: `Select-String -Pattern 'Copyright|MIT License|Chao'` → 0 matches in each; the build strips the banner).
An embedder who inlines it verbatim is therefore **already non-compliant** until it prepends the MIT text + copyright
line itself. No further attribution requirement, no copyleft, no patent clause.

---

## 5. Performance — harness exists, numbers do not; **UNVERIFIED**

- `leaferjs/canvas-benchmark` is a live Astro site (benchmark.leaferjs.com) that renders scenes in the browser and reads
  FPS with `stats.js`; results are **not** committed as data. Scenes: create / scale / pan / drag / fully-dynamic, across
  PixiJS, Konva, Fabric, SVG, HTML, Leafer. `README.md:5-15`; `src/core/Case.ts:2`; `src/benchmarks/leafer.ts:1-18`.
- The "dynamic" scene is the closest thing to per-frame mutation of thousands of objects: it builds Leafer with
  `usePartLayout: !dynamicMode, usePartRender: !dynamicMode` — i.e. it *disables* both optimisations when everything moves
  every frame (`src/benchmarks/leafer.ts:12-13`). There is no raw-Canvas-2D baseline in the harness at all, so
  "scene-graph mutation vs per-frame `ctx` redraw" is **measured nowhere upstream**.
- Consequently any latency claim for 1k–10k mutable objects on Leafer vs a hand-written `renderAt(t)` loop is
  **UNVERIFIED**. The structural overhead is visible in source (proxy/watcher per element, dirty-bounds layout pass, temp
  canvas per blend/eraser element), but no numbers may be quoted.

---

## What it would cost to keep prompt fidelity

The 341 upstream styles are imperative Canvas 2D recipes (`docs/research/assets-and-licensing.md`, M: 341 catalog records).
A scene graph means **every recipe is re-expressed**, not re-hosted:

1. **Immediate mode → retained scene graph.** Each `ctx` call becomes an object with a lifecycle (create once, mutate per
   frame); a loop drawing 500 particles becomes 500 objects or one `Path`. The prompt's code can no longer just run.
2. **Global compositing → element-local compositing.** Whole-canvas `destination-out` / `lighter` mid-draw must be
   restructured into Group scoping (§2); frame-wide erase trails — a very common recipe — have no direct equivalent.
3. **Ad-hoc offscreen canvases → unsupported.** Sprite caches, `getImageData` glyph masks and pixel-loop effects are what
   many prompts do; only the *final* canvas and your own offscreen canvases are reachable, and those pixels cannot be fed
   back as a layer without serialising through an Image/data URL.
4. **The prompt text is the spec.** It says `ctx.fillRect`, `globalCompositeOperation`, `getImageData`; a Leafer backend
   makes the emitted code diverge from the words — exactly the project's stated non-goal.
5. **A new determinism failure surface.** Correct driving needs `usePartRender: false`, `hittable: false`, no
   `transition`/`Animate`, `forceRender(undefined, true)` and a *running* engine (§1) — none enforced by the API, so one
   regenerated snippet using `transition` silently breaks `renderAt(t)`.

Net: full rewrite of the 341 recipes (or a permanent fork of the prompt corpus), +222 KB per artifact (M:), and a
determinism contract that is convention, not API. The benefit (declarative tweens, hit-testing, editor features) is
outside what the animation generator needs.

---

## Recommendation for the skeleton decision

1. **Default engine: raw Canvas 2D**, unchanged. `window.renderAt(t)` stays a pure function; the 341 prompts stay valid;
   artifacts carry ~0 KB of library; `destination-out`, `lighter`, offscreen caching and `getImageData` work natively;
   no licence notice to embed.
2. **Do not invent an engine abstraction in the skeleton now.** A backend interface written against one engine and then
   retro-fitted to a scene graph is churn; the seam can be added later behind `renderAt` without changing the contract.
3. **If Leafer is ever wanted** (e.g. an "editable output" mode), ship it as an **opt-in engine with its own prompt
   dialect** (`engine: 'leafer'`), never as a drop-in for the Canvas-2D prompts — and then: inline
   `leafer-ui/dist/web.min.js` (222,003 B raw / 71,846 B gzip, M:), prepend the MIT notice (the dist has none), construct
   with `{ usePartRender: false, hittable: false }`, drive frames with `forceRender(undefined, true)` while `running` is
   true, and add a test that renders the same `t` from two different `t` histories and compares `getImageData` hashes —
   the test the source analysis says *should* pass, but which **could not be executed here** (UNVERIFIED).
4. **Revisit only if** a measured need appears for retained-mode features (hit-testing, editing, tweens), or if the
   determinism probe is run in a real browser on a probe of the actual style corpus and passes.
