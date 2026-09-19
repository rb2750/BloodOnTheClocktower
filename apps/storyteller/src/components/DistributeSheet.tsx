import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { getCharacter } from '@botc/rules'
import {
  characterIndex,
  generateKeyMaterial,
  generateRoomId,
  indexesFor,
  payloadUrl,
  roomCode,
  type Payload,
} from '@botc/protocol'
import { Button, Label, Sheet, ChevronLeft, ChevronRight, Check } from '@botc/ui'
import { useStore } from '../state/store.js'
import { useRoom } from '../room.js'
import { PLAYER_ORIGIN, RELAY_URL } from '../config.js'

/**
 * Handing out roles.
 *
 * Two paths, and the app picks without asking. With a relay configured the
 * whole table scans one code, claims a seat, and is sent only their own role.
 * With no relay there is no shared state to claim against, so it falls back to
 * one code per player, which the Storyteller turns to each seat in turn. That
 * is exactly the physical ritual of carrying the bag around the circle, and it
 * needs no server at all.
 */
export function DistributeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const game = useStore((s) => s.game)
  const [index, setIndex] = useState(0)
  const [handed, setHanded] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setIndex(0)
      setHanded([])
    }
  }, [open])

  if (!game) return null

  const seats = game.seats.filter((s) => s.characterId)
  const seat = seats[index]

  const scriptIndexes = useMemo(
    () => indexesFor(game.script.characterIds.filter((id) => getCharacter(id))),
    [game.script.characterIds],
  )

  if (RELAY_URL) return <SharedCode open={open} onClose={onClose} />

  const payload: Payload | null = seat?.characterId
    ? {
        kind: 'seat',
        character: characterIndex(seat.characterId),
        seat: index + 1,
        script: scriptIndexes,
      }
    : null

  const done = handed.length === seats.length

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={done ? 'Everyone has their character' : `Show this to ${seat?.name ?? ''}`}
      subtitle={
        done
          ? 'You can close this and begin.'
          : `${handed.length} of ${seats.length} done. Turn the screen to them, then tap Next.`
      }
    >
      {seat && payload && (
        <div className="flex flex-col items-center gap-5 pb-2">
          <QrImage value={payloadUrl(PLAYER_ORIGIN, payload)} />

          <p className="serif max-w-[32ch] text-center text-[14px] leading-snug text-(--text-faint)">
            Only {seat.name} should scan this. It carries their character and nothing else, and
            it never touches a server.
          </p>
          <p className="serif max-w-[34ch] border-t border-(--hairline) pt-3 text-center text-[13px] leading-snug text-(--text-faint)">
            One code for the whole table, where each player picks their own name, needs the
            relay. Deploy the worker in the repository and set <code>RELAY_URL</code>; this app
            switches over on its own.
          </p>

          <div className="flex w-full gap-2">
            <Button
              aria-label="Previous player"
              disabled={index === 0}
              onClick={() => setIndex((i) => i - 1)}
              className="px-4"
            >
              <ChevronLeft size={20} />
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => {
                setHanded((h) => (h.includes(seat.id) ? h : [...h, seat.id]))
                if (index < seats.length - 1) setIndex((i) => i + 1)
              }}
            >
              {handed.includes(seat.id) ? <Check size={18} /> : null}
              {index < seats.length - 1 ? 'Next player' : 'Done'}
              <ChevronRight size={18} />
            </Button>
          </div>

          <div className="w-full">
            <Label>Who has theirs</Label>
            <div className="flex flex-wrap gap-1.5">
              {seats.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setIndex(i)}
                  className={`min-h-9 rounded-full border px-3 text-[12px] font-medium ${
                    handed.includes(s.id)
                      ? 'border-(--accent) bg-(--accent) text-(--bg)'
                      : i === index
                        ? 'border-(--now) text-(--now)'
                        : 'border-(--hairline-strong) text-(--text-faint)'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Sheet>
  )
}

function SharedCode({ open, onClose }: { open: boolean; onClose: () => void }) {
  const game = useStore((s) => s.game)
  const ensureRoom = useStore((s) => s.ensureRoom)
  const { status } = useRoom()
  // One room per game, kept in the game itself: the same code works at dusk
  // on night one and again on day three, and a phone that scans it twice is
  // sent back to the seat it already holds.
  const [room] = useState(() =>
    ensureRoom(() => ({ id: generateRoomId(), key: generateKeyMaterial() })),
  )
  const claimed = Object.keys(game?.claims ?? {})
  const seats = game?.seats ?? []

  if (!game) return null

  const payload: Payload = { kind: 'room', room: room.id, key: room.key, scriptHash: 0 }
  const code = roomCode(room.key)

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Everyone scan this"
      subtitle="Then they tap their own name and confirm it. Each player only ever sees their own character, and a phone that scans again is sent back to its own seat."
    >
      <div className="flex flex-col items-center gap-5 pb-2">
        <QrImage value={payloadUrl(PLAYER_ORIGIN, payload)} />

        <div className="text-center">
          <Label>Or type this at {PLAYER_ORIGIN.replace(/^https?:\/\//, '')}</Label>
          <div className="display text-[26px] tracking-[0.3em] text-(--accent)">
            {code}
          </div>
        </div>

        <div className="w-full">
          <Label>
            {claimed.length} of {seats.length} have theirs
            {status !== 'open' && ' · not connected'}
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {seats.map((s) => (
              <span
                key={s.id}
                className={`min-h-8 rounded-full border px-3 text-[12px] font-medium leading-8 ${
                  claimed.includes(s.id)
                    ? 'border-(--accent) bg-(--accent) text-(--bg)'
                    : 'border-(--hairline-strong) text-(--text-faint)'
                }`}
              >
                {s.name}
              </span>
            ))}
          </div>
        </div>

        <p className="max-w-[32ch] text-center text-[13px] leading-snug text-(--text-faint)">
          The key lives in this code and never reaches a server. Each character is sealed to
          the phone that claimed it, so nobody else at the table can read it either.
        </p>
      </div>
    </Sheet>
  )
}

/**
 * Rendered large and at high error correction. A code shown on one phone and
 * scanned by another in a dim room wants to be chunky and forgiving, not dense.
 */
function QrImage({ value }: { value: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    QRCode.toCanvas(canvas, value, {
      errorCorrectionLevel: 'M',
      margin: 2,
      scale: 8,
      color: { dark: '#f4ede0ff', light: '#0b0d12ff' },
    }).catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [value])

  if (error) {
    return <p className="text-[14px] text-(--color-red-2)">That code could not be drawn.</p>
  }

  return (
    <canvas
      ref={ref}
      className="h-auto w-[min(74vw,300px)] rounded-(--radius-surface) border border-(--hairline)"
    />
  )
}
