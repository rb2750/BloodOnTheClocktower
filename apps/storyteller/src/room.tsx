import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Relay,
  characterIndex,
  exportPublicKey,
  generateKeyMaterial,
  generateRoomId,
  keptSealingPair,
  indexesFor,
  sealFor,
  type RelayMessage,
  type RelayStatus,
} from '@botc/protocol'
import { getCharacter } from '@botc/rules'
import { get as idbGet, set as idbSet } from 'idb-keyval'
import { phaseLabel, useStore } from './state/store.js'
import { RELAY_URL } from './config.js'

/**
 * The room, for as long as the game lasts.
 *
 * This used to live inside the hand-out sheet, which meant the Storyteller was
 * only connected while that sheet was open. Roles were all it ever had to send,
 * so that was enough. A private word is different: it is sent hours later, from
 * a different screen, so the connection belongs to the game rather than to a
 * sheet.
 */
type Room = {
  status: RelayStatus
  /** Seats whose phone is connected and can be sent a private word. */
  reachable: string[]
  whisper: (seatId: string, text: string, id: string) => Promise<boolean>
}

const RoomContext = createContext<Room>({
  status: 'offline',
  reachable: [],
  whisper: async () => false,
})

export const useRoom = () => useContext(RoomContext)

function tableOf(game: ReturnType<typeof useStore.getState>['game']) {
  return (game?.seats ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    taken: Boolean(game?.claims?.[s.id]),
    alive: s.alive,
    ghostVote: s.deadVoteAvailable,
    traveller: s.isTraveller,
  }))
}

function phaseMessage(game: ReturnType<typeof useStore.getState>['game']): RelayMessage | null {
  const phase = game?.phase
  if (!phase || phase.k === 'setup') return null
  const day = phase.k === 'ended' ? 0 : phase.n
  return { t: 'phase', phase: phaseLabel(phase), day }
}

function voteMessage(game: ReturnType<typeof useStore.getState>['game']): RelayMessage {
  const today = game?.phase.k === 'day' ? game.phase.n : null
  const nomination = game?.nominations.filter((n) => n.day === today).at(-1)
  if (!game || !nomination) return { t: 'vote', nomination: null }
  const name = (id: string) => game.seats.find((s) => s.id === id)?.name ?? '?'
  return {
    t: 'vote',
    nomination: {
      id: nomination.id,
      nominator: name(nomination.nominatorId),
      nominee: name(nomination.nomineeId),
      voters: nomination.voterIds.map(name),
      tally: nomination.tally,
      majority: nomination.majority,
      settled: nomination.settled,
    },
  }
}

export function RoomProvider({ children }: { children: ReactNode }) {
  const game = useStore((s) => s.game)
  const ensureRoom = useStore((s) => s.ensureRoom)
  const recordClaim = useStore((s) => s.recordClaim)
  const [status, setStatus] = useState<RelayStatus>('offline')
  const [reachable, setReachable] = useState<string[]>([])

  const relay = useRef<Relay | null>(null)
  const pair = useRef<CryptoKeyPair | null>(null)
  const resend = useRef<(seatId: string) => void>(() => {})
  // Each player's own public key, learned when they claim their seat. Kept on
  // disk per room, so a Storyteller whose app restarted mid-game can still
  // reach every phone that has ever sat down.
  const keys = useRef<Map<string, string>>(new Map())
  // What each seat was last told it is, so a changed character is sent again.
  const told = useRef<Map<string, string>>(new Map())

  const roomId = game?.room?.id
  const hasGame = Boolean(game)

  useEffect(() => {
    if (!RELAY_URL || !hasGame) return
    let cancelled = false
    const room = ensureRoom(() => ({ id: generateRoomId(), key: generateKeyMaterial() }))

    const keysStore = `botc-keys-${room.id}`

    // Everything a phone needs to catch up: who we are, who is here, what time
    // it is, and how the vote stands. Sent on every connect, not just the
    // first, so a Storyteller's phone coming back from a locked screen makes
    // every player re-introduce itself and nothing stays stale.
    const introduce = (client: Relay, pub: string) => {
      const now = useStore.getState().game
      client.send({ t: 'hello', pub })
      client.send({ t: 'seats', seats: tableOf(now) })
      const opening = phaseMessage(now)
      if (opening) client.send(opening)
      client.send(voteMessage(now))
    }

    const sendRole = (client: Relay, seatId: string) => {
      const ours = pair.current
      const theirs = keys.current.get(seatId)
      const state = useStore.getState()
      const seat = state.game?.seats.find((s) => s.id === seatId)
      if (!ours || !theirs || !seat?.characterId) return
      // Never. A seat that says "drunk" is a seat whose believed role has not
      // been chosen yet, however it came to say so.
      if (seat.characterId === 'drunk') return
      told.current.set(seat.id, seat.characterId)
      // Sealed to this player's own key, so the broadcast is readable by
      // exactly one device at the table.
      void sealFor(ours, theirs, {
        character: characterIndex(seat.characterId),
        script: indexesFor((state.game?.script.characterIds ?? []).filter((id) => getCharacter(id))),
        scriptName: state.game?.scriptName ?? '',
      }).then((sealed) => client.send({ t: 'role', seatId: seat.id, sealed }))
    }

    // Everything this seat was ever told, sent again under the same ids. A
    // phone that missed a word while asleep, or could not open it before its
    // key was known, gets it the moment it sits back down.
    const resendWhispers = (client: Relay, seatId: string) => {
      const ours = pair.current
      const theirs = keys.current.get(seatId)
      const game = useStore.getState().game
      if (!ours || !theirs || !game) return
      for (const entry of game.log) {
        if (entry.kind !== 'info' || entry.info?.toSeatId !== seatId || !entry.info.id) continue
        const { id, given } = entry.info
        void sealFor(ours, theirs, { text: given, at: entry.phase }).then((sealed) =>
          client.send({ t: 'whisper', seatId, id, sealed }),
        )
      }
    }

    const run = async () => {
      const ours = await keptSealingPair(
        () => idbGet('botc-storyteller-pair'),
        (p) => idbSet('botc-storyteller-pair', p),
      )
      if (cancelled) return
      pair.current = ours
      const pub = await exportPublicKey(ours)
      const remembered = (await idbGet(keysStore).catch(() => undefined)) as
        | Record<string, string>
        | undefined
      if (remembered) keys.current = new Map(Object.entries(remembered))
      setReachable([...keys.current.keys()])

      const client = new Relay({
        url: RELAY_URL,
        room: room.id,
        key: room.key,
        role: 'host',
        onStatus: (status) => {
          setStatus(status)
          if (status === 'open') introduce(client, pub)
        },
        onMessage: (message: RelayMessage) => {
          if (message.t === 'hand') {
            // The store already knows the rules: a dead hand only counts while
            // its one vote is unspent, and lowering it gives that vote back.
            const game = useStore.getState().game
            const today = game?.phase.k === 'day' ? game.phase.n : null
            const open = game?.nominations.filter((n) => n.day === today && !n.settled).at(-1)
            if (!open) return
            const up = open.voterIds.includes(message.seatId)
            if (up !== message.up) useStore.getState().toggleVote(open.id, message.seatId)
            return
          }
          if (message.t !== 'claim') return
          const state = useStore.getState()
          const seat = state.game?.seats.find((s) => s.id === message.seatId)
          if (!seat || !pair.current) return

          keys.current.set(seat.id, message.pub)
          void idbSet(keysStore, Object.fromEntries(keys.current))
          setReachable([...keys.current.keys()])
          recordClaim(seat.id, message.deviceId)
          sendRole(client, seat.id)
          resendWhispers(client, seat.id)
        },
      })

      relay.current = client
      resend.current = (seatId) => sendRole(client, seatId)
      await client.start()
    }

    void run()
    return () => {
      cancelled = true
      relay.current?.close()
      relay.current = null
      keys.current.clear()
      told.current.clear()
      setReachable([])
    }
  }, [hasGame, roomId, ensureRoom, recordClaim])


  // The seat list is re-sent whenever it changes, so a phone that joins late,
  // or comes back, is never looking at a stale table.
  const seats = game?.seats
  const claims = game?.claims
  // A character changed mid-game goes out to that phone as soon as it changes.
  // Before this, a role was only ever sent in answer to a claim, and a player
  // whose character was swapped kept the old one until they scanned again.
  useEffect(() => {
    for (const seat of seats ?? []) {
      if (!seat.characterId || !keys.current.has(seat.id)) continue
      if (told.current.get(seat.id) !== seat.characterId) resend.current(seat.id)
    }
  }, [seats])

  useEffect(() => {
    if (!relay.current || !seats) return
    relay.current.send({ t: 'seats', seats: tableOf(useStore.getState().game) })
  }, [seats, claims])

  // And the time of day. Every phone shows it, and plays the same nightfall
  // the Storyteller's screen plays, so the room moves together.
  const phase = game?.phase
  useEffect(() => {
    const message = phaseMessage(useStore.getState().game)
    if (relay.current && message) relay.current.send(message)
  }, [phase])

  // The vote, as it is counted. Every raised hand is a change.
  const nominations = game?.nominations
  useEffect(() => {
    if (relay.current) relay.current.send(voteMessage(useStore.getState().game))
  }, [nominations, phase])

  const whisper = async (seatId: string, text: string, id: string) => {
    const client = relay.current
    const ours = pair.current
    const theirs = keys.current.get(seatId)
    if (!client || !ours || !theirs) return false
    const phase = useStore.getState().game?.phase
    const at = phase ? phaseLabel(phase) : ''
    const sealed = await sealFor(ours, theirs, { text, at })
    client.send({ t: 'whisper', seatId, id, sealed })
    return true
  }

  return (
    <RoomContext.Provider value={{ status, reachable, whisper }}>{children}</RoomContext.Provider>
  )
}
