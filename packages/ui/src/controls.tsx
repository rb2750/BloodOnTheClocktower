import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /**
   * `primary` is the one filled control on a screen: cream with dark text, a
   * printed label. `quiet` is a hairline. `text` has no border at all.
   * `danger` is red text and never a red fill: destructive actions are
   * styled as secondary, never as the loud option.
   */
  variant?: 'primary' | 'quiet' | 'text' | 'danger'
  /** Live night controls get the taller target. */
  live?: boolean
  children: ReactNode
}

export function Button({
  variant = 'quiet',
  live = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-(--radius-surface) px-5 text-[15px] font-medium transition-colors disabled:opacity-35 disabled:pointer-events-none'
  const height = live ? 'min-h-(--tap-live)' : 'min-h-(--tap-min)'
  const look = {
    primary: 'border border-(--accent) bg-(--accent) text-(--bg) active:opacity-85',
    quiet: 'border border-(--hairline-strong) text-(--text) active:bg-(--surface-raised)',
    text: 'border border-transparent text-(--text-dim) active:bg-(--surface-raised)',
    danger: 'border border-(--hairline-strong) text-(--color-red-2) active:bg-(--surface-raised)',
  }[variant]

  return (
    <button className={`${base} ${height} ${look} ${className}`} {...rest}>
      {children}
    </button>
  )
}

/** A toggle in a row of toggles: quick marks, voters, options. */
export function Chip({
  children,
  active = false,
  kind,
  className = '',
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
      className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-colors disabled:opacity-30 ${
        active
          ? 'border-(--accent) bg-(--accent) text-(--bg)'
          : 'border-(--hairline-strong) text-(--text-dim)'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

/** A section label: Franklin caps, small and quiet. */
export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`caps mb-2 text-(--text-faint) ${className}`}>{children}</div>
}

/** Ability and rules text, set in the serif so it reads like a page. */
export function AbilityText({ children }: { children: ReactNode }) {
  return <p className="serif m-0 text-[16px] leading-snug text-(--text-dim)">{children}</p>
}

/**
 * A list where rows are separated by rules rather than wrapped in boxes.
 * A border is spent only on an input, a button and a sheet.
 */
export function Rows({ children, className = '', ...rest }: HTMLAttributes<HTMLUListElement>) {
  return (
    <ul className={`m-0 list-none border-t border-(--hairline) p-0 ${className}`} {...rest}>
      {children}
    </ul>
  )
}

type RowProps = {
  leading?: ReactNode
  children: ReactNode
  /** Small text on the right: a count, a status, a hint. */
  trailing?: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

export function Row({ leading, children, trailing, onClick, disabled, className = '', ...rest }: RowProps) {
  const inner = (
    <>
      {leading && <span className="flex shrink-0 items-center text-(--text-dim)">{leading}</span>}
      <span className="min-w-0 flex-1 text-left text-[15px]">{children}</span>
      {trailing && (
        <span className="caps shrink-0 text-(--text-faint) normal-case tracking-normal">{trailing}</span>
      )}
    </>
  )
  const cls = `flex min-h-(--tap-min) w-full items-center gap-3 border-b border-(--hairline) py-2 ${className}`
  return (
    <li className="m-0 p-0">
      {onClick ? (
        <button
          onClick={onClick}
          disabled={disabled}
          className={`${cls} text-left active:bg-(--surface-raised) disabled:opacity-35`}
          {...rest}
        >
          {inner}
        </button>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </li>
  )
}

/** A flat switch. */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
        checked ? 'border-(--accent) bg-(--accent)' : 'border-(--hairline-strong)'
      }`}
    >
      <span
        className={`absolute top-1/2 block size-5 -translate-y-1/2 rounded-full transition-transform ${
          checked ? 'translate-x-6 bg-(--bg)' : 'translate-x-1 bg-(--hairline-strong)'
        }`}
      />
    </button>
  )
}

/** Text input, the one place a hairline box is still the right shape. */
export const inputClass =
  'min-h-(--tap-min) w-full rounded-(--radius-surface) border border-(--hairline-strong) bg-(--bg) px-4 text-[16px] text-(--text) outline-none placeholder:text-(--text-faint) focus:border-(--accent)'
