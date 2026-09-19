import { useMemo, useState } from 'react'
import { getCharacter, placesReminder } from '@botc/rules'
import { Button, ReminderText, Sheet, Label } from '@botc/ui'
import { ChevronLeft, ChevronRight, Eye, QrCode, Sunrise } from 'lucide-react'
import { useStore } from '../state/store.js'
import { CharacterToken } from './CharacterToken.js'
import { DistributeSheet } from './DistributeSheet.js'

/**
 * The guided night walk.
 *
 * Note the register: at night the Storyteller is silent. They tap a shoulder
 * twice and show tokens. So this panel says what to *do* and what to *show* —
 * never a sentence to read aloud. Speech belongs to the day.
 */
export function NightPanel() {
  const game = useStore((s) => s.game)
  const nightOrder = useStore((s) => s.nightOrder)
  const setNightStep = useStore((s) => s.setNightStep)
  const toDay = useStore((s) => s.toDay)
  const addEffect = useStore((s) => s.addEffect)
  const [placing, setPlacing] = useState<{ label: string; characterId: string } | null>(null)
  const [distributing, setDistributing] = useState(false)

  const order = useMemo(() => nightOrder(), [nightOrder, game])
  if (!game || game.phase.k !== 'night') return null

  const step = Math.min(game.phase.step, Math.max(order.length - 1, 0))
  const entry = order[step]
  const isLast = step >= order.length - 1
  const character = entry?.kind === 'character' ? getCharacter(entry.id) : undefined

  return (
    <>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>
            {entry ? `Step ${entry.order} of ${order.length}` : 'Night complete'}
          </Label>
          {entry?.allDead && (
            <span className="text-[11px] text-(--text-faint)">everyone here is dead</span>
          )}
        </div>

        {entry ? (
          <div className="flex gap-3">
            {character && <CharacterToken character={character} size="52px" />}
            <div className="min-w-0 flex-1">
              <div className="display text-[14px] text-(--text)">{entry.name}</div>
              {entry.seats.length > 0 && (
                <div className="mb-1 text-[12px] text-(--text-faint)">
                  {entry.seats
                    .map((s) => {
                      const seat = game.seats.find((x) => x.id === s.seatId)
                      return s.isDisguised
                        ? `${seat?.name} (really the ${getCharacter(s.trueCharacterId ?? '')?.name})`
                        : seat?.name
                    })
                    .join(', ')}
                </div>
              )}
              <ReminderText source={entry.reminder} />
            </div>
          </div>
        ) : (
          <p className="serif text-[16px] text-(--text-dim)">
            Everyone is asleep and every step is done. Wait about ten seconds before you call
            for eyes open, so the last wake cannot be timed.
          </p>
        )}

        {/* Handing out characters belongs at dusk on the first night, which is
            exactly when it happens at a table. Offered here rather than buried
            in a menu, and only when it is the thing you are about to do. */}
        {game.phase.n === 1 && step === 0 && (
          <Button className="mt-3 w-full" onClick={() => setDistributing(true)}>
            <QrCode size={17} />
            Hand out characters
          </Button>
        )}

        {/* Reminder tokens the current step wants placed, one tap each. */}
        {entry && entry.reminderTokens.length > 0 && placesReminder(entry.reminder) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {entry.reminderTokens.map((label) => (
              <button
                key={label}
                onClick={() => setPlacing({ label, characterId: entry.id })}
                className="min-h-9 rounded-full border border-(--color-brass-600) px-3 text-[12px] text-(--color-brass-300)"
              >
                place “{label}”
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Button
            live
            aria-label="Previous step"
            disabled={step === 0}
            onClick={() => setNightStep(step - 1)}
            className="px-4"
          >
            <ChevronLeft size={22} />
          </Button>
          {isLast ? (
            <Button live variant="primary" className="flex-1" onClick={toDay}>
              <Sunrise size={20} />
              Call for eyes open
            </Button>
          ) : (
            <Button
              live
              variant="primary"
              className="flex-1"
              onClick={() => setNightStep(step + 1)}
            >
              Next
              <ChevronRight size={20} />
            </Button>
          )}
        </div>
      </div>

      <DistributeSheet open={distributing} onClose={() => setDistributing(false)} />

      {/* Placing a token is a two-tap flow: pick the token, pick the seat. */}
      <Sheet
        open={placing !== null}
        onOpenChange={(open) => !open && setPlacing(null)}
        title={placing ? `Who is “${placing.label}”?` : ''}
      >
        <div className="grid grid-cols-3 gap-2 pb-2">
          {game.seats.map((seat) => (
            <button
              key={seat.id}
              onClick={() => {
                if (!placing) return
                const kind =
                  placing.label.toLowerCase() === 'poisoned'
                    ? 'poisoned'
                    : placing.label.toLowerCase() === 'drunk'
                      ? 'drunk'
                      : placing.label.toLowerCase() === 'protected'
                        ? 'protected'
                        : 'custom'
                addEffect(seat.id, {
                  kind,
                  label: placing.label,
                  sourceCharacterId: placing.characterId,
                  // Poison from a night ability lasts into the next day, so it
                  // expires at the following dusk rather than immediately.
                  expiry: kind === 'poisoned' ? { kind: 'dusk' } : { kind: 'permanent' },
                })
                setPlacing(null)
              }}
              className="flex min-h-(--tap-min) flex-col items-center gap-1 rounded-(--radius-surface) border border-(--hairline) p-2"
            >
              <span className="truncate text-[13px]">{seat.name}</span>
              <span className="text-[10px] text-(--text-faint)">
                {getCharacter(seat.characterId ?? '')?.name ?? '—'}
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  )
}

export { Eye }
