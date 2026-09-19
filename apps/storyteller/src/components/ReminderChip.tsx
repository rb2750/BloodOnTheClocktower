import { getCharacter } from '@botc/rules'
import { Token, Vial, Tankard, Shield, Mask, Warning, Close } from '@botc/ui'
import { CharacterToken } from './CharacterToken.js'
import type { Effect, EffectKind } from '../state/types.js'

/** The glyph a reminder carries when no character placed it. */
function Glyph({ kind }: { kind: EffectKind }) {
  const size = 13
  if (kind === 'poisoned') return <Vial size={size} />
  if (kind === 'drunk') return <Tankard size={size} />
  if (kind === 'protected') return <Shield size={size} />
  if (kind === 'mad') return <Mask size={size} />
  return <Warning size={size} />
}

function ringFor(kind: EffectKind): 'good' | 'evil' | 'unknown' {
  if (kind === 'poisoned' || kind === 'red-herring') return 'evil'
  if (kind === 'protected') return 'good'
  return 'unknown'
}

/**
 * A reminder, drawn the way the physical game draws it: a small round token
 * carrying the art of the character that placed it. When nothing placed it, a
 * glyph stands in for the art.
 */
export function ReminderMini({
  kind,
  sourceCharacterId,
  size = '26px',
}: {
  kind: EffectKind
  sourceCharacterId?: string
  size?: string
}) {
  const source = getCharacter(sourceCharacterId ?? '')
  if (source) return <CharacterToken character={source} size={size} />
  return (
    <Token name={kind} alignment={ringFor(kind)} size={size}>
      <span className="text-(--color-ink-2)">
        <Glyph kind={kind} />
      </span>
    </Token>
  )
}

/** A placed reminder in the seat sheet, with its expiry and a way to lift it. */
export function ReminderChip({ effect, onRemove }: { effect: Effect; onRemove?: () => void }) {
  const expiry =
    effect.expiry.kind === 'dusk'
      ? 'until dusk'
      : effect.expiry.kind === 'permanent'
        ? ''
        : `until ${effect.expiry.kind}`
  return (
    <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-(--hairline-strong) py-1 pl-1 pr-2 text-[14px] text-(--text)">
      <ReminderMini kind={effect.kind} sourceCharacterId={effect.sourceCharacterId} />
      {effect.label}
      {expiry && <span className="text-[11px] text-(--text-faint)">{expiry}</span>}
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${effect.label}`}
          className="grid size-7 place-items-center text-(--text-faint)"
        >
          <Close size={14} />
        </button>
      )}
    </span>
  )
}

/** An unplaced quick reminder: tap to add. */
export function ReminderOption({
  kind,
  label,
  onClick,
}: {
  kind: EffectKind
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-(--hairline) py-1 pl-1 pr-3 text-[14px] text-(--text-dim) active:bg-(--surface-raised)"
    >
      <ReminderMini kind={kind} />+ {label}
    </button>
  )
}
