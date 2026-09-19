import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import { idsFor, type Payload } from '@botc/protocol'

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
  /** The seat we claimed in a shared room. */
  seatId: string | null
  seatName: string | null
  /** Storyteller-driven phase, when a relay is connected. */
  phase: string
  day: number
  /** Notes keyed by the other players' names. */
  notes: Record<string, PlayerNote>
  /** Stable id for this device, so a claimed seat survives a reload. */
  deviceId: string
  hasRevealed: boolean
}

export type PlayerActions = {
  applyPayload: (payload: Payload) => void
  setRole: (characterId: string, scriptIds: string[], scriptName: string) => void
  setSeat: (seatId: string, seatName: string) => void
  setPhase: (phase: string, day: number) => void
  markRevealed: () => void

  ensureNote: (name: string) => void
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
      seatId: null,
      seatName: null,
      phase: 'Day 1',
      day: 1,
      notes: {},
      deviceId: newId(),
      hasRevealed: false,

      applyPayload: (payload) =>
        set((s) => {
          if (payload.kind === 'seat') {
            const ids = idsFor(payload.script)
            return {
              payload,
              scriptIds: ids,
              characterId: idsFor([payload.character])[0] ?? null,
              // A per-player code carries the role outright, so there is
              // nothing to claim and nothing to wait for.
              seatId: s.seatId,
            }
          }
          return { payload }
        }),

      setRole: (characterId, scriptIds, scriptName) =>
        set({ characterId, scriptIds, scriptName }),

      setSeat: (seatId, seatName) => set({ seatId, seatName }),

      setPhase: (phase, day) => set({ phase, day }),

      markRevealed: () => set({ hasRevealed: true }),

      ensureNote: (name) =>
        set((s) =>
          s.notes[name]
            ? s
            : { notes: { ...s.notes, [name]: { name, claims: [], stamps: [], lines: [] } } },
        ),

      addClaim: (name, characterId) =>
        set((s) => {
          const note = s.notes[name] ?? { name, claims: [], stamps: [], lines: [] }
          // A changed claim is itself information, so both are kept.
          if (note.claims.at(-1)?.characterId === characterId) return s
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
          seatId: null,
          seatName: null,
          notes: {},
          hasRevealed: false,
          deviceId: get().deviceId,
        }),
    }),
    {
      name: 'botc-player',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
    },
  ),
)
