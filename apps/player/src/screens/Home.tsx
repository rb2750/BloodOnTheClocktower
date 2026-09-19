import { useState } from 'react'
import { getCharacter } from '@botc/rules'
import { ChevronRight, Plus, Token, Button, inputClass } from '@botc/ui'
import { useStore } from '../state.js'
import { MeScreen } from './Me.js'
import { HoldToReveal } from '../components/HoldToReveal.js'
import { NoteSheet } from './Notes.js'
import { SheetOne, SheetShort, SheetTeams, SheetCombined } from './NoteSheets.js'

// Preview only: ?sheet=1|2|3 to compare the three note sheets.
const SHEET = new URLSearchParams(window.location.search).get('sheet') ?? ''
const Note =
  SHEET === '1'
    ? SheetOne
    : SHEET === '2'
      ? SheetShort
      : SHEET === '3'
        ? SheetTeams
        : SHEET === '4'
          ? SheetCombined
          : NoteSheet

/** Everyone at the table, in seat order, from the list the Storyteller sent. */
function useTable() {
  const notes = useStore((s) => s.notes)
  return Object.keys(notes)
}

function claimOf(name: string, notes: ReturnType<typeof useStore.getState>['notes']) {
  const claim = notes[name]?.claims.at(-1)
  return claim ? getCharacter(claim.characterId) : undefined
}

/** The table as it actually sits: a ring, in seat order, like the grimoire. */
export function HomeScreen({ openRoles }: { openRoles: () => void }) {
  const payload = useStore((s) => s.payload)
  const characterId = useStore((s) => s.characterId)
  const seatName = useStore((s) => s.seatName)
  const scriptIds = useStore((s) => s.scriptIds)
  const notes = useStore((s) => s.notes)
  const table = useTable()
  const [open, setOpen] = useState<string | null>(null)

  return (
    <>
      <Seat name={seatName} />
      <MeScreen />
      <Whispers />

      {payload && (characterId || seatName) && (
        <div className="mt-6 mb-10">
          <div className="relative mx-auto aspect-square w-[min(86vw,340px)]">
            {table.map((name, i) => {
              // Seat one sits at the bottom, where the player is, so the ring
              // matches the room rather than a clock face.
              const angle = (i / table.length) * 2 * Math.PI + Math.PI / 2
              return (
                <button
                  key={name}
                  onClick={() => setOpen(name)}
                  className="absolute flex w-[68px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
                  style={{
                    left: `${50 + 40 * Math.cos(angle)}%`,
                    top: `${50 + 40 * Math.sin(angle)}%`,
                  }}
                >
                  <Person name={name} claim={claimOf(name, notes)} size="52px" />
                </button>
              )
            })}
            <div className="absolute inset-[26%] flex flex-col items-center justify-center gap-1 text-center">
              <p className="caps text-(--text-faint)">The table</p>
              <p className="serif text-[13px] leading-snug text-(--text-faint)">
                Tap anyone to note what they claim
              </p>
            </div>
          </div>

          <AddSomeone empty={table.length === 0} />

          <button
            onClick={openRoles}
            className="mt-6 flex w-full items-center gap-4 border-y border-(--hairline) px-5 py-5 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="display block text-[20px] leading-tight text-(--text)">
                What every role does
              </span>
              <span className="serif block text-[13px] text-(--text-faint)">
                All {scriptIds.length} characters that could be in this game
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-(--text-faint)" />
          </button>
        </div>
      )}

      <Note name={open} onClose={() => setOpen(null)} />
    </>
  )
}

/**
 * What the Storyteller told you, under the same cover as your character.
 *
 * The fact that you were told something is not a secret: they wake people and
 * the table watches it happen. What was said is, so it never sits in the open,
 * and the newest one is on top because that is the one being asked about.
 */
function Whispers() {
  const messages = useStore((s) => s.messages)
  if (messages.length === 0) return null
  const newest = messages.at(-1)!

  return (
    <section className="mt-6 px-5">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="caps text-(--text-faint)">The Storyteller told you</p>
        <span className="caps text-(--text-faint)">
          {messages.length === 1 ? newest.at : `${messages.length} things`}
        </span>
      </div>
      <HoldToReveal label="Press and hold" hint="Only you should read this.">
        <div className="flex flex-col gap-3 px-2 text-center">
          {[...messages].reverse().map((m) => (
            <p key={m.id} className="serif text-[16px] leading-snug text-(--text)">
              {m.text}
              <span className="caps ml-2 text-[10px] text-(--text-faint)">{m.at}</span>
            </p>
          ))}
        </div>
      </HoldToReveal>
    </section>
  )
}

/**
 * The Storyteller's seat list fills the ring in, so this is for the game played
 * with one code per player, where nobody sent a list at all.
 */
function AddSomeone({ empty }: { empty: boolean }) {
  const ensureNote = useStore((s) => s.ensureNote)
  const [open, setOpen] = useState(empty)
  const [draft, setDraft] = useState('')

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mx-auto mt-2 flex min-h-(--tap-min) items-center gap-2 px-5 text-[14px] text-(--text-faint)"
      >
        <Plus size={16} />
        Someone missing?
      </button>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const name = draft.trim()
        if (!name) return
        ensureNote(name)
        setDraft('')
      }}
      className="mt-2 flex gap-2 px-5"
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
  )
}

function Seat({ name }: { name: string | null }) {
  if (!name) return null
  return <p className="caps px-5 pt-5 text-center text-(--text-faint)">You are {name}</p>
}

/**
 * A person is drawn as their initials and nothing else.
 *
 * Never their character. The app is only ever told one role, your own, and a
 * face on somebody else would read as though the app knew theirs. What it can
 * show is what *you* wrote down, in your words, underneath: "says Chef".
 */
function Person({
  name,
  claim,
  size,
}: {
  name: string
  claim?: ReturnType<typeof getCharacter>
  size: string
}) {
  return (
    <>
      <Token name={name} size={size} />
      <span className="max-w-[10ch] truncate text-[12px] text-(--text-dim)">{name}</span>
      {claim && (
        <span className="max-w-[12ch] text-center text-[11px] leading-tight text-(--text-faint)">
          says {claim.name}
        </span>
      )}
    </>
  )
}
