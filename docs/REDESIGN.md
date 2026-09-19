# Grimoire redesign proposal

> **Status: implemented on this branch in four commits.** Written 2026-09-19 after
> rebuilding and screenshotting the current UI at three viewports. The first
> draft (warm umber ground, brass, gradients) was rejected as cheap-looking and
> is withdrawn. The full visual version, with live type specimens, the drawn
> icon set and four screen mockups, is a private artifact; this file is the text
> record so the decisions live with the code. Departures during the build are
> noted at the end.

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

## Proposal: flat, black, cream

One rule: **flat**. No gradient anywhere (including the token rim), no glows,
no vignettes, no film grain. The only shadow is under a bottom sheet. Chrome is
black, cream and hairlines; the only hues are the character art and the blue
and red of alignment. This is what the physical grimoire looks like: cream
tokens with ink art on a black board.

### Type (recommended)

| Role | Now | Proposed |
| --- | --- | --- |
| Titles, phase names, role names, headers | Cinzel 600 | **Libre Caslon Display** |
| Reading text: abilities, reminders, say-this | EB Garamond 500 | **Libre Caslon Text** 400 |
| UI: buttons, names, numbers | Inter 380 | **Libre Franklin** 400/500 |
| Labels | Inter uppercase tracked | Franklin caps, 11px, 0.14em tracking |

Alternative shown for comparison: Cormorant SC + Libre Caslon Text + Alegreya
Sans. Both on Fontsource, self-hosted as now. Tabular figures wherever a number
changes in place. Radius 6px on surfaces; tokens are the only circles.

### Colour

```
ink-0 #0c0c0d  ink-1 #141416  ink-2 #1c1c1f  ink-3 #2a2a2f  ink-4 #3b3b42
cream #ede8db  cream-2 #b8b3a7  cream-3 #7d796f
blue #3f7cc4   blue-2 #8db4e2   red #b33029   red-2 #e07c72
shroud #8a8f96  now #ffe3a3
```

Neutral black, not blue-black and not brown. Brass is removed entirely.
On ink-0: cream 15.8:1, cream-2 9.4:1, cream-3 4.6:1 (labels only), blue-2
8.9:1, red-2 6.7:1; blue and red at the 500 step are for rings and fills only.
"Extra dim" drops cream to cream-2 and dims the token discs.

### The token

Flat cream disc, art on top, flat 2.5px ring in blue or red, notched for evil.
Unassigned: grey ring. Dead: grey disc, desaturated, flat shroud over the top
edge. Acting now (night) or hand raised (vote): pale `now` ring with an outline.
Reminder tokens are the same object at 16px (ring) and 26px (sheet), carrying
the source character's art.

### Icons

A drawn set of about thirty on the Lucide 24px grid: 1.5px line, round caps,
solid fills where an engraving would be solid, the game's own objects. Kill →
shroud, nominate → pointing hand, vote → raised hand, ghost vote → ghost, log →
open book, past games → hourglass, notes → quill, script → sealed scroll,
settings → candle, Traveller → signpost, lock → iron lock, add player → a seat
at the ring, disguised → mask. Shipped as `packages/ui/src/icons.tsx` with
Lucide's `size` prop; Lucide removed from all three packages. Stopgap: Phosphor
thin.

### Components and screens

- **Primary button**: cream fill, dark text. Hairline secondary, text-only
  quiet, red-2 text for danger, never a red fill.
- **Header**: phase in Caslon Display 24px with a Franklin caps subline
  ("12 alive · step 4 of 9").
- **Setup steps**: three labels on a rule, not a segmented control.
- **Lists**: hairlines between rows, no boxes. Borders only on inputs, buttons
  and sheets.
- **Home**: wordmark, line-drawn clock face (also the app icon), rows for
  continue / regulars / scripts / past games / settings, "New game" primary.
- **Seat sheet**: icon action row (Kill / Character / Disguise / Traveller),
  reminders as tokens with expiry, notes as a line, timeline as a margin note,
  remove as a hold on a red text line at the bottom.
- **Grimoire centre dial**: awake character's token and "4 of 9" with a flat
  arc; by day, the player about to die and their votes. Log and Undo leave the
  ring (tap / long-press on the phase title; undo toast).
- **Vote on the ring** (phase IV): tap seats to raise hands, tally in the dial,
  hairline nomination arc on the reserved SVG layer; the name-chip grid goes.
- **Cinematic**: keeps letterbox and timing, loses the colour wash and flames.
- **Player app**: one grey step lighter than the Storyteller's; the vignette
  goes.

## Decisions needed

1. Flat, black, cream as the premise (recommended yes).
2. Cream tokens (recommended) or dark discs with flat coloured rings.
3. Caslon + Franklin (recommended) or the Cormorant alternative.
4. Drawn icon set (recommended) or Phosphor thin stopgap.
5. Centre dial (recommended yes).
6. Vote on the ring (recommended yes, as its own last phase).

## Phases

| Phase | Work | Touches |
| --- | --- | --- |
| I | Tokens: palette, fonts, label utilities, tabular figures, 6px radius. Remove every gradient, the grain and the vignette. Palette test updated. | `theme.css`, `palette.ts`, both `styles.css`, `grimoire.css`, `reveal.css` |
| II | Cream token, flat rings, shroud, acting state. Icon set as React components; every Lucide import swapped; Lucide removed. App icons for both apps. | `Token.tsx`, `grimoire.css`, `icons.tsx`, ~20 call sites, both `public/` |
| III | Components and screens: buttons, header, stepper, rules-not-boxes lists, reminder tokens, sheet, home screen, cinematic re-set. | `controls.tsx`, `Screen.tsx`, `Plan.tsx`, `SeatSheet.tsx`, `Settings.tsx`, `cinematic.css`, player screens |
| IV | Grimoire: centre dial, mini reminder tokens, vote on the ring with the nomination arc. | `Grimoire.tsx`, `Run.tsx`, `DayPanel.tsx`, `SeatView.tsx` |

Each phase is screenshot-reviewed with `pnpm shots` before the next starts.
Phases I–III change no behaviour or tests; IV changes the vote interaction and
its end-to-end test.

## What changed during the build

- **Undo** moved into the log sheet (a tap on the phase title) and a long
  press on the phase title, with the undo toast unchanged. **Add a Traveller**
  moved into the log sheet too, since the centre of the ring is now the dial.
- The **night rail** under the reminder text shows one tick per step; the
  dial shows the same progress as an arc, and the acting seat is lit.
- **Vote on the ring** replaced the voter chip grid outright rather than
  sitting beside it; the nomination arc is measured from the seat elements so
  it follows the ring at every player count.
- The design system's raw token names changed (`ink-0..4`, `cream`,
  `blue`, `red`, `now`); components reach only for the semantic aliases.
- Both apps now ship the icon files their manifests referenced. They are
  rendered by `pnpm icons` from the same clock face and seal the UI draws.
