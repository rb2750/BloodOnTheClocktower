import { useEffect, useState } from 'react'
import { getCharacter, teamAlignment } from '@botc/rules'
import { AbilityText, Button, Label, Sheet, Shroud, Heart, Ghost, Swap, Signpost, Bell, haptic, inputClass } from '@botc/ui'
import { toast } from 'sonner'
import { useStore } from '../state/store.js'
import { CharacterToken } from './CharacterToken.js'
import { HoldToConfirm } from './HoldToConfirm.js'
import { ReminderChip, ReminderOption } from './ReminderChip.js'
import { CharacterPicker } from './CharacterPicker.js'
import { WhisperSheet } from './WhisperSheet.js'
import { useRoom } from '../room.js'
import type { EffectKind } from '../state/types.js'

/** Effects a Storyteller reaches for constantly, each with the right expiry. */
const QUICK_EFFECTS: { kind: EffectKind; label: string; expiry: 'dusk' | 'permanent' }[] = [
  { kind: 'poisoned', label: 'Poisoned', expiry: 'dusk' },
  { kind: 'drunk', label: 'Drunk', expiry: 'permanent' },
  { kind: 'protected', label: 'Protected', expiry: 'dusk' },
  { kind: 'red-herring', label: 'Red herring', expiry: 'permanent' },
  { kind: 'mad', label: 'Mad', expiry: 'permanent' },
]

const TEAM_LABEL: Record<string, string> = {
  townsfolk: 'Townsfolk',
  outsider: 'Outsider',
  minion: 'Minion',
  demon: 'Demon',
  traveller: 'Traveller',
  fabled: 'Fabled',
  loric: 'Loric',
}

export function SeatSheet({ seatId, onClose }: { seatId: string | null; onClose: () => void }) {
  const game = useStore((s) => s.game)
  const toggleAlive = useStore((s) => s.toggleAlive)
  const toggleDeadVote = useStore((s) => s.toggleDeadVote)
  const addEffect = useStore((s) => s.addEffect)
  const removeEffect = useStore((s) => s.removeEffect)
  const setSeatCharacter = useStore((s) => s.setSeatCharacter)
  const setSeatTrueCharacter = useStore((s) => s.setSeatTrueCharacter)
  const setSeatNotes = useStore((s) => s.setSeatNotes)
  const setSeatTraveller = useStore((s) => s.setSeatTraveller)
  const removeSeat = useStore((s) => s.removeSeat)
  const undo = useStore((s) => s.undo)

  const [picking, setPicking] = useState<'perceived' | 'believed' | null>(null)
  const [telling, setTelling] = useState(false)
  const { reachable, nudge } = useRoom()

  // A seat that still says "drunk" is owed a choice, and the sheet opens on it.
  const owed = game?.seats.find((s) => s.id === seatId)?.characterId === 'drunk'
  useEffect(() => {
    if (owed) setPicking('believed')
  }, [owed, seatId])

  const seat = game?.seats.find((s) => s.id === seatId)
  if (!game || !seat) return null

  const character = getCharacter(seat.characterId ?? '')
  const drunk = seat.trueCharacterId === 'drunk'
  const shown = character
  const alignment = seat.alignmentOverride ?? (shown ? teamAlignment(shown.team) : undefined)
  const timeline = game.log.filter((l) => l.seatIds.includes(seat.id))

  const roleLine = shown
    ? `${shown.name} · ${TEAM_LABEL[shown.team] ?? shown.team}${drunk ? ' · drunk' : ''}`
    : 'No character yet'

  return (
    <>
      <Sheet open={seatId !== null && picking === null} onOpenChange={(o) => !o && onClose()}>
        <div className="flex items-center gap-4">
          <button onClick={() => setPicking('perceived')} className="shrink-0" aria-label="Change character">
            <CharacterToken
              character={shown}
              size="60px"
              dead={!seat.alive}
              alignment={seat.alignmentOverride}
            />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="display text-[26px] leading-none">{seat.name}</h2>
            <div
              className={`caps mt-1.5 ${
                alignment === 'evil'
                  ? 'text-(--color-red-2)'
                  : alignment === 'good'
                    ? 'text-(--color-blue-2)'
                    : 'text-(--text-faint)'
              }`}
            >
              {roleLine}
            </div>
          {drunk && (
            <button
              onClick={() => setSeatTrueCharacter(seat.id, undefined)}
              className="caps mt-1 min-h-8 text-[10px] text-(--text-faint)"
            >
              Not drunk after all
            </button>
          )}
          </div>
        </div>

        <div className="mt-4">
          {shown ? (
            <AbilityText>{shown.ability}</AbilityText>
          ) : (
            <p className="serif text-[15px] text-(--text-faint)">Tap the token to assign one.</p>
          )}
        </div>

        {/* Frequent, reversible actions: instant, with an undo toast. No dialog
            every time, which in a dim room would be torture. */}
        <div className="mt-5 grid grid-cols-5 gap-1 border-y border-(--hairline) py-2">
          <Action
            icon={seat.alive ? <Shroud size={22} /> : <Heart size={22} />}
            label={seat.alive ? 'Kill' : 'Revive'}
            onClick={() => {
              toggleAlive(seat.id)
              toast(seat.alive ? `${seat.name} died.` : `${seat.name} lives.`, {
                action: { label: 'Undo', onClick: () => undo() },
              })
            }}
          />
          {/* A character can change at any point in the game, alive or dead:
              picking Drunk asks what they believe; picking anything else makes
              them simply that, drunk no longer. */}
          <Action icon={<Swap size={22} />} label="Character" onClick={() => setPicking('perceived')} />
          <Action
            icon={<Bell size={22} />}
            label="Nudge"
            dim={!reachable.includes(seat.id)}
            onClick={() => {
              nudge(seat.id)
              toast(`${seat.name}'s phone buzzed.`)
            }}
          />
          {!seat.alive && (
            <Action
              icon={<Ghost size={22} />}
              label={seat.deadVoteAvailable ? 'Ghost vote' : 'Vote spent'}
              dim={!seat.deadVoteAvailable}
              onClick={() => toggleDeadVote(seat.id)}
            />
          )}
          <Action
            icon={<Signpost size={22} />}
            label="Traveller"
            active={seat.isTraveller}
            onClick={() => {
              setSeatTraveller(seat.id, !seat.isTraveller)
              toast(
                seat.isTraveller
                  ? `${seat.name} is a regular player again.`
                  : `${seat.name} is a Traveller.`,
              )
            }}
          />
        </div>

        <div className="mt-5">
          <Label>Privately</Label>
          <Button className="w-full" onClick={() => setTelling(true)}>
            <Signpost size={17} />
            {reachable.includes(seat.id)
              ? `Tell ${seat.name} something`
              : `Tell ${seat.name} something · phone not joined`}
          </Button>
        </div>

        <div className="mt-5">
          <Label>Reminders</Label>
          <div className="flex flex-wrap gap-2">
            {seat.effects.map((e) => (
              <ReminderChip
                key={e.id}
                effect={e}
                onRemove={() => {
                  removeEffect(seat.id, e.id)
                  toast('Reminder removed.', {
                    action: { label: 'Undo', onClick: () => undo() },
                  })
                }}
              />
            ))}
            {QUICK_EFFECTS.filter((q) => !seat.effects.some((e) => e.kind === q.kind)).map((e) => (
              <ReminderOption
                key={e.kind}
                kind={e.kind}
                label={e.label}
                onClick={() =>
                  addEffect(seat.id, {
                    kind: e.kind,
                    label: e.label,
                    expiry: e.expiry === 'dusk' ? { kind: 'dusk' } : { kind: 'permanent' },
                  })
                }
              />
            ))}
          </div>
        </div>

        <div className="mt-6">
          <Label>Your notes on {seat.name}</Label>
          <textarea
            value={seat.notes}
            onChange={(e) => setSeatNotes(seat.id, e.target.value)}
            rows={2}
            placeholder="What you told them, what they claimed…"
            className={`${inputClass} serif resize-none p-3 text-[15px]`}
          />
        </div>

        {timeline.length > 0 && (
          <div className="mt-6">
            <Label>Their game so far</Label>
            <ol className="space-y-2 border-l border-(--hairline) pl-4">
              {timeline.map((l) => (
                <li key={l.id}>
                  <div className="caps text-[10px] text-(--text-faint)">{l.phase}</div>
                  <div className="text-[14px] text-(--text-dim)">{l.text}</div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Removing someone is rare and not undone by a tap, so it needs a
            deliberate hold rather than a dialog that would be one more thing
            to dismiss in the dark. */}
        <div className="mt-6">
          <HoldToConfirm
            label="Hold to remove from the game"
            onConfirm={() => {
              removeSeat(seat.id)
              onClose()
              toast(`${seat.name} left the game.`, {
                action: { label: 'Undo', onClick: () => undo() },
              })
            }}
          />
        </div>
      </Sheet>

      <WhisperSheet seatId={telling ? seat.id : null} onClose={() => setTelling(false)} />

      <CharacterPicker
        open={picking !== null}
        onClose={() => setPicking(null)}
        script={game.script}
        title={picking === 'believed' ? 'The Drunk believes they are the…' : `${seat.name} is the…`}
        teams={picking === 'believed' ? ['townsfolk'] : undefined}
        current={seat.characterId}
        taken={game.seats
          .filter((s) => s.id !== seat.id)
          .flatMap((s) => [s.characterId, s.trueCharacterId])
          .filter((id): id is string => Boolean(id))}
        onPick={(c) => {
          if (picking === 'believed') {
            // Chosen from the banner, the seat has not yet been marked as
            // really the Drunk; chosen after picking Drunk, it already has.
            setSeatCharacter(seat.id, c.id)
            if (seat.trueCharacterId !== 'drunk') setSeatTrueCharacter(seat.id, 'drunk')
          } else if (picking === 'perceived' && c.id === 'drunk') {
            // Making someone the Drunk is two choices, and the second is not
            // optional: what they believe they are.
            setSeatTrueCharacter(seat.id, 'drunk')
            setPicking('believed')
            return
          } else setSeatCharacter(seat.id, c.id)
          setPicking(null)
        }}
      >
      </CharacterPicker>
    </>
  )
}

function Action({
  icon,
  label,
  onClick,
  active = false,
  dim = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  active?: boolean
  dim?: boolean
}) {
  return (
    <button
      onClick={() => {
        // Every action on a seat answers the thumb, since most of them change
        // something the Storyteller cannot see from the button itself.
        haptic('tap')
        onClick()
      }}
      className={`flex min-h-(--tap-min) flex-col items-center justify-center gap-1.5 rounded-(--radius-surface) py-1 active:bg-(--surface-raised) ${
        dim ? 'opacity-45' : ''
      }`}
    >
      <span className={active ? 'text-(--now)' : 'text-(--text)'}>{icon}</span>
      <span className={`caps text-[9.5px] ${active ? 'text-(--now)' : 'text-(--text-dim)'}`}>
        {label}
      </span>
    </button>
  )
}
