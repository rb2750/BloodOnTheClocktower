import { useState } from 'react'
import { getCharacter, teamAlignment, type Character } from '@botc/rules'
import { Button, Chip, Label, Sheet, Token, inputClass, Plus, Shroud, Trash, Close, ChevronRight, haptic } from '@botc/ui'
import { useStore } from '../state.js'
import { CharacterToken } from '../components/CharacterToken.js'

/**
 * Observations worth one tap.
 *
 * Chips must toggle off as well as on: the documented failure of chip
 * interfaces is a user who mis-taps and cannot take it back.
 */
const STAMPS = [
  'Confirmed',
  'Suspect',
  'Evil?',
  'Lied',
  'Droisoned?',
  'Voted with me',
  'Registered odd',
]

export type SheetProps = {
  name: string | null
  onClose: () => void
  /** Present when this person can be messaged: their phone is in the room. */
  onMessage?: () => void
  unread?: number
  last?: string
}

export function NoteSheet({ name, onClose, onMessage, unread = 0, last }: SheetProps) {
  const notes = useStore((s) => s.notes)
  const scriptIds = useStore((s) => s.scriptIds)
  const phase = useStore((s) => s.phase)
  const day = useStore((s) => s.day)
  const addClaim = useStore((s) => s.addClaim)
  const toggleStamp = useStore((s) => s.toggleStamp)
  const addLine = useStore((s) => s.addLine)
  const removeLine = useStore((s) => s.removeLine)
  const setDied = useStore((s) => s.setDied)

  const [line, setLine] = useState('')

  const note = name ? notes[name] : undefined
  if (!name || !note) return null

  const characters = scriptIds
    .map((id) => getCharacter(id))
    .filter((c): c is Character => Boolean(c))

  return (
    <>
      <Sheet
        open
        onOpenChange={(o) => !o && onClose()}
        title={note.name}
        subtitle={note.diedOnDay ? `Died on day ${note.diedOnDay}` : phase}
      >
        <div className="space-y-6 pb-2">
          {onMessage && (
            <button
              onClick={onMessage}
              className="-mt-2 flex w-full items-center gap-3 border-b border-(--hairline) py-4 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="display block text-[19px] leading-tight text-(--text)">Message {note.name}</span>
                <span className="serif block truncate text-[13px] text-(--text-faint)">
                  {last ?? 'Only the two of you can read it'}
                </span>
              </span>
              {unread > 0 && (
                <span className="grid min-w-5 place-items-center rounded-full bg-(--accent) px-1 text-[11px] font-semibold leading-5 text-(--bg)">
                  {unread}
                </span>
              )}
              <ChevronRight size={18} className="shrink-0 text-(--text-faint)" />
            </button>
          )}
          <div>
            <Label>Who do they say they are?</Label>
            <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5">
              {characters.map((c) => {
                const current = note.claims.at(-1)?.characterId === c.id
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      haptic('tap')
                      addClaim(note.name, c.id)
                    }}
                    aria-pressed={current}
                    className={`flex flex-col items-center gap-1 rounded-xl py-1.5 ${
                      current ? 'bg-(--surface-raised)' : ''
                    }`}
                  >
                    <CharacterToken
                      character={c}
                      size="46px"
                      alignment={teamAlignment(c.team) === 'evil' ? 'evil' : 'good'}
                      muted={!current}
                    />
                    <span
                      className={`text-center text-[10px] leading-tight ${
                        current ? 'text-(--text)' : 'text-(--text-faint)'
                      }`}
                    >
                      {c.name}
                    </span>
                  </button>
                )
              })}
            </div>
            {note.claims.length > 1 && (
              <p className="serif mt-3 text-[13px] leading-snug text-(--text-faint)">
                Said before:{' '}
                {note.claims
                  .slice(0, -1)
                  .map((c) => `${getCharacter(c.characterId)?.name} in ${c.at}`)
                  .join(', ')}
              </p>
            )}
          </div>

          <div>
            <Label>What do you make of them?</Label>
            <div className="flex flex-wrap gap-2">
              {STAMPS.map((stamp) => (
                <Chip
                  key={stamp}
                  active={note.stamps.includes(stamp)}
                  onClick={() => {
                    haptic('tap')
                    toggleStamp(note.name, stamp)
                  }}
                >
                  {stamp}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <Label>Anything they said</Label>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                addLine(note.name, line)
                setLine('')
              }}
              className="flex gap-2"
            >
              <input
                value={line}
                onChange={(e) => setLine(e.target.value)}
                placeholder={`What did ${note.name} say?`}
                className={`${inputClass} flex-1`}
              />
              <Button type="submit" aria-label="Save note" disabled={!line.trim()}>
                <Plus size={20} />
              </Button>
            </form>

            {note.lines.length > 0 && (
              <ul className="mt-3 space-y-1">
                {note.lines.map((l) => (
                  <li key={l.id} className="flex items-start gap-2">
                    <span className="caps mt-[3px] shrink-0 text-[10px] text-(--text-faint)">
                      {l.at}
                    </span>
                    <span className="serif flex-1 text-[15px] leading-snug text-(--text-dim)">
                      {l.text}
                    </span>
                    <button
                      onClick={() => removeLine(note.name, l.id)}
                      aria-label="Delete note"
                      className="grid size-8 shrink-0 place-items-center text-(--text-faint)"
                    >
                      <Trash size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Death is set on whichever day it happened, not just "now", so a
              timeline reconstructed after the fact stays correct. */}
          <div>
            <Label>Alive?</Label>
            {note.diedOnDay ? (
              <Button className="w-full" onClick={() => setDied(note.name, undefined)}>
                <Close size={17} />
                They are alive after all
              </Button>
            ) : (
              <Button variant="danger" className="w-full" onClick={() => setDied(note.name, day)}>
                <Shroud size={17} />
                Died on day {day}
              </Button>
            )}
          </div>
        </div>
      </Sheet>

    </>
  )
}
