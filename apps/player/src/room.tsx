import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { get as idbGet, set as idbSet } from 'idb-keyval'
import {
  Relay,
  exportPublicKey,
  keptSealingPair,
  idsFor,
  openSealed,
  type RelayMessage,
  type RelayStatus,
  type SealedRole,
  type SealedWhisper,
} from '@botc/protocol'
import { RELAY_URL } from './config.js'
import { useStore } from './state.js'
import { alert } from './alert.js'

export type Seat = { id: string; name: string; taken: boolean }

/**
 * Connects to the shared room, if there is one, and stays connected.
 *
 * It used to live inside the seat picker, which meant a phone stopped listening
 * the moment it had a character. The Storyteller can send a private word at any
 * point in the game, so the connection lasts as long as the app is open.
 *
 * A per-player code carries everything already, so this does nothing in that
 * case. When there is no relay configured, or it cannot be reached, it reports
 * `offline` and the app keeps working with whatever it has.
 */
function useRelayConnection() {
  const payload = useStore((s) => s.payload)
  const seatId = useStore((s) => s.seatId)
  const deviceId = useStore((s) => s.deviceId)
  const setRole = useStore((s) => s.setRole)
  const setPhase = useStore((s) => s.setPhase)
  const rememberTable = useStore((s) => s.rememberTable)
  const setTable = useStore((s) => s.setTable)
  const setVote = useStore((s) => s.setVote)
  const setStorytellerKey = useStore((s) => s.setStorytellerKey)
  const addMessage = useStore((s) => s.addMessage)

  const [seats, setSeats] = useState<Seat[]>([])
  const [status, setStatus] = useState<RelayStatus>('offline')
  const relay = useRef<Relay | null>(null)
  // Ours is ephemeral and lives only for this session: the Storyteller seals
  // our role to it, so nobody else in the room can open it.
  const pair = useRef<CryptoKeyPair | null>(null)
  // Seeded from the last game, so a restart can open a word that arrives
  // before the Storyteller has said hello again.
  const storytellerKey = useRef<string | null>(useStore.getState().storytellerKey)
  const pendingClaim = useRef<Seat | null>(null)

  const announceClaim = useCallback(
    async (seat: Seat) => {
      if (!pair.current || !relay.current) return
      relay.current.send({
        t: 'claim',
        seatId: seat.id,
        deviceId,
        pub: await exportPublicKey(pair.current),
      })
    },
    [deviceId],
  )

  useEffect(() => {
    if (!payload || payload.kind !== 'room' || !RELAY_URL) return
    let cancelled = false

    const run = async () => {
      const ours = await keptSealingPair(
        () => idbGet('botc-player-pair'),
        (p) => idbSet('botc-player-pair', p),
      )
      if (cancelled) return
      pair.current = ours

      // Say who we are every time the line comes back, not only when asked.
      // The Storyteller may have restarted, and may have missed our last
      // answer while its own phone was asleep.
      const sitDown = () => {
        const s = useStore.getState()
        if (s.roomId === payload.room && s.seatId && s.seatName) {
          void announceClaim({ id: s.seatId, name: s.seatName, taken: false })
        }
      }

      const client = new Relay({
        url: RELAY_URL,
        room: payload.room,
        key: payload.key,
        role: 'player',
        onStatus: (status) => {
          setStatus(status)
          if (status === 'open') sitDown()
        },
        onMessage: (message: RelayMessage) => {
          if (message.t === 'hello') {
            storytellerKey.current = message.pub
            setStorytellerKey(message.pub)
            // A claim made before we knew their key is re-sent now.
            const waiting = pendingClaim.current
            if (waiting) {
              pendingClaim.current = null
              void announceClaim(waiting)
              return
            }
            // Scanned this room before: sit back down without asking. The
            // Storyteller's side only honours it because it is the same device.
            const remembered = useStore.getState()
            if (remembered.roomId === payload.room && remembered.seatId && remembered.seatName) {
              void announceClaim({ id: remembered.seatId, name: remembered.seatName, taken: false })
            }
            return
          }
          if (message.t === 'whisper') {
            // Every phone in the room receives it; only one can open it.
            const mine = useStore.getState().seatId
            const theirs = storytellerKey.current
            if (message.seatId !== mine || !theirs || !pair.current) return
            void openSealed<SealedWhisper>(pair.current, theirs, message.sealed)
              .then((word) => {
                const fresh = !useStore.getState().messages.some((m) => m.id === message.id)
                addMessage(message.id, word.text, word.at)
                if (fresh) alert('word')
              })
              .catch(() => {
                // Addressed to us and we cannot open it: the Storyteller holds a
                // key we no longer have. Sitting down again gives them the right
                // one, and they send everything we were ever told.
                console.warn('A word from the Storyteller could not be opened. Asking again.')
                sitDown()
              })
            return
          }
          if (message.t === 'seats') {
            rememberTable(message.seats.map((s) => s.name))
            setTable(
              message.seats.map((s) => ({
                name: s.name,
                alive: s.alive ?? true,
                ghostVote: s.ghostVote ?? true,
                traveller: s.traveller ?? false,
              })),
            )
            return setSeats(message.seats)
          }
          if (message.t === 'phase') {
            const was = useStore.getState()
            if (was.phaseKnown && was.phase !== message.phase) {
              alert(/^night/i.test(message.phase) ? 'night' : 'day')
            }
            return setPhase(message.phase, message.day)
          }
          if (message.t === 'vote') {
            // A short buzz when a vote opens, a longer one when it closes, so a
            // phone face down on the table still says "look up". Nothing for a
            // raised hand: that would buzz the room every few seconds.
            const before = useStore.getState().vote
            const next = message.nomination
            if (next && next.id !== before?.id) alert('vote')
            else if (next && next.settled && before && !before.settled) alert('closed')
            return setVote(next)
          }
          if (message.t === 'role') {
            // Every device receives every role message. Only ours will open,
            // because only we hold the private half it was sealed to.
            if (message.seatId !== useStore.getState().seatId) return
            const theirs = storytellerKey.current
            if (!theirs || !pair.current) return
            void openSealed<SealedRole>(pair.current, theirs, message.sealed)
              .then((role) =>
                setRole(
                  idsFor([role.character])[0] ?? '',
                  idsFor(role.script),
                  role.scriptName,
                ),
              )
              .catch(() => {
                /* Not sealed for us. Nothing to do and nothing to report. */
              })
          }
        },
      })

      relay.current = client
      await client.start()
    }

    void run()
    return () => {
      cancelled = true
      relay.current?.close()
      relay.current = null
    }
  }, [payload, setRole, setPhase, rememberTable, setTable, setVote, setStorytellerKey, addMessage, announceClaim])

  const claim = (seat: Seat) => {
    if (!payload || payload.kind !== 'room') return
    useStore.getState().setSeat(seat.id, seat.name, payload.room)
    if (storytellerKey.current) void announceClaim(seat)
    else pendingClaim.current = seat
  }

  // A hand is sent, not kept: the Storyteller's count comes back in the next
  // vote snapshot, and that is what the screen shows. A hand raised while the
  // line is down is lost, exactly as a hand nobody saw would be.
  const hand = (up: boolean) => {
    const mine = useStore.getState().seatId
    if (!mine || !relay.current) return
    relay.current.send({ t: 'hand', seatId: mine, up })
  }

  return { seats, status, claim, claimed: seatId, hand }
}


type Room = ReturnType<typeof useRelayConnection>

const RoomContext = createContext<Room>({
  seats: [],
  status: 'offline',
  claim: () => {},
  claimed: null,
  hand: () => {},
})

/** One connection for the whole app, rather than one per screen. */
export function RoomProvider({ children }: { children: ReactNode }) {
  const room = useRelayConnection()
  return <RoomContext.Provider value={room}>{children}</RoomContext.Provider>
}

export const useRelay = () => useContext(RoomContext)
