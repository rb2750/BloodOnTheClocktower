import { useCallback, useRef, useState } from 'react'
import { haptic } from '@botc/ui'

/**
 * Reorder a vertical list by dragging a handle.
 *
 * The item follows the finger only in the sense that the list reorders live
 * underneath it: as the pointer crosses the midpoint of a neighbour, the two
 * swap. On release the order is whatever is on screen. Simple, and it works
 * with a thumb on a phone.
 */
export function useListDrag<T extends string>(items: T[], setItems: (next: T[]) => void) {
  const [dragging, setDragging] = useState<T | null>(null)
  const list = useRef<HTMLUListElement | null>(null)
  const current = useRef<T[]>(items)
  current.current = items

  const move = useCallback(
    (clientY: number) => {
      const el = list.current
      const item = dragging
      if (!el || item === null) return
      const rows = Array.from(el.children) as HTMLElement[]
      const from = current.current.indexOf(item)
      let to = from
      rows.forEach((row, i) => {
        const r = row.getBoundingClientRect()
        if (i < from && clientY < r.top + r.height / 2) to = Math.min(to, i)
        if (i > from && clientY > r.top + r.height / 2) to = Math.max(to, i)
      })
      if (to !== from) {
        const next = [...current.current]
        next.splice(from, 1)
        next.splice(to, 0, item)
        current.current = next
        haptic('tick')
        setItems(next)
      }
    },
    [dragging, setItems],
  )

  const start = useCallback((item: T, e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    setDragging(item)
    haptic('pick')
  }, [])

  const listProps = {
    ref: (el: HTMLUListElement | null) => {
      list.current = el
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (dragging !== null) move(e.clientY)
    },
    onPointerUp: () => setDragging(null),
    onPointerCancel: () => setDragging(null),
  }

  return { dragging, start, listProps }
}
