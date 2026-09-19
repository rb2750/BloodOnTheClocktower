import { useState } from 'react'
import { getCharacter, teamAlignment, type Character } from '@botc/rules'
import { Button, Chip, Label, Sheet, Plus, Shroud, Trash, Close } from '@botc/ui'
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
          <Label>Everyone at the table</Label>
          <span className="text-[12px] text-(--text-faint)">{phase}</span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            const name = draft.trim()
            if (!name) return
            ensureNote(name)
            setDraft('')
          }}
          className="mb-4 flex gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a name"
            autoComplete="off"
            className="min-h-(--tap-min) flex-1 rounded-(--radius-surface) border border-(--hairline) bg-(--bg) px-4 text-[16px] text-(--text) outline-none placeholder:text-(--text-faint) focus:border-(--hairline-strong)"
          />
          <Button type="submit" aria-label="Add" disabled={!draft.trim()}>
            <Plus size={20} />
          </Button>
        </form>

        {names.length === 0 ? (
          <p className="px-4 py-10 text-center text-[14px] leading-snug text-(--text-faint)">
            Add the people around you and you can record what they claim with a single tap.
          </p>
        ) : (
          <ul className="space-y-1">
            {names.map((name) => {
              const note = notes[name]!
              const claim = note.claims.at(-1)
              const claimed = claim ? getCharacter(claim.characterId) : undefined
              return (
                <li key={name}>
                  <button
                    onClick={() => setOpen(name)}
                    className="flex min-h-(--tap-min) w-full items-center gap-3 rounded-(--radius-surface) border border-(--hairline) px-3 py-2 text-left"
                  >
                    <CharacterToken character={claimed} size="38px" muted />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-[15px] ${
                          note.diedOnDay ? 'text-(--text-faint) line-through' : 'text-(--text)'
                        }`}
                      >
                        {name}
                      </span>
                      <span className="block truncate text-[13px] text-(--text-faint)">
                        {claimed ? `claims ${claimed.name}` : 'no claim yet'}
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
      </section>

      <NoteSheet name={open} onClose={() => setOpen(null)} />
    </>
  )
}

function NoteSheet({ name, onClose }: { name: string | null; onClose: () => void }) {
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
  const [picking, setPicking] = useState(false)

  const note = name ? notes[name] : undefined
  if (!name || !note) return null

  const characters = scriptIds
    .map((id) => getCharacter(id))
    .filter((c): c is Character => Boolean(c))

  return (
    <>
      <Sheet
        open={!picking}
        onOpenChange={(o) => !o && onClose()}
        title={note.name}
        subtitle={note.diedOnDay ? `Died on day ${note.diedOnDay}` : phase}
      >
        <div className="space-y-6 pb-2">
          <div>
            <Label>Claims</Label>
            <Button className="w-full" onClick={() => setPicking(true)}>
              {note.claims.length === 0 ? 'Record a claim' : 'Record a different claim'}
            </Button>
            {note.claims.length > 0 && (
              <ol className="mt-3 space-y-1">
                {note.claims.map((c, i) => (
                  <li
                    key={`${c.characterId}-${i}`}
                    className="flex items-center gap-2 text-[14px]"
                  >
                    <span className="text-(--text-faint)">{c.at}</span>
                    <span className="text-(--text)">{getCharacter(c.characterId)?.name}</span>
                    {i < note.claims.length - 1 && (
                      <span className="text-[11px] text-(--accent)">then changed</span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div>
            <Label>Quick marks</Label>
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
            <Label>Notes</Label>
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
                className="min-h-(--tap-min) flex-1 rounded-(--radius-surface) border border-(--hairline) bg-(--bg) px-4 text-[16px] text-(--text) outline-none placeholder:text-(--text-faint) focus:border-(--hairline-strong)"
              />
              <Button type="submit" aria-label="Save note" disabled={!line.trim()}>
                <Plus size={20} />
              </Button>
            </form>

            {note.lines.length > 0 && (
              <ul className="mt-3 space-y-1">
                {note.lines.map((l) => (
                  <li key={l.id} className="flex items-start gap-2">
                    <span className="mt-[3px] shrink-0 text-[11px] uppercase tracking-wider text-(--text-faint)">
                      {l.at}
                    </span>
                    <span className="flex-1 text-[14px] leading-snug text-(--text-dim)">
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

      <Sheet
        open={picking}
        onOpenChange={(o) => !o && setPicking(false)}
        title={`What does ${note.name} claim?`}
        subtitle="Only the characters on this script."
      >
        <div className="grid grid-cols-4 gap-3 pb-2 sm:grid-cols-5">
          {characters.map((c) => (
            <button
              key={c.id}
              className="flex flex-col items-center gap-1"
              onClick={() => {
                addClaim(note.name, c.id)
                setPicking(false)
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
