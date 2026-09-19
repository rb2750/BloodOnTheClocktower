import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import {
  buildNightOrder,
  editionScript,
  getCharacter,
  majorityThreshold,
  resolveBlock,
  tallyVotes,
  type NightEntry,
  type Script,
} from '@botc/rules'
import type { Effect, Game, LogEntry, LogKind, Nomination, Phase, Seat } from './types.js'

enablePatches()

const idbStorage: StateStorage = {
  getItem: async (name) => (await idbGet(name)) ?? null,
  setItem: async (name, value) => {
    await idbSet(name, value)
  },
  removeItem: async (name) => {
    await idbDel(name)
  },
}

export function phaseLabel(phase: Phase): string {
  switch (phase.k) {
    case 'setup':
      return 'Setup'
    case 'night':
      return `Night ${phase.n}`
    case 'day':
      return `Day ${phase.n}`
    case 'ended':
      return 'Finished'
  }
}

const id = () => Math.random().toString(36).slice(2, 10)

const toBytes = (value: unknown): Uint8Array =>
  value instanceof Uint8Array ? value : Uint8Array.from(Object.values(value as Record<string, number>))

/**
 * One undoable step.
 *
 * Every mutation goes through `commit`, which records Immer's inverse patches
 * alongside a human-readable description. That single mechanism gives the game
 * log, the per-player timeline and undo, which is why there is no separate
 * snapshot-diffing undo library here.
 */
type Commit = { label: string; inverse: Patch[]; at: number }

export type RosterEntry = { id: string; name: string }

export type StoreState = {
  game: Game | null
  /** Regular players, so eight names are not retyped every session. */
  roster: RosterEntry[]
  savedScripts: { id: string; name: string; script: Script }[]
  history: Game[]
  undoStack: Commit[]
  settings: {
    cinematics: boolean
    sound: boolean
    dim: boolean
    showFlavour: boolean
    keepAwake: boolean
  }
}

export type StoreActions = {
  commit: (label: string, recipe: (draft: StoreState) => void) => void
  undo: () => string | null
  canUndo: () => boolean

  newGame: (opts: { script: Script; scriptName: string; names: string[] }) => void
  abandonGame: () => void
  finishGame: (winner: 'good' | 'evil', rationale: string) => void

  setSeatCharacter: (seatId: string, characterId: string | undefined) => void
  setSeatTrueCharacter: (seatId: string, characterId: string | undefined) => void
  renameSeat: (seatId: string, name: string) => void
  setSeatTraveller: (seatId: string, isTraveller: boolean) => void
  addSeat: (name: string, isTraveller?: boolean) => void
  removeSeat: (seatId: string) => void
  moveSeat: (seatId: string, toIndex: number) => void
  toggleAlive: (seatId: string) => void
  toggleDeadVote: (seatId: string) => void
  setSeatNotes: (seatId: string, notes: string) => void
  setAlignment: (seatId: string, alignment: 'good' | 'evil' | undefined) => void

  addEffect: (seatId: string, effect: Omit<Effect, 'id' | 'createdAt' | 'createdOn'>) => void
  removeEffect: (seatId: string, effectId: string) => void
  expireEffects: (at: 'dusk' | 'dawn') => void

  setBluffs: (ids: string[]) => void
  setLocked: (locked: boolean) => void
  /** The game's shared room, created on first use. */
  ensureRoom: (make: () => { id: string; key: string }) => { id: string; key: string }
  /** A device has taken a seat. Returns false if another device holds it. */
  recordClaim: (seatId: string, deviceId: string) => boolean
  /** Roles hidden on screen, for when someone can see the phone. Not persisted. */
  concealed: boolean
  setConcealed: (concealed: boolean) => void
  /** The last phase the cinematic played for, so a reload does not replay it. */
  cinematicPlayed: string | null
  setCinematicPlayed: (key: string) => void

  startFirstNight: () => void
  toNight: () => void
  toDay: () => void
  setNightStep: (step: number) => void

  nominate: (nominatorId: string, nomineeId: string) => void
  toggleVote: (nominationId: string, seatId: string) => void
  settleNomination: (nominationId: string) => void
  execute: (seatId: string | null) => void

  log: (kind: LogKind, text: string, seatIds?: string[], info?: LogEntry['info']) => void
  nightOrder: (includeDead?: boolean) => NightEntry[]
  aliveCount: () => number
  seat: (seatId: string) => Seat | undefined

  saveScript: (name: string, script: Script) => void
  removeScript: (scriptId: string) => void
  setSetting: <K extends keyof StoreState['settings']>(
    key: K,
    value: StoreState['settings'][K],
  ) => void
}

export type Store = StoreState & StoreActions

const UNDO_DEPTH = 100

function makeSeat(name: string, isTraveller = false): Seat {
  return {
    id: id(),
    name,
    alive: true,
    deadVoteAvailable: true,
    isTraveller,
    effects: [],
    notes: '',
  }
}

export const useStore = create<Store>()(
  persist(
    (set, getState) => {
      const commit: StoreActions['commit'] = (label, recipe) => {
        const current = getState()
        const [next, , inverse] = produceWithPatches(current, (draft) => {
          recipe(draft as unknown as StoreState)
        })
        if (inverse.length === 0) return
        set({
          ...(next as StoreState),
          undoStack: [
            ...(next as StoreState).undoStack,
            { label, inverse, at: Date.now() },
          ].slice(-UNDO_DEPTH),
        })
      }

      const pushLog = (
        draft: StoreState,
        kind: LogKind,
        text: string,
        seatIds: string[] = [],
        info?: LogEntry['info'],
      ) => {
        if (!draft.game) return
        draft.game.log.push({
          id: id(),
          at: Date.now(),
          phase: phaseLabel(draft.game.phase),
          kind,
          text,
          seatIds,
          info,
        })
      }

      return {
        game: null,
        roster: [],
        savedScripts: [],
        history: [],
        undoStack: [],
        settings: {
          cinematics: true,
          sound: false,
          dim: false,
          showFlavour: true,
          keepAwake: true,
        },

        commit,

        canUndo: () => getState().undoStack.length > 0,

        undo: () => {
          const state = getState()
          const last = state.undoStack.at(-1)
          if (!last) return null
          const reverted = applyPatches(state, last.inverse) as StoreState
          set({ ...reverted, undoStack: state.undoStack.slice(0, -1) })
          return last.label
        },

        newGame: ({ script, scriptName, names }) =>
          commit('Start game', (draft) => {
            draft.game = {
              id: id(),
              createdAt: Date.now(),
              scriptName,
              script,
              seats: names.map((n) => makeSeat(n)),
              phase: { k: 'setup' },
              bluffs: [],
              nominations: [],
              log: [],
              locked: false,
            }
            for (const name of names) {
              if (!draft.roster.some((r) => r.name === name)) {
                draft.roster.push({ id: id(), name })
              }
            }
            pushLog(draft, 'phase', `New game on ${scriptName} with ${names.length} players.`)
          }),

        abandonGame: () =>
          commit('Abandon game', (draft) => {
            draft.game = null
          }),

        finishGame: (winner, rationale) =>
          commit('Finish game', (draft) => {
            if (!draft.game) return
            draft.game.phase = { k: 'ended', winner, rationale }
            draft.game.finishedAt = Date.now()
            pushLog(draft, 'phase', `${winner === 'good' ? 'Good' : 'Evil'} wins. ${rationale}`)
            draft.history.unshift(JSON.parse(JSON.stringify(draft.game)) as Game)
          }),

        setSeatCharacter: (seatId, characterId) =>
          commit('Change character', (draft) => {
            const seat = draft.game?.seats.find((s) => s.id === seatId)
            if (!seat) return
            seat.characterId = characterId
            // Log the character's proper name, not its id. The log is read by a
            // person, often out loud during the post-game recap.
            const name = characterId ? getCharacter(characterId)?.name : undefined
            pushLog(draft, 'change', `${seat.name} is the ${name ?? 'nobody yet'}.`, [seatId])
          }),

        setSeatTrueCharacter: (seatId, characterId) =>
          commit('Change true character', (draft) => {
            const seat = draft.game?.seats.find((s) => s.id === seatId)
            if (!seat) return
            seat.trueCharacterId = characterId
            const realName = characterId ? getCharacter(characterId)?.name : undefined
            pushLog(
              draft,
              'change',
              realName
                ? `${seat.name} really is the ${realName}, though they believe otherwise.`
                : `${seat.name} is what they appear to be.`,
              [seatId],
            )
          }),

        renameSeat: (seatId, name) =>
          commit('Rename player', (draft) => {
            const seat = draft.game?.seats.find((s) => s.id === seatId)
            if (seat) seat.name = name
          }),

        setSeatTraveller: (seatId, isTraveller) =>
          commit('Change Traveller status', (draft) => {
            const seat = draft.game?.seats.find((s) => s.id === seatId)
            if (seat) seat.isTraveller = isTraveller
          }),

        addSeat: (name, isTraveller = false) =>
          commit('Add player', (draft) => {
            draft.game?.seats.push(makeSeat(name, isTraveller))
            pushLog(draft, 'change', `${name} joined${isTraveller ? ' as a Traveller' : ''}.`)
          }),

        removeSeat: (seatId) =>
          commit('Remove player', (draft) => {
            if (!draft.game) return
            const seat = draft.game.seats.find((s) => s.id === seatId)
            draft.game.seats = draft.game.seats.filter((s) => s.id !== seatId)
            if (seat) pushLog(draft, 'change', `${seat.name} left the game.`)
          }),

        moveSeat: (seatId, toIndex) =>
          commit('Move player', (draft) => {
            if (!draft.game) return
            const from = draft.game.seats.findIndex((s) => s.id === seatId)
            if (from < 0) return
            const [seat] = draft.game.seats.splice(from, 1)
            if (seat) draft.game.seats.splice(toIndex, 0, seat)
          }),

        toggleAlive: (seatId) =>
          commit('Toggle alive', (draft) => {
            const seat = draft.game?.seats.find((s) => s.id === seatId)
            if (!seat) return
            seat.alive = !seat.alive
            if (!seat.alive) {
              // A dead player keeps exactly one vote for the rest of the game.
              seat.deadVoteAvailable = true
              pushLog(draft, 'death', `${seat.name} died.`, [seatId])
            } else {
              pushLog(draft, 'change', `${seat.name} is alive again.`, [seatId])
            }
          }),

        toggleDeadVote: (seatId) =>
          commit('Toggle ghost vote', (draft) => {
            const seat = draft.game?.seats.find((s) => s.id === seatId)
            if (seat) seat.deadVoteAvailable = !seat.deadVoteAvailable
          }),

        setSeatNotes: (seatId, notes) =>
          commit('Edit notes', (draft) => {
            const seat = draft.game?.seats.find((s) => s.id === seatId)
            if (seat) seat.notes = notes
          }),

        setAlignment: (seatId, alignment) =>
          commit('Change alignment', (draft) => {
            const seat = draft.game?.seats.find((s) => s.id === seatId)
            if (!seat) return
            seat.alignmentOverride = alignment
            pushLog(draft, 'change', `${seat.name} is now ${alignment ?? 'their usual alignment'}.`, [
              seatId,
            ])
          }),

        addEffect: (seatId, effect) =>
          commit(`Add ${effect.label}`, (draft) => {
            const seat = draft.game?.seats.find((s) => s.id === seatId)
            if (!seat || !draft.game) return
            seat.effects.push({
              ...effect,
              id: id(),
              createdAt: Date.now(),
              createdOn: phaseLabel(draft.game.phase),
            })
            pushLog(draft, 'effect', `${seat.name} is ${effect.label.toLowerCase()}.`, [seatId])
          }),

        removeEffect: (seatId, effectId) =>
          commit('Remove reminder', (draft) => {
            const seat = draft.game?.seats.find((s) => s.id === seatId)
            if (!seat) return
            const effect = seat.effects.find((e) => e.id === effectId)
            seat.effects = seat.effects.filter((e) => e.id !== effectId)
            if (effect) {
              pushLog(draft, 'effect', `${seat.name} is no longer ${effect.label.toLowerCase()}.`, [
                seatId,
              ])
            }
          }),

        expireEffects: (at) =>
          commit('Expire reminders', (draft) => {
            if (!draft.game) return
            const phase = draft.game.phase
            for (const seat of draft.game.seats) {
              seat.effects = seat.effects.filter((e) => {
                if (e.expiry.kind === 'permanent') return true
                if (e.expiry.kind === 'dusk') return at !== 'dusk'
                if (e.expiry.kind === 'night') {
                  return !(phase.k === 'night' && phase.n >= e.expiry.night)
                }
                if (e.expiry.kind === 'day') {
                  return !(phase.k === 'day' && phase.n >= e.expiry.day)
                }
                return true
              })
            }
          }),

        setBluffs: (ids) =>
          commit('Set demon bluffs', (draft) => {
            if (draft.game) draft.game.bluffs = ids
          }),

        concealed: false,
        setConcealed: (concealed) => set({ concealed }),
        cinematicPlayed: null,
        setCinematicPlayed: (key) => set({ cinematicPlayed: key }),

        ensureRoom: (make) => {
          const game = getState().game
          if (!game) return make()
          if (game.room) return game.room
          const room = make()
          set({ game: { ...game, room } })
          return room
        },

        // A seat goes to whoever last said it was theirs. Refusing a second
        // device locks out anyone who cleared their browser data or swapped
        // phones mid-game, and that costs more than it saves: the role is sent
        // sealed to the device that asked, so the table still cannot read it.
        recordClaim: (seatId, deviceId) => {
          const game = getState().game
          if (!game) return false
          if (game.claims?.[seatId] === deviceId) return true
          set({ game: { ...game, claims: { ...(game.claims ?? {}), [seatId]: deviceId } } })
          return true
        },

        setLocked: (locked) =>
          commit(locked ? 'Lock grimoire' : 'Unlock grimoire', (draft) => {
            if (draft.game) draft.game.locked = locked
          }),

        startFirstNight: () =>
          commit('Begin first night', (draft) => {
            if (!draft.game) return
            draft.game.phase = { k: 'night', n: 1, step: 0 }
            pushLog(draft, 'phase', 'Night falls on Ravenswood Bluff.')
          }),

        toNight: () =>
          commit('Begin night', (draft) => {
            if (!draft.game) return
            const n = draft.game.phase.k === 'day' ? draft.game.phase.n + 1 : 1
            draft.game.phase = { k: 'night', n, step: 0 }
            pushLog(draft, 'phase', `Night ${n} begins.`)
          }),

        toDay: () =>
          commit('Begin day', (draft) => {
            if (!draft.game) return
            const n = draft.game.phase.k === 'night' ? draft.game.phase.n : 1
            draft.game.phase = { k: 'day', n }
            pushLog(draft, 'phase', `Day ${n} begins.`)
          }),

        setNightStep: (step) =>
          commit('Night step', (draft) => {
            if (draft.game?.phase.k === 'night') draft.game.phase.step = step
          }),

        nominate: (nominatorId, nomineeId) =>
          commit('Nominate', (draft) => {
            if (!draft.game || draft.game.phase.k !== 'day') return
            const day = draft.game.phase.n
            const alive = draft.game.seats.filter((s) => s.alive && !s.isTraveller).length
            const nominator = draft.game.seats.find((s) => s.id === nominatorId)
            const nominee = draft.game.seats.find((s) => s.id === nomineeId)
            const nomination: Nomination = {
              id: id(),
              day,
              nominatorId,
              nomineeId,
              voterIds: [],
              tally: 0,
              majority: majorityThreshold(alive),
              settled: false,
              at: Date.now(),
            }
            draft.game.nominations.push(nomination)
            pushLog(
              draft,
              'nomination',
              `${nominator?.name ?? '?'} nominated ${nominee?.name ?? '?'}.`,
              [nominatorId, nomineeId],
            )
          }),

        toggleVote: (nominationId, seatId) =>
          commit('Toggle vote', (draft) => {
            if (!draft.game) return
            const nomination = draft.game.nominations.find((n) => n.id === nominationId)
            const seat = draft.game.seats.find((s) => s.id === seatId)
            if (!nomination || !seat) return

            const voting = nomination.voterIds.includes(seatId)
            if (voting) {
              nomination.voterIds = nomination.voterIds.filter((v) => v !== seatId)
              // A ghost vote spent in error must come back.
              if (!seat.alive) seat.deadVoteAvailable = true
            } else {
              if (!seat.alive && !seat.deadVoteAvailable) return
              nomination.voterIds.push(seatId)
              if (!seat.alive) seat.deadVoteAvailable = false
            }

            nomination.tally = tallyVotes(
              nomination.voterIds.map((v) => {
                const s = draft.game!.seats.find((x) => x.id === v)
                return { seatId: v, characterId: s?.characterId }
              }),
            )
          }),

        settleNomination: (nominationId) =>
          commit('Close vote', (draft) => {
            if (!draft.game) return
            const nomination = draft.game.nominations.find((n) => n.id === nominationId)
            if (!nomination) return
            nomination.settled = true
            const nominee = draft.game.seats.find((s) => s.id === nomination.nomineeId)
            pushLog(
              draft,
              'nomination',
              `${nominee?.name ?? '?'} received ${nomination.tally} vote${
                nomination.tally === 1 ? '' : 's'
              }, needing ${nomination.majority}.`,
              [nomination.nomineeId],
            )
          }),

        execute: (seatId) =>
          commit('Execute', (draft) => {
            if (!draft.game) return
            if (!seatId) {
              pushLog(draft, 'execution', 'Nobody was executed today.')
              return
            }
            const seat = draft.game.seats.find((s) => s.id === seatId)
            if (!seat) return
            // Execution and death are separate events: a player can be executed
            // and survive, and a dead player can be executed again. Either way
            // it uses up the day's execution.
            pushLog(draft, 'execution', `${seat.name} was executed.`, [seatId])
          }),

        log: (kind, text, seatIds = [], info) =>
          commit('Log', (draft) => pushLog(draft, kind, text, seatIds, info)),

        nightOrder: (includeDead = false) => {
          const game = getState().game
          if (!game || game.phase.k !== 'night') return []
          return buildNightOrder({
            night: game.phase.n,
            playerCount: game.seats.filter((s) => !s.isTraveller).length,
            includeDead,
            seats: game.seats
              .filter((s) => s.characterId)
              .map((s) => ({
                seatId: s.id,
                characterId: s.characterId!,
                trueCharacterId: s.trueCharacterId,
                alive: s.alive,
              })),
            override:
              game.phase.n === 1 ? game.script.meta.firstNight : game.script.meta.otherNight,
          })
        },

        aliveCount: () =>
          getState().game?.seats.filter((s) => s.alive && !s.isTraveller).length ?? 0,

        seat: (seatId) => getState().game?.seats.find((s) => s.id === seatId),

        saveScript: (name, script) =>
          commit('Save script', (draft) => {
            const existing = draft.savedScripts.find((s) => s.name === name)
            if (existing) existing.script = script
            else draft.savedScripts.push({ id: id(), name, script })
          }),

        removeScript: (scriptId) =>
          commit('Remove script', (draft) => {
            draft.savedScripts = draft.savedScripts.filter((s) => s.id !== scriptId)
          }),

        setSetting: (key, value) =>
          commit('Change setting', (draft) => {
            draft.settings[key] = value
          }),
      }
    },
    {
      name: 'botc-storyteller',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      // The undo stack is deliberately not persisted: undoing across a reload,
      // possibly days later, is more surprising than useful.
      partialize: (state) => ({
        game: state.game,
        roster: state.roster,
        savedScripts: state.savedScripts,
        history: state.history,
        settings: state.settings,
        cinematicPlayed: state.cinematicPlayed,
      }),
      // A Uint8Array does not survive JSON, so the room key comes back as an
      // object keyed by byte index and every use of it fails.
      merge: (persisted, current) => {
        const state = { ...current, ...(persisted as Partial<StoreState>) } as Store
        const room = state.game?.room
        if (state.game && room && !(room.key instanceof Uint8Array)) {
          state.game = { ...state.game, room: { ...room, key: toBytes(room.key) } }
        }
        return state
      },
    },
  ),
)

/** Convenience for the common "who is about to die" question. */
export function currentBlock(game: Game | null) {
  if (!game || game.phase.k !== 'day') return { seatId: null, votes: 0, tied: false }
  const alive = game.seats.filter((s) => s.alive && !s.isTraveller).length
  const today = game.nominations.filter((n) => n.day === game.phase.n && n.settled)
  return resolveBlock(
    today.map((n) => ({
      day: n.day,
      nominator: n.nominatorId,
      nominee: n.nomineeId,
      voters: n.voterIds,
      tally: n.tally,
      majority: n.majority,
      succeeded: n.tally >= n.majority,
      at: n.at,
    })),
    alive,
  )
}

export { editionScript }
