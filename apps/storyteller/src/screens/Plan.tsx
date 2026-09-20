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
import { Button, Label, Rows, Row, inputClass, Plus, Close, Dice, Import, Grip , haptic } from '@botc/ui'
import { CharacterPicker } from '../components/CharacterPicker.js'
import { useListDrag } from '../hooks/useListDrag.js'
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
  const setSeatTrueCharacter = useStore((s) => s.setSeatTrueCharacter)
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
  // The Drunk is never told they are the Drunk. They are handed a Townsfolk
  // the Storyteller picks, and nothing starts until that pick is made.
  const [drunkAs, setDrunkAs] = useState<string | null>(null)
  const [choosingDrunk, setChoosingDrunk] = useState(false)
  const [travellers, setTravellers] = useState<string[]>([])
  const [choices, setChoices] = useState<Record<string, number>>({})
  const [swapping, setSwapping] = useState<{ list: 'dealt' | 'travellers'; index: number } | null>(null)
  const listDrag = useListDrag(names, setNames)

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
    haptic('tap')
    const tableSize = playerCount - travellerCount
    const result = dealCharacters(script, { playerCount: tableSize, choices })
    if (result.shortfall.length > 0) {
      const missing = result.shortfall.map((s) => `${s.missing} ${s.team}`).join(', ')
      toast.error(`This script is short of ${missing} for ${tableSize} players.`)
    }
    setDealt(result.characterIds)
    setDrunkAs(null)

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

  const drunkDealt = Boolean(dealt?.includes('drunk'))

  const begin = () => {
    if (!script || !dealt) return
    if (drunkDealt && !drunkAs) {
      setChoosingDrunk(true)
      return
    }
    haptic('confirm')
    newGame({ script, scriptName, names })
    const seats = useStore.getState().game?.seats ?? []
    const shuffled = [...dealt].sort(() => Math.random() - 0.5)

    seats.forEach((seat, i) => {
      const characterId = shuffled[i]
      if (characterId === 'drunk' && drunkAs) {
        setSeatCharacter(seat.id, drunkAs)
        setSeatTrueCharacter(seat.id, 'drunk')
        return
      }
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
      title="New game"
      subtitle={
        step === 'players'
          ? playerCount > 0
            ? `${playerCount} at the table`
            : undefined
          : step === 'script'
            ? `${playerCount} players`
            : scriptName
      }
      onBack={() => (game && game.phase.k !== 'setup' ? go('run') : go('home'))}
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
          <div>
            {drunkDealt && (
              <button
                onClick={() => setChoosingDrunk(true)}
                className="mb-2 flex min-h-(--tap-min) w-full items-center justify-between rounded-(--radius-surface) border border-(--accent) px-4 text-left"
              >
                <span className="text-[14px] text-(--text)">
                  {drunkAs
                    ? `The Drunk believes they are the ${getCharacter(drunkAs)?.name}`
                    : 'The Drunk needs a role to believe'}
                </span>
                <span className="caps text-(--text-faint)">{drunkAs ? 'change' : 'choose'}</span>
              </button>
            )}
            <div className="flex gap-2">
              <Button onClick={deal} aria-label="Deal again">
                <Dice size={18} />
              </Button>
              <Button variant="primary" className="flex-1" onClick={begin}>
                {drunkDealt && !drunkAs ? 'Choose the Drunk\u2019s role' : 'Begin the first night'}
              </Button>
            </div>
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
              className={`${inputClass} flex-1`}
            />
            <Button type="submit" aria-label="Add player" disabled={!draft.trim()}>
              <Plus size={20} />
            </Button>
          </form>

          {names.length > 0 && (
            <>
            <p className="serif mt-4 text-[14px] text-(--text-faint)">
              This is the seating order. Drag a name to move it.
            </p>
            <Rows className="mt-2" {...listDrag.listProps}>
              {names.map((name, i) => (
                <Row
                  key={name}
                  className={listDrag.dragging === name ? 'bg-(--surface-raised)' : ''}
                  leading={
                    <span
                      className="flex items-center gap-1 text-(--text-faint)"
                      style={{ touchAction: 'none' }}
                      onPointerDown={(e) => listDrag.start(name, e)}
                      aria-label={`Drag ${name}`}
                    >
                      <Grip size={18} />
                      <span className="tabular w-5 text-[13px]">{i + 1}</span>
                    </span>
                  }
                  trailing={
                    <button
                      onClick={() => setNames((n) => n.filter((x) => x !== name))}
                      aria-label={`Remove ${name}`}
                      className="grid size-9 place-items-center text-(--text-faint)"
                    >
                      <Close size={16} />
                    </button>
                  }
                >
                  {name}
                </Row>
              ))}
            </Rows>
            </>
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
                      className="min-h-9 rounded-full border border-(--hairline-strong) px-3 text-[13px] text-(--text-dim)"
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
          <Rows>
            {BASE_SCRIPTS.map((e) => (
              <Row
                key={e.id}
                trailing={e.level}
                onClick={() => chooseScript(editionScript(e.id, e.name), e.name)}
              >
                {e.name}
              </Row>
            ))}
          </Rows>

          {savedScripts.length > 0 && (
            <>
              <div className="mt-6" />
              <Label>Your scripts</Label>
              <Rows>
                {savedScripts.map((s) => (
                  <Row
                    key={s.id}
                    trailing={`${s.script.characterIds.length} characters`}
                    onClick={() => chooseScript(s.script, s.name)}
                  >
                    {s.name}
                  </Row>
                ))}
              </Rows>
            </>
          )}

          <div className="mt-6">
            <Label>Import</Label>
            <label className="flex min-h-(--tap-min) cursor-pointer items-center justify-center gap-2 rounded-(--radius-surface) border border-dashed border-(--hairline-strong) text-[14px] font-medium text-(--text-dim)">
              <Import size={16} />
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
              <Label>In play — tap one to change it</Label>
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
                {dealt.map((cid, i) => {
                  const c = getCharacter(cid)
                  return (
                    <button
                      key={`${cid}-${i}`}
                      className="flex flex-col items-center gap-1"
                      onClick={() => setSwapping({ list: 'dealt', index: i })}
                    >
                      <CharacterToken character={c} size="56px" />
                      <span className="caps text-center text-[9px] leading-tight text-(--text-faint)">
                        {c?.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <p className="serif mt-8 text-center text-[16px] text-(--text-faint)">
              {scriptName} is ready. Deal when you are.
            </p>
          )}

          {dealt && travellerCount > 0 && (
            <>
              <div className="mt-5" />
              <Label>
                Travellers — {travellerCount} of {playerCount} must be
              </Label>
              <p className="serif mb-3 text-[14px] leading-snug text-(--text-faint)">
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
                      onClick={() => setSwapping({ list: 'travellers', index: i })}
                    >
                      <CharacterToken character={c} size="56px" />
                      <span className="caps text-center text-[9px] leading-tight text-(--text-faint)">
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

      {script && dealt && (
        <CharacterPicker
          open={choosingDrunk}
          onClose={() => setChoosingDrunk(false)}
          script={script}
          title="The Drunk believes they are the…"
          subtitle="A Townsfolk not in play. They wake in its slot, get its information, and never learn the difference."
          current={drunkAs ?? undefined}
          teams={['townsfolk']}
          taken={dealt.filter((id) => id !== 'drunk')}
          onPick={(c) => {
            setDrunkAs(c.id)
            setChoosingDrunk(false)
          }}
        />
      )}

      {script && (

      <CharacterPicker
          open={swapping !== null}
          onClose={() => setSwapping(null)}
          script={script}
          title="Swap for…"
          subtitle="Grouped by team. Changing team changes the composition, and the report above will say so."
          current={
            swapping
              ? swapping.list === 'dealt'
                ? dealt?.[swapping.index]
                : travellers[swapping.index]
              : undefined
          }
          teams={swapping?.list === 'travellers' ? ['traveller'] : undefined}
          taken={[...(dealt ?? []), ...travellers]}
          onPick={(c) => {
            if (!swapping) return
            if (swapping.list === 'dealt') {
              setDealt((d) => d!.map((x, j) => (j === swapping.index ? c.id : x)))
              setDrunkAs(null)
            } else {
              setTravellers((t) => t.map((x, j) => (j === swapping.index ? c.id : x)))
            }
            setSwapping(null)
          }}
        />
      )}
    </Screen>
  )
}

/** Setup is a sequence, so it is drawn as one: three labels on a rule, the
 *  done ones lit. */
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
  const steps: { id: Step; label: string; enabled: boolean }[] = [
    { id: 'players', label: 'Players', enabled: true },
    { id: 'script', label: 'Script', enabled: count >= 5 },
    { id: 'deal', label: 'Deal', enabled: hasScript },
  ]
  const at = steps.findIndex((s) => s.id === step)
  return (
    <nav className="mb-6 mt-2 flex items-center">
      {steps.map((s, i) => {
        const active = s.id === step
        const done = i < at
        return (
          <span key={s.id} className="contents">
            {i > 0 && <span className="mx-3 h-px flex-1 bg-(--hairline)" aria-hidden />}
            <button
              disabled={!s.enabled}
              onClick={() => onStep(s.id)}
              aria-current={active ? 'step' : undefined}
              className={`caps min-h-10 pb-0.5 transition-colors disabled:opacity-35 ${
                active
                  ? 'border-b border-(--accent) text-(--text)'
                  : done
                    ? 'text-(--text-dim)'
                    : 'text-(--text-faint)'
              }`}
            >
              {s.label}
            </button>
          </span>
        )
      })}
    </nav>
  )
}

function CompositionPreview({ count }: { count: number }) {
  const c = baseComposition(count)
  const travellers = requiredTravellers(count)
  return (
    <div className="mt-8 border-t border-(--hairline) pt-4">
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
            <dd className="tabular display text-[28px] text-(--text)">{n}</dd>
            <dt className="caps mt-1 text-[9.5px] text-(--text-faint)">{label}</dt>
          </div>
        ))}
      </dl>
      {travellers > 0 && (
        <p className="serif mt-3 text-[14px] leading-snug text-(--text-dim)">
          Above fifteen players the table does not grow, so {travellers} of them must be
          Travellers. The other {compositionTotal(c)} take the fifteen-player setup.
        </p>
      )}
    </div>
  )
}
