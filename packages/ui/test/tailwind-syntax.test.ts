import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { globSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '../../..')

/**
 * Tailwind v3 let you write `bg-[--my-var]` as shorthand for `var(--my-var)`.
 * Tailwind v4 removed it in favour of `bg-(--my-var)`, and the old form still
 * compiles — to `background-color: --my-var`, which is invalid CSS and simply
 * does nothing.
 *
 * That is a nasty failure mode: no build error, no console warning, the element
 * just silently inherits its colour. It cost a full round of screenshots to
 * spot, so it is asserted here.
 */
describe('Tailwind v4 syntax', () => {
  const files = globSync('{apps,packages}/*/src/**/*.tsx', { cwd: ROOT })

  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it('never uses the removed v3 CSS-variable shorthand', () => {
    const offenders: string[] = []
    for (const file of files) {
      const source = readFileSync(join(ROOT, file), 'utf8')
      for (const [i, line] of source.split('\n').entries()) {
        // Matches `text-[--foo]` but not `text-[12px]` or `w-[calc(...)]`.
        if (/-\[--[a-zA-Z]/.test(line)) {
          offenders.push(`${file}:${i + 1}  ${line.trim().slice(0, 100)}`)
        }
      }
    }
    expect(offenders, `use -(--var) instead of -[--var]:\n${offenders.join('\n')}`).toEqual([])
  })
})
