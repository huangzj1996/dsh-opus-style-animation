# Composer interception for `/anim` — primary-source research

Researched 2026-10-30 for wayfinder ticket #10 ("「/anim」前缀怎么接管输入框"). Question: the user types
`/anim 用水墨做一个新年片头` in the composer; the plugin must parse the payload, assemble a generation
instruction, and get it into the send flow — with evidence from the shipped runtime and the reference plugin.

**Source shorthands**

- **ASAR:<pkg>/<file>:<line>** — a file *inside* D:\software\DeepSeek Harness\resources\app.asar at
  dsh/node_modules/@deepseek-ai/<pkg>/<file>; line numbers are those of the extracted copy (the archive was
  copied to a non-`.asar` temp path and its header parsed by a standalone Node script, because Electron's own fs
  refuses the archive). Runtime: DSH Desktop, client UI packages 0.2.1-rc.3.
- **DECK/<path>** — D:\work\traeworkspace\dsh-mattpocock-skills-deck-main (third-party reference plugin).
- Live DOM was not available (the GUI answers 401 to non-browser clients); every UI claim below is read from
  shipped source.

---

## Verdict

**Do not take the composer over. Register a host command named `anim` that declares an `input` hint, and let its
handler compose the instruction and submit it with `agent.followup(createUserMessage(...))`.**

The typed line `/anim …` then resolves through DSH's own *leadingInput claim* path: the client turns the token
into a command chip, ships the whole line through `ctx.remote.commands.execute`, and the host adapter hands our
handler `{agent, rawInput, attachments}`. Composition happens host-side; nothing in the composer, the send
button, the stop button, or the `/` menu is replaced. This is exactly how the shipped `/plan [message]` works.
ASAR:dsh-plan-mode/lib/index.js:179-229 · ASAR:dsh-commands/README.md:37-50,121

The three candidate mechanisms, graded: the host command **wins**; `ctx.commandUi` **cannot carry a payload**;
the `conversation.composer` chain **works but replaces the entire resident composer, including send and stop**.

---

## Candidate comparison

| # | Mechanism | Can it see `/anim <payload>`? | Can it submit the assembled text? | Cost / why it loses | Evidence |
|---|---|---|---|---|---|
| **1** | **Host command `anim` with `input`** (the verdict) | Yes — client resolves any host command that declares `input` into a claim and sends the whole line; handler gets `rawInput` = everything after the name and its separator | Yes — the handler receives the live `Agent`, which has `followup/steer/inject/send` | none on the client; needs the host half installed | ASAR:dsh-client-ui-commands/lib/client.js:1661-1663 (input ⇒ claim), :1695-1705 (claim.submit ⇒ execute), :1717-1730; ASAR:dsh-commands/lib/index.js:110 (`rawInput`), :153-162 (input validation), :379-388 (invocation `{commandId, agent, rawInput, attachments, signal}`); ASAR:dsh-commands/lib/typert.host.js:237 (`Agent` interface) |
| 2 | `ctx.commandUi` client contribution (action or popupSelect) | **No.** An action runs only for a *bare* token: `if (!bare) return void 0` — `/anim 水墨…` never reaches it, and the callback is invoked as `ui.run(session)` with no args and no actx. popupSelect is an option list, not free text | No — "an action submits nothing" | Cannot carry a user-typed prompt at all | ASAR:dsh-client-ui-commands/lib/client.js:1636-1638, :1678-1682; ASAR:dsh-client-ui-commands/README.md:32 |
| 2b | Host command **without** `input` | No — same `if (!bare) return void 0` at the end of `matchEnter`, so `/anim foo` falls to the default sink and is **sent as a literal prompt** | No | Silent degradation; this is why the hint is mandatory | ASAR:dsh-client-ui-commands/lib/client.js:1665 combined with ASAR:dsh-client-ui-conversation/lib/client.js:5206-5210 |
| 3 | `conversation.composer` chain entry (`select`) | Yes — a takeover component receives `useInput`, `useChat`, `inputActions`, `sessionId` | Yes — `inputActions.submit()` | **Replaces the whole resident composer.** With `overlay: true` the shipped composer is kept mounted but `display:none`, so editor, attachments, send **and stop** vanish; `InputActions` has no cancel/stop verb, and a chain entry declares no children so it cannot re-mount `conversation.composer.bar` | ASAR:dsh-cordis-client-runner/lib/client.js:2872-2920 (chain, `select` required, standardProps incl. `inputActions`); ASAR:dsh-client-ui-conversation/lib/client.js:17913-17921 (`overlay: true`, fallback = resident bar); ASAR:dsh-client-ui-renderer/lib/client.js:1183-1201, :1223-1231 (`display: none` on the fallback), :753-755 (renderSlot only for declared children); ASAR:dsh-client-ui-conversation/lib/client.js:14941-14967 (`InputActions` = captureInsertion, insertText, setDraft, persistDraft, addAttachments, removeAttachment, pruneAttachments, submit) |
| 4 | `inputActions` alone (setDraft / insertText / submit) | **No** — it is an output channel only; there is no event for "the user typed /anim" | Yes | Cannot observe the prefix; usable only *inside* a component that already knows the state | ASAR:dsh-cordis-client-runner/lib/client.js:2902; DECK/src/client/statusbar/StatusBar.ts:143-165 (DECK's only use is seeding a draft; no submit) |
| 5 | Own `/` trigger source with `matchEnter` returning `"handled"` + deferred `setDraft`+`submit` | Yes | Yes, but only *after* the submit attempt settles | Possible fallback, not the choice: `submit()` is a no-op while phase is adjudicating/submitting, so the rewrite must be deferred past `onAdjudicated`; no command row, no lifecycle log; uses an internal service | ASAR:dsh-client-ui-input-trigger/lib/client.js:1280-1288 (first non-undefined wins, registration order), :1556-1571; ASAR:dsh-client-ui-conversation/lib/client.js:5168-5211, :15202-15256 (phase guards) |

*Note on 2 vs 3:* `/plan` proves the intended pattern is a **host command that submits the message itself**, not a
client-side rewrite — its handler calls `agent.steer(createUserMessage(...))` for the optional `/plan [message]`
part. ASAR:dsh-plan-mode/lib/index.js:216-222 · ASAR:dsh-commands/README.md:121

---

## Payload grammar proposal

The host command registry only guarantees *unstructured* input ("forms, completion schemas, and typed arguments
remain command-owned parsing concerns" — ASAR:dsh-commands/README.md:138), so the grammar is ours. Keep it
forgiving: flags first, everything else is the prompt.

```
/anim [--style <id>] [--duration <6s|4>] [--aspect <16:9|9:16|1:1>] [--fps <n>] <prompt…>

  <id>    水墨 | 赛博 | 极简 | ink | cyber | …   (falls back to free text passed to the style resolver)
  prompt  the remaining text, verbatim, newlines allowed; may be empty (uses a default brief)
```

- `/anim 用水墨做一个新年片头` → `{style: undefined, prompt: "用水墨做一个新年片头"}` — the style resolver infers
  from the prompt, the plugin only records what the user actually said.
- `/anim --duration 8s --aspect 9:16 红包雨` → `{duration: 8, aspect: "9:16", prompt: "红包雨"}`.
- Put the exact grammar in `input.hint`; the composer renders the hint as the placeholder while the claimed token
  has no argument yet (ASAR:dsh-client-ui-conversation/lib/client.js:19146-19154).
- Do **not** invent sub-commands (`/anim list`, `/anim off`); a second word after the name is prompt text. If
  later needed, use a leading flag rather than a positional keyword.

---

## Send-flow wiring

```ts
// host half (package/lib/index.js) — the only code the flow needs
import { createUserMessage } from '@deepseek-ai/dsh-llm'   // types + helper: ASAR:dsh-llm/lib/types/message.js:53-58

export const inject = ['commands']

export function apply(ctx) {
  ctx.inject(['commands'], (c) => {                        // same shape as dsh-plan-mode/lib/index.js:179
    c.commands.register({                                  // dsh-commands/lib/index.js:266-268
      name: 'anim',                                        // lowercase, [a-z0-9_-] — dsh-commands/README.md:50
      description: '…',                                    // row copy in the / menu
      input: { hint: '[--style <id>] [--duration 6s] [--aspect 16:9] <prompt>' },
      handler: ({ agent, rawInput, attachments }) => {      // invocation shape: dsh-commands/lib/index.js:379-388
        const spec = parseAnim(rawInput)                    // our grammar, our errors
        if (!spec.ok) return { kind: 'error', text: spec.message }
        agent.followup(createUserMessage({                  // Agent.followup: dsh-agent-loop/lib/index.js:806-808
          content: [...attachments, { type: 'text', text: compose(spec) }],
          source: { kind: 'user' },
        }))
        return { kind: 'success', text: `动画 · ${spec.style ?? 'auto'} · ${spec.duration}s · ${spec.aspect}` }
      },
    })
  })
}
```

| Step | API that enables it | Source |
|---|---|---|
| `/anim …` is recognised as a command | host descriptor with `input` ⇒ `matchEnter` returns `{claim}` on Enter | ASAR:dsh-client-ui-commands/lib/client.js:1661-1663 |
| the line reaches the host | `claim.submit` ⇒ `ctx.remote.commands.execute(sessionId, line, attachments)` | ASAR:dsh-client-ui-commands/lib/client.js:1695-1705, :1717-1730 |
| the handler gets agent + raw text | `handler({commandId, agent, rawInput, attachments, signal})` | ASAR:dsh-commands/lib/index.js:379-388 |
| the instruction enters the send flow | `agent.followup(createUserMessage(...))` — queues a next-turn user message and wakes the driver | ASAR:dsh-agent-loop/lib/index.js:806-808, :800-805 |
| the composer clears | `commit-draft` with `retainSuffixOf` after a success outcome | ASAR:dsh-client-ui-conversation/lib/client.js:5227-5239, :15511-15517 |

Optional polish, still outside the composer: register a **command row** renderer for the command name so the
`/anim` line renders as a card instead of the generic one — `conversation.chat.commandview` is keyed by command
name and the unoccupied key falls back to the generic card. ASAR:dsh-cordis-client-runner/lib/client.js:2531-2547

### What the user sees (Q4)

- The draft is cleared on success (commit-draft, above); the typed `/anim …` is consumed as a command, not sent.
- The **assembled instruction** appears as *their* user message, because `followup` creates a real user-role
  message with `source: {kind:'user'}`. The transcript therefore shows exactly what the model reads.
- Recommendation: **yes, show it** — the rewrite must be auditable, and a silent model-input mutation is worse
  than a visible one. Keep the user's own words verbatim inside the instruction (as the brief), and put the parsed
  parameters in the command result text.
- Do **not** instead rewrite the draft in place with `setDraft`: it takes the full text with no caret argument
  (DECK/src/client/kernel/api-io.ts:79, DECK/src/client/statusbar/StatusBar.ts:162), so the user watches their line
  morph and then still has to press Enter, with no way to tell which text will be sent.

---

## Failure & conflict handling

| Situation | What the runtime does | What we do |
|---|---|---|
| Another plugin already owns `/anim` | A client contribution colliding with a host command throws `ui-commands: contribution /anim collides with a host command`; a duplicate host name throws at register | Pick a distinct name; surface the load error, never silently rename |
| Our host row is missing/disabled | `matchEnter` declines at ASAR:dsh-client-ui-commands/lib/client.js:1665, the default sink sends the raw `/anim …` line as a **model prompt** (ASAR:dsh-client-ui-conversation/lib/client.js:5206-5210) | Ship host + client in one bundle; assert the command exists at startup |
| We forget `input` | Same silent downgrade: args-bearing lines decline | `input.hint` is mandatory in review |
| Catalog warmup fails | `adjudication-failed` ⇒ one composer notice, draft kept (ASAR:dsh-client-ui-conversation/lib/client.js:5212-5220) | nothing — already correct |
| Handler returns `kind:'error'` with attachments | RPC outcome is error ⇒ draft **and** attachments are kept (ASAR:dsh-client-ui-conversation/lib/client.js:5227-5249, :15685-15688) | Return error for malformed flags when attachments are present |
| Handler returns `kind:'error'` without attachments | `execute` reports plain success (ASAR:dsh-client-ui-commands/lib/client.js:1725-1729) ⇒ draft cleared; the error text lives only on the command row | Parse leniently; never reject on a style it cannot resolve |
| Attachments sent to a command that does not declare them | Client throws the localized `attachmentsUnsupported` refusal, draft kept (ASAR:dsh-client-ui-commands/lib/client.js:1661-1663) | Declare `input.attachments` only if we forward them |
| Two `/` sources both match | `adjudicate` polls `roster.all()` in **registration order**, first non-`undefined` wins; the menu's `order` option sorts candidates but not Enter adjudication (ASAR:dsh-client-ui-input-trigger/lib/client.js:1280-1288, :1593-1596) | ui-commands owns `/` and resolves `anim` first; a second source only ever sees lines it declines |
| Stop / interrupt (Q6) | Untouched. Stop is a session-level call (`scopedConversation(...).cancel()`) rendered by the resident composer (ASAR:dsh-client-ui-conversation/lib/client.js:19793-19795, :20205-20207, :19131-19145); `agent.followup` only queues next-turn input and wakes the driver | Nothing to do — this is the main reason not to take the composer over |

---

## UNVERIFIED

1. **Live rendering was not observed** (GUI 401 to non-browser clients). The "resident composer hidden while a
   chain entry is elected" claim is read from `renderChainResult` (ASAR:dsh-client-ui-renderer/lib/client.js:1223-1231),
   not from a running page. This also settles the earlier open question: a chain `select()` **cannot** take the
   composer over while keeping the shipped send/stop — the fallback is `display:none` and `InputActions` exposes no
   cancel (ASAR:dsh-client-ui-conversation/lib/client.js:14941-14967) — but the visual consequence is unexecuted.
2. **Third-party command row face in the `/` menu.** Only known `definitionId`s get a first-party face; other rows
   fall back to the registered `description` (ASAR:dsh-client-ui-commands/lib/client.js:1540). Inferred from code,
   not seen.
3. **`followup` from a command handler while the session is idle.** `followup = send(message,'next-turn',wake=true)`
   (ASAR:dsh-agent-loop/lib/index.js:800-808) and the shipped precedent uses `steer` instead
   (ASAR:dsh-plan-mode/lib/index.js:216). Semantics read from source; not executed against a live agent.
4. **Attachment blocks passed through to `UserMessage.content`.** Precedent at
   ASAR:dsh-plan-mode/lib/index.js:217; not executed.
5. **Whether a second `/` source can be registered by a third-party client plugin** (needed only by the rejected
   option 5): `registerSource` is a plain method on the `inputTriggers` service with a uniqueness check
   (ASAR:dsh-client-ui-input-trigger/lib/client.js:1556-1571), but no document states that third parties may call it.
6. **Menu-pick path.** The same claim is also produced when the user picks the row from the `/` menu
   (ASAR:dsh-client-ui-commands/lib/client.js:1578); that path builds the token from the localized catalog name, so
   a picked row for a third-party command was not exercised.
