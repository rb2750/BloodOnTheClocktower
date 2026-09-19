import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'quiet' | 'danger'
  /** Live night controls get the taller target. */
  live?: boolean
  children: ReactNode
}

/**
 * Brass is the interaction accent throughout. Blue and red are never used for
 * chrome, only for alignment, which is what makes them land when they appear.
 */
export function Button({
  variant = 'quiet',
  live = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-(--radius-surface) px-5 text-[15px] transition-colors disabled:opacity-40 disabled:pointer-events-none'
  const height = live ? 'min-h-(--tap-live)' : 'min-h-(--tap-min)'
  const look = {
    // Brass as a lit edge and a tint, not a slab. A full-width solid gold fill
    // is the single most reliable way to make a dark theme look cheap.
    primary:
      'border border-(--color-brass-400) bg-[color-mix(in_oklab,var(--color-brass-400)_14%,transparent)] text-(--color-brass-300) font-medium active:bg-[color-mix(in_oklab,var(--color-brass-400)_22%,transparent)]',
    quiet:
      'border border-(--hairline) text-(--text) hover:border-(--color-ink-500) active:bg-(--surface-raised)',
    // Destructive actions are styled as secondary, never as the loud option.
    danger: 'border border-(--hairline) text-(--color-evil-300) hover:border-(--color-evil-500)',
  }[variant]

  return (
    <button className={`${base} ${height} ${look} ${className}`} {...rest}>
      {children}
    </button>
  )
}

export function Chip({
  children,
  active = false,
  kind,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean
  kind?: string
  children: ReactNode
}) {
  return (
    <button
      data-kind={kind}
      aria-pressed={active}
      className={`min-h-9 rounded-full border px-3 text-[13px] transition-colors ${
        active
          ? 'border-(--color-brass-400) bg-[color-mix(in_oklab,var(--color-brass-400)_16%,transparent)] text-(--color-brass-300)'
          : 'border-(--hairline) text-(--text-dim)'
      }`}
      {...rest}
    >
      {children}
    </button>
  )
}

/** A quiet section label. Sentence-case, never a shouty header. */
export function Label({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 text-[12px] uppercase tracking-[0.14em] text-(--text-faint)">
      {children}
    </div>
  )
}

/** Ability and rules text, set in the serif so it reads like a page. */
export function AbilityText({ children }: { children: ReactNode }) {
  return <p className="serif m-0 text-[16px] leading-snug text-(--text-dim)">{children}</p>
}
