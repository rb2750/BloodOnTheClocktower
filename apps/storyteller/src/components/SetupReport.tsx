import { getCharacter, type SetupResolution } from '@botc/rules'
import { Label } from '@botc/ui'
import { AlertTriangle, Link2, HelpCircle } from 'lucide-react'

/**
 * What the setup solver worked out, and — just as important — what it refused
 * to guess.
 *
 * Existing tools either handle only the easy modifiers and say nothing about
 * the rest, or silently produce a wrong bag. Being plainly honest about the
 * open cases is more useful to a Storyteller than a confident wrong answer.
 */
export function SetupReport({
  resolution,
  jinxes,
  choices,
  onChoose,
}: {
  resolution: SetupResolution
  jinxes: { a: string; b: string; reason: string }[]
  choices: Record<string, number>
  onChoose: (characterId: string, optionIndex: number) => void
}) {
  const { composition, bag, base } = resolution
  const changed =
    composition.townsfolk !== base.townsfolk ||
    composition.outsider !== base.outsider ||
    composition.minion !== base.minion ||
    composition.demon !== base.demon
  const bagDiffers =
    bag.townsfolk !== composition.townsfolk || bag.outsider !== composition.outsider

  return (
    <div className="space-y-4">
      <div className="rounded-(--radius-surface) border border-(--hairline) p-4">
        <Label>{changed ? 'Adjusted for the characters in play' : 'Composition'}</Label>
        <dl className="grid grid-cols-4 gap-2 text-center">
          {(
            [
              ['Townsfolk', composition.townsfolk, base.townsfolk],
              ['Outsiders', composition.outsider, base.outsider],
              ['Minions', composition.minion, base.minion],
              ['Demon', composition.demon, base.demon],
            ] as const
          ).map(([label, n, was]) => (
            <div key={label}>
              <dd
                className={`tabular display text-[22px] ${
                  n !== was ? 'text-(--accent)' : 'text-(--text)'
                }`}
              >
                {n}
              </dd>
              <dt className="text-[10px] uppercase tracking-wider text-(--text-faint)">
                {label}
              </dt>
              {n !== was && (
                <dd className="tabular text-[10px] text-(--text-faint)">was {was}</dd>
              )}
            </div>
          ))}
        </dl>

        {bagDiffers && (
          <p className="mt-3 border-t border-(--hairline) pt-3 text-[13px] text-(--text-dim)">
            The bag is not the same as the composition here. Deal{' '}
            <strong className="text-(--text)">{bag.townsfolk} Townsfolk</strong> and{' '}
            <strong className="text-(--text)">{bag.outsider} Outsider</strong> tokens, because
            a player is holding a token that is not their real character.
          </p>
        )}
      </div>

      {resolution.problems.map((p) => (
        <Callout key={p} tone="bad" icon={AlertTriangle} title="This does not add up">
          {p}
        </Callout>
      ))}

      {resolution.pendingChoices.map((choice) => (
        <div
          key={choice.characterId}
          className="rounded-(--radius-surface) border border-(--hairline-strong) p-4"
        >
          <div className="mb-3 flex items-center gap-2 text-[14px] text-(--accent)">
            <HelpCircle size={16} />
            {choice.prompt}
          </div>
          <div className="flex flex-wrap gap-2">
            {choice.options.map((option, i) => (
              <button
                key={option.label}
                onClick={() => onChoose(choice.characterId, i)}
                className={`min-h-10 rounded-full border px-4 text-[13px] ${
                  choices[choice.characterId] === i
                    ? 'border-(--accent) text-(--accent)'
                    : 'border-(--hairline) text-(--text-dim)'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {resolution.unresolved.map((u) => (
        <Callout
          key={u.characterId}
          tone="open"
          icon={HelpCircle}
          title={`${u.characterName} — you decide`}
        >
          {u.note}
        </Callout>
      ))}

      {resolution.seating.map((s) => (
        <Callout key={s.characterId} tone="note" icon={Link2} title={`${s.characterName} seating`}>
          {s.constraint === 'neighbours-demon'
            ? 'They must sit next to the Demon.'
            : 'The evil players must sit in one unbroken line, with the Demon in the middle.'}
        </Callout>
      ))}

      {resolution.disguised.map((d) => (
        <Callout key={d.characterId} tone="note" icon={AlertTriangle} title={d.characterName}>
          {d.note}
        </Callout>
      ))}

      {resolution.forced.length > 0 && (
        <Callout tone="note" icon={Link2} title="Pulled into play">
          {resolution.forced
            .map((f) => `${getCharacter(f.by)?.name ?? f.by} brings the ${f.characterName}`)
            .join('. ')}
          .
        </Callout>
      )}

      {jinxes.length > 0 && (
        <div className="rounded-(--radius-surface) border border-(--hairline-strong) p-4">
          <Label>Jinxes in play</Label>
          <ul className="space-y-2">
            {jinxes.map((j) => (
              <li key={`${j.a}-${j.b}`}>
                <div className="text-[13px] text-(--accent)">
                  {getCharacter(j.a)?.name} &amp; {getCharacter(j.b)?.name}
                </div>
                <p className="serif m-0 text-[15px] leading-snug text-(--text-dim)">{j.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Callout({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: 'bad' | 'open' | 'note'
  icon: typeof AlertTriangle
  title: string
  children: React.ReactNode
}) {
  const border =
    tone === 'bad'
      ? 'border-(--color-red)'
      : tone === 'open'
        ? 'border-(--hairline-strong)'
        : 'border-(--hairline)'
  const colour =
    tone === 'bad'
      ? 'text-(--color-red-2)'
      : tone === 'open'
        ? 'text-(--accent)'
        : 'text-(--text-dim)'
  return (
    <div className={`rounded-(--radius-surface) border ${border} p-4`}>
      <div className={`mb-1 flex items-center gap-2 text-[13px] ${colour}`}>
        <Icon size={15} />
        {title}
      </div>
      <p className="serif m-0 text-[15px] leading-snug text-(--text-dim)">{children}</p>
    </div>
  )
}
