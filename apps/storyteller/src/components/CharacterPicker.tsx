import { useMemo, useState } from 'react'
import { scriptCharacters, teamAlignment, type Character, type Script, type Team } from '@botc/rules'
import { Label, Sheet, inputClass } from '@botc/ui'
import { CharacterToken } from './CharacterToken.js'

const ORDER: Team[] = ['townsfolk', 'outsider', 'minion', 'demon', 'traveller', 'fabled', 'loric']
const HEADING: Record<string, string> = {
  townsfolk: 'Townsfolk',
  outsider: 'Outsiders',
  minion: 'Minions',
  demon: 'Demons',
  traveller: 'Travellers',
  fabled: 'Fabled',
  loric: 'Loric',
}

/**
 * Choose a character from the script.
 *
 * Grouped by team with the current one marked, and a filter for long scripts,
 * so swapping a role is a choice rather than a re-roll.
 */
export function CharacterPicker({
  open,
  onClose,
  script,
  title,
  subtitle,
  current,
  /** Restrict to these teams; everything when omitted. */
  teams,
  /** Grey out characters already in play elsewhere. */
  taken = [],
  onPick,
  children,
}: {
  open: boolean
  onClose: () => void
  script: Script
  title: React.ReactNode
  subtitle?: React.ReactNode
  current?: string
  teams?: Team[]
  taken?: readonly string[]
  onPick: (character: Character) => void
  /** Anything to show above the grid: an escape hatch, a note. */
  children?: React.ReactNode
}) {
  const [filter, setFilter] = useState('')
  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const all = scriptCharacters(script).filter(
      (c) => (!teams || teams.includes(c.team)) && (!q || c.name.toLowerCase().includes(q)),
    )
    return ORDER.map((team) => ({ team, characters: all.filter((c) => c.team === team) })).filter(
      (g) => g.characters.length > 0,
    )
  }, [script, teams, filter])

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setFilter('')
          onClose()
        }
      }}
      title={title}
      subtitle={subtitle}
    >
      {children}
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Find a character"
        autoComplete="off"
        className={`${inputClass} mb-4`}
      />
      {groups.map((g) => (
        <div key={g.team} className="mb-5">
          <Label>{HEADING[g.team] ?? g.team}</Label>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
            {g.characters.map((c) => {
              const isCurrent = c.id === current
              const isTaken = !isCurrent && taken.includes(c.id)
              return (
                <button
                  key={c.id}
                  className={`flex flex-col items-center gap-1.5 ${isTaken ? 'opacity-35' : ''}`}
                  aria-current={isCurrent || undefined}
                  onClick={() => {
                    setFilter('')
                    onPick(c)
                  }}
                >
                  <CharacterToken
                    character={c}
                    size="52px"
                    now={isCurrent}
                    alignment={teamAlignment(c.team) === 'evil' ? 'evil' : 'good'}
                  />
                  <span
                    className={`caps text-center text-[9px] leading-tight ${
                      isCurrent ? 'text-(--now)' : 'text-(--text-faint)'
                    }`}
                  >
                    {c.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {groups.length === 0 && (
        <p className="serif py-6 text-center text-[15px] text-(--text-faint)">
          Nothing on this script matches.
        </p>
      )}
    </Sheet>
  )
}
