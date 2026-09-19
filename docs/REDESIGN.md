# Grimoire redesign proposal

> **Status: proposal, not implemented.** Written 2026-09-19 after rebuilding and
> screenshotting the current UI at three viewports. The full visual version, with
> live type specimens, the drawn icon set and four screen mockups, is a private
> artifact; this file is the text record so the decisions live with the code.

## Diagnosis

1. **Cinzel says "Rome", not "Ravenswood Bluff".** A Trajan clone, used at 13px
   uppercase and letterspaced for the most-read line in the app. The game's world
   is Victorian: engraved lettering, book type, ink illustration.
2. **Inter makes it look like a settings app.** Neutral dashboard sans under
   watercolour token art. Three unrelated faces are on screen in the night panel.
3. **Lucide icons are from the wrong century**, and several are semantically
   wrong: aeroplane for Traveller, gavel for nominate, sparkles for settings,
   ballot box for a raised-hand vote, skull for death when the game's symbol is
   the shroud.
4. **Everything is a box.** Every row, setting, reminder and note is a hairline
   rounded rectangle; the seat sheet stacks eight. The token, meant to be the one
   ornate object, competes with a dozen equal rectangles.
5. **The centre of the ring is a menu.** "Log / Undo / Add" as text links in the
   most valuable space on screen, while the night panel repeats the acting token.
6. **Smaller things:** gold-outline primary reads as disabled; the empty
   new-game screen is 70% black with no wordmark; reminder chips are 9px pills;
   the shroud is a grey bar; `icon-192.png` / `icon-512.png` are referenced by
   both manifests and exist in neither app.

## What stays

Plan/Run separation, bottom sheets, thumb-zone primary action, 48/64px targets,
the token (gradient rim, notched evil ring, the word alongside the colour), the
clock-ring layout and its size solver, the cinematic and its performance budget,
hold-to-reveal and the seal, film grain, blue/red reserved for alignment.

## Proposal

### Type (recommended pairing A)

| Role | Now | Proposed |
| --- | --- | --- |
| Display, phase titles, role names, headers | Cinzel 600 | **Cormorant / Cormorant SC** 600 |
| Reading text: abilities, reminders, say-this | EB Garamond 500 | **Alegreya** 400 |
| UI: buttons, names, numbers | Inter 380 | **Alegreya Sans** 500 |
| Labels | Inter uppercase tracked | **Alegreya SC** small caps |

Alternative B: Playfair Display + Source Serif 4 + Source Sans 3 (crisper, less
atmospheric). Body goes 17px to 18px to match optical size. Small caps replace
tracked uppercase. Tabular figures everywhere a number changes in place. All on
Fontsource, self-hosted as now.

### Colour

Same structure, warmer temperature. Ground moves from blue-black to near-neutral
umber. One new token, `candle`, for "happening now" only.

```
umber-900 #0f0c0a  umber-800 #181311  umber-700 #241c17  umber-600 #35291f  umber-500 #4d3d30
parch-100 #efe3cc  parch-300 #cdbc9d  parch-500 #97876d
brass-300 #dcb75e  brass-400 #b98e2e  brass-600 #7a5a18  candle #f3cf84
good-500  #3f7fbf  good-300  #8cb5e0  evil-500  #a72e28  evil-300 #df7a70
shroud    #7b8087  ok        #6f8b5b
```

Contrast on umber-900: parch-100 15.3:1, brass-300 10.2:1, good-300 9.1:1,
evil-300 6.6:1, evil-500 2.8:1 (fills and rings only, as now). Shroud stays cool
on purpose.

### Icons

A bespoke "ink" set of about thirty on the Lucide 24px grid: 1.6px round-capped
strokes with solid fills where a woodcut would be solid, drawn from the game's
objects. Kill → shroud, nominate → manicule, vote → raised hand, ghost vote →
ghost, log → open book, past games → hourglass, notes → quill, script → sealed
scroll, settings → candle, Traveller → signpost, lock → iron lock, add player →
a seat at the ring, poisoned → vial, drunk → tankard, protected → shield,
disguised → mask. Shipped as `packages/ui/src/icons.tsx` with Lucide's `size`
and `strokeWidth` props so every call site is a one-line change; Lucide removed.
Stopgap if no bespoke set: Phosphor duotone.

### Components

- **Primary button** is a parchment fill with dark text. Gold outline becomes
  secondary emphasis; hairline stays quiet; danger is evil-300 text, never a fill.
- **Header**: phase in Cormorant SC at 22px with a small-caps subline
  ("12 alive · step 4 of 9"); no more 13px Cinzel.
- **Setup steps**: I · II · III on a rule, not a segmented control.
- **Lists**: rules between rows, no boxes. Containers only for real objects
  (token, say-this line, QR).
- **Reminders**: miniature round tokens carrying the source character's art,
  16px on the ring tucked inside the circle, larger in the seat sheet with the
  label and expiry beside them.
- **Seat sheet**: one icon action row (Kill / Character / Disguise /
  Traveller), reminders as tokens, notes as a line, timeline as a margin note,
  remove as a hold on a text line at the bottom.
- **Home**: wordmark, clock face (which also becomes the app icon), continue /
  regulars / scripts / past games / settings as rows, "New game" primary.
- **Grimoire centre dial**: the awake character's token and "4 of 9" at night
  with a conic progress ring; by day, the player about to die and their votes.
  Log and Undo leave the ring (tap / long-press on the phase title; undo toast).
- **Shroud** drawn as a cloth over the top of the token, not a bar. Awake seat
  lit with `candle`.
- **Vote on the ring** (phase IV): tap seats to raise hands, tally in the dial,
  nomination arc on the reserved SVG layer; the name-chip grid goes.

## Decisions needed

1. Type pairing: A (recommended) or B.
2. Icons: bespoke (recommended) or Phosphor stopgap.
3. Warm ground: yes (recommended) or keep blue-black.
4. Primary button: parchment fill (recommended) or solid brass.
5. Centre dial: yes (recommended).
6. Vote on the ring: yes, as its own last phase (recommended).

## Phases

| Phase | Work | Touches |
| --- | --- | --- |
| I | Tokens: palette, fonts, small-caps and label utilities, tabular figures; palette test updated. No layout changes. | `packages/ui/src/theme.css`, `palette.ts`, both `styles.css` |
| II | Icon set as React components; every Lucide import swapped; Lucide removed. App icons (192, 512, maskable) for both apps. | `packages/ui/src/icons.tsx`, ~20 call sites, both `public/` |
| III | Components: buttons, header, stepper, rules-not-boxes lists, reminder tokens, sheet header, home screen; cinematic re-set. | `controls.tsx`, `Screen.tsx`, `Plan.tsx`, `SeatSheet.tsx`, `Settings.tsx`, player screens |
| IV | Grimoire: centre dial, mini reminder tokens, shroud, awake highlight, vote-on-ring with nomination arc. | `Grimoire.tsx`, `grimoire.css`, `Run.tsx`, `DayPanel.tsx`, `SeatView.tsx` |

Each phase is screenshot-reviewed with `pnpm shots` before the next starts.
Phases I–III change no behaviour or tests; IV changes the vote interaction and
its end-to-end test.
