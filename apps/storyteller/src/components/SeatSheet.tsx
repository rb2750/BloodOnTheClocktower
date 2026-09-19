import { useState } from 'react'
import { getCharacter, scriptCharacters, teamAlignment } from '@botc/rules'
import { AbilityText, Button, Chip, Label, Sheet } from '@botc/ui'
import { Skull, Heart, Vote, UserPen, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '../state/store.js'
import { CharacterToken } from './CharacterToken.js'
import type { EffectKind } from '../state/types.js'

/** Effects a Storyteller reaches for constantly, each with the right expiry. */
const QUICK_EFFECTS: { kind: EffectKind; label: string; expiry: 'dusk' | 'permanent' }[] = [
  { kind: 'poisoned', label: 'Poisoned', expiry: 'dusk' },
  { kind: 'drunk', label: 'Drunk', expiry: 'permanent' },
  { kind: 'protected', label: 'Protected', expiry: 'dusk' },
  { kind: 'red-herring', label: 'Red herring', expiry: 'permanent' },
  { kind: 'mad', label: 'Mad', expiry: 'permanent' },
]

export function SeatSheet({ seatId, onClose }: { seatId: string | null; onClose: () => void }) {
  const game = useStore((s) => s.game)
  const toggleAlive = useStore((s) => s.toggleAlive)
  const toggleDeadVote = useStore((s) => s.toggleDeadVote)
  const addEffect = useStore((s) => s.addEffect)
  const removeEffect = useStore((s) => s.removeEffect)
  const setSeatCharacter = useStore((s) => s.setSeatCharacter)
  const setSeatTrueCharacter = useStore((s) => s.setSeatTrueCharacter)
  const setSeatNotes = useStore((s) => s.setSeatNotes)
  const undo = useStore((s) => s.undo)

  const [picking, setPicking] = useState<'perceived' | 'true' | null>(null)

  const seat = game?.seats.find((s) => s.id === seatId)
  if (!game || !seat) return null

  const character = getCharacter(seat.characterId ?? '')
  const trueCharacter = getCharacter(seat.trueCharacterId ?? '')
  const timeline = game.log.filter((l) => l.seatIds.includes(seat.id))

  return (
    <>
      <Sheet
        open={seatId !== null && picking === null}
        onOpenChange={(o) => !o && onClose()}
        title={seat.name}
        subtitle={
          trueCharacter
            ? `Believes they are the ${character?.name}. Really the ${trueCharacter.name}.`
            : (character?.name ?? 'No character yet')
        }
      >
        <div className="flex items-start gap-4">
          <button onClick={() => setPicking('perceived')} className="shrink-0">
            <CharacterToken
              character={trueCharacter ?? character}
              size="72px"
              dead={!seat.alive}
              alignment={seat.alignmentOverride}
            />
          </button>
          <div className="min-w-0 flex-1">
            {character ? (
              <AbilityText>{(trueCharacter ?? character).ability}</AbilityText>
            ) : (
              <p className="text-[14px] text-(--text-faint)">Tap the token to assign one.</p>
            )}
          </div>
        </div>

        {/* Frequent, reversible actions: instant, with an undo toast. No dialog
            every time, which in a dim room would be torture. */}
        <div className="mt-5 flex gap-2">
          <Button
            className="flex-1"
            onClick={() => {
              toggleAlive(seat.id)
              toast(seat.alive ? `${seat.name} died.` : `${seat.name} lives.`, {
                action: { label: 'Undo', onClick: () => undo() },
              })
            }}
          >
            {seat.alive ? <Skull size={18} /> : <Heart size={18} />}
            {seat.alive ? 'Kill' : 'Revive'}
          </Button>
          {!seat.alive && (
            <Button className="flex-1" onClick={() => toggleDeadVote(seat.id)}>
              <Vote size={18} />
              {seat.deadVoteAvailable ? 'Ghost vote unused' : 'Ghost vote spent'}
            </Button>
          )}
        </div>

        <div className="mt-6">
          <Label>Reminders</Label>
          <div className="flex flex-wrap gap-2">
            {QUICK_EFFECTS.map((e) => (
              <Chip
                key={e.kind}
                kind={e.kind}
                onClick={() =>
                  addEffect(seat.id, {
                    kind: e.kind,
                    label: e.label,
                    expiry: e.expiry === 'dusk' ? { kind: 'dusk' } : { kind: 'permanent' },
                  })
                }
              >
                + {e.label}
              </Chip>
            ))}
          </div>

          {seat.effects.length > 0 && (
            <ul className="mt-3 space-y-1">
              {seat.effects.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-2 rounded-(--radius-surface) border border-(--hairline) px-3 py-2"
                >
                  <span className="flex-1 text-[14px]">{e.label}</span>
                  <span className="text-[11px] text-(--text-faint)">
                    {e.expiry.kind === 'dusk'
                      ? 'until dusk'
                      : e.expiry.kind === 'permanent'
                        ? 'lasting'
                        : `until ${e.expiry.kind} ${'night' in e.expiry ? e.expiry.night : ''}`}
                    {' · '}
                    {e.createdOn}
                  </span>
                  <button
                    onClick={() => {
                      removeEffect(seat.id, e.id)
                      toast('Reminder removed.', {
                        action: { label: 'Undo', onClick: () => undo() },
                      })
                    }}
                    aria-label={`Remove ${e.label}`}
                    className="grid size-9 place-items-center text-(--text-faint)"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6">
          <Label>Your notes on {seat.name}</Label>
          <textarea
            value={seat.notes}
            onChange={(e) => setSeatNotes(seat.id, e.target.value)}
            rows={2}
            placeholder="What you told them, what they claimed…"
            className="w-full resize-none rounded-(--radius-surface) border border-(--hairline) bg-(--bg) p-3 text-[15px] outline-none placeholder:text-(--text-faint) focus:border-(--color-brass-600)"
          />
        </div>

        <div className="mt-6 flex gap-2">
          <Button className="flex-1" onClick={() => setPicking('perceived')}>
            <UserPen size={17} />
            Change character
          </Button>
          <Button className="flex-1" onClick={() => setPicking('true')}>
            {trueCharacter ? 'Change what they really are' : 'They are not what they think'}
          </Button>
        </div>

        {timeline.length > 0 && (
          <div className="mt-6">
            <Label>Their game so far</Label>
            <ol className="space-y-2 border-l border-(--hairline) pl-4">
              {timeline.map((l) => (
                <li key={l.id}>
                  <div className="text-[11px] uppercase tracking-wider text-(--text-faint)">
                    {l.phase}
                  </div>
                  <div className="text-[14px] text-(--text-dim)">{l.text}</div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Sheet>

      <Sheet
        open={picking !== null}
        onOpenChange={(o) => !o && setPicking(null)}
        title={picking === 'true' ? 'What are they really?' : 'Which character?'}
        subtitle={
          picking === 'true'
            ? 'Use this for the Drunk, the Marionette or the Lunatic. They keep waking in the slot of the character they believe they are.'
            : undefined
        }
      >
        {picking === 'true' && seat.trueCharacterId && (
          <Button
            className="mb-3 w-full"
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
              className="flex flex-col items-center gap-1"
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
              <span className="text-center text-[10px] leading-tight text-(--text-faint)">
                {c.name}
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  )
}
