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
import { alert } from '@botc/ui'
import { currentPush } from './push.js'
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
  /** Pairs of seats that have exchanged a private message lately. Who, never what. */
  talking: { a: string; b: string; at: number }[]
  /** Seats whose phone is connected and can be sent a private word. */
  reachable: string[]
  whisper: (seatId: string, text: string, id: string) => Promise<boolean>
  /** Show one player the whole Grimoire, as the Spy and the Widow are owed. */
  showGrimoire: (seatId: string) => Promise<boolean>
  /** Send the relay this phone's own notification subscription. */
  subscribe: (sub: string) => void
}

const RoomContext = createContext<Room>({
  status: 'offline',
  talking: [],
  reachable: [],
  whisper: async () => false,
  showGrimoire: async () => false,
  subscribe: () => {},
})

export const useRoom = () => useContext(RoomContext)

function tableOf(game: ReturnType<typeof useStore.getState>['game'], keys?: Map<string, string>) {
  return (game?.seats ?? []).map((s) => ({
    // Public keys are public: every phone needs every other's to seal a
    // message to it.
    pub: keys?.get(s.id),
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
  const [talking, setTalking] = useState<{ a: string; b: string; at: number }[]>([])

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
      // The Storyteller's own phone gets its notifications the same way a
      // player's does, under the name "host".
      void currentPush().then((sub) => {
        if (sub) client.sendRaw(`sub:host:${sub}`)
      })
      client.send({ t: 'seats', seats: tableOf(now, keys.current) })
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
      const changed = told.current.has(seat.id) && told.current.get(seat.id) !== seat.characterId
      told.current.set(seat.id, seat.characterId)
      // Sealed to this player's own key, so the broadcast is readable by
      // exactly one device at the table.
      void sealFor(ours, theirs, {
        character: characterIndex(seat.characterId),
        script: indexesFor((state.game?.script.characterIds ?? []).filter((id) => getCharacter(id))),
        scriptName: state.game?.scriptName ?? '',
      }).then((sealed) => {
        client.send({ t: 'role', seatId: seat.id, sealed })
        if (changed) client.sendRaw(`push:${seat.id}:role`)
      })
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
            if (up !== message.up) {
              useStore.getState().toggleVote(open.id, message.seatId)
              alert('hand')
              client.sendRaw('push:host:hand')
            }
            return
          }
          if (message.t === 'chat') {
            // Cannot be read here, and is not. The phone it is for gets its
            // notification, and the grimoire notes that two people are talking.
            client.sendRaw(`push:${message.to}:chat`)
            client.sendRaw('push:host:chat')
            const [a, b] = [message.from, message.to].sort()
            setTalking((t) => [...t.filter((x) => !(x.a === a && x.b === b)), { a: a!, b: b!, at: Date.now() }].slice(-12))
            return
          }
          if (message.t !== 'claim') return
          const state = useStore.getState()
          const seat = state.game?.seats.find((s) => s.id === message.seatId)
          if (!seat || !pair.current) return

          if (!keys.current.has(seat.id)) {
            alert('seat')
            client.sendRaw('push:host:seat')
          }
          keys.current.set(seat.id, message.pub)
          // The table goes out again so everyone has this phone's key.
          client.send({ t: 'seats', seats: tableOf(state.game, keys.current) })
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
    relay.current.send({ t: 'seats', seats: tableOf(useStore.getState().game, keys.current) })
  }, [seats, claims, reachable])

  // And the time of day. Every phone shows it, and plays the same nightfall
  // the Storyteller's screen plays, so the room moves together.
  const phase = game?.phase
  const lastPhase = useRef<string | null>(null)
  useEffect(() => {
    const message = phaseMessage(useStore.getState().game)
    if (!relay.current || !message || message.t !== 'phase') return
    relay.current.send(message)
    if (lastPhase.current !== null && lastPhase.current !== message.phase) {
      relay.current.sendRaw(`push:*:${/^night/i.test(message.phase) ? 'night' : 'day'}`)
    }
    lastPhase.current = message.phase
  }, [phase])

  // The vote, as it is counted. Every raised hand is a change.
  const nominations = game?.nominations
  const lastVote = useRef<{ id: string; settled: boolean } | null>(null)
  useEffect(() => {
    if (!relay.current) return
    const message = voteMessage(useStore.getState().game)
    relay.current.send(message)
    const now = message.t === 'vote' ? message.nomination : null
    if (now && now.id !== lastVote.current?.id) relay.current.sendRaw('push:*:vote')
    else if (now && now.settled && lastVote.current && !lastVote.current.settled) relay.current.sendRaw('push:*:closed')
    lastVote.current = now ? { id: now.id, settled: now.settled } : null
  }, [nominations, phase])

  const subscribe = (sub: string) => {
    relay.current?.sendRaw(`sub:host:${sub}`)
  }

  const showGrimoire = async (seatId: string) => {
    const client = relay.current
    const ours = pair.current
    const theirs = keys.current.get(seatId)
    const game = useStore.getState().game
    if (!client || !ours || !theirs || !game) return false
    const sealed = await sealFor(ours, theirs, {
      at: phaseLabel(game.phase),
      seats: game.seats.map((s) => ({
        name: s.name,
        character: s.characterId ? characterIndex(s.characterId) : -1,
        drunk: s.trueCharacterId === 'drunk',
        dead: !s.alive,
        tokens: s.effects.map((e) => ({ kind: e.kind, label: e.label })),
      })),
    })
    client.send({ t: 'grimoire', seatId, id: Math.random().toString(36).slice(2, 10), sealed })
    client.sendRaw(`push:${seatId}:grimoire`)
    return true
  }

  const whisper = async (seatId: string, text: string, id: string) => {
    const client = relay.current
    const ours = pair.current
    const theirs = keys.current.get(seatId)
    if (!client || !ours || !theirs) return false
    const phase = useStore.getState().game?.phase
    const at = phase ? phaseLabel(phase) : ''
    const sealed = await sealFor(ours, theirs, { text, at })
    client.send({ t: 'whisper', seatId, id, sealed })
    client.sendRaw(`push:${seatId}:word`)
    return true
  }

  return (
    <RoomContext.Provider value={{ status, reachable, talking, whisper, showGrimoire, subscribe }}>
      {children}
    </RoomContext.Provider>
  )
}
