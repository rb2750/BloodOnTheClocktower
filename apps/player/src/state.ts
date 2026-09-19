import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import { idsFor, type Payload, type VoteSnapshot } from '@botc/protocol'
import { alert } from './alert.js'

const idbStorage: StateStorage = {
  getItem: async (name) => (await idbGet(name)) ?? null,
  setItem: async (name, value) => {
    await idbSet(name, value)
  },
  removeItem: async (name) => {
    await idbDel(name)
  },
}

/**
 * A note about another player.
 *
 * Three layers, fastest first. A tap costs about a third of a second with your
 * eyes still on the table; typing a word costs three to five seconds with your
 * eyes on the keyboard, and in a live conversation that is information you do
 * not get back. So the common case — who claimed what — is one tap, the next
 * most common is a chip, and free text is the last resort.
 */
export type PlayerNote = {
  name: string
  /** Every claim they have made, kept in order with the phase it was made in. */
  claims: { characterId: string; at: string }[]
  /** Toggleable observations. */
  stamps: string[]
  lines: { id: string; text: string; at: string }[]
  /** Set retroactively; everything after this point reads as dead. */
  diedOnDay?: number
}

export type PlayerState = {
  /** What the scanned code told us. */
  payload: Payload | null
  /** Our own character, once known. */
  characterId: string | null
  /** The script, so every character can be looked up. */
  scriptIds: string[]
  scriptName: string
  /** The room that seat was claimed in, so a re-scan of the same code is
   *  recognised and a different game starts fresh. */
  roomId: string | null
  /** The seat we claimed in a shared room. */
  seatId: string | null
  seatName: string | null
  /** Storyteller-driven phase, when a relay is connected. */
  phase: string
  day: number
  /** Whether the Storyteller has ever said what time it is. Until they have,
   *  "Day 1" is only a label for notes, not something to show or play. */
  phaseKnown: boolean
  /** Notes keyed by the other players' names. */
  notes: Record<string, PlayerNote>
  /** Private words from the Storyteller, oldest first. */
  messages: { id: string; text: string; at: string }[]
  /** The table in seat order, who is alive, and who still holds a vote, as the
   *  Storyteller last said. A dead player has one vote for the rest of the game. */
  table: { name: string; alive: boolean; ghostVote: boolean; traveller: boolean }[]
  /** The last phase change this phone played, so a reload does not replay it. */
  cinematicPlayed: string | null
  /** Today's nomination as the Storyteller is counting it. */
  vote: VoteSnapshot | null
  /** The Storyteller's public key, kept so a restart can open what arrives. */
  storytellerKey: string | null
  /** The Storyteller changed our character and we have not looked yet. */
  roleChanged: boolean
  /** Stable id for this device, so a claimed seat survives a reload. */
  deviceId: string
  hasRevealed: boolean
}

export type PlayerActions = {
  applyPayload: (payload: Payload) => void
  setRole: (characterId: string, scriptIds: string[], scriptName: string) => void
  setSeat: (seatId: string, seatName: string, roomId: string) => void
  setPhase: (phase: string, day: number) => void
  markRevealed: () => void
  addMessage: (id: string, text: string, at: string) => void
  setTable: (table: { name: string; alive: boolean; ghostVote: boolean; traveller: boolean }[]) => void
  setVote: (vote: VoteSnapshot | null) => void
  setStorytellerKey: (key: string) => void
  setCinematicPlayed: (key: string) => void

  ensureNote: (name: string) => void
  rememberTable: (names: string[]) => void
  addClaim: (name: string, characterId: string) => void
  toggleStamp: (name: string, stamp: string) => void
  addLine: (name: string, text: string) => void
  removeLine: (name: string, lineId: string) => void
  setDied: (name: string, day: number | undefined) => void

  reset: () => void
}

const newId = () => Math.random().toString(36).slice(2, 10)

export const useStore = create<PlayerState & PlayerActions>()(
  persist(
    (set, get) => ({
      payload: null,
      characterId: null,
      scriptIds: [],
      scriptName: '',
      roomId: null,
      seatId: null,
      seatName: null,
      phase: 'Day 1',
      day: 1,
      phaseKnown: false,
      notes: {},
      messages: [],
      table: [],
      cinematicPlayed: null,
      vote: null,
      storytellerKey: null,
      roleChanged: false,
      deviceId: newId(),
      hasRevealed: false,

      // Notes are about the people in *this* game. A new room, or a per-player
      // code for a different script, is a new game, and what you thought of
      // Cara last week must not follow her to the next table.
      applyPayload: (payload) =>
        set((s) => {
          if (payload.kind === 'seat') {
            const ids = idsFor(payload.script)
            const sameGame =
              s.payload?.kind === 'seat' && s.scriptIds.join() === ids.join()
            return {
              payload,
              scriptIds: ids,
              characterId: idsFor([payload.character])[0] ?? null,
              // A per-player code carries the role outright, so there is
              // nothing to claim and nothing to wait for.
              seatId: s.seatId,
              notes: sameGame ? s.notes : {},
              messages: sameGame ? s.messages : [],
            }
          }
          // A code for the room we already sat down in keeps our seat; a code
          // for another game clears it, along with everything that belonged
          // to the old one.
          if (s.roomId === payload.room) return { payload }
          return {
            payload,
            roomId: null,
            seatId: null,
            seatName: null,
            characterId: null,
            hasRevealed: false,
            messages: [],
            notes: {},
            table: [],
            vote: null,
            cinematicPlayed: null,
            phaseKnown: false,
            storytellerKey: null,
            roleChanged: false,
          }
        }),

      setRole: (characterId, scriptIds, scriptName) =>
        set((s) => {
          const changed = Boolean(s.characterId && s.characterId !== characterId)
          if (changed) alert('role')
          return {
            characterId,
            scriptIds,
            scriptName,
            roleChanged: s.roleChanged || changed,
            hasRevealed: changed ? false : s.hasRevealed,
          }
        }),

      setStorytellerKey: (storytellerKey) => set({ storytellerKey }),

      setSeat: (seatId, seatName, roomId) =>
        set((s) => {
          // The table was remembered before we knew which seat was ours, so
          // drop the note we made about ourselves, unless it was written in.
          const mine = s.notes[seatName]
          const untouched =
            mine && mine.claims.length === 0 && mine.stamps.length === 0 && mine.lines.length === 0
          const notes = { ...s.notes }
          if (untouched) delete notes[seatName]
          return { seatId, seatName, roomId, notes }
        }),

      setPhase: (phase, day) => set({ phase, day, phaseKnown: true }),

      setTable: (table) => set({ table }),

      setVote: (vote) => set({ vote }),

      setCinematicPlayed: (key) => set({ cinematicPlayed: key }),

      markRevealed: () => set({ hasRevealed: true, roleChanged: false }),

      // The relay replays what it holds when a phone comes back, so the same
      // word can arrive twice; it is kept once, under the id it was sent with.
      addMessage: (id, text, at) =>
        set((s) =>
          s.messages.some((m) => m.id === id)
            ? s
            : { messages: [...s.messages, { id, text, at }] },
        ),

      ensureNote: (name) =>
        set((s) =>
          s.notes[name]
            ? s
            : { notes: { ...s.notes, [name]: { name, claims: [], stamps: [], lines: [] } } },
        ),

      // The Storyteller already typed everyone in, so nobody should have to
      // type them again. Our own seat is left out: notes are about other people.
      rememberTable: (names) =>
        set((s) => {
          const notes = { ...s.notes }
          for (const name of names) {
            if (name === s.seatName || notes[name]) continue
            notes[name] = { name, claims: [], stamps: [], lines: [] }
          }
          return { notes }
        }),

      addClaim: (name, characterId) =>
        set((s) => {
          const note = s.notes[name] ?? { name, claims: [], stamps: [], lines: [] }
          // Tapping the one already chosen takes it back: a mis-tap must cost
          // one more tap, not a trip through a menu.
          if (note.claims.at(-1)?.characterId === characterId) {
            return { notes: { ...s.notes, [name]: { ...note, claims: note.claims.slice(0, -1) } } }
          }
          // A changed claim is itself information, so both are kept.
          return {
            notes: {
              ...s.notes,
              [name]: {
                ...note,
                claims: [...note.claims, { characterId, at: s.phase }],
              },
            },
          }
        }),

      toggleStamp: (name, stamp) =>
        set((s) => {
          const note = s.notes[name] ?? { name, claims: [], stamps: [], lines: [] }
          const stamps = note.stamps.includes(stamp)
            ? note.stamps.filter((x) => x !== stamp)
            : [...note.stamps, stamp]
          return { notes: { ...s.notes, [name]: { ...note, stamps } } }
        }),

      addLine: (name, text) =>
        set((s) => {
          const trimmed = text.trim()
          if (!trimmed) return s
          const note = s.notes[name] ?? { name, claims: [], stamps: [], lines: [] }
          return {
            notes: {
              ...s.notes,
              [name]: {
                ...note,
                lines: [...note.lines, { id: newId(), text: trimmed, at: s.phase }],
              },
            },
          }
        }),

      removeLine: (name, lineId) =>
        set((s) => {
          const note = s.notes[name]
          if (!note) return s
          return {
            notes: {
              ...s.notes,
              [name]: { ...note, lines: note.lines.filter((l) => l.id !== lineId) },
            },
          }
        }),

      setDied: (name, day) =>
        set((s) => {
          const note = s.notes[name] ?? { name, claims: [], stamps: [], lines: [] }
          return { notes: { ...s.notes, [name]: { ...note, diedOnDay: day } } }
        }),

      reset: () =>
        set({
          payload: null,
          characterId: null,
          scriptIds: [],
          scriptName: '',
          roomId: null,
          seatId: null,
          seatName: null,
          notes: {},
          messages: [],
          table: [],
          cinematicPlayed: null,
          phaseKnown: false,
          vote: null,
          storytellerKey: null,
          roleChanged: false,
          hasRevealed: false,
          deviceId: get().deviceId,
        }),
    }),
    {
      name: 'botc-player',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      // A Uint8Array does not survive JSON, so the room key comes back as an
      // object keyed by byte index and the relay can never be rejoined.
      merge: (persisted, current) => {
        const state = { ...current, ...(persisted as Partial<PlayerState>) } as PlayerState &
          PlayerActions
        const payload = state.payload
        if (payload?.kind === 'room' && !(payload.key instanceof Uint8Array)) {
          state.payload = {
            ...payload,
            key: Uint8Array.from(Object.values(payload.key as unknown as Record<string, number>)),
          }
        }
        return state
      },
    },
  ),
)
