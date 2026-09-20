import { useCallback, useEffect, useRef, useState } from 'react'
import { haptic } from '@botc/ui'

const HOLD_MS = 220
const SLOP = 8

/**
 * Move a player to another chair by dragging their token around the ring.
 *
 * Press and hold a seat, then drag: the token follows the finger and the
 * other seats shuffle out of the way as the finger crosses each chair, so
 * the result is visible before letting go. The chair a finger is over is
 * found from its angle around the centre of the ring, which is the same
 * trigonometry that lays the seats out.
 */
export function useRingDrag({
  order,
  disabled,
  onMove,
}: {
  order: string[]
  disabled: boolean
  onMove: (seatId: string, toIndex: number) => void
}) {
  const [dragging, setDragging] = useState<string | null>(null)
  const [preview, setPreview] = useState<string[] | null>(null)
  const timer = useRef<number | null>(null)
  const start = useRef<{
    x: number
    y: number
    id: string
    li: HTMLLIElement
    /** Where in the token the finger landed, so it does not jump on pickup. */
    grabX: number
    grabY: number
    /** The ring's centre, measured once: it cannot move mid-drag. */
    cx: number
    cy: number
  } | null>(null)
  const justDragged = useRef(false)
  const orderRef = useRef(order)
  orderRef.current = order

  const clear = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    if (start.current) start.current.li.style.translate = ''
    start.current = null
    setDragging(null)
    setPreview(null)
  }, [])

  useEffect(() => clear, [clear])

  const slotAt = (clientX: number, clientY: number) => {
    const s = start.current
    if (!s) return null
    const dx = clientX - s.cx
    const dy = clientY - s.cy
    // Seat 0 is at the top and angles run clockwise, matching the CSS.
    let turn = Math.atan2(dy, dx) / (Math.PI * 2) + 0.25
    turn = ((turn % 1) + 1) % 1
    const n = orderRef.current.length
    return Math.round(turn * n) % n
  }

  const onPointerDown = useCallback(
    (index: number, e: React.PointerEvent<HTMLLIElement>) => {
      if (disabled || e.button !== 0) return
      const id = orderRef.current[index]
      if (!id) return
      const li = e.currentTarget
      const seat = li.getBoundingClientRect()
      const ring = li.closest('.circle')?.getBoundingClientRect()
      start.current = {
        x: e.clientX,
        y: e.clientY,
        id,
        li,
        grabX: e.clientX - (seat.left + seat.width / 2),
        grabY: e.clientY - (seat.top + seat.height / 2),
        cx: ring ? ring.left + ring.width / 2 : 0,
        cy: ring ? ring.top + ring.height / 2 : 0,
      }
      // Owning the pointer from the first touch, not from the end of the hold:
      // by then the browser may already have taken the gesture for itself.
      try {
        li.setPointerCapture(e.pointerId)
      } catch {
        /* the pointer may already be gone; the window listeners still work */
      }
      timer.current = window.setTimeout(() => {
        // Held still long enough: this is a drag, not a tap.
        setDragging(id)
        setPreview(orderRef.current)
        haptic('pick')
      }, HOLD_MS)
    },
    [disabled],
  )

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const s = start.current
      if (!s) return
      if (dragging === null) {
        // Moving before the hold completes is a scroll or a mis-tap, not a drag.
        if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > SLOP) clear()
        return
      }
      e.preventDefault()
      // Placed from the ring's centre to the finger, never as an offset from
      // where the drag began. The old way added the finger's travel to the
      // seat's own chair position, and that position changes the moment the
      // other seats shuffle: the token teleported instead of following.
      s.li.style.translate = `calc(-50% + ${e.clientX - s.grabX - s.cx}px) calc(-50% + ${e.clientY - s.grabY - s.cy}px)`
      const slot = slotAt(e.clientX, e.clientY)
      if (slot === null) return
      setPreview((p) => {
        const base = p ?? orderRef.current
        const from = base.indexOf(s.id)
        if (from === slot) return p
        const next = [...base]
        next.splice(from, 1)
        next.splice(slot, 0, s.id)
        // One tick per chair crossed, the way a picker clicks past its stops.
        haptic('tick')
        return next
      })
    }
    const up = () => {
      const s = start.current
      if (s && dragging !== null && preview) {
        const to = preview.indexOf(s.id)
        const from = orderRef.current.indexOf(s.id)
        justDragged.current = true
        if (to !== from) {
          haptic('drop')
          onMove(s.id, to)
        }
      }
      clear()
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [dragging, preview, clear, onMove])

  /** True once, right after a drag, so the click that follows is ignored. */
  const consumeDrag = () => {
    const was = justDragged.current
    justDragged.current = false
    return was
  }

  return { order: preview ?? order, dragging, onPointerDown, consumeDrag }
}
