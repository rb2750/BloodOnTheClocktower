# Blood on the Clocktower — Storyteller App

> **Status: built and shipped.** This document was written as the plan and is kept
> as the design record: it holds the research, the decisions and the reasoning
> behind them, which the code itself cannot explain. Everything below was
> implemented on `claude/botct-gm-app-msq9k8` across five commits.
>
> What changed during the build, against this plan:
>
> - The relay gained **per-player sealing**. The plan's design encrypted messages
>   with the room key alone, but the relay broadcasts to the room and every player
>   holds that key, so any player could have read anyone else's role. Each player
>   now publishes an ephemeral public key on claiming a seat and the Storyteller
>   seals their character to it.
> - The Vigormortis exposed a rules bug: it removes an Outsider at player counts
>   that have none, which drove the count negative. It now clamps.
> - Players can be added, removed and turned into Travellers mid-game, which the
>   plan did not cover and real play needs.
> - The capture harness composes frame strips in the browser. Playwright's bundled
>   ffmpeg is a minimal build with no GIF muxer and no `tile` filter, so clips stay
>   as WebM.
>
> Four bugs the screenshot loop caught that no test would have: every themed
> colour was dead from a Tailwind v3 shorthand, unlayered base styles outranked
> every utility, the ring collapsed to a sliver, and tokens overlapped at five and
> eight players.

## Context

`rb2750/BloodOnTheClocktower` was an empty repository when this was written, with
no commits locally or on `origin`. Everything here is new code, built on the
branch `claude/botct-gm-app-msq9k8`.

The user runs Blood on the Clocktower as the Storyteller and wants a companion app
that knows the rules and composition table, lets them add and remove characters
freely, tracks how characters interact with players each day, and randomly allocates
characters with manual tweaking. It must be simple and never overwhelming, with a
modern minimalistic "expensive" design, cinematic phase transitions, guidance on what
to say, and complete persistence of player state and effects. Players join a companion
app by scanning **one shared QR code** to learn their role, re-check it later, browse
the script, and keep private notes on each other.

### Decisions taken

| | Decision |
|---|---|
| Automation | **Guide and prompt only.** Step the night order with official reminder text and track effects. The app does not compute Empath/Chef numbers or decide information. |
| Roster | **All 181 official characters + custom script JSON import.** |
| Day phase | **Full nominations and voting** with live tally and history. |
| Interaction tracking | **All four**: night action log, info-given log, live effects, per-player timeline. |
| Setup solver | **Solve everything it can**, including hard modifiers and seating constraints. |
| Persistence | **All four**: game history, player roster, favourite scripts, export/import. |
| Animation | **Full, but skippable**, respecting reduced motion. |
| Player join | **One shared QR** for the whole table. |
| Aesthetic | **Midnight Grimoire** (below) — confirmed. No Papyrus. |
| Hosting | **GitHub Pages** for the apps, plus a small relay (see the conflict below). |
| Delivery | **Build everything** rather than shipping a thin slice — but **share screenshots and animation clips throughout**, so the design is reviewed continuously even though the functionality lands complete. |

### The one unresolved tension, and how I'm resolving it

A single shared QR cannot work without shared state. If every player scans the same
code, the code carries the same bytes to everyone, so either everyone can read every
role or something must hand each device only its own. That "something" is a server.

GitHub Pages is static-only and cannot host one. So:

- **Both apps ship as static files to GitHub Pages**, as requested.
- **One Cloudflare Worker + Durable Object** hosts the room. It is a few hundred lines
  and sits inside the free tier at any realistic volume. It does require a Cloudflare
  account.
- The relay is made **zero-knowledge**: a key derived from a secret in the QR fragment
  encrypts payloads client-side via WebCrypto, so the relay is a dumb byte pipe that
  can never see a role. That removes the privacy question entirely.
- **Automatic fallback.** If the relay is unreachable, the app silently switches to
  per-player QR codes — a 39-byte payload in the URL fragment, needing no server at
  all. The Storyteller turns the phone to each seat in turn, exactly as they would pass
  a bag of tokens. Bad venue wifi degrades the ritual, never the game.

So the shared-QR path is the pleasant normal case and the serverless path is the safety
net, and the Storyteller app itself never awaits the network for anything.

---

## Data layer — verified, not assumed

The Pandemonium Institute publishes official machine-readable data for toolmakers. I
fetched and validated all of it from this environment. Base URL:
`https://raw.githubusercontent.com/ThePandemoniumInstitute/botc-release/main`

| File | Result |
|---|---|
| `resources/data/roles.json` | 200, 99,614 bytes, **181 characters** |
| `resources/data/jinxes.json` | 200, 27 roots, **131 jinx pairs** |
| `resources/data/nightsheet.json` | 200, 80 first-night / 99 other-night entries |
| `script-schema.json` | 200, JSON Schema 2020-12 |
| `resources/characters/{edition}/{id}_{g,e}.webp` | 200 |

**Every integrity check passed.** Every night-sheet entry resolves to a real character
or a pseudo-step, every jinx id resolves, no character has a night reminder without a
sheet position and none has a position without a reminder. The join is exact in both
directions, so the night engine can be built directly on this data.

```
townsfolk 69  minion 27  outsider 23  demon 19  traveller 18  fabled 14  loric 11
editions: carousel 71, snv 30, bmr 30, tb 27, fabled 12, loric 11
setup-modifying characters: exactly 25      distinct reminder-token labels: 85
```

`team` includes **`loric`**, an eleven-character whole-game-modifier type missing from
most community datasets, so the enum is
`townsfolk | outsider | minion | demon | traveller | fabled | loric`.

### Gaps we fill ourselves

- No `firstNight`/`otherNight` integers in `roles.json`. Derive by indexing into the
  `nightsheet.json` arrays.
- The pseudo-steps `dusk`, `minioninfo`, `demoninfo`, `dawn` appear in the night sheet
  but have **no entry in `roles.json`** (verified). We supply their text.
- No almanac "How to Run" prose is published. Do **not** paste it in; it is not covered
  by the content policy. Write our own operational phrasing from the official reminder
  text, which is short and mechanical.

### Markup conventions

`:reminder:` renders as a reminder-token icon. `*TEXT IN ASTERISKS*` is a physical info
token to show the player: `*TOWNSFOLK*`, `*WRONG*`, `*RED HERRING*`, `*YOU ARE*`. The
renderer handles both.

### Licensing — the user should read this

Character text and art are TPI's. The Community Created Content Policy permits
toolmakers to use the published assets and requires a CCC logo plus a clear statement
of non-affiliation. One clause matters:

> The Pandemonium Institute retains the rights to any apps, bots, electronic, online,
> or otherwise digital tools that incorporate any of the intellectual property
> pertaining to Blood on the Clocktower.

Keep it free and personal, display the CCC logo and trademark notice, and don't
commercialise or publish to app stores without contacting
`storyteller@bloodontheclocktower.com`. Vendor a pinned copy of the data at build time,
since TPI warn the URLs may move.

---

## The insight that shapes "tell me what to say"

> At night, the Storyteller is **silent**. They signal — two taps on the shoulder or
> knee means eyes open — and show physical info tokens.

So the feature has **two registers**, and rendering them alike would teach the wrong
behaviour:

- **Night: do this, show this.** "Tap twice. Show the Townsfolk token. Point to the two
  marked players." No quoted speech.
- **Day: say this.** Real sentences generated from live state.

The most valuable generated line, which official advice explicitly asks for and no tool
provides: the app knows the living count and the tally, so it can say **"Alice needs 4
to tie, 5 to take the block."**

Two more details worth encoding:

- The official `dawn` step reads *"Wait approximately 10 seconds. Call for eyes open,
  then immediately announce which players (if any) died."* That mandated pause is
  exactly the length of the dawn cinematic, which makes the animation **functional**
  rather than decorative.
- There is **no seconding** in this game; a nomination goes straight to a vote. The
  official term is "**about to die**", not "on the block".

Mark official reminder text differently from our own suggested narration, and let the
Storyteller switch flavour off — experienced hosts want mechanics only.

---

## Aesthetic — "Midnight Grimoire"

Research found the real game sets its text in Papyrus, which the community openly
mocks. Every fan tool that copies it inherits the mockery. **We carry the other
identity signals instead**: the circular token, blue/red alignment, the shroud, the
clock.

The rule that resolves gothic against minimal: **ornament lives in the content layer,
the chrome is dead plain.** Nav, sheets, lists and inputs are flat with hairline
borders and generous whitespace. The token, the reveal, the ring and the day header
carry all the texture and brass. This is how the physical game works — the table is
plain, the tokens are ornate — and it confines expensive rendering to a few components.

Three motifs, repeated relentlessly: **the circular token**, **the clock ring** (twelve
faint hour ticks; seats are hours, the phase is the hand sweeping), **the shroud**
(greyscale plus a thin grey banner). Banned: cobwebs, blood drips, skulls, blackletter.

```css
--ink-900:#0B0D12  --ink-800:#12151C  --ink-700:#1A1F29  --ink-600:#252B38
--parch-100:#F4EDE0  --parch-300:#CFC4B0  --parch-500:#9A8F7C
--brass-300:#E3C46A  --brass-400:#C9A227  --brass-600:#8A6D18
--good-500:#4B87C9  --good-300:#8FB8E0  --evil-500:#B3312B  --evil-300:#E0766D
```

Never pure black or pure white. **Blue and red are reserved strictly for alignment** —
no blue primary buttons, no red delete — which is what makes them land with weight.
Brass is the interaction accent, used as hairlines and highlights only; large gold
fills look cheap. Gold edges are a three-stop gradient, not a flat colour.

**Contrast check against `--ink-900`:** parch-100 ≈ 16:1, brass-400 ≈ 8.5:1, good-500
≈ 5.2:1 all pass, but **evil-500 ≈ 3.6:1 fails for body text**. Oxblood is for fills,
rings and strokes; use `--evil-300` whenever evil is expressed as text. Encoded in the
token names so it can't be got wrong.

Type: **Cinzel** for the few display moments (wordmark, role name on reveal, day/night
headers — three places, no more), **Inter** for all UI, **EB Garamond at 500** for
ability text. Self-hosted via fontsource, never a CDN, because the app is offline.
Light type on dark optically gains weight, so drop body weight one step and add
`letter-spacing: .08em` to all-caps.

Alignment is **shape-coded as well as coloured** — good is a smooth gold ring, evil a
notched one — plus the literal word. Three redundant channels for colour-vision
deficiency at zero chrome cost.

The two apps share one system and differ only in surface temperature: Storyteller on
`--ink-900` (backstage, lights down), player companion on `--ink-800` with a faint
amber vignette (candlelight). A glance across the table tells you which app someone is
holding.

---

## Stack

```
vite 8 + react 19.3 + typescript
vite-plugin-pwa 1.3      precache everything; autoUpdate + explicit reload toast
zustand 5 + immer + persist, behind idb-keyval
tailwindcss 4            @theme tokens + one hand-written stylesheet for geometry
vaul, sonner, lucide-react, @fontsource Inter/Cinzel/EB Garamond
vitest 5 + playwright
```

Omitted deliberately: no router framework, no drag-and-drop library (seat dragging is
`atan2` and Pointer Events), no `zundo`, no XState, no GSAP, no react-spring.

**Animation.** React 19.3 shipped `<ViewTransition>` stable on 2026-09-09 and
same-document view transitions are Baseline with Safari 18+. Use it for UI state swaps
and shared-element moves at zero runtime cost. Do **not** author the cinematic inside
one: a view transition is a one-shot morph of a snapshot, it pauses rendering to take
that snapshot, and it blocks interaction, which fights tap-to-skip. Render the
cinematic as a fixed overlay driven by CSS keyframes, and swap the UI underneath inside
`startTransition` behind it.

### Animation performance budget

The app holds a screen wake lock for ninety minutes, so **all ambient animation must
stop when the cinematic ends.** A drifting starfield running all game is the worst
thing we could build.

- **Safe:** `clip-path` wipes (same shape function in both keyframes), `transform` and
  `opacity` on pre-composited layers, a static vignette whose opacity animates, a
  pre-baked grain tile translated in `steps()`, letterboxing, two or three candle
  flames on long out-of-phase flickers.
- **Budgeted:** one `backdrop-filter` layer at a *fixed* blur radius animating opacity
  only. Never animate a blur radius. Cap CSS particles around 40.
- **Forbidden:** animated SVG `feTurbulence` smoke. CPU-bound, not reliably
  GPU-accelerated, and it will collapse frame rate while the wake lock holds. Pre-render
  smoke to a static asset if we want it.

```css
--ease-cinematic: cubic-bezier(0.16, 1, 0.16, 1);
--ease-veil:      cubic-bezier(0.65, 0, 0.35, 1);
--ease-ui:        cubic-bezier(0.32, 0.72, 0, 1);
```

Expensive reads as a long tail and no overshoot. Cinematic 1600-2200 ms,
micro-interactions 120-180 ms. Choreograph four layered beats — letterbox in, veil
sweeps, title fades up with letter-spacing opening, grain and vignette settle and
everything stops — not fifteen parallel token animations. Tap anywhere skips to the end
state and a faint "tap to continue" fades in at ~700 ms. Under `prefers-reduced-motion`
substitute a 200 ms crossfade with a held title rather than removing the transition,
since the phase change is a functional signal, and freeze the grain rather than
deleting it.

Audio: one optional, opt-in, sub-second low cue at night start only, defaulting to
**off**. A chime on every phase change leaks timing to players and steps on the
Storyteller's narration. Unlock a single `AudioContext` on the start-game tap.

### Dim-room UX rules

Dark only, near-black rather than pure black. Tap targets 48 px minimum, 64 px for live
night controls. No controls in the top bar; primary actions in a bottom bar within
thumb reach. Bottom sheets, never centre modals. Frequent destructive actions are
instant with an undo toast; rare ones need a long-press confirm. At most two levels of
disclosure, with setup complexity on a separate screen from the live game.

---

## Architecture

### Storyteller app

Two hard-separated modes, the highest-leverage decision for "not overwhelming":

1. **Plan** — roster, script picker and editor, composition solver, deal and tweak.
2. **Run** — the live grimoire. Ruthlessly sparse: the circle, the phase, one primary
   action, and a bottom sheet per seat.

Plus **History** and **Settings**.

```ts
type Phase =
  | { k: 'setup' }
  | { k: 'night'; n: number; step: number }
  | { k: 'day'; n: number }
  | { k: 'nomination'; n: number; nominator: SeatId; nominee: SeatId; votes: SeatId[] }
  | { k: 'ended'; winner: 'good' | 'evil'; rationale: string }
```

A seat carries the axes that are genuinely independent. Getting this wrong is why
hand-rolled trackers break:

- `alive | dead`, plus `deadVoteAvailable`
- `alignment` — independent of character, because a good player can hold an evil one
- `trueCharacterId` **vs** `perceivedCharacterId` — Drunk, Lunatic, Marionette
- `drunk` and `poisoned` as **separate** flags that stack and do not cancel
- `registeredAs` — Recluse and Spy misregistration. No existing tool tracks this
- `mad` with subject and penalty, as an adjudication aid only. Madness is social and
  must never be automated
- effects carry an **expiry** — `dusk`, a named night, or permanent. Most tools model
  poison as an untyped boolean and get it wrong

Every mutation goes through `apply(action)`, pushing `{action, inverse, timestamp}`
onto a capped log. That log **is** the night action log, the per-player timeline and
the recap, and undo falls out of it for free. This is why we aren't using a
snapshot-diffing undo library.

### Night engine

Filter `nightsheet.json` to the characters actually dealt, preserving order, dropping
dead players but keeping characters whose ability works while dead. A Drunk appears at
their **cover role's** position, labelled so the Storyteller doesn't forget. Insert
`minioninfo` and `demoninfo` only at seven or more players.

The queue alone is insufficient: some abilities resolve immediately when triggered
(Scarlet Woman on Demon death, Ravenkeeper on death, the Imp star-pass). This is
exactly where hand-rolled night lists break, so the engine needs the ordered queue
**plus an interrupt stack**.

### Setup solver

A constraint solver over the composition table (5-15; 16-20 use the 15 row plus
Travellers), applying: fixed deltas (Baron +2 Outsiders, Fang Gu +1, Vigormortis −1,
Lil' Monsta +1 Minion); Storyteller-choice deltas (Godfather ±1, Balloonist, Hermit,
Sentinel); open deltas (Kazali, Lord of Typhon); forced inclusions (Huntsman pulls the
Damsel, Choirboy the King); team wipes (Atheist removes all evil, Summoner starts with
no Demon); the coupled case (Xaan, where the Outsider count *is* the night it fires);
bag exceptions (`bag-disabled` means the token is never drawn though the slot counts;
`bag-duplicate` for Legion and Village Idiot); and seating constraints (Marionette
neighbours the Demon, Lord of Typhon needs a contiguous evil line centred on the Demon).

Where it cannot close a case it must **say so plainly** rather than guess.
Confidently-wrong automation is the worst failure mode for a Storyteller tool.

### Grimoire geometry

Absolutely-positioned DOM, not SVG or canvas, so real buttons get focus, hit areas,
text wrapping and `backdrop-filter` for free. Drive the circle from two custom
properties using CSS `cos()`/`sin()`, Baseline since 2023:

```css
.circle > li {
  --a: calc(1turn * var(--i) / var(--n) - 0.25turn);
  --r: 38cqmin;
  position: absolute; inset: 50% auto auto 50%;
  translate: calc(-50% + var(--r) * cos(var(--a))) calc(-50% + var(--r) * sin(var(--a)));
}
```

Seat size `clamp(52px, 13cqmin, 96px)` keeps the tap-target floor at 20 players; an
elliptical layout in portrait buys room. Show at most two reminder chips per seat plus
a "+3" badge, rest in the sheet — thirty visible chips is exactly the overwhelm the
brief forbids. Chips are `pointer-events: none`; the seat is the target. One SVG layer
underneath for nomination arrows. A **grimoire lock** toggle lets the tablet be set
down or passed safely.

### Player companion

Join flow, two taps from scan to role:

```
ST shows one QR  →  player scans, taps the OS banner  →  app opens
  →  "Who are you?" list of names; taps theirs (claimed seats grey out)
  →  opaque card: "Press and hold"
  →  picture, name, team and ability together; release re-covers
  →  under it, two named rows: "The script", "Your notes"
```

No name typing — the grimoire already knows who's at the table, and the seat list it
sends fills in the notes so nobody types the table twice. The install prompt is
deferred until *after* the reveal, the likeliest abandonment point.

No tab bar. A player meets this app once, in a dim room, so the screen opens on the one
thing they came for and names the other two in words rather than icons. While the
question is "who are you?", nothing else is on screen at all.

**Secrecy, by construction.** Cover is **opaque, never blurred** — a blurred token
still leaks the blue/red ring, which is most of the secret — and it covers the whole
card, ability included: an ability left in the open names the character as surely as
its picture does. Visible only while the
finger is down, via `pointerdown`/`pointerup`/`pointercancel`; no timers or toggle
state that can be left open. Auto-recover after ~6 s even if held, so the phone can't
be propped face-up. Re-cover on `visibilitychange` and `blur`, which matters on iOS
because the OS snapshots the screen for the app switcher. Reveal inside a circular mask
growing from the centre so the alignment ring appears last. Strip the fragment with
`history.replaceState()` once cached, keep the role out of `document.title` and
notifications, and disable the long-press callout so iOS can't surface the role name in
a share sheet.

**Notes**, three layers of decreasing speed and increasing expressiveness — because a
tap costs ~0.3 s with eyes on the table and typing a word costs 3-5 s with eyes down:

1. **Claim** — one tap, from a grid of *this script's* characters, so 13-25 options not
   181. Re-tapping keeps both claims with timestamps.
2. **Stamps** — toggleable chips: Confirmed, Suspect, Evil?, Lied, Registered as,
   Droisoned?, Voted with me. They must toggle **off** on tap; the documented chip
   failure is users unable to remove a mis-tap.
3. **Freeform** — a single line pinned to the thumb zone, autosaving on every keystroke,
   no save button ever.

Every note is auto-stamped with the current day or night, so day separators and a
retroactive-death timeline come free from one input with three controls on screen. This
is how we beat the incumbent note app's fifteen fields while staying "incredibly
simple". Death is a long-press on the seat with the shroud animating over, settable on
an earlier day with later days recomputing.

The differentiator over every existing note app: **this one already knows your role and
your script, because you scanned the Storyteller's code.**

### Relay

One Cloudflare Worker with a Durable Object per room, using WebSocket hibernation so an
idle room isn't billed for duration — ideal for a long bursty game. Payloads are
encrypted client-side with a key derived from the QR fragment, so the relay never sees
a role. It is a **fire-and-forget outbox**: the Storyteller writes to IndexedDB first,
queues a delta, and a background flusher drains it when online. Nothing in the UI ever
awaits the network. If the relay is unreachable the app falls back to per-player QR
codes automatically. A four-character room code (Crockford alphabet, no I/O/0/1) sits
under the QR for camera failures.

---

## Repository shape

```
apps/storyteller/      the Storyteller PWA
apps/player/           the player companion PWA
packages/rules/        data loading, composition table, setup solver, night order
packages/ui/           shared design tokens and primitives
packages/protocol/     QR payload codec, encryption, relay message types
workers/room/          Cloudflare Worker + Durable Object
scripts/fetch-data.ts  vendors and pins the official TPI data
.github/workflows/     test, build, deploy both apps to Pages
```

pnpm workspace. Both apps build to static output; a single Pages deployment serves
`/st` and `/p`.

---

## Design iteration loop — the design is reviewed visually, not assumed

The design is not "specified once and built". It is built, **captured, looked at, and
refined**, with the user seeing screenshots and animation clips throughout rather than
only at the end. This is a standing requirement on the work, not a final QA step.

Everything needed is already installed and verified in this environment: Chromium at
`/opt/pw-browsers`, and ffmpeg 7.0.1 bundled with Playwright at
`/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux`.

### Capture harness

A `pnpm shots` script drives Playwright over every screen and state, writing to
`design/<date>/`:

- **Viewports**: small phone (390×844), large phone (430×932), tablet (820×1180), all
  at `deviceScaleFactor: 3` so the images are retina-sharp and text rendering can
  actually be judged.
- **Every screen in every meaningful state**: empty roster, 7-player and 15-player
  grimoires, a seat sheet open, night step mid-walk, a nomination with a live tally,
  the player companion's token back and revealed token, the notes sheet.
- **Both apps side by side**, so the shared design system can be checked for drift.
- The grimoire at 5, 10, 15 and 20 seats, because the circle layout and the tap-target
  floor are exactly where a seating design silently breaks.

### Animation capture

Two complementary artefacts per transition, because they answer different questions:

1. **A video clip** — Playwright `recordVideo` produces webm, converted with the
   bundled ffmpeg to a compact looping GIF or MP4. This shows whether the motion
   *feels* expensive: the timing, the settle, the weight.
2. **A deterministic frame strip** — pause every animation via
   `document.getAnimations()`, seek each to a fixed `currentTime`, and screenshot.
   Stitched into a contact sheet by ffmpeg. Because seeking is deterministic, the same
   frames come back every run, so two iterations can be compared honestly rather than
   guessing at timing-dependent captures.

Covered transitions: day → night, night → dawn, the token flip on reveal, a death
shroud landing, a seat sheet rising, a nomination arrow sweeping.

### The loop

Build a screen → capture → **send the user the images with `SendUserFile`** →
critique against the Midnight Grimoire rules (pure black or pure white anywhere?
alignment colour used decoratively? more than three display-type moments? contrast on
evil text? chrome carrying ornament it shouldn't?) → refine → recapture. Screenshots go
out **as the work happens**, not batched at the end, so the user can redirect early and
cheaply. Animation clips accompany any change to motion.

### What gets checked in the images

- The near-black ground reads as lit, not flat, and elevation is legible without shadow.
- Evil text uses `--evil-300`, never `--evil-500`, and the contrast holds.
- Tap targets clear 48 px at 15 and 20 seats; the circle doesn't crowd.
- No more than two reminder chips visible per seat.
- Type: Cinzel confined to three places, body weight not too light on dark.
- The bottom third holds the controls; nothing important sits in the top bar.
- Reduced-motion variants render as a crossfade with the grain frozen, not stripped.

### Automated guards on the look

Not everything needs an eye. A small Vitest suite asserts the contrast ratios of every
foreground/background token pair in the palette, so a future palette tweak cannot
quietly break legibility. Playwright asserts computed tap-target sizes at 20 seats.
Visual-regression snapshots are deliberately **not** used in early iterations — the
aesthetic will churn and they'd only generate noise — but are worth adding once the
design settles.

## Verification

- `pnpm test` — Vitest over the pure logic, where the risk is concentrated: the
  composition solver across all counts 5-15 against every one of the 25 setup
  modifiers; night-order derivation; the action reducer with a property test that
  `apply(inverse(a), apply(a, s)) === s`; the QR codec round-tripping; persistence
  migrations; and the palette contrast guards.
- **A data-integrity test** re-running the join checks above against the vendored data,
  so a refreshed `roles.json` cannot silently break the night engine.
- `pnpm e2e` — Playwright: deal a 7-player Trouble Brewing game and walk the first
  night to dawn; kill a player, undo, confirm restoration; reload mid-game and confirm
  rehydration; go offline and confirm the app still boots; scan-to-reveal against a
  generated QR payload.
- Manual: run a real game on a phone, in a dim room, one-handed.

## Notes for the user

- The relay needs a **Cloudflare account** (free tier). Without one, the app still works
  end to end using per-player QR codes; only the single-shared-QR convenience is lost.
- GitHub Pages will serve the apps at `rb2750.github.io/BloodOnTheClocktower/...`. That
  path is long enough to make the fallback per-player QR denser than ideal. A short
  custom domain would improve it noticeably if one is available later.
