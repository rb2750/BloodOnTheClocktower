import { useState } from 'react'
import { getCharacter, scriptCharacters, teamAlignment } from '@botc/rules'
import { AbilityText, Button, Label, Sheet, Shroud, Heart, Ghost, Swap, Mask, Signpost, inputClass } from '@botc/ui'
import { toast } from 'sonner'
import { useStore } from '../state/store.js'
import { CharacterToken } from './CharacterToken.js'
import { HoldToConfirm } from './HoldToConfirm.js'
import { ReminderChip, ReminderOption } from './ReminderChip.js'
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

  const [picking, setPicking] = useState<'perceived' | 'true' | null>(null)

  const seat = game?.seats.find((s) => s.id === seatId)
  if (!game || !seat) return null

  const character = getCharacter(seat.characterId ?? '')
  const trueCharacter = getCharacter(seat.trueCharacterId ?? '')
  const shown = trueCharacter ?? character
  const alignment = seat.alignmentOverride ?? (shown ? teamAlignment(shown.team) : undefined)
  const timeline = game.log.filter((l) => l.seatIds.includes(seat.id))

  const roleLine = shown
    ? `${shown.name} · ${TEAM_LABEL[shown.team] ?? shown.team}${
        trueCharacter ? ` · believes ${character?.name}` : ''
      }`
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
        <div className="mt-5 grid grid-cols-4 gap-1 border-y border-(--hairline) py-2">
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
          {seat.alive ? (
            <Action icon={<Swap size={22} />} label="Character" onClick={() => setPicking('perceived')} />
          ) : (
            <Action
              icon={<Ghost size={22} />}
              label={seat.deadVoteAvailable ? 'Ghost vote' : 'Vote spent'}
              dim={!seat.deadVoteAvailable}
              onClick={() => toggleDeadVote(seat.id)}
            />
          )}
          <Action
            icon={<Mask size={22} />}
            label={trueCharacter ? 'Disguised' : 'Disguise'}
            active={Boolean(trueCharacter)}
            onClick={() => setPicking('true')}
          />
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

      <Sheet
        open={picking !== null}
        onOpenChange={(o) => !o && setPicking(null)}
        title={picking === 'true' ? 'What are they really?' : 'Which character?'}
        subtitle={
          picking === 'true'
            ? 'For the Drunk, the Marionette or the Lunatic. They keep waking in the slot of the character they believe they are.'
            : undefined
        }
      >
        {picking === 'true' && seat.trueCharacterId && (
          <Button
            className="mb-4 w-full"
            onClick={() => {
              setSeatTrueCharacter(seat.id, undefined)
              setPicking(null)
            }}
          >
            They really are the {character?.name}
          </Button>
        )}
        <div className="grid grid-cols-4 gap-3 pb-2 sm:grid-cols-5">
          {scriptCharacters(game.script).map((c) => (
            <button
              key={c.id}
              className="flex flex-col items-center gap-1.5"
              onClick={() => {
                if (picking === 'true') setSeatTrueCharacter(seat.id, c.id)
                else setSeatCharacter(seat.id, c.id)
                setPicking(null)
              }}
            >
              <CharacterToken
                character={c}
                size="52px"
                alignment={teamAlignment(c.team) === 'evil' ? 'evil' : 'good'}
              />
              <span className="caps text-center text-[9px] leading-tight text-(--text-faint)">
                {c.name}
              </span>
            </button>
          ))}
        </div>
      </Sheet>
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
      onClick={onClick}
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
