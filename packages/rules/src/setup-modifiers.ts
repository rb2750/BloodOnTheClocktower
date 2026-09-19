import type { BagTeam, Composition } from './types.js'

export type CompositionDelta = Partial<Composition>

export type SetupChoiceOption = { label: string; delta: CompositionDelta }

/**
 * How each setup-modifying character changes the game's setup.
 *
 * This table is written out explicitly rather than parsed from the `[...]`
 * fragment of the ability text. The bracket text is prose written for humans and
 * its phrasing varies; getting setup silently wrong is the worst failure mode a
 * Storyteller tool has, so every entry here is stated deliberately.
 *
 * There are exactly 25 characters with `setup: true` in the official data, and
 * a test asserts this table covers all of them.
 */
export type SetupModifier = {
  /** Deltas applied unconditionally to the true composition. */
  delta?: CompositionDelta
  /** The Storyteller must choose one option; the solver cannot decide. */
  choice?: { prompt: string; options: SetupChoiceOption[] }
  /** Characters that must also be in play. */
  forces?: string[]
  /** The solver cannot determine this; the Storyteller sets the numbers. */
  open?: { note: string }
  /**
   * This character's token never goes in the bag.
   *
   * With a `coverTeam`, the character still occupies its slot and a replacement
   * token of that team is dealt instead, so the player believes they are
   * something else (the Drunk, the Marionette). Without one, no replacement is
   * dealt and the character's own `delta` already accounts for the seat.
   */
  bagDisabled?: { coverTeam?: BagTeam | 'good' }
  /** More than one copy of this character may be in play. */
  bagDuplicate?: { note: string }
  /** Removes a whole team, redistributing its slots to Townsfolk. */
  wipe?: 'evil' | 'demon'
  /** A constraint on where players sit. */
  seating?: 'neighbours-demon' | 'evil-line'
  /** Changes a player's alignment without changing the composition. */
  alignmentTwist?: { note: string }
  /** Shown to the Storyteller in the setup screen. */
  note: string
}

export const SETUP_MODIFIERS: Record<string, SetupModifier> = {
  // --- Fixed deltas. The solver applies these without asking. ---
  baron: {
    delta: { outsider: +2, townsfolk: -2 },
    note: 'Two extra Outsiders replace two Townsfolk.',
  },
  fanggu: {
    delta: { outsider: +1, townsfolk: -1 },
    note: 'One extra Outsider replaces a Townsfolk. Keep a spare Fang Gu token to hand.',
  },
  vigormortis: {
    delta: { outsider: -1, townsfolk: +1 },
    note: 'One fewer Outsider; a Townsfolk takes the slot.',
  },
  lilmonsta: {
    // The extra Minion is what replaces the undealt Demon token, so the seat
    // counts stay level: a ten-player game deals 7/0/3/0 rather than 7/0/2/1.
    delta: { minion: +1, demon: -1 },
    bagDisabled: {},
    note: 'One extra Minion, and no Lil’ Monsta token goes in the bag, so no player holds the Demon. The Minions babysit it each night and it is still the Demon for every other purpose.',
  },

  // --- The Storyteller chooses. The solver offers the options. ---
  godfather: {
    choice: {
      prompt: 'Godfather: one more or one fewer Outsider?',
      options: [
        { label: 'One fewer Outsider', delta: { outsider: -1, townsfolk: +1 } },
        { label: 'One more Outsider', delta: { outsider: +1, townsfolk: -1 } },
      ],
    },
    note: 'You choose whether the game has one more or one fewer Outsider.',
  },
  balloonist: {
    choice: {
      prompt: 'Balloonist: add an Outsider?',
      options: [
        { label: 'No change', delta: {} },
        { label: 'One more Outsider', delta: { outsider: +1, townsfolk: -1 } },
      ],
    },
    note: 'You may add one Outsider.',
  },
  hermit: {
    choice: {
      prompt: 'Hermit: remove an Outsider?',
      options: [
        { label: 'No change', delta: {} },
        { label: 'One fewer Outsider', delta: { outsider: -1, townsfolk: +1 } },
      ],
    },
    note: 'You may remove one Outsider. The Hermit itself is an Outsider with all Outsider abilities.',
  },
  sentinel: {
    choice: {
      prompt: 'Sentinel: adjust the Outsider count?',
      options: [
        { label: 'No change', delta: {} },
        { label: 'One more Outsider', delta: { outsider: +1, townsfolk: -1 } },
        { label: 'One fewer Outsider', delta: { outsider: -1, townsfolk: +1 } },
      ],
    },
    note: 'There might be one extra or one fewer Outsider. Players know the Sentinel is in play, so the count is genuinely uncertain to them.',
  },

  // --- Forced inclusions. ---
  huntsman: {
    forces: ['damsel'],
    note: 'The Damsel must also be in play, taking an Outsider slot.',
  },
  choirboy: {
    forces: ['king'],
    note: 'The King must also be in play, taking a Townsfolk slot.',
  },

  // --- Team wipes. ---
  atheist: {
    wipe: 'evil',
    note: 'No evil characters are in play at all. Every player is good and you, the Storyteller, may break the rules. Good wins if the Atheist is executed.',
  },
  summoner: {
    wipe: 'demon',
    note: 'The game begins with no Demon. The Summoner chooses which Demon is created on the third night.',
  },

  // --- Players who are not what their token says. ---
  drunk: {
    bagDisabled: { coverTeam: 'townsfolk' },
    note: 'The Drunk occupies an Outsider slot, but no Drunk token goes in the bag. An extra Townsfolk token is dealt instead, and that player believes they are that Townsfolk.',
  },
  marionette: {
    bagDisabled: { coverTeam: 'good' },
    seating: 'neighbours-demon',
    note: 'The Marionette occupies a Minion slot, but no Marionette token goes in the bag. An extra good token is dealt instead. The Marionette must neighbour the Demon, and the Demon knows who it is.',
  },

  // --- Duplicates in the bag. ---
  villageidiot: {
    bagDuplicate: {
      note: 'Up to two extra Village Idiots may be in play, each taking a Townsfolk slot. One of them is drunk, and you choose which.',
    },
    note: 'Zero to two extra copies. One of the copies is drunk.',
  },
  legion: {
    open: {
      note: 'Most players are Legion. Set the counts by hand: Legion players are evil and take the place of most of the bag, with a small number of good characters remaining.',
    },
    bagDuplicate: { note: 'Many players hold a Legion token.' },
    note: 'Most players are Legion. The composition is not the standard table.',
  },

  // --- Open-ended: the Storyteller sets the numbers. ---
  kazali: {
    open: {
      note: 'You choose which players become which Minions on the first night, and the Outsider count changes by however much that costs. Set the Outsider count by hand.',
    },
    note: 'Minions are not dealt from the bag. Outsider count is open.',
  },
  lordoftyphon: {
    delta: { minion: +1, townsfolk: -1 },
    open: {
      note: 'The Outsider count is open, and the evil players must sit in one unbroken line with the Lord of Typhon in the middle. Set the Outsider count by hand and arrange the seating.',
    },
    seating: 'evil-line',
    note: 'One extra Minion, an open Outsider count, and the evil team sits in a line centred on the Demon.',
  },
  xaan: {
    open: {
      note: 'Choose a number X. There are X Outsiders in play, and on night X all Townsfolk are poisoned until dusk. The Outsider count and the night it fires are the same number.',
    },
    note: 'The Outsider count is X, and X is also the night the Xaan fires.',
  },

  // --- Alignment twists that leave the counts alone. ---
  bountyhunter: {
    alignmentTwist: {
      note: 'One Townsfolk is evil. The counts do not change; you flip one Townsfolk player’s alignment and tell them on the first night.',
    },
    note: 'One Townsfolk is evil.',
  },

  // --- Fabled and Loric: whole-game modifiers. ---
  deusexfiasco: {
    open: { note: 'You must make a deliberate, public mistake at some point in the game.' },
    note: 'Plan a public mistake.',
  },
  bootlegger: {
    open: { note: 'This script carries homebrew rules. Read them to the players during setup.' },
    note: 'Homebrew rules apply.',
  },
  gardener: {
    open: { note: 'You assign one or more players their character instead of dealing it randomly.' },
    note: 'You choose some characters rather than dealing them.',
  },
  pope: {
    bagDuplicate: { note: 'Duplicate good characters are allowed.' },
    note: 'Two players may share a good character.',
  },
  tor: {
    open: { note: 'Set up according to the Tor’s rules rather than the standard table.' },
    note: 'Non-standard setup.',
  },
}

export function applyDelta(base: Composition, delta: CompositionDelta): Composition {
  return {
    townsfolk: base.townsfolk + (delta.townsfolk ?? 0),
    outsider: base.outsider + (delta.outsider ?? 0),
    minion: base.minion + (delta.minion ?? 0),
    demon: base.demon + (delta.demon ?? 0),
  }
}
