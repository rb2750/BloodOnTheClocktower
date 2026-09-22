import { useState } from 'react'
import { scriptCharacters, teamAlignment, type Character } from '@botc/rules'
import { Sheet } from '@botc/ui'
import type { Tip } from '../coach.js'
import { BASICS, EXPLAIN } from '../rules-explained.js'
import { useStore } from '../state/store.js'
import { CharacterToken } from './CharacterToken.js'

const MARK: Record<Tip['k'], { label: string; colour: string }> = {
  rule: { label: 'Rule', colour: 'var(--text-faint)' },
  do: { label: 'Do', colour: 'var(--text)' },
  say: { label: 'Say', colour: 'var(--now)' },
  note: { label: 'Record', colour: 'var(--text-dim)' },
  hint: { label: 'Hint', colour: 'var(--color-blue-2)' },
  warn: { label: 'Check', colour: 'var(--color-red-2)' },
}

/** The coach's list for this moment, in order. */
export function Coach({ tips }: { tips: Tip[] }) {
  if (tips.length === 0) return null
  return (
    <ol className="mt-3 flex list-none flex-col gap-2 border-t border-(--hairline) p-0 pt-3">
      {tips.map((tip, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="caps mt-[3px] w-[46px] shrink-0 text-[9.5px]" style={{ color: MARK[tip.k].colour }}>
            {MARK[tip.k].label}
          </span>
          <span
            className={`leading-snug ${tip.k === 'rule' ? 'serif text-[14px]' : 'text-[15px]'}`}
            style={{ color: tip.k === 'say' ? 'var(--now)' : tip.k === 'rule' ? 'var(--text-dim)' : 'var(--text)' }}
          >
            {tip.t}
          </span>
        </li>
      ))}
    </ol>
  )
}

const TEAM: Record<string, string> = { townsfolk: 'Townsfolk', outsider: 'Outsider', minion: 'Minion', demon: 'Demon', traveller: 'Traveller' }

/**
 * The whole rule set on one sheet: how the game works, then every character
 * in this game explained, then the rest of the script, which players may
 * claim to be.
 */
export function RulesButton() {
  const game = useStore((s) => s.game)
  const [open, setOpen] = useState(false)
  if (!game) return null
  const inPlay = new Set(game.seats.flatMap((s) => [s.characterId, s.trueCharacterId]).filter(Boolean) as string[])
  const all = scriptCharacters(game.script).filter((c) => c.team !== 'fabled' && c.team !== 'loric')
  const playing = all.filter((c) => inPlay.has(c.id))
  const others = all.filter((c) => !inPlay.has(c.id))
  const row = (c: Character) => (
    <div key={c.id} className="flex gap-3 border-b border-(--hairline) py-3">
      <CharacterToken character={c} size="44px" />
      <div className="min-w-0 flex-1">
        <div className="display text-[18px] leading-tight">{c.name}</div>
        <div className={`caps text-[9.5px] ${teamAlignment(c.team) === 'evil' ? 'text-(--color-red-2)' : 'text-(--color-blue-2)'}`}>{TEAM[c.team] ?? c.team}</div>
        <p className="m-0 mt-1 text-[14px] leading-snug text-(--text)">{c.ability}</p>
        {EXPLAIN[c.id] && <p className="serif m-0 mt-1 text-[14px] leading-snug text-(--text-dim)">{EXPLAIN[c.id]}</p>}
      </div>
    </div>
  )
  return (
    <>
      <button onClick={() => setOpen(true)} className="caps mt-3 min-h-9 w-full rounded-full border border-(--hairline-strong) px-3 text-[10.5px] text-(--text-dim)">
        How this game works
      </button>
      <Sheet open={open} onOpenChange={setOpen} title={`${game.scriptName}: how it works`} subtitle="The basics, then every character in this game, then the rest of the script.">
        <div className="pb-4">
          {BASICS.map((b) => (
            <div key={b.title} className="border-b border-(--hairline) py-2.5">
              <div className="text-[14px] font-semibold text-(--text)">{b.title}</div>
              <p className="serif m-0 mt-0.5 text-[14px] leading-snug text-(--text-dim)">{b.text}</p>
            </div>
          ))}
          <div className="caps mt-5 text-(--text-faint)">In this game</div>
          {playing.map(row)}
          <div className="caps mt-5 text-(--text-faint)">Also on the script: players may claim these</div>
          {others.map(row)}
        </div>
      </Sheet>
    </>
  )
}
