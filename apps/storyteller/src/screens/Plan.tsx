import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  baseComposition,
  compositionTotal,
  dealCharacters,
  editionScript,
  EDITIONS,
  getCharacter,
  jinxesInPlay,
  parseScript,
  pickBluffs,
  requiredTravellers,
  resolveSetup,
  scriptCharacters,
  type Script,
} from '@botc/rules'
import { Button, Label } from '@botc/ui'
import { Plus, X, Shuffle, Upload, Users, ScrollText, Sparkles } from 'lucide-react'
import { useStore } from '../state/store.js'
import { Screen } from '../components/Screen.js'
import { CharacterToken } from '../components/CharacterToken.js'
import { SetupReport } from '../components/SetupReport.js'
import type { Screen as ScreenName } from '../App.js'

type Step = 'players' | 'script' | 'deal'

const BASE_SCRIPTS = EDITIONS.filter((e) => ['tb', 'bmr', 'snv'].includes(e.id))

export function PlanScreen({ go }: { go: (s: ScreenName) => void }) {
  const roster = useStore((s) => s.roster)
  const savedScripts = useStore((s) => s.savedScripts)
  const game = useStore((s) => s.game)
  const newGame = useStore((s) => s.newGame)
  const setSeatCharacter = useStore((s) => s.setSeatCharacter)
  const setSeatTraveller = useStore((s) => s.setSeatTraveller)
  const setBluffs = useStore((s) => s.setBluffs)
  const startFirstNight = useStore((s) => s.startFirstNight)
  const saveScript = useStore((s) => s.saveScript)

  const [step, setStep] = useState<Step>('players')
  const [names, setNames] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [script, setScript] = useState<Script | null>(null)
  const [scriptName, setScriptName] = useState('')
  const [dealt, setDealt] = useState<string[] | null>(null)
  const [travellers, setTravellers] = useState<string[]>([])
  const [choices, setChoices] = useState<Record<string, number>>({})

  const playerCount = names.length
  const resolution = useMemo(
    () => (playerCount >= 5 ? resolveSetup(playerCount, dealt ?? [], choices) : null),
    [playerCount, dealt, choices],
  )
  const jinxes = useMemo(() => jinxesInPlay(dealt ?? []), [dealt])

  const addName = (value: string) => {
    const name = value.trim()
    if (!name) return
    if (names.includes(name)) {
      toast.error(`${name} is already at the table.`)
      return
    }
    setNames((n) => [...n, name])
    setDraft('')
  }

  const chooseScript = (s: Script, name: string) => {
    setScript(s)
    setScriptName(name)
    setDealt(null)
    setStep('deal')
  }

  /**
   * Above fifteen players the composition table does not grow: every extra
   * player must be a Traveller. So the deal covers the table and the remaining
   * seats are filled from the script's Travellers, which the Storyteller can
   * swap like any other token.
   */
  const travellerCount = requiredTravellers(playerCount)

  const deal = () => {
    if (!script) return
    const tableSize = playerCount - travellerCount
    const result = dealCharacters(script, { playerCount: tableSize, choices })
    if (result.shortfall.length > 0) {
      const missing = result.shortfall.map((s) => `${s.missing} ${s.team}`).join(', ')
      toast.error(`This script is short of ${missing} for ${tableSize} players.`)
    }
    setDealt(result.characterIds)

    if (travellerCount > 0) {
      const pool = scriptCharacters(script).filter((c) => c.team === 'traveller')
      if (pool.length === 0) {
        toast.error('This script has no Travellers, and this many players needs some.')
        setTravellers([])
      } else {
        const picked: string[] = []
        for (let i = 0; i < travellerCount; i++) {
          const remaining = pool.filter((c) => !picked.includes(c.id))
          const next = (remaining.length > 0 ? remaining : pool)[
            Math.floor(Math.random() * (remaining.length > 0 ? remaining.length : pool.length))
          ]
          if (next) picked.push(next.id)
        }
        setTravellers(picked)
      }
    } else {
      setTravellers([])
    }
  }

  const begin = () => {
    if (!script || !dealt) return
    newGame({ script, scriptName, names })
    const seats = useStore.getState().game?.seats ?? []
    const shuffled = [...dealt].sort(() => Math.random() - 0.5)

    seats.forEach((seat, i) => {
      const characterId = shuffled[i]
      if (characterId) {
        setSeatCharacter(seat.id, characterId)
        return
      }
      // Seats beyond the table are the Travellers.
      const travellerId = travellers[i - shuffled.length]
      if (travellerId) {
        setSeatCharacter(seat.id, travellerId)
        setSeatTraveller(seat.id, true)
      }
    })

    setBluffs(pickBluffs(script, dealt))
    startFirstNight()
    go('run')
  }

  const importScript = async (file: File) => {
    try {
      const json = JSON.parse(await file.text())
      const parsed = parseScript(json, file.name.replace(/\.json$/i, ''))
      for (const w of parsed.warnings) toast.warning(w)
      saveScript(parsed.meta.name, parsed)
      chooseScript(parsed, parsed.meta.name)
      toast.success(`Imported ${parsed.meta.name}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That file could not be read.')
    }
  }

  return (
    <Screen
      title={
        game && game.phase.k !== 'setup' ? (
          <button onClick={() => go('run')} className="text-(--color-brass-300)">
            Return to the game in progress
          </button>
        ) : (
          'New game'
        )
      }
      trailing={
        <button
          onClick={() => go('settings')}
          aria-label="Settings"
          className="text-(--text-faint)"
        >
          <Sparkles size={18} />
        </button>
      }
      bottom={
        step === 'players' ? (
          <Button
            variant="primary"
            className="w-full"
            disabled={playerCount < 5}
            onClick={() => setStep('script')}
          >
            {playerCount < 5
              ? `${5 - playerCount} more player${5 - playerCount === 1 ? '' : 's'} needed`
              : `Choose a script for ${playerCount}`}
          </Button>
        ) : step === 'deal' && dealt ? (
          <div className="flex gap-2">
            <Button onClick={deal} aria-label="Deal again">
              <Shuffle size={18} />
            </Button>
            <Button variant="primary" className="flex-1" onClick={begin}>
              Begin the first night
            </Button>
          </div>
        ) : step === 'deal' ? (
          <Button variant="primary" className="w-full" onClick={deal}>
            Deal {playerCount} characters
          </Button>
        ) : null
      }
    >
      <Stepper step={step} onStep={setStep} hasScript={Boolean(script)} count={playerCount} />

      {step === 'players' && (
        <section className="pb-6">
          <Label>Who is playing</Label>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              addName(draft)
            }}
            className="flex gap-2"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a name"
              autoComplete="off"
              className="min-h-(--tap-min) flex-1 rounded-(--radius-surface) border border-(--hairline) bg-(--surface) px-4 text-[16px] text-(--text) outline-none placeholder:text-(--text-faint) focus:border-(--color-brass-600)"
            />
            <Button type="submit" aria-label="Add player" disabled={!draft.trim()}>
              <Plus size={20} />
            </Button>
          </form>

          {names.length > 0 && (
            <ul className="mt-4 space-y-1">
              {names.map((name, i) => (
                <li
                  key={name}
                  className="flex items-center gap-3 rounded-(--radius-surface) border border-(--hairline) bg-(--surface) px-4 py-2"
                >
                  <span className="tabular w-6 text-[13px] text-(--text-faint)">{i + 1}</span>
                  <span className="flex-1 text-[15px]">{name}</span>
                  <button
                    onClick={() => setNames((n) => n.filter((x) => x !== name))}
                    aria-label={`Remove ${name}`}
                    className="grid size-9 place-items-center text-(--text-faint)"
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {roster.length > 0 && (
            <div className="mt-6">
              <Label>Your regulars</Label>
              <div className="flex flex-wrap gap-2">
                {roster
                  .filter((r) => !names.includes(r.name))
                  .map((r) => (
                    <button
                      key={r.id}
                      onClick={() => addName(r.name)}
                      className="min-h-9 rounded-full border border-(--hairline) px-3 text-[13px] text-(--text-dim)"
                    >
                      {r.name}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {playerCount >= 5 && <CompositionPreview count={playerCount} />}
        </section>
      )}

      {step === 'script' && (
        <section className="pb-6">
          <Label>Official scripts</Label>
          <div className="space-y-2">
            {BASE_SCRIPTS.map((e) => (
              <ScriptRow
                key={e.id}
                name={e.name}
                detail={e.level}
                onClick={() => chooseScript(editionScript(e.id, e.name), e.name)}
              />
            ))}
          </div>

          {savedScripts.length > 0 && (
            <>
              <div className="mt-6" />
              <Label>Your scripts</Label>
              <div className="space-y-2">
                {savedScripts.map((s) => (
                  <ScriptRow
                    key={s.id}
                    name={s.name}
                    detail={`${s.script.characterIds.length} characters`}
                    onClick={() => chooseScript(s.script, s.name)}
                  />
                ))}
              </div>
            </>
          )}

          <div className="mt-6">
            <Label>Import</Label>
            <label className="flex min-h-(--tap-min) cursor-pointer items-center justify-center gap-2 rounded-(--radius-surface) border border-dashed border-(--hairline) text-[14px] text-(--text-dim)">
              <Upload size={16} />
              Script Tool or botcscripts JSON
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void importScript(file)
                }}
              />
            </label>
          </div>
        </section>
      )}

      {step === 'deal' && script && (
        <section className="pb-6">
          {resolution && (
            <SetupReport
              resolution={resolution}
              jinxes={jinxes}
              choices={choices}
              onChoose={(id, index) => setChoices((c) => ({ ...c, [id]: index }))}
            />
          )}

          {dealt ? (
            <>
              <div className="mt-5" />
              <Label>In play — tap to swap</Label>
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
                {dealt.map((cid, i) => {
                  const c = getCharacter(cid)
                  return (
                    <button
                      key={`${cid}-${i}`}
                      className="flex flex-col items-center gap-1"
                      onClick={() => {
                        // Swapping a single character is a Plan-mode nicety;
                        // in Run mode the seat sheet does it properly.
                        const pool = scriptCharacters(script).filter(
                          (x) => x.team === c?.team && !dealt.includes(x.id),
                        )
                        const next = pool[Math.floor(Math.random() * pool.length)]
                        if (!next) {
                          toast.error(`No other ${c?.team} left on this script.`)
                          return
                        }
                        setDealt((d) => d!.map((x, j) => (j === i ? next.id : x)))
                      }}
                    >
                      <CharacterToken character={c} size="56px" />
                      <span className="text-center text-[10px] leading-tight text-(--text-faint)">
                        {c?.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <p className="mt-6 text-center text-[14px] text-(--text-faint)">
              {scriptName} is ready. Deal when you are.
            </p>
          )}

          {dealt && travellerCount > 0 && (
            <>
              <div className="mt-5" />
              <Label>
                Travellers — {travellerCount} of {playerCount} must be
              </Label>
              <p className="mb-3 text-[13px] leading-snug text-(--text-faint)">
                The composition table stops at fifteen, so these seats sit outside it. You choose
                each Traveller&rsquo;s alignment yourself once the game starts.
              </p>
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
                {travellers.map((cid, i) => {
                  const c = getCharacter(cid)
                  return (
                    <button
                      key={`${cid}-${i}`}
                      className="flex flex-col items-center gap-1"
                      onClick={() => {
                        const pool = scriptCharacters(script).filter(
                          (x) => x.team === 'traveller' && !travellers.includes(x.id),
                        )
                        const next = pool[Math.floor(Math.random() * pool.length)]
                        if (!next) {
                          toast.error('No other Travellers left on this script.')
                          return
                        }
                        setTravellers((t) => t.map((x, j) => (j === i ? next.id : x)))
                      }}
                    >
                      <CharacterToken character={c} size="56px" />
                      <span className="text-center text-[10px] leading-tight text-(--text-faint)">
                        {c?.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </section>
      )}
    </Screen>
  )
}

function Stepper({
  step,
  onStep,
  hasScript,
  count,
}: {
  step: Step
  onStep: (s: Step) => void
  hasScript: boolean
  count: number
}) {
  const steps: { id: Step; label: string; icon: typeof Users; enabled: boolean }[] = [
    { id: 'players', label: 'Players', icon: Users, enabled: true },
    { id: 'script', label: 'Script', icon: ScrollText, enabled: count >= 5 },
    { id: 'deal', label: 'Deal', icon: Shuffle, enabled: hasScript },
  ]
  return (
    <nav className="mb-5 mt-1 flex gap-1">
      {steps.map((s) => {
        const active = s.id === step
        return (
          <button
            key={s.id}
            disabled={!s.enabled}
            onClick={() => onStep(s.id)}
            className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-(--radius-surface) border text-[13px] transition-colors disabled:opacity-35 ${
              active
                ? 'border-(--color-brass-600) text-(--color-brass-300)'
                : 'border-transparent text-(--text-faint)'
            }`}
          >
            <s.icon size={15} />
            {s.label}
          </button>
        )
      })}
    </nav>
  )
}

function ScriptRow({
  name,
  detail,
  onClick,
}: {
  name: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-(--tap-min) w-full items-center justify-between rounded-(--radius-surface) border border-(--hairline) bg-(--surface) px-4 text-left"
    >
      <span className="text-[15px]">{name}</span>
      <span className="text-[12px] text-(--text-faint)">{detail}</span>
    </button>
  )
}

function CompositionPreview({ count }: { count: number }) {
  const c = baseComposition(count)
  const travellers = requiredTravellers(count)
  return (
    <div className="mt-6 rounded-(--radius-surface) border border-(--hairline) p-4">
      <Label>A {count}-player game needs</Label>
      <dl className="grid grid-cols-4 gap-2 text-center">
        {(
          [
            ['Townsfolk', c.townsfolk],
            ['Outsiders', c.outsider],
            ['Minions', c.minion],
            ['Demon', c.demon],
          ] as const
        ).map(([label, n]) => (
          <div key={label}>
            <dd className="tabular display text-[22px] text-(--text)">{n}</dd>
            <dt className="text-[10px] uppercase tracking-wider text-(--text-faint)">{label}</dt>
          </div>
        ))}
      </dl>
      {travellers > 0 && (
        <p className="mt-3 text-[13px] text-(--color-brass-300)">
          Above fifteen players the table does not grow, so {travellers} of them must be
          Travellers. The other {compositionTotal(c)} take the fifteen-player setup.
        </p>
      )}
    </div>
  )
}
