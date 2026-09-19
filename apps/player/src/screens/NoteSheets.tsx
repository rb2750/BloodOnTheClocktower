import { useState } from 'react'
import { getCharacter, teamAlignment, type Character, type Team } from '@botc/rules'
import { Button, Chip, Label, Sheet, inputClass, Plus, Shroud, ChevronRight } from '@botc/ui'
import { useStore } from '../state.js'
import { CharacterToken } from '../components/CharacterToken.js'

/** Preview only: three ways of asking the same three questions. */

const STAMPS = ['Confirmed', 'Suspect', 'Evil?', 'Lied', 'Droisoned?', 'Voted with me']
const TEAMS: { team: Team; label: string }[] = [
  { team: 'townsfolk', label: 'Townsfolk' },
  { team: 'outsider', label: 'Outsiders' },
  { team: 'minion', label: 'Minions' },
  { team: 'demon', label: 'Demons' },
]

function useSheet(name: string | null) {
  const notes = useStore((s) => s.notes)
  const scriptIds = useStore((s) => s.scriptIds)
  const phase = useStore((s) => s.phase)
  const day = useStore((s) => s.day)
  const note = name ? notes[name] : undefined
  const characters = scriptIds.map((id) => getCharacter(id)).filter((c): c is Character => Boolean(c))
  // Everything anyone at this table has already said they are.
  const spoken = new Set(
    Object.values(notes).flatMap((n) => n.claims.map((c) => c.characterId)),
  )
  return { note, characters, spoken, phase, day, notes }
}

function Face({
  character,
  current,
  onClick,
  size = '46px',
}: {
  character: Character
  current: boolean
  onClick: () => void
  size?: string
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={current}
      className={`flex w-[62px] shrink-0 flex-col items-center gap-1 rounded-xl py-1.5 ${
        current ? 'bg-(--surface-raised)' : ''
      }`}
    >
      <CharacterToken
        character={character}
        size={size}
        alignment={teamAlignment(character.team) === 'evil' ? 'evil' : 'good'}
        muted={!current}
      />
      <span
        className={`text-center text-[10px] leading-tight ${
          current ? 'text-(--text)' : 'text-(--text-faint)'
        }`}
      >
        {character.name}
      </span>
    </button>
  )
}

/* ------------------------------------------------- one question at a time --- */

export function SheetOne({ name, onClose }: { name: string | null; onClose: () => void }) {
  const { note, characters, phase, day } = useSheet(name)
  const addClaim = useStore((s) => s.addClaim)
  const toggleStamp = useStore((s) => s.toggleStamp)
  const addLine = useStore((s) => s.addLine)
  const setDied = useStore((s) => s.setDied)
  const [step, setStep] = useState<'menu' | 'claim' | 'mark' | 'write'>('menu')
  const [line, setLine] = useState('')

  if (!name || !note) return null
  const claim = note.claims.at(-1)
  const claimed = claim ? getCharacter(claim.characterId) : undefined

  return (
    <Sheet
      open
      onOpenChange={(o) => {
        if (!o) {
          setStep('menu')
          onClose()
        }
      }}
      title={step === 'menu' ? note.name : `${note.name} ${step === 'claim' ? 'says they are' : step === 'mark' ? 'marks' : 'note'}`}
      subtitle={step === 'menu' ? phase : 'Tap to go back when you are done'}
    >
      {step === 'menu' && (
        <div className="pb-2">
          <Row
            title="Says they are…"
            hint={claimed ? claimed.name : 'Nothing yet'}
            onClick={() => setStep('claim')}
          />
          <Row
            title="Mark them"
            hint={note.stamps.length > 0 ? note.stamps.join(', ') : 'Confirmed, suspect, lied…'}
            onClick={() => setStep('mark')}
          />
          <Row
            title="Write it down"
            hint={note.lines.length > 0 ? `${note.lines.length} written` : 'Their own words'}
            onClick={() => setStep('write')}
          />
          <button
            onClick={() => setDied(note.name, note.diedOnDay ? undefined : day)}
            className="flex min-h-(--tap-min) w-full items-center gap-3 px-1 pt-5 text-[15px] text-(--text-faint)"
          >
            <Shroud size={17} />
            {note.diedOnDay ? 'They are alive after all' : `They died on day ${day}`}
          </button>
        </div>
      )}

      {step === 'claim' && (
        <div className="grid grid-cols-4 gap-x-2 gap-y-3 pb-2 sm:grid-cols-5">
          {characters.map((c) => (
            <Face
              key={c.id}
              character={c}
              current={claim?.characterId === c.id}
              onClick={() => {
                addClaim(note.name, c.id)
                setStep('menu')
              }}
            />
          ))}
        </div>
      )}

      {step === 'mark' && (
        <div className="flex flex-wrap gap-2 pb-2">
          {STAMPS.map((s) => (
            <Chip key={s} active={note.stamps.includes(s)} onClick={() => toggleStamp(note.name, s)}>
              {s}
            </Chip>
          ))}
        </div>
      )}

      {step === 'write' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            addLine(note.name, line)
            setLine('')
            setStep('menu')
          }}
          className="flex gap-2 pb-2"
        >
          <input
            value={line}
            onChange={(e) => setLine(e.target.value)}
            placeholder={`What did ${note.name} say?`}
            className={`${inputClass} flex-1`}
          />
          <Button type="submit" aria-label="Save" disabled={!line.trim()}>
            <Plus size={20} />
          </Button>
        </form>
      )}
    </Sheet>
  )
}

function Row({ title, hint, onClick }: { title: string; hint: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-(--hairline) py-4 text-left first:border-t"
    >
      <span className="min-w-0 flex-1">
        <span className="display block text-[19px] leading-tight text-(--text)">{title}</span>
        <span className="serif block truncate text-[13px] text-(--text-faint)">{hint}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-(--text-faint)" />
    </button>
  )
}

/* ------------------------------------------------------------ short list --- */

export function SheetShort({ name, onClose }: { name: string | null; onClose: () => void }) {
  const { note, characters, spoken, phase, day } = useSheet(name)
  const addClaim = useStore((s) => s.addClaim)
  const toggleStamp = useStore((s) => s.toggleStamp)
  const addLine = useStore((s) => s.addLine)
  const setDied = useStore((s) => s.setDied)
  const [all, setAll] = useState(false)
  const [more, setMore] = useState(false)
  const [line, setLine] = useState('')

  if (!name || !note) return null
  const claim = note.claims.at(-1)
  // Nobody claims a role somebody else has already claimed, usually, so the
  // ones still unspoken are the likely answers.
  const likely = characters.filter((c) => !spoken.has(c.id) || claim?.characterId === c.id)
  const shown = all ? characters : likely.slice(0, 8)

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={note.name} subtitle={phase}>
      <div className="space-y-5 pb-2">
        <div>
          <Label>Says they are</Label>
          <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5">
            {shown.map((c) => (
              <Face
                key={c.id}
                character={c}
                current={claim?.characterId === c.id}
                onClick={() => addClaim(note.name, c.id)}
              />
            ))}
          </div>
          {!all && (
            <button
              onClick={() => setAll(true)}
              className="caps mt-3 min-h-(--tap-min) text-[11px] text-(--text-faint)"
            >
              Show all {characters.length}
            </button>
          )}
          {note.claims.length > 1 && (
            <p className="serif mt-2 text-[13px] text-(--text-faint)">
              Said before: {getCharacter(note.claims.at(-2)!.characterId)?.name} in{' '}
              {note.claims.at(-2)!.at}
            </p>
          )}
        </div>

        {!more ? (
          <button
            onClick={() => setMore(true)}
            className="flex min-h-(--tap-min) w-full items-center gap-2 border-t border-(--hairline) pt-4 text-[15px] text-(--text-faint)"
          >
            <Plus size={16} />
            Add a mark or a note
          </button>
        ) : (
          <div className="space-y-4 border-t border-(--hairline) pt-4">
            <div className="flex flex-wrap gap-2">
              {STAMPS.map((s) => (
                <Chip
                  key={s}
                  active={note.stamps.includes(s)}
                  onClick={() => toggleStamp(note.name, s)}
                >
                  {s}
                </Chip>
              ))}
              <Chip active={Boolean(note.diedOnDay)} onClick={() => setDied(note.name, note.diedOnDay ? undefined : day)}>
                Died
              </Chip>
            </div>
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
              <Button type="submit" aria-label="Save" disabled={!line.trim()}>
                <Plus size={20} />
              </Button>
            </form>
          </div>
        )}
      </div>
    </Sheet>
  )
}

/* ----------------------------------------------------------- team strips --- */

export function SheetTeams({ name, onClose }: { name: string | null; onClose: () => void }) {
  const { note, characters, phase, day } = useSheet(name)
  const addClaim = useStore((s) => s.addClaim)
  const toggleStamp = useStore((s) => s.toggleStamp)
  const setDied = useStore((s) => s.setDied)

  if (!name || !note) return null
  const claim = note.claims.at(-1)

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={note.name} subtitle={phase}>
      <div className="space-y-4 pb-2">
        {TEAMS.map(({ team, label }) => {
          const lot = characters.filter((c) => c.team === team)
          if (lot.length === 0) return null
          return (
            <div key={team}>
              <Label>{label}</Label>
              <div className="-mx-5 flex gap-1 overflow-x-auto px-5 pb-1">
                {lot.map((c) => (
                  <Face
                    key={c.id}
                    character={c}
                    current={claim?.characterId === c.id}
                    onClick={() => addClaim(note.name, c.id)}
                  />
                ))}
              </div>
            </div>
          )
        })}

        <div className="border-t border-(--hairline) pt-4">
          <div className="flex flex-wrap gap-2">
            {STAMPS.map((s) => (
              <Chip key={s} active={note.stamps.includes(s)} onClick={() => toggleStamp(note.name, s)}>
                {s}
              </Chip>
            ))}
            <Chip active={Boolean(note.diedOnDay)} onClick={() => setDied(note.name, note.diedOnDay ? undefined : day)}>
              Died
            </Chip>
          </div>
        </div>
      </div>
    </Sheet>
  )
}

/* ----------------------------------------------- the menu, then the teams --- */

export function SheetCombined({ name, onClose }: { name: string | null; onClose: () => void }) {
  const { note, characters, phase, day } = useSheet(name)
  const addClaim = useStore((s) => s.addClaim)
  const toggleStamp = useStore((s) => s.toggleStamp)
  const addLine = useStore((s) => s.addLine)
  const setDied = useStore((s) => s.setDied)
  const [step, setStep] = useState<'menu' | 'claim' | 'mark' | 'write'>('menu')
  const [line, setLine] = useState('')

  if (!name || !note) return null
  const claim = note.claims.at(-1)
  const claimed = claim ? getCharacter(claim.characterId) : undefined
  const close = () => {
    setStep('menu')
    onClose()
  }

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && close()}
      title={step === 'menu' ? note.name : `${note.name} says they are`}
      subtitle={
        step === 'menu'
          ? phase
          : claimed
            ? `Now: ${claimed.name}. Tap another to change it.`
            : 'Tap the one they claimed'
      }
    >
      {step === 'menu' && (
        <div className="pb-2">
          <Row
            title="Says they are…"
            hint={claimed ? claimed.name : 'Nothing yet'}
            onClick={() => setStep('claim')}
          />
          <Row
            title="Mark them"
            hint={note.stamps.length > 0 ? note.stamps.join(', ') : 'Confirmed, suspect, lied…'}
            onClick={() => setStep('mark')}
          />
          <Row
            title="Write it down"
            hint={
              note.lines.length > 0 ? note.lines.at(-1)!.text : 'Their own words, in yours'
            }
            onClick={() => setStep('write')}
          />
          <button
            onClick={() => setDied(note.name, note.diedOnDay ? undefined : day)}
            className="flex min-h-(--tap-min) w-full items-center gap-3 px-1 pt-5 text-[15px] text-(--text-faint)"
          >
            <Shroud size={17} />
            {note.diedOnDay ? 'They are alive after all' : `They died on day ${day}`}
          </button>
        </div>
      )}

      {/* Grouped the way the script on the table is grouped, and wrapped rather
          than scrolled sideways: nothing worth tapping is off the edge. */}
      {step === 'claim' && (
        <div className="space-y-4 pb-2">
          {TEAMS.map(({ team, label }) => {
            const lot = characters.filter((c) => c.team === team)
            if (lot.length === 0) return null
            return (
              <div key={team}>
                <Label>{label}</Label>
                <div className="flex flex-wrap gap-x-1 gap-y-2">
                  {lot.map((c) => (
                    <Face
                      key={c.id}
                      character={c}
                      current={claim?.characterId === c.id}
                      onClick={() => {
                        addClaim(note.name, c.id)
                        setStep('menu')
                      }}
                    />
                  ))}
                </div>
              </div>
            )
          })}
          {note.claims.length > 0 && (
            <button
              onClick={() => setStep('menu')}
              className="caps min-h-(--tap-min) text-[11px] text-(--text-faint)"
            >
              Leave it as it is
            </button>
          )}
        </div>
      )}

      {step === 'mark' && (
        <div className="flex flex-wrap gap-2 pb-2">
          {STAMPS.map((s) => (
            <Chip key={s} active={note.stamps.includes(s)} onClick={() => toggleStamp(note.name, s)}>
              {s}
            </Chip>
          ))}
        </div>
      )}

      {step === 'write' && (
        <div className="space-y-3 pb-2">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              addLine(note.name, line)
              setLine('')
              setStep('menu')
            }}
            className="flex gap-2"
          >
            <input
              value={line}
              onChange={(e) => setLine(e.target.value)}
              placeholder={`What did ${note.name} say?`}
              className={`${inputClass} flex-1`}
              autoFocus
            />
            <Button type="submit" aria-label="Save" disabled={!line.trim()}>
              <Plus size={20} />
            </Button>
          </form>
          {note.lines.length > 0 && (
            <ul className="space-y-1">
              {note.lines.map((l) => (
                <li key={l.id} className="flex gap-2">
                  <span className="caps mt-[3px] shrink-0 text-[10px] text-(--text-faint)">
                    {l.at}
                  </span>
                  <span className="serif text-[15px] leading-snug text-(--text-dim)">{l.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Sheet>
  )
}
