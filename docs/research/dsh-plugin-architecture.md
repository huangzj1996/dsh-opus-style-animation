> **历史记录（调研于 2026-10-30/31）：** 本文件是当时的原始研究笔记。其中 `/anim` 命令线、指令装配、闸门、播放器的路线已在 2026-10-31 二次重锚中退场（见 [`docs/adr/0001-carry-style-source-not-compiled.md`](../adr/0001-carry-style-source-not-compiled.md)）；当前实现以仓库 [README](../../README.md) 与 `docs/adr/` 为准。

# DSH plugin architecture — primary-source research

Researched 2026-10-30. Question: how a third-party DeepSeek Harness (DSH) plugin is structured, built,
installed and loaded; which UI surfaces the Web GUI lets a plugin extend; how client and host halves talk;
where plugin state lives.

**Source shorthands used in citations**

- **DECK/<path>** — D:\work\traeworkspace\dsh-mattpocock-skills-deck-main (real third-party plugin, v1.9.0-beta.32).
- **ASAR:<path>** — a file *inside* D:\software\DeepSeek Harness\resources\app.asar (the installed runtime).
  Read with a standalone Node process that parses the asar header (Electron's own fs refuses *.asar).
  ASAR:.../ is shorthand for ASAR:dsh/node_modules/@deepseek-ai/ ; line numbers are those of the extracted file.
- **PROFILE/<path>** — C:\Users\11132\.dsh\profiles\desktop (the live, installed profile).

---

## Summary

- A DSH plugin **is an npm package**. A bundle declares dsh.bundle.patch (a YAML patch that *inserts* Loader rows);
  a browser half additionally declares dsh.client (platform/immediately/inject/external) and an
  exports["./client"] bundle. DECK/package/package.json:17-23,55-63
- Installation = a dependency in the **profile** package.json + the bundle name in dsh.profile.bundles + pnpm
  install; the bundle's patch is then applied as one layer of the composed Loader tree.
  PROFILE/package.json:4-13,14-37 ; PROFILE/cordis.yml:1-4
- The host half is a cordis plugin: export default { name, inject, apply(ctx) } or export function apply(ctx, config).
  DECK/src/host/index.ts:14-22 ; ASAR:dsh/node_modules/@deepseek-ai/dsh-agent-preset/skills/cordis-plugin-development/references/host-plugin.md
  (section "Host plugin export forms")
- The browser half is **not** a React app and not an iframe: it is a script that calls
  window.__ModuleLoader__.load({ id, factory(require) }) and returns a cordis plugin object
  ({ inject: ['slots'], apply(ctx) }). ASAR:.../cordis-plugin-development/templates/decoration/client.js:2-23
- **The whole UI extension model is named slots**, served by ctx.slots: ctx.slots.inject(ownerKey, fn) plus
  ctx.slots.register({name, id|key, order, label, select, inject}, Component). There is no global "app" object to
  patch. ASAR:dsh/node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:1373-1385 ;
  DECK/src/client/panelAssembly.ts:94-106
- The installed runtime exposes **103 slots** (list / single / keyed / chain kinds; root / session / session-maybe
  scopes). Each is introspectable — kind, scope, register options, owner props, standard props, occupants,
  replaceRisk — through the Slots inspection API (listSubTree). ASAR:.../dsh-cordis-client-runner/lib/client.js:7081 ;
  the catalog itself starts at line 1128 of the same file.
- **Composer/input interception: YES**, three graded mechanisms — full composer takeover (conversation.composer,
  chain kind), composer action plumbing (inputActions.setDraft / insertText / submit as a standard slot prop), and
  the "/" and "@" trigger pipeline with matchEnter / matchSpace / matchClaim adjudication hooks.
- **Full-page view: YES** — register a main (keyed) entry plus a matching sidebar.panellist pin; navigate with
  ctx.layout.selectPanel(key). A right-sidebar tab (sidebarRightTabs service + sidebar.right.pane.tab slot) is the
  path DECK actually ships. There are **no URL routes** — panel selection is client layout state.
- **Live-updating content: YES inside session-scoped slots** (every session slot receives live hooks
  useConversation / useChat / useInput / useProjection / useSessionStatus); a root-scoped page must bring its own
  transport, which is what DECK does (RPC to an exact Fetch route).
- Custom client→host calls are **not** free-form RPC: either call an existing typed Remote endpoint
  (ctx.remote.commands.execute(...)) or register an **exact Fetch route** on the host
  (connection.fetch.register({path, methods, fetch})) and call it via
  connection.rpc.call('/api', '<channel>', {method, payload}).

---

## Plugin anatomy

### 1. Manifest (package.json)

| Field | Meaning | Source |
|---|---|---|
| exports["."] | Host entry (ESM). | DECK/package/package.json:17-23 |
| exports["./client"] | Browser entry, built to window.__ModuleLoader__.load(...). | DECK/package/package.json:19 ; DECK/scripts/build.mts:1042-1062 |
| exports["./locale/*.json"], exports["./icon"] | Display metadata + icon, read *without activating* the plugin. | ASAR:.../references/host-plugin.md (section "Display metadata and icon") |
| dsh.bundle.patch | Path (or ordered list) of the Loader patch; applied as one bundle layer. | DECK/package/package.json:55-63 ; ASAR:dsh/node_modules/@deepseek-ai/dsh-package-manifest/README.md |
| dsh.client.platform / .immediately / .inject / .external | Browser half: web only; immediately === true loads at boot instead of lazily; activation ordering; extra non-baseline module requests. | DECK/package/package.json:59-63 ; ASAR:dsh/node_modules/@deepseek-ai/dsh-client-modules/lib/client.js:69-74,141 |
| engines.dsh | Declared compatible DSH range (declarative only, never enforced). | DECK/package/package.json:9-11 ; ASAR:.../dsh-package-manifest/README.md (section "Known Limitations") |

DECK inserts **two** rows: the panel plugin, and a separate row module <pkg>/tools that registers agent tools as
pure data with zero framework imports — one package may ship several Loader rows.
DECK/package/cordis.patch.yml:8-14

### 2. Patch dialect

    - insert:
        - id: my-plugin
          name: '@local/my-plugin'
          config: {}

ASAR:.../references/host-plugin.md (section "Manifest"). A patch is an ordered YAML array of loader entries; an
entry can insert rows, override config (a matching override replaces the **whole** config), or set disabled.
PROFILE/cordis.patch.yml:1-3,4-8 (real overrides) ; DECK/package/cordis.patch.yml:6-7 (comment says the row is
auto-assembled by "dsh plugin --profile <name> add" — CLI spelling **UNVERIFIED**, not checked against dsh --help).

### 3. Host entry

export default { name, inject: ['connection','llm','sessionQuery'], apply(ctx) {...} } — services are pulled with
ctx.get(name); optional services go in inject so the plugin stays inactive in profiles without them instead of
throwing. DECK/src/host/index.ts:14-28 ; ASAR:.../references/practices.md (section "Stability")

### 4. Client entry

DECK proves the shape end-to-end: package/lib/client.js is a factory shell wrapping the same closure the dev build
uses, and the build **fails** if window.__ModuleLoader__.load is missing. DECK/scripts/build.mts:18-30,377-379,1042-1062

The minimal registerable plugin, verbatim shape (23 lines):

    window.__ModuleLoader__.load({
      id: '@local/my-decoration',
      factory(require) {
        const React = require('react');
        ...
        return {
          inject: ['slots'],
          apply(ctx) {
            ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
              name: 'conversation.composer.dock', id: 'my-decoration', order: 5,
            }, Decoration));
          },
        };
      },
    });

ASAR:.../templates/decoration/client.js:2-23 ; documented in ASAR:.../references/ui-plugin.md (section "Client module").
Only react comes from the browser module table; every other runtime import must be declared in dsh.client.external.
ASAR:dsh/node_modules/@deepseek-ai/dsh-client-modules/README.md (section "Sharing modules")

---

## Build, install, dev loop

**Build.** DECK compiles one source tree into two dialects: *_dev* (client.js / host.js as a cordis_define function
body) and *_pkg* (package/lib/client.js in ModuleLoader form, package/lib/index.js ESM).
DECK/scripts/build.mts:18-21,1042-1062. Gates compile the pkg artifact in a vm and assert the __ModuleLoader__
marker. DECK/scripts/build.mts:29,377-379. The build never writes into a profile ("永不同步") —
DECK/scripts/build.mts:34-38.

**Install.** plugin_manager action install_bundle with the absolute package directory (or a registry spec) is the
supported path: it performs pnpm install and bundle selection and should not be reproduced by hand-editing the
profile. ASAR:.../references/host-plugin.md (section "Install, enable, and observe") ;
ASAR:dsh/node_modules/@deepseek-ai/dsh-plugin-manager/README.md (section "Use this package"). What that leaves on disk:

- PROFILE/package.json — dependency + dsh.profile.bundles[] entry (PROFILE/package.json:4-37).
- PROFILE/node_modules/<pkg> — hoisted pnpm store; the installed copy of DECK sits next to dsh-session-manager,
  dsh-unlag, dsh-whale-widget (verified by listing PROFILE/node_modules).
- PROFILE/cordis.patch.yml — the *profile* patch layer, applied after every bundle layer (PROFILE/cordis.patch.yml:1-3).
- PROFILE/.plugin-manager/logs/operation-*/pnpm.log — one directory per install operation (verified on disk).

**Load.** The host composes the boot graph from enabled Loader entries and serves each client bundle under the
logical /plugins/.../client.js URL; the browser loads bundles lazily and executing a bundle only *registers* a
factory. ASAR:dsh/node_modules/@deepseek-ai/dsh-client-modules/README.md (sections "Summary", "What the browser
loads") ; ASAR:dsh/node_modules/@deepseek-ai/dsh-client-connection/README.md ("The Web Host still serves the browser
export at the logical /plugins/.../client.js URL").

**Dev loop.**
- Graph changes (enable/disable a plugin) reach open pages over the HMR transport with no page reload and no host
  restart; /plugins/events carries the graph and rebuilt frames.
  ASAR:dsh/node_modules/@deepseek-ai/dsh-client-hmr/README.md (sections "Summary", "Design concept").
- **Code rebuilds need a watcher**: "pnpm run dev:web, which starts the host and the rebuild watchers together
  (--no-serve attaches only the watchers to a host started elsewhere, as does any watch process using the shared
  Client tsdown preset)". ASAR:.../dsh-client-hmr/README.md (section "Starting the reload chain").
  So: **client-plugin HMR (the receiver) is shipped and active, but a rebuilt bundle only reaches the page if a
  rebuild watcher is running — pnpm run dev:web for a DSH source checkout, or the shared tsdown preset in watch mode.**
  A 500 ms stat-poll governs how fast the host notices a rebuilt artifact (same README, section "Configuration").
- Replacing an **already-installed** package needs a host restart to load a fresh JS generation; a *new* bundle can
  activate through HMR. ASAR:.../references/host-plugin.md (section "Install, enable, and observe"); the plugin
  manager reports restart-required for that case — ASAR:.../dsh-plugin-manager/README.md (section "Use this package").

---

## UI surfaces available to a plugin

### The model

The shell renders exactly one built-in root hole (root); every other seat is a named slot beneath it.
ASAR:.../dsh-cordis-client-runner/lib/client.js:4373 ("The built-in render-tree root hole (seeded by SlotCore)") ;
DECK/src/shared/ui/slots.ts:54-55 (the three parent slots DECK reuses: shell.overlay, details,
conversation.input.dock — note "details" is DECK's own name, not a platform slot).

Registration API (ctx.slots): inject(key, cb) returns a disposer; register(options, Component) returns a disposer;
registerFactory is the factory form. ASAR:.../dsh-cordis-client-runner/lib/client.js:1373-1385. Kinds are
list | single | keyed | chain; scopes are root | session | session-maybe; a chain entry routes by a select(owner)
predicate (first non-null wins, owner's fallback otherwise). ASAR:.../client.js:2873-2920 (conversation.composer).
Registrations are effects: they dispose when the owning declaration collapses and reinstall when it returns.
ASAR:.../references/practices.md (section "UI").

### Direct answers

| Question | Answer | Proof |
|---|---|---|
| Intercept/hook the composer | **YES**, 3 levels: (a) replace the composer wholesale via conversation.composer (chain, selector-routed); (b) drive it through the inputActions prop (setDraft, insertText, captureInsertion, submit, addAttachments); (c) own a "/" command via ctx.commandUi, or consume/refuse a submission through trigger-source matchEnter / matchSpace / matchClaim. | ASAR:.../client.js:2873-2920 ; ASAR:dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:14942-14963 ; ASAR:.../dsh-client-ui-commands/README.md ; ASAR:.../dsh-client-ui-input-trigger/README.md (section "Keyboard and mouse") |
| Raw keydown hook on the editor | **NO** documented API. Nearest sanctioned surfaces: ctx.shortcuts app commands (device-specific defaults, registerFixed / observeFixedInput) and the trigger pipeline's Enter/Space adjudication. A DOM keydown listener is not sanctioned ("do not write DOM outside your component"). | ASAR:dsh/node_modules/@deepseek-ai/dsh-client-shortcuts/README.md (section "Use this package") ; ASAR:.../references/practices.md (section "UI") |
| Full-page panel / own view | **YES** — main is keyed by panel id ("Central panel selected by sidebar entry id"; occupants include PluginManagerPage and TaskManagerPage); pair it with sidebar.panellist ("Each list id addresses the matching main panel"); navigate via ctx.layout.selectPanel(panelId). | ASAR:.../client.js:4373 ; :5749 ; :1128-1160 |
| Right-sidebar big panel (what DECK ships) | **YES** — register a tab type through the sidebarRightTabs service, then render the body in sidebar.right.pane.tab (+ title in sidebar.right.pane.tab.title), waiting with ctx.inject(['sidebarRightTabs'], ...). | DECK/src/client/panelAssembly.ts:141-186 |
| Live / streaming updates in a panel | **YES**, two ways: (a) session-scoped slots receive live hooks — useConversation, useChat, useInput, useProjection, useSessionStatus — as standard props (49 of the 103 slots carry them); (b) host-pushed events/streams via the gateway/connection. Root-scoped slots (main, sidebar.*) get no chat hooks, so a full page must fetch or stream for itself. | ASAR:.../client.js (standardProps lists, e.g. :2896-2910 for conversation.composer) ; ASAR:.../dsh-api-gateway/README.md (sections "Summary", "Host service") |
| Custom routes (URLs) | **NO** — no pushState / location.hash / useRoute anywhere in the client runner; panel selection is ctx.layout.selectPanel state. | grep of ASAR:.../dsh-cordis-client-runner/lib/client.js (0 hits) ; :1128-1160 |
| Settings UI | **YES** — a whole settings page (settings.section, list/root, label+order), one row in General (settings.general.item), a tab inside Settings→Plugins (settings.plugins.tab), plus plugin-manager-owned config surfaces (plugins.tab, plugins.bundle.config, plugins.row.config, plugins.detail.section). | ASAR:.../client.js:5341 ; DECK/src/client/panelAssembly.ts:130-137 |
| Chat-row / tool-card injection | **YES** — conversation.chat.node (keyed by ChatNodeKind; 19 shipped occupants), conversation.chat.turnTail, conversation.chat.assistant-actions, tool.call.toolview, tool.view.cordis. | ASAR:.../client.js:2695-2740 ; DECK/src/client/panelAssembly.ts:126-128 |
| Iframe / own HTML document | **NO** — explicitly forbidden (no host theme tokens, no light/dark switching, no ctx.locale). | ASAR:.../references/practices.md (section "UI") |

### Exhaustive slot inventory (103 slots, 8 services)

Verbatim keys from the runtime catalog (ASAR:dsh/node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js,
from line 1128). Grouped here for readability; each entry carries its own kind, scope, registerOptions, ownerProps,
standardProps, declaredBy, occupants and replaceRisk in that file.

- **Shell / frame (root):** root, shell.leading, shell.overlay, shell.bottom, shell.quota-notice, main,
  main.conversation, rightbar, rightbar.session, sidebar, sidebar.brand.mark, sidebar.brand.name, sidebar.panellist,
  sidebar.panellist.actions, sidebar.footer.action, sidebar.settings, sidebar.toggle.badge, sidebar.workspaces,
  sidebar.workspaces.directoryFlow, sidebar.chat.conversation, sidebar.session.row.hover, sidebar.session.row.leading,
  sidebar.workspaces.session.menu.item, sidebar.workspaces.session.row.action
- **Conversation header / session:** conversation.header, conversation.header.leading, conversation.view,
  conversation.session, conversation.session.header, conversation.session.header.actions,
  conversation.session.header.corner, conversation.session.header.lineage,
  conversation.session.header.utilities, conversation.session.header.views.actions,
  conversation.plan-review.actions
- **Composer / input:** conversation.composer, conversation.composer.bar, conversation.composer.dock,
  conversation.input.dock, conversation.input.overlay, conversation.input.activity, conversation.input.left,
  conversation.input.right, conversation.input.model, conversation.input.model.label,
  conversation.input.permission, conversation.input.plan, conversation.input.attachments
- **Hero / new session:** conversation.hero.agentPreset, conversation.hero.brand.mark, conversation.hero.options,
  conversation.hero.workspace, conversation.hero.workspace.directoryFlow
- **Chat rows:** conversation.chat.flow, conversation.chat.node, conversation.chat.commandview,
  conversation.chat.turnTail, conversation.chat.assistant-actions, conversation.chat.reasoning.body,
  conversation.chat.message.images, conversation.chat.user.images, conversation.trajectory.images,
  conversation.user.text.node, conversation.approval.detail
- **Right sidebar:** sidebar.right.pane.tab, sidebar.right.pane.tab.title, sidebar.right.tab.document,
  sidebar.right.tab.document.action, sidebar.right.tab.document.actions, sidebar.right.tab.document.office.pdf,
  sidebar.right.tab.document.unpreviewable, sidebar.right.tab.files.actions, sidebar.right.tab.guide,
  sidebar.right.tab.guide.actions, sidebar.right.tab.guide.entry, sidebar.right.tab.menu.item
- **Settings:** settings.section, settings.general.item, settings.plugins.tab, settings.onboarding, settings.action,
  settings.header, settings.close, settings.launcher, settings.trigger, settings.models.footer,
  settings.models.provider-card, settings.models.sign-in
- **Plugins page:** plugins.item, plugins.tab, plugins.add.actions, plugins.detail.actions, plugins.detail.badge,
  plugins.detail.section, plugins.bundle.activation, plugins.bundle.config, plugins.row.config
- **Tool calls / deliverables:** tool.call.toolview, tool.call.images, tool.view.cordis, deliverables.file.actions,
  deliverables.review.file.actions, workspace.toast
- **Client services (not slots):** layout, locale, sessions, slots, theme, timer, uiWorkspace, workspaces
  (ASAR:.../client.js:1128-1130).

---

## Client ↔ host communication

Three mechanisms, in increasing order of "do it yourself":

1. **Typed Remote (the platform's own API).** The host exposes Typert-annotated service methods (@Remote,
   @RemoteScope) through ctx.typertGateway; the browser gets ctx.remote and calls
   ctx.remote.<service>.<method>(...). Authorization runs through ctx.remoteAccess.decide(...) and fails as
   remote-access/denied. ASAR:dsh/node_modules/@deepseek-ai/dsh-api-gateway/README.md (sections "Summary",
   "Host service"). Real call sites: ctx.remote.commands.execute(sessionId, line, attachments) —
   ASAR:.../dsh-client-ui-commands/lib/client.js:1719 ; ASAR:.../dsh-api-session-controller/lib/client.js:2475.
   *Whether a third-party package can add its own @Remote service is UNVERIFIED* — it needs generated invocation
   descriptors (ctx.typert.local), i.e. DSH's codegen, not just a decorated class.
2. **Exact Fetch route + generic RPC (what DECK does).** Host: ctx.get('connection').fetch.register({ path,
   methods: ['POST'], requestBody: 'buffered', fetch }) — deliberately **not** connection.rpc.handle, which needs
   webServer injection and throws during registration. DECK/src/host/rpcChannel.ts:188-219.
   Browser: ctx.get('connection').rpc.call('/api', 'dsws', { method, payload }) — the runtime composes the URL
   /api/dsws and returns { ok, value | error }. DECK/src/seam/rpc.ts:22-24,51-61 ; the wire is DSH's /api HTTP
   bridge and /api/remote.mux WebSocket — ASAR:.../dsh-client-connection/README.md (section "Use this package").
3. **Events / streams.** The gateway owns multiplexed Remote streams, each with a Client→Host uplink, and forwards
   host events; connection.rpc.open yields the same streams without opening a WebSocket.
   ASAR:.../dsh-api-gateway/README.md ; ASAR:.../dsh-client-connection/README.md. The plugin graph itself is pushed
   over /plugins/events (SSE), which is how a page learns about rebuilt bundles —
   ASAR:.../dsh-client-hmr/README.md (section "Design concept").

The browser never receives a Host object graph: unary results are JSON (optional byte attachments travel as
multipart parts); binary parameters, events and streamed binary results are unsupported.
ASAR:.../dsh-client-connection/README.md (section "Use this package").

### Where plugin state lives

| Kind | Location | Source |
|---|---|---|
| Host config | the row's config: in a cordis.patch.yml layer, validated against the plugin's exported Config schema | ASAR:.../references/host-plugin.md ; PROFILE/cordis.patch.yml:4-8 |
| Plugin-owned data (DECK's choice) | ~/.dsh/mattskillsdeck/settings.yaml and choices.json — one dir per plugin under DSH home | DECK/src/shared/config-store/src/settings.ts:33 ; files verified on disk |
| Plugin-owned data (DECK, per workspace) | in-repo files under docs/agents/ (workspace.json, label-colors.json) | DECK/src/shared/config-store/src/workspace.ts:26 ; DECK/.../labels.ts:25 |
| Session-derived state | session projections (ctx.sessionProjections) — derived cache, never authoritative | ASAR:.../references/practices.md (sections "Principles", "Performance") |
| DSH storages | ~/.dsh/storages/ (workspace.json, session_projcache); docs say to find a storage service by inspection rather than writing files yourself | ASAR:.../references/practices.md (section "Stability") ; dir listing verified |
| Caches / bookkeeping | ~/.dsh/profiles/<p>/.dsh-market/, PROFILE/.plugin-manager/logs/, plugin-private cache dirs | verified by directory listing |

---

## Risks & unknowns

1. **@Remote for third parties is UNVERIFIED.** The typed gateway is generated from DSH's own build; a plugin with no
   descriptors can only fall back to SRC mode (a development fallback that parses parameter names).
   ASAR:.../dsh-api-gateway/README.md (section "Host service"). Assume custom host endpoints must be exact Fetch routes.
2. **Streaming from a third-party host half is UNVERIFIED.** Streams exist (wireStream.open, $events), but every
   documented path names a generated descriptor, and DECK — a mature plugin — uses polled snapshot RPC instead
   (DECK/src/client/panelAssembly.ts:215-217, loadSnapshot). Budget for polling + cache, not SSE.
3. **No raw composer keyboard hook.** If the design needs "keydown inside the input box", the sanctioned surfaces are
   ctx.shortcuts (global commands), the "/" / "@" trigger sources (Enter/Space adjudication), or replacing the composer
   via conversation.composer. Whether a chain select() can take the composer over *without* owning send/stop is
   UNVERIFIED — the shipped occupants (ApprovalPanel, QuestionComposer, SubagentReadOnlyComposer) are all
   takeover-style. ASAR:.../client.js:2896-2920.
4. **Slot keys are not a frozen public ABI.** Each entry carries replaceRisk ("shadows-shipped-ui" | "none") and a
   source pointer into packages/.../src/...ts, but the official skill tells authors to re-inspect live slots rather
   than trust docs. ASAR:.../client.js:4373 ; ASAR:.../SKILL.md (section "Deliver a working plugin first") ;
   DECK/src/shared/ui/slots.ts:1-13 records a self-imposed contract precisely because the platform has none.
5. **Runtime observation was blocked.** http://127.0.0.1:52931/ returns **401** to unauthenticated requests
   (browser-trust fence — ASAR:.../dsh-client-connection/README.md, section "Browser authentication and request
   trust"), so the live DOM could not be diffed against the slot catalog; every UI claim above is from shipped
   source, not from the running page. The "dsh plugin ... add" CLI spelling is quoted from a repo comment, not from
   CLI help — UNVERIFIED.
6. **Version drift.** The installed runtime is DSH Desktop's app.asar; DECK targets @deepseek-ai/dsh-tools 0.1.7-rc.2
   and declares engines.dsh >= 0.2.0-rc.2 (DECK/package.json:36 ; DECK/package/package.json:9-11), and neither field
   is enforced at install time (ASAR:.../dsh-package-manifest/README.md, section "Known Limitations"). Slot keys and
   standardProps can change between releases; a plugin should fail soft when a slot is absent.
