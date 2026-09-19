import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Relay,
  exportPublicKey,
  generateSealingPair,
  idsFor,
  openSealed,
  type RelayMessage,
  type RelayStatus,
  type SealedRole,
} from '@botc/protocol'
import { RELAY_URL } from './config.js'
import { useStore } from './state.js'

export type Seat = { id: string; name: string; taken: boolean }

/**
 * Connects to the shared room, if there is one.
 *
 * A per-player code carries everything already, so this does nothing in that
 * case. When there is no relay configured, or it cannot be reached, the hook
 * reports `offline` and the app keeps working with whatever it has.
 */
export function useRelay() {
  const payload = useStore((s) => s.payload)
  const seatId = useStore((s) => s.seatId)
  const deviceId = useStore((s) => s.deviceId)
  const setRole = useStore((s) => s.setRole)
  const setPhase = useStore((s) => s.setPhase)

  const [seats, setSeats] = useState<Seat[]>([])
  const [status, setStatus] = useState<RelayStatus>('offline')
  const relay = useRef<Relay | null>(null)
  // Ours is ephemeral and lives only for this session: the Storyteller seals
  // our role to it, so nobody else in the room can open it.
  const pair = useRef<CryptoKeyPair | null>(null)
  const storytellerKey = useRef<string | null>(null)
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
      const ours = await generateSealingPair()
      if (cancelled) return
      pair.current = ours

      const client = new Relay({
        url: RELAY_URL,
        room: payload.room,
        key: payload.key,
        role: 'player',
        onStatus: setStatus,
        onMessage: (message: RelayMessage) => {
          if (message.t === 'hello') {
            storytellerKey.current = message.pub
            // A claim made before we knew their key is re-sent now.
            const waiting = pendingClaim.current
            if (waiting) {
              pendingClaim.current = null
              void announceClaim(waiting)
            }
            return
          }
          if (message.t === 'seats') return setSeats(message.seats)
          if (message.t === 'phase') return setPhase(message.phase, message.day)
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
  }, [payload, setRole, setPhase, announceClaim])

  const claim = (seat: Seat) => {
    useStore.getState().setSeat(seat.id, seat.name)
    if (storytellerKey.current) void announceClaim(seat)
    else pendingClaim.current = seat
  }

  return { seats, status, claim, claimed: seatId }
}
