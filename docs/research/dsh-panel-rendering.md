> **历史记录（调研于 2026-10-30/31）：** 本文件是当时的原始研究笔记。其中 `/anim` 命令线、指令装配、闸门、播放器的路线已在 2026-10-31 二次重锚中退场（见 [`docs/adr/0001-carry-style-source-not-compiled.md`](../adr/0001-carry-style-source-not-compiled.md)）；当前实现以仓库 [README](../../README.md) 与 `docs/adr/` 为准。

# Rendering arbitrary HTML animations inside a DSH panel — primary-source research

Researched 2026-10-30 for wayfinder ticket **#11**. Builds on
[`dsh-plugin-architecture.md`](dsh-plugin-architecture.md) — the slot model (103 named slots, no URL routes,
exact Fetch route + `connection.rpc.call`) is taken as given there and not re-derived here.
Runtime examined: DSH Desktop shell **0.2.1-rc.3** (`ASAR:package.json:4`) over `dsh/node_modules/@deepseek-ai/*`,
live profile **PROFILE** = `C:\Users\11132\.dsh\profiles\desktop`.

**Source shorthands**

- **ASAR:<path>** — a file inside `D:\software\DeepSeek Harness\resources\app.asar`, read by parsing the asar
  header with a throwaway Node script (Electron's fs refuses `*.asar`); line numbers are the extracted file's.
- **APP:lib/main.js** — the Electron main process, a top-level file in the same archive.
- **CONN** — `ASAR:dsh/node_modules/@deepseek-ai/dsh-client-connection/README.md`.

**Method note.** No browser proof: the GUI answers **401** to non-browser clients (the browser-trust fence,
**CONN:41**) and an earlier headless-Chrome attempt aborted at Mojo channel creation here. Everything below is read
from shipped source or on-disk config; anything needing a running page is under **UNVERIFIED**.

---

## Verdict

**Render the animation inside the panel as a sandboxed iframe in the platform's own idiom: a `blob:` URL document
with `sandbox="allow-scripts"` (no `allow-same-origin`), a CSP `<meta>` in the document, and a generated driver
script that answers `postMessage` with frame-by-frame `renderAt(t)` execution and `getImageData` capture.**

One-line why: it is the only candidate that keeps arbitrary, model-generated script off the GUI's origin — the one
origin whose requests the Host's authenticated cookie is attached to — while still allowing deterministic frame
stepping and pixel readback; and it is exactly what DSH already ships for user-supplied HTML
(`ASAR:dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar-documentpreview/lib/client.js:4377,4411-4418`,
README of the same package line 60: "a Blob iframe with exactly `sandbox="allow-scripts"`, without
`allow-same-origin`; scripts cannot access the parent application's origin").

---

## Deployment facts the decision rests on

1. **Two carriers, two origins.** The desktop window loads `dsh-app://app/` (a privileged, *secure* custom scheme:
   **APP:lib/main.js:11880-11890** registers it, **:12134** builds the URL, **:12406-12412** serves the dist and
   forwards every other path to the Host). The `dsh web` carrier serves the same page from
   `http://127.0.0.1:<port>` (`ASAR:dsh/node_modules/@deepseek-ai/dsh-web-app/lib/index.js:146-162`). The live app
   here is the desktop carrier (4 `DeepSeek Harness` processes; PID 12456 owns 127.0.0.1:52931).
2. **The GUI document has no CSP at all — on either carrier.** The web server writes only `content-type`
   (`ASAR:dsh/node_modules/@deepseek-ai/dsh-host-frontend-static/lib/index.js:73`), the shipped
   `dist/index.html` carries no `<meta http-equiv=Content-Security-Policy>`
   (`ASAR:dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html:1-17`), and the desktop document is served
   the same way (**APP:lib/main.js:8222**). A whole-archive grep for `Content-Security-Policy` finds only the account
   platform's own login page (`ASAR:dsh/node_modules/@deepseek-ai/dsh-deepseek-account-platform/lib/index.js:1136`)
   and a per-response CSP for media references (`ASAR:dsh/node_modules/@deepseek-ai/dsh-api-session-controller/lib/index.js:2428`).
   ⇒ *Nothing today forbids `frame-src`, and nothing today protects the page if you add one.*
3. **The app origin is privileged in the desktop shell.** `forwardWebRequest` accepts only requests whose
   `Origin` is absent or exactly `dsh-app://app`, strips `host/origin/cookie/sec-fetch-site`, and **injects the
   Host's authentication cookie** (**APP:lib/main.js:8268-8291**, guard at :8271, cookie at :8282). Any script that
   runs *at* `dsh-app://app` therefore has authenticated Host-API access with one `fetch('/api/...')`.
4. **The Host's own fence, for everything else.** The browser cookie is host+port bound, `HttpOnly`,
   `SameSite=Strict` (**CONN:43**); every request must pass request-trust: `Host` loopback-or-trusted, an attached
   `Origin` must name the same authority, and `sec-fetch-site: cross-site` is refused — 403 (**CONN:47**, :41).
   ⇒ A frame with an **opaque** origin (`sandbox` without `allow-same-origin`) sends `Origin: null` and is refused;
   and it cannot read the `HttpOnly` cookie anyway.
5. **The platform already embeds arbitrary content in iframes** — twice: user HTML in a Blob iframe with
   `sandbox="allow-scripts"` (`...documentpreview/lib/client.js:4411-4418`), and real web pages in the sidebar
   browser with `sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"`
   (`ASAR:dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar-browser/lib/client.js:920,968-974`).
   The "no iframe" rule in the plugin practices is narrower than it reads: *"Do not serve an HTML page from the Host
   and embed it in an iframe: an iframe document does not receive the host's theme tokens, light/dark switching, or
   `ctx.locale`"* (`ASAR:dsh/node_modules/@deepseek-ai/dsh-agent-preset/skills/cordis-plugin-development/references/practices.md:33`;
   same summary as `dsh-plugin-architecture.md:188`). That is a *chrome-consistency* rule, not a security ban.
6. **There is no plugin HTML route to point an iframe at.** The only HTML-serving seat is the frontend fallback,
   claimed exclusively (`...dsh-host-frontend-static/lib/index.js:87-96`); exact routes are the `/api` RPC bridge
   (CONN:34). Option (b) therefore means running a server, not registering a route.

---

## Per-option evidence table

| # | Option | 1. Drive `renderAt(t)` per frame | 2. Read canvas pixels | 3. CSP intact / no privilege leak | 4. Residue after uninstall | Verdict |
|---|---|---|---|---|---|---|
| a0 | `<iframe srcdoc>`, **no sandbox** (true same-origin) | yes, direct `contentWindow.renderAt(t)` | yes, direct `getImageData` | **FAILS.** Same origin as the GUI ⇒ `fetch('/api/...')` is proxied **with the Host cookie** (APP:8268-8291), and the app's in-memory services/DOM are reachable. This is the exact leak the Host fence exists to stop (CONN:47). | none | reject |
| a1 | `<iframe src=blob:...>` + `sandbox="allow-scripts"` (or `srcdoc` with the same sandbox) | **yes** — driver script *inside* the document; `postMessage` round trip per frame | **yes** — `getImageData` runs inside the frame and the buffer is transferred out | **PASSES.** Opaque origin: no parent DOM, no app-origin fetch; its requests carry `Origin: null` and are 403 at both fences (**APP:8271**, CONN:47); cookie is `HttpOnly` + `SameSite=Strict` (CONN:43). Add the in-document CSP below to also block network egress. | none — the Blob URL is revoked on unmount (pattern: `...documentpreview/lib/client.js:4393-4396`) | **CHOSEN** |
| a2 | same as a1 **plus** `allow-same-origin` | yes, direct | yes, direct | **FAILS** — `allow-scripts` + `allow-same-origin` restores the a0 origin and its API access. | none | reject |
| b | Host-side local HTTP server + `<iframe src="http://127.0.0.1:N">` | no direct `contentWindow` (cross-origin) ⇒ `postMessage` only, same cost as a1 | only from inside the frame | **Worse.** On the Host's own origin it is same-origin with `/api` ⇒ a0-grade leak; on a private port it is a **new unauthenticated loopback origin** with its own lifecycle and its own Host/Origin/DNS-rebinding duties (the Host needed `src/api-request-trust.ts`, CONN:47). Adds nothing a1 lacks. | a listening socket + port bookkeeping; and no supported route to hang it on (fact 6) | reject |
| c | Inject the HTML into a shadow root in the panel | only by `document.createElement('script')` — parser-inserted scripts from `innerHTML`/DOMParser are inert | yes, but *in the app realm* | **FAILS hardest.** Running the scripts means running model-generated code in the GUI origin ⇒ a0 leak, plus `position:fixed` overlays can cover the app (clickjacking). Also functionally wrong: generated documents style `html/body`, which a shadow root does not match. | none | reject |
| d | Open in the system browser; panel degrades to prompt + stills | no | no | safe | temp file; no addressable URL (no routes, `dsh-plugin-architecture.md:185`) | reject as primary; keep as the *failure* state |

Note on (c): `DECK` — the mature reference plugin — never embeds HTML; it builds markup through its own whitelist
builder and asserts the absence of `innerHTML`/`dangerouslySetInnerHTML` (`DECK/tests/verify-markdown.ts:60`; the one
exception is a hard-coded SVG path table, `DECK/src/client/views/cards/PixelCardBtns.ts:19`). No iframe anywhere in DECK.

---

## CSP & isolation specifics (chosen path)

**Attribute set:** `sandbox="allow-scripts"` only. Not `allow-same-origin` (restores the a0 origin), not
`allow-popups`/`allow-top-navigation`/`allow-downloads` (the sidebar browser's wider set exists because it loads
*third-party sites*, and its own README accepts that escaped popups can navigate the top-level app —
`...sidebar-browser/README.md:63`). Add `allow-pointer-lock` only if a specific animation needs it.

**Document shape.** Build the document string client-side, prepend

    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval';
      style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none';
      frame-src 'none'; form-action 'none'; base-uri 'none'">

then append the driver script. The platform's own static preview uses the same idea with scripts off
(`...documentpreview/lib/client.js:4242-4245`); for animation you must allow inline script, but `connect-src 'none'`
still removes network egress (fetch/WebSocket/beacon) and `img-src data: blob:` keeps the canvas **untainted**, which
is what makes pixel reads legal (next section). `'unsafe-eval'` is needed only if the generated code uses
`Function`/`eval`; drop it if the generator contract forbids them.

**Why `blob:` and not `srcdoc`.** Both give an opaque origin under this sandbox; `blob:` is the shipped pattern
(`...documentpreview/lib/client.js:4377`, used in desktop too — its README lines 49, 60), keeps the payload out of an
HTML attribute, and gives the document its own base URL instead of inheriting the app's `<base href="./">`
(`...dsh-host-frontend-static/lib/index.js:85`). Keep `srcdoc` as the fallback if a Blob URL ever fails.

**Theme handoff.** The frame receives no theme tokens or `ctx.locale` (practices.md:33); render the chrome natively and
inject `--dsw-alias-bg-base` (read via `getComputedStyle(document.documentElement)`) plus size/DPR into the document.

**No new privileges.** `sandbox` without `allow-same-origin` also removes storage, cookies and IndexedDB from the frame.

---

## What this implies for reading pixels

- Pixel reads happen **inside** the frame, not in the panel. With an opaque origin the panel cannot touch
  `iframe.contentWindow.document`; that is the price of criterion 3 and it is not negotiable.
- That is sufficient: `canvas.getContext('2d').getImageData(...)` inside the frame works as long as the canvas is
  **untainted**. Tainting is caused by drawing cross-origin images, and the CSP above (`img-src data: blob:`) plus a
  self-contained document means there is nothing cross-origin to draw. The platform's own comment says as much:
  resource URLs created *by the parent* cannot even be loaded by an opaque-origin frame
  (`...documentpreview/lib/client.js:1725-1726`) — so inline everything as `data:`, never hand in parent-created
  Blob URLs.
- Transport: post a `Uint8ClampedArray`'s `ArrayBuffer` back with a transfer list (zero-copy), or a 32-bit frame hash
  when verification only needs "did this frame change". Do not plan on the panel calling `getImageData` itself.
- A WebGL animation must `gl.finish()` (or `readPixels`) before capture; `renderAt` returning is not proof the GPU
  submitted.
- Trust boundary: the driver lives in the same document as the untrusted script, so a hostile animation can fake the
  reply. Pixel data is evidence about *rendering*, not about the animation's honesty — verification logic must treat
  it as untrusted input.

---

## Minimal wiring sketch

    // client bundle (window.__ModuleLoader__ form), any panel slot, e.g. sidebar.right.pane.tab
    ctx.slots.register({ name: 'sidebar.right.pane.tab', key: 'animation', order: 10 }, Panel);

    function Panel() {
      const frame = useRef(null);
      const [url, setUrl] = useState();
      const nonce = useMemo(() => crypto.randomUUID(), []);
      useEffect(() => {                        // one revision of generated HTML -> one document
        const u = URL.createObjectURL(new Blob([composeDocument(html, { nonce, bg })], { type: 'text/html' }));
        setUrl(u);
        return () => URL.revokeObjectURL(u);
      }, [html, nonce, bg]);
      useEffect(() => {                        // accept results only from our own frame (origin is "null")
        const onMsg = (e) => { if (e.source === frame.current?.contentWindow) resolvePending(e.data); };
        addEventListener('message', onMsg);
        return () => removeEventListener('message', onMsg);
      }, []);
      const renderAt = (t, capture) => request(frame.current.contentWindow, { nonce, type: 'renderAt', t, capture });
      return <iframe ref={frame} src={url} sandbox="allow-scripts" title={t('animation')} />;
    }

    // composeDocument(): <html> + CSP meta + generator HTML + driver at end of <body>
    // driver: wait for window.renderAt (poll up to ~3 s), then on message {nonce,type:'renderAt'}:
    //   window.renderAt(t); const c = window.targetCanvas ?? document.querySelector('canvas');
    //   if (capture) parent.postMessage({nonce,id,ok,pixels:{w,h,data:getImageData(...).data.buffer}}, '*', [buf]);
    //   else parent.postMessage({nonce,id,ok}, '*');

    // generation contract: window.renderAt(t) is a pure render for time t; exactly one target canvas
    // (window.targetCanvas optional); no network, no external assets.

Watchdog: each `renderAt` carries a ~2 s timeout; on timeout remount the iframe (change `key`) and report failure. Never overlap requests.

---

## UNVERIFIED

1. **Whether a sandboxed (opaque-origin) frame gets its own renderer process** in this Electron build. If it shares
   the GUI's process, a synchronous infinite loop in generated code freezes the whole window; the watchdog can
   report but cannot pre-empt a busy loop. Not testable without a browser here — treat as the top risk.
2. **`requestAnimationFrame` in a hidden/throttled frame.** Deterministic stepping of a *visible* frame is the plan;
   behaviour when the panel is collapsed or the tab backgrounded is assumed-throttled but unproven.
3. **Blob-URL documents under the `dsh-app:` custom scheme** are inferred from the shipped document preview (README
   lines 49, 60 assert Web *and* desktop); not directly observed in a page.
4. **Whether a future DSH release adds a page CSP** (`frame-src`/`script-src`), which would govern `blob:` documents
   inherited from the parent origin. Today there is none (fact 2), so nothing breaks — but the plugin must fail soft
   if its frame stops loading.
5. **The exact srcdoc/blob CSP-inheritance rule** as applied by this Chromium version (the spec text was not
   reachable through the fetch truncation used here). Only matters if the platform later adopts a page CSP.
6. **Whether an animation's audio would play** under `sandbox="allow-scripts"` + `media-src data: blob:`; Electron's
   autoplay policy was not exercised.
7. **No browser was run**: the 401 fence (CONN:41) and the earlier headless-Chrome Mojo failure stand; every claim
   above is static, from source and config, verified line by line.
