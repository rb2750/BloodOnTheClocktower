import { useState } from 'react'
import { getCharacter, teamAlignment, type Character } from '@botc/rules'
import { Button, Chip, Label, Sheet, Token, inputClass, Plus, Shroud, Trash, Close } from '@botc/ui'
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

export function NotesScreen() {
  const notes = useStore((s) => s.notes)
  const ensureNote = useStore((s) => s.ensureNote)
  const phase = useStore((s) => s.phase)
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  const names = Object.keys(notes)

  return (
    <>
      <section className="px-5 pb-8 pt-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h1 className="display text-[26px] leading-none text-(--text)">Your notes</h1>
          <span className="caps text-(--text-faint)">{phase}</span>
        </div>


        <p className="serif mb-4 text-[14px] leading-snug text-(--text-faint)">
          Tap anyone to record what they claim, and what you make of it.
        </p>

        {names.length === 0 ? (
          <p className="serif px-4 py-10 text-center text-[15px] leading-snug text-(--text-faint)">
            Add the people around you and you can record what they claim with a single tap.
          </p>
        ) : (
          <ul className="m-0 list-none border-t border-(--hairline) p-0">
            {names.map((name) => {
              const note = notes[name]!
              const claim = note.claims.at(-1)
              const claimed = claim ? getCharacter(claim.characterId) : undefined
              return (
                <li key={name}>
                  <button
                    onClick={() => setOpen(name)}
                    className="flex min-h-(--tap-min) w-full items-center gap-3 border-b border-(--hairline) py-2 text-left active:bg-(--surface-raised)"
                  >
                    <Token name={name} size="38px" />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-[15px] ${
                          note.diedOnDay ? 'text-(--text-faint) line-through' : 'text-(--text)'
                        }`}
                      >
                        {name}
                      </span>
                      <span className="block truncate text-[13px] text-(--text-faint)">
                        {claimed ? `says ${claimed.name}` : 'has not said yet'}
                        {note.stamps.length > 0 && ` · ${note.stamps.join(', ')}`}
                      </span>
                    </span>
                    {note.lines.length > 0 && (
                      <span className="tabular text-[11px] text-(--text-faint)">
                        {note.lines.length}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <div className="mt-6">
          <Label>Someone missing?</Label>
        <form
            onSubmit={(e) => {
              e.preventDefault()
              const name = draft.trim()
              if (!name) return
              ensureNote(name)
              setDraft('')
            }}
            className="flex gap-2"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a name"
              autoComplete="off"
              className={`${inputClass} flex-1`}
            />
            <Button type="submit" aria-label="Add" disabled={!draft.trim()}>
              <Plus size={20} />
            </Button>
          </form>
        </div>
      </section>

      <NoteSheet name={open} onClose={() => setOpen(null)} />
    </>
  )
}

export function NoteSheet({ name, onClose }: { name: string | null; onClose: () => void }) {
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
          <div>
            <Label>Who do they say they are?</Label>
            <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5">
              {characters.map((c) => {
                const current = note.claims.at(-1)?.characterId === c.id
                return (
                  <button
                    key={c.id}
                    onClick={() => addClaim(note.name, c.id)}
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
                  onClick={() => toggleStamp(note.name, stamp)}
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
