# 素材与许可 — fetch mechanism, third-party licences, offline degradation

Researched 2026-10-30 against `XiaoyeCodes/code-animation-prompts@main` (pushed 2026-10-29, default branch `main`,
GitHub-reported licence `NOASSERTION`/`Other`). Builds on `docs/research/dsh-plugin-architecture.md` (plugin = npm
package + cordis.patch.yml) and `docs/research/opus55-quality-gap.md` (prompt anatomy). Ticket #4 fixed the SHAPE
(bundle the catalog, fetch on demand, keep licences + attribution); this note fixes the MECHANICS.

**Citation keys.** **M:** = measured on this host on 2026-10-30, by the command shown. **REPO/path** = path inside the
upstream repo; raw form `https://raw.githubusercontent.com/XiaoyeCodes/code-animation-prompts/main/<path>`.

---

## Verdict

Ship `references/catalog.json` (159,373 B, 341 records, 35,410 B gzipped) inside the npm package and fetch a **named
style** with **one plain GET per file to `raw.githubusercontent.com`** — exact bytes, no auth, no 1 MB ceiling, no
base64 — using the catalog's `file`/`image` fields as the path index; cache under `~/.dsh/<plugin>/`. Use the REST
contents API only as the >1 MB escape hatch and as a cheap "did upstream change" probe, and offer
`git clone --filter=blob:none --sparse` as an **opt-in mirror action** for a whole series or the whole library, never
as the default: git is not guaranteed on a user's machine, pins the user to an 82.1 MB object store when a single
style is 150,605 B, and on this host **3/3 clone attempts failed** while `gh api` succeeded continuously (M:). Three
of the ten series carry MIT with a named copyright holder; the other seven rest on an informal Chinese
"free to use, free to pass on, do not sell" note, and the repo itself says the collection must not be labelled MIT —
so **nothing from this library may ship inside a paid artifact**, and any bundled copy must carry the three MIT
notices verbatim plus the attribution/collection notes.

---

## Q1 — fetch mechanism

### Measured repo facts (all M: via `gh api`)

| Measure | Value | How |
|---|---|---|
| Repo size field (`.size`) | 80,163 KB | `gh api repos/… --jq .size` |
| Whole tree, 581 blobs | 83,745,929 B | `…/git/trees/main?recursive=1` (not truncated, 610 entries) |
| Whole-repo tarball, actually downloaded | **82,133,706 B** | `gh api repos/…/tarball/main > repo.tar.gz` |
| `风格提示词/` total (341 md + 193 jpg) | 14,222,010 B | tree rollup |
| — md only, 341 files | 1,432,189 B (mean 4,200 B, min 81 B) | tree rollup |
| — jpg only, 193 files | 12,787,219 B (mean 66,255 B, min 15,108 B, max 239,811 B) | tree rollup |
| `示例/` total | 63,467,392 B — of which 3 .mp4 = 62,756,054 B | tree rollup |
| `第三方许可/` | 3,268 B (1,085 + 1,091 + 1,092) | tree rollup |
| `references/catalog.json` | **159,373 B** (112,361 chars; gzip 35,410 B) | tree + M: recompressed locally |
| Others | 说明.md 3,147 B · 许可与来源.md 377 B · LICENSE.md 2,293 B · attribution.md 1,382 B · 风格挑选.html 479,831 B · docs/source-manifest.json 71,486 B | tree rollup |

Per-series cost (the unit of "prefetch one series", all M:):

| Series | md | jpg | bytes |
|---|---|---|---|
| K_卡通画风 | 38 | 0 | **7,782** |
| X_code-video | 31 | 0 | 95,678 |
| V_mg-styles-15 | 15 | 0 | 119,701 |
| M_动态风格 | 40 | 1 | 227,110 |
| Z_中国风 | 15 | 1 | 235,638 |
| H_现成版式 | 12 | 1 | 244,895 |
| R_照参考学来的 | 7 | 7 | 692,275 |
| A-G_代码样片 | 26 | 26 | 1,772,115 |
| L_Lemo-Opuscar | 59 | 59 | 3,920,739 |
| O_奥斯卡98部 | 98 | 98 | **6,906,077** |

### Comparison

One "style" below = A1 (md 1,980 B + jpg 148,625 B = 150,605 B; M: both sizes, and the transport costs measured live).

| Mechanism | Bytes for one style | Auth | Rate limit | Offline after | Update cost | Risks |
|---|---|---|---|---|---|---|
| (a) `git clone --filter=blob:none --sparse --depth 1` + `sparse-checkout set <dir>` | metadata + 150,605 B. Metadata = all commits+trees, no blobs: ≤ ~61 KB of tree text (610 entries, 42,746 B of path names — ESTIMATE, see UNVERIFIED) | none for public repo | none documented | yes, and fully (any file is one `sparse-checkout set` away once blobs are fetched) | `git fetch` + `sparse-checkout reapply` — genuinely incremental | needs git installed; needs TLS trust (this host: *"unable to get local issuer certificate"* with `http.sslCAInfo=D:/software/Git/mingw64/ssl/certs/ca-bundle.crt`, M:); 3/3 clones failed here (2×21 s connect timeout, 1× SSL reset, M:) |
| (b) Contents API `GET /repos/{o}/{r}/contents/{path}` (base64) | md → 2,684 b64 chars in a 4,313-char JSON; jpg → 201,471 chars in a 206,368-char JSON ⇒ **×1.36 on base64, ~×1.40 with the envelope** (all M:) | optional (PAT lifts 60→5,000/h) | 60/h unauthenticated, 5,000/h authenticated, secondary 100 concurrent / 900 points per minute per endpoint | yes, if you persist the decoded bytes | 1 request per file; a `304` only saves budget when authenticated | 1,000-files-per-directory cap; >1 MB returns `"content":""`, `"encoding":"none"` and you must switch to raw; 60/h means O series (196 files) is 3.3 h unauthenticated |
| (c) `raw.githubusercontent.com/<o>/<r>/main/<path>` | **150,605 B exactly** — no base64, no envelope (M: raw of the same md returns 1,580 chars = 1,980 UTF-8 bytes) | none | **no number published** in GitHub's rate-limit docs (see Q1 notes); AUP §9 excessive bandwidth still applies | yes, once cached | 1 GET per file, unconditional; no listing, no ETag story documented | undocumented limit → one unauthenticated burst can be throttled without warning; no directory listing (fine: catalog.json supplies every path); not a CDN by contract |
| (d) Tarball `/repos/{o}/{r}/tarball/main` or `codeload.github.com/{o}/{r}/tar.gz/main` | **82,133,706 B** (measured download) for the same 150,605 B of useful content | none | generated on request, cached briefly | yes, whole library | re-download 82 MB | 62,756,054 B of it is three MP4s nobody asked for; docs say archives are "generated on request, cached for a while, then deleted" |
| (e) jsDelivr CDN mirror | not measured (host could not reach it) | none | secondary-source, not verified | yes | per-file | **SECONDARY**: does not change the answer; adds a third party to the trust chain |

### Recommendation

**Take (c) as the default transport, (b) as the fallback/probe, (a) as an opt-in mirror, (d) never by default.**

- **Path resolution comes from the bundle, not from the network.** `catalog.json` already carries
  `file` and `image` as repo-relative paths (`assets/library/风格提示词/A-G_代码样片/A1_字雨.md`), so the plugin needs
  exactly zero listing calls; `id`, `name`, `tags`, `description`, `fit`, `series`, `category` are all local (M: entry
  keys = category, description, file, fit, id, image, name, series, tags).
- **Why not (b) as default:** 60 requests/hour unauthenticated is 30 styles with stills per hour, and the transport
  inflates every byte by ~1.40×. It is the wrong default but the right *escape hatch* — the docs mandate it for
  >100 MB and it is the documented way to get a fresh `download_url` ("Download URLs expire and are meant to be used
  just once" — docs.github.com/en/rest/repos/contents).
- **Why not (a) as default:** it is a 100 MB-class dependency (git) plus a network operation that failed 3/3 here,
  to deliver 150 KB. It is, however, the only mechanism with real incremental update semantics and the only one that
  can materialise an arbitrary style offline *later*. Offer it as "mirror this series / mirror everything".
- **Fresh machine, no network:** the plugin installs, lists all 341 styles, and searches them — because
  `catalog.json` ships in the tarball. It cannot show a prompt body or a still until the first successful fetch.
  That is the whole degradation story in Q3.

### Primary-source notes for Q1

- `git clone --sparse`: "Employ a sparse-checkout, with only files in the toplevel directory initially being present.
  The git-sparse-checkout[1] command can be used to grow the working directory as needed."
  — <https://git-scm.com/docs/git-clone>
- `--filter=<filter-spec>`: "Use the partial clone feature and request that the server sends a subset of reachable
  objects according to a given object filter." — same page.
- `git sparse-checkout set` "populate[s] the sparse-checkout file from the list of arguments … and update[s] the
  working directory to match" — <https://git-scm.com/docs/git-sparse-checkout>
- Partial clone needs a cooperating server and stays online-dependent: missing objects are "demand fetched" from a
  *promisor* remote, and "Use of partial clone requires that the user be online and the origin remote … be available
  for on-demand fetching of missing objects" — <https://git-scm.com/docs/partial-clone>
- Server support is required for the filter (it is a pack-protocol capability negotiated in `fetch-pack`/`upload-pack`,
  same page). Whether *GitHub* advertises `filter` is **UNVERIFIED here** — every clone attempt died before the
  capability line could be captured, although one attempt did receive `HTTP/2 200` +
  `content-type: application/x-git-upload-pack-advertisement` (M:).
- Local toolchain (M:): `git 2.36.1.windows.1` supports all three flags — `git clone -h` lists `--filter`, `--sparse`,
  `--depth`; `git sparse-checkout -h` lists `init|list|set|add|reapply|disable`. So the host clears any version bar.
- Contents API size bands, verbatim: "If the requested file's size is: 1 MB or smaller: All features of this endpoint
  are supported. Between 1-100 MB: Only the raw or object custom media types are supported. Both will work as normal,
  except that when using the object media type, the content field will be an empty string and the encoding field will
  be "none". To get the contents of these larger files, use the raw media type. Greater than 100 MB: This endpoint is
  not supported." Also "This API has an upper limit of 1,000 files for a directory" and "Download URLs expire and are
  meant to be used just once." — <https://docs.github.com/en/rest/repos/contents>. Confirmed live (M:): a 479,831 B
  file returns base64 content; a 1,118,541 B file returns `encoding:"none"` with empty content; a 22,644,006 B MP4
  returns only metadata + `download_url`.
- Rate limits: "The primary rate limit for unauthenticated requests is 60 requests per hour"; PAT/app requests
  "count towards your personal rate limit of 5,000 requests per hour"; secondary limits include "No more than 100
  concurrent requests" and "No more than 900 points per minute … for REST API endpoints"
  — <https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api>.
- Conditional requests: "Make authenticated conditional requests, so that unchanged data does not count against your
  primary rate limit" — <https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api>.
  The unauthenticated 304 case is not stated there → UNVERIFIED.
- `raw.githubusercontent.com`: GitHub's rate-limit page documents api.github.com only; it names no limit for the raw
  host, and the raw host appears in the docs as the *sanctioned* path for files over 1 MB ("use the raw media type")
  and as the target of the `download_url` field. There is no documented "raw is not for automated use" prohibition —
  but there is no documented permission either. The binding constraint is policy, not quota: Acceptable Use §9
  "Excessive Bandwidth Use" reserves the right to "throttle your file hosting, or otherwise limit your activity"
  — <https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies>.
- Archives: download forms `github.com/{o}/{r}/archive/refs/heads/main.tar.gz`, "You can use either `.zip` or
  `.tar.gz`", and "Source code archives are generated on request, cached for a while, and then deleted"
  — <https://docs.github.com/en/repositories/working-with-files/using-files/downloading-source-code-archives>.

---

## Q2 — the three third-party licences

All three files were fetched and read in full (raw URLs under `skills/code-animation-prompts/assets/library/第三方许可/`).

| File | Licence, as written | Copyright holder | Year | Bytes | Obligations |
|---|---|---|---|---|---|
| `Lemo-Opuscar_LICENSE.txt` | "MIT License" | **LemoLab** | 2026 | 1,085 | notice + permission text "shall be included in all copies or substantial portions of the Software"; no share-alike; no field-of-use or redistribution restriction; no warranty |
| `code-video_LICENSE.txt` | "MIT License" | **Bae-ChangHyun** | 2026 | 1,091 | identical MIT terms |
| `mg-styles-15_LICENSE.txt` | "MIT License" | **Vincentwei1021** | 2026 | 1,092 | identical MIT terms |

Coverage in the catalog: L_ (59), X_ (31), V_ (15) = **105 of 341 styles**, but only **59 of 193 stills** (L is the
only MIT-covered series that ships stills; X and V are text-only). The other **236 styles
(7 series: A-G, H, K, M, O, R, Z) have no licence file at all** — only the collection author's informal note.

The collection-level terms, verbatim:

- `assets/library/说明.md` (3,147 B): "全部免费，不用私信，不用买课。你可以免费用、免费转给别人；转的时候也请免费分享。
  **禁止把这些内容包装成课程、付费 skills 或任何收费的东西拿去卖。**"
- `assets/library/许可与来源.md` (377 B): "约定：免费使用，转发也请免费分享" (author's own compilation/rewrite: A–G, R, M/K/Z/H
  rewrites, 风格挑选.html, the Opus 5.5 B6 sample).
- `LICENSE.md` (2,293 B): "整个混合来源合集不统一标注为 MIT"; credits 哔哩哔哩 俯仰观照 as the original collector, XiaoyeCodes
  as the packager; "电影、艺术风格与示例名称是参考描述，不代表官方合作或背书" (`references/attribution.md`, 1,382 B).
- GitHub classifies the repo as `NOASSERTION` / "Other" (M: `gh api repos/… --jq .license`) — i.e. no machine-readable
  licence, which matches the text.

### (i) If the plugin only FETCHES at runtime and never bundles

- **MIT still attaches.** A cache written to the user's disk is a copy; MIT's condition is on "all copies or
  substantial portions". Ship the three notices alongside the cache (a `LICENSES/` dir in the cache root) and link
  them from the UI; never strip or rewrite the licence files or the attribution block when caching. Cost: 3,268 B.
- **Do not relicense.** Your npm `package.json` must not say MIT-and-that-covers-the-assets. State "assets fetched at
  runtime from <repo>, licences as upstream".
- **The "free sharing" covenant is not triggered** by fetching (you are not distributing), but it *does* bind the
  upstream, and the plugin should not describe the material in a way that implies resale rights.
- **Network-side obligations:** identify the client (User-Agent with plugin name/version), serialize requests
  (best-practices: "make requests serially instead of concurrently"), honour `retry-after`, and treat 82 MB downloads
  as opt-in only (AUP §9).
- **Ambiguity:** whether an adapted Chinese prompt is a "substantial portion" of the MIT-licensed source project is a
  legal question, **UNVERIFIED**. The conservative reading — treat 105 derived prompts as MIT-derived — costs nothing
  but a notice file.

### (ii) If it BUNDLES any of them (a cached copy inside the npm package)

1. **Reproduce all three MIT texts verbatim, with holder and year, in the distributed artifact** (e.g.
   `LICENSES/Lemo-Opuscar_LICENSE.txt` etc.). Not a link — the text, because "shall be included in all copies".
2. **Carry the collection's own notice too**: 说明.md / 许可与来源.md / the collector credit. The repo's `LICENSE.md`
   already models this: keep 来源 + 本说明 when sharing.
3. **Keep it free.** The "禁止……任何收费的东西拿去卖" clause is the one thing that can kill a distribution channel: an npm
   package that is sold, or a paid tier that gates the library, breaches it. Free download ≠ paid. **This is the
   biggest compliance risk of the whole feature**: 236 of 341 styles have no licence text at all, so everything
   beyond the three MIT files rests on a Chinese, non-SPDX, non-OSI permission that grants free use *on condition of
   staying free*, and GitHub records the repo as `NOASSERTION` (`LICENSE.md`, `说明.md`, `gh api … --jq .license`).
4. **Never label the bundle MIT, and never present a single SPDX id for the whole thing.** Split it: MIT for L/X/V,
   "collection terms (free redistribution, no sale)" for the other seven series.
5. **Keep per-style provenance** — the series→source mapping is the only record that says which notice applies where.
6. **Highest-risk content if you bundle whole:** the 98 O_奥斯卡98部 stills (film titles as style names; the repo
   disclaims endorsement) and the 3 MP4s of `示例/` (62,756,054 B of video whose provenance is a single author note).

### Where attribution must surface

- **Per-style detail pane**: a "来源 / 许可" line under the prompt body — style id, series, and for L/X/V the MIT holder
  + a link to the licence text; click expands the full text (works offline from the cache).
- **About / settings page**: the three notices, the collector credit (俯仰观照, bilibili), the upstream repo link, and
  the "not MIT as a whole" statement.
- **Wherever a still is shown large** (picker/preview): a small source caption, because the 193 jpgs are the most
  visibly third-party artifacts.
- **On first fetch**: the cache root should contain the notices so that a user who later inspects the folder finds
  them without the app.

---

## Q3 — offline degradation

What `catalog.json` actually contains per record (M:, all 341 entries, same 9 keys):
`{category, description, file, fit, id, image, name, series, tags}` — a description one-liner, a "适合" one-liner, and
**paths**, not content. `file` is the prompt path, `image` is non-empty for exactly the 193 styles with a still.
Record count 341; series count 10; declared `total` 341, `with_still` 193 — all three match the tree's 341 md / 193 jpg.

| Level | What the user has | Works | Does not work |
|---|---|---|---|
| **L0 offline, fresh install** | `catalog.json` only — **159,373 B** (35,410 B gzipped) | full list of 341 styles; search by **id, name, tag, description, fit**; filter by series (10) and by "has still" (193); show the description/fit one-liners; show the *path* it would fetch | **prompt body** (needs `file`, mean 4,200 B, min 81 B); **still** (needs `image`, mean 66,255 B, min 15,108 B, max 239,811 B); `风格挑选.html` (479,831 B, not shipped) |
| **L1 catalog + one cached style** | +`file` | prompt text readable and copyable (~4.2 KB/style) | still |
| **L2 + its still** | +`image` | full fidelity for that style (~70 KB/style) | everything else; no series browsing of images |
| **L3 + one cached series** | 7,782 B … 6,906,077 B | whole series offline incl. stills (O: 196 files) | other 9 series |
| **L4 + library mirror** | `风格提示词/` = **14,222,010 B** (341 md = 1,432,189 B + 193 jpg = 12,787,219 B) | everything except the sample videos and the offline picker | `示例/` (63,467,392 B), `风格挑选.html` (479,831 B) |
| **L5 + samples (opt-in only)** | +`示例/` = 63,467,392 B (MP4s 62,756,054 B) + `风格挑选.html` 479,831 B | the offline picker and the demo videos | — |

**Prefetch one whole series:** smallest = **K_卡通画风, 7,782 B** (38 md, no stills — text-only series are cheap);
largest = **O_奥斯卡98部, 6,906,077 B** (98 md + 98 jpg ~ 6.6 MiB). Text-only prefetch of O would be 316,744 B;
the largest text-only series is L at 790,413 B. Rule of thumb: **a series costs ~42 KB per style if it has stills,
~4 KB per style if it does not** (14,222,010 B / 341 = 41,707 B mean across the mixed library).

Ladder rule for the UI: state the level explicitly ("离线：仅索引 — 提示词需联网获取"), make L1/L2 automatic on first
successful fetch, make L3 a single button with the byte cost shown *before* download, and make L4/L5 (the git mirror)
the only path that requires git.

---

## Recommendation for the plugin

- **Bundle exactly `catalog.json` + the three MIT texts + the collection notice.** 159,373 B + 3,268 B + 377 B of
  assets; ship it as data, version it, and record the upstream commit SHA it was built from.
- **Transport: raw host, one GET per file, serialized, with a UA of `dsh-<plugin>/<version>`.** Resume/retry on
  5xx; on 429/403 honour `retry-after` and fall back to the contents API (which at least tells you `size`/`sha`).
- **Cache layout:** `~/.dsh/<plugin>/styles/<id>/{prompt.md,still.jpg,meta.json}` + `LICENSES/` at the cache root;
  key `meta.json` on the upstream blob `sha` so a re-fetch can be skipped, and cap the cache with an LRU budget
  (default ~64 MiB ≈ 900 styles-with-stills, under the 14 MB full library).
- **Drift check:** one request to `/repos/{o}/{r}/git/ref/heads/main` (or a conditional GET of catalog.json) at most
  once per session/day; if the head moved, re-fetch `catalog.json` (159 KB) and diff by `id`, not by file.
- **Never auto-download the tarball or the MP4s.** If "download everything" is offered, show 82.1 MB first.
- **Make the offline state a first-class UI state**, not an error: L0 must still search, sort, filter and display the
  description/fit text — that is ~341 records of real value for 159 KB.
- **Attribution is a feature, not a footer**: the per-style licence line and the About page described in Q2, rendered
  from local files so they work at L0.

---

## UNVERIFIED & open questions

- **GitHub's `filter` capability** (i.e. whether partial clone works against github.com) — 3 clone attempts failed
  before capability negotiation; docs only say the server must support it. If it does not, mechanism (a) is dead.
- **Blobless-clone metadata size** — the ~61 KB figure is an ESTIMATE from 610 tree entries and 42,746 B of path text,
  not a measurement; the clone never completed.
- **raw.githubusercontent.com rate limiting** — no published number. Empirical: repeated raw fetches worked from this
  host throughout, but that is not a contract. Whether bursts get throttled, and at what point, is unknown.
- **Whether 304s count against the unauthenticated 60/h budget** — the docs only state the authenticated case.
- **Whether an adapted prompt is a "substantial portion"** of the MIT-licensed upstream project (L/X/V). Treated
  conservatively above.
- **Whether the collection's "no selling" clause is a licence condition or a request** — it is written as a permission
  with a restriction, in Chinese, with no English text and no SPDX id (GitHub: `NOASSERTION`). Counsel should read it
  before any bundled or paid distribution.
- **jsDelivr** — could not be reached from this host; secondary source; any file-size cap is unverified.
- **`docs/source-manifest.json`** (71,486 B, `algorithm: sha256`, `file_count: 555`, keys = library-relative paths incl.
  the three licence files) is an integrity index the plugin could use to verify a fetched file byte-for-byte; not yet
  evaluated as a shipped artifact (71 KB for verification only — probably not worth bundling).
- The native picker `风格挑选.html` (479,831 B, works offline in a browser) is a possible cheap full-offline UI at L4+;
  it was not evaluated against DSH's "no iframe / no own HTML document" constraint
  (`docs/research/dsh-plugin-architecture.md`, UI surfaces table).
