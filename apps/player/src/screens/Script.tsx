import { useMemo, useState } from 'react'
import { getCharacter, teamAlignment, type Character, type Team } from '@botc/rules'
import { AbilityText, Label, Sheet } from '@botc/ui'
import { useStore } from '../state.js'
import { CharacterRow } from '../components/CharacterRow.js'

const ORDER: Team[] = ['townsfolk', 'outsider', 'minion', 'demon', 'traveller', 'fabled']

const HEADING: Record<string, string> = {
  townsfolk: 'Townsfolk',
  outsider: 'Outsiders',
  minion: 'Minions',
  demon: 'Demons',
  traveller: 'Travellers',
  fabled: 'Fabled',
  loric: 'Loric',
}

/** What every character on this script does. Read-only, and offline. */
export function ScriptScreen() {
  const scriptIds = useStore((s) => s.scriptIds)
  const scriptName = useStore((s) => s.scriptName)
  const [open, setOpen] = useState<Character | null>(null)

  const grouped = useMemo(() => {
    const characters = scriptIds
      .map((id) => getCharacter(id))
      .filter((c): c is Character => Boolean(c))
    return ORDER.map((team) => ({
      team,
      characters: characters.filter((c) => c.team === team),
    })).filter((g) => g.characters.length > 0)
  }, [scriptIds])

  if (scriptIds.length === 0) {
    return (
      <p className="px-8 py-16 text-center text-[14px] text-(--text-faint)">
        The script will appear here once you have scanned the Storyteller&rsquo;s code.
      </p>
    )
  }

  return (
    <>
      <section className="px-5 pb-8 pt-5">
        {scriptName && (
          <h1 className="display mb-5 text-center text-[16px] text-(--text)">{scriptName}</h1>
        )}
        {grouped.map((group) => (
          <div key={group.team} className="mb-6">
            <Label>{HEADING[group.team] ?? group.team}</Label>
            <ul className="space-y-1">
              {group.characters.map((c) => (
                <li key={c.id}>
                  <CharacterRow character={c} onClick={() => setOpen(c)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <Sheet
        open={open !== null}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open?.name}
        subtitle={open ? `${HEADING[open.team] ?? open.team} · ${teamAlignment(open.team)}` : ''}
      >
        {open && (
          <div className="space-y-4 pb-2">
            <AbilityText>{open.ability}</AbilityText>
            {open.flavor && (
              <p className="serif m-0 border-l border-(--color-brass-600) pl-3 text-[15px] italic leading-snug text-(--text-faint)">
                {open.flavor}
              </p>
            )}
            {open.jinxes.length > 0 && (
              <div>
                <Label>Special rules with</Label>
                <ul className="space-y-2">
                  {open.jinxes
                    .filter((j) => useStore.getState().scriptIds.includes(j.with))
                    .map((j) => (
                      <li key={j.with}>
                        <div className="text-[13px] text-(--color-brass-300)">
                          {getCharacter(j.with)?.name}
                        </div>
                        <p className="serif m-0 text-[15px] leading-snug text-(--text-dim)">
                          {j.reason}
                        </p>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </>
  )
}
