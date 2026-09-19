# Grimoire

A Storyteller companion for **Blood on the Clocktower**, and a player companion
to go with it. Unofficial, free, and built to be used on a phone in a dim room
while standing up.

> Not affiliated with The Pandemonium Institute. See [NOTICE.md](./NOTICE.md).

## What it does

**For the Storyteller**

- Plan a game from any of the 181 official characters, or import a script from
  the official Script Tool or botcscripts.com.
- Work out the composition, including all 25 setup-modifying characters. It
  solves what it can and says plainly what it cannot, rather than guessing.
- Deal characters at random and swap any of them by tapping.
- Walk the night in the official order, with the Storyteller reminder for each
  step and one-tap reminder tokens.
- Run nominations and voting with a live tally, ghost votes, and the line
  official advice asks for: how many votes to tie and how many to take the block.
- Track every effect with a real expiry, and every player's whole game.
- Undo anything.

**For players**

- Scan a code, hold the token to see your character, and it covers itself the
  moment you let go.
- Read what every character on the script does.
- Keep private notes on everyone: one tap for a claim, one tap for a mark, free
  text when you need it.

Both apps install to the home screen and work with no network.

The reasoning behind all of this — the research, the decisions, and the things
that changed during the build — is in [docs/DESIGN.md](./docs/DESIGN.md).

## Running it

```bash
pnpm install
pnpm data     # vendor the official character data
pnpm art      # fetch character art (not committed; see NOTICE.md)
pnpm dev      # the Storyteller app
pnpm dev:player
```

| Command | What it does |
| --- | --- |
| `pnpm test` | Unit tests over the rules engine, protocol and palette |
| `pnpm e2e` | End-to-end flows in a real browser |
| `pnpm shots` | Screenshots and animation clips into `design/<date>/` |
| `pnpm build` | Build both apps |

## How it is put together

```
apps/storyteller     the Storyteller app
apps/player          the player companion
packages/rules       composition, setup solving, night order, scripts, voting
packages/ui          the Midnight Grimoire design system
packages/protocol    QR payloads, encryption, relay client
workers/room         optional Cloudflare relay
```

### Where the data comes from

The Pandemonium Institute publish machine-readable data for toolmakers at
[`ThePandemoniumInstitute/botc-release`](https://github.com/ThePandemoniumInstitute/botc-release).
`pnpm data` vendors it, derives each character's night position from the night
sheet, indexes jinxes in both directions, and **refuses to write anything if a
cross-reference fails**. A test suite re-runs those checks, so a future refresh
cannot quietly break the night engine.

### Handing out characters

Two paths, chosen without asking:

- **With a relay** (`VITE_RELAY_URL` set): the whole table scans one code and
  each player taps their own name. Everything crossing the relay is encrypted
  with a key that only ever travelled inside the QR fragment, and each player's
  character is sealed a second time to that player's own ephemeral key — because
  the relay broadcasts to the room, and without that second layer any player
  could read everyone else's role.
- **With no relay**: one code per player, which the Storyteller turns to each
  seat in turn, exactly like carrying the bag around the circle. No server is
  involved at all.

The second path is the foundation, not a degraded mode. The Storyteller app
never waits on the network for anything.

### Design

Dark only, near-black rather than pure black. Blue and red are reserved strictly
for alignment, so they land with weight when they appear; brass is the accent,
used as a hairline and never as a slab. Ornament lives in the content layer and
the chrome stays plain, which is how the physical game works: the table is
plain, the tokens are ornate.

The design is reviewed by looking at it. `pnpm shots` drives the built apps
across three viewports and every seat count from five to twenty, records the
phase cinematics, and builds deterministic frame strips by seeking the overlay's
animations. It has already caught four bugs no test would have: dead colour
tokens from a Tailwind v3 shorthand, base styles outranking every utility, a
ring collapsing to a sliver, and tokens overlapping at eight players.

## Deploying

Pushing to `main` publishes both apps to GitHub Pages, the Storyteller at the
root and the player companion under `/player`.

The relay is optional. To use it:

```bash
cd workers/room && pnpm wrangler deploy
```

then set a repository variable `RELAY_URL` to the deployed Worker's address.
Without it, everything still works via per-player codes.
