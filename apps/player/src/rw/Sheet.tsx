import { useEffect, useRef, type ReactNode } from 'react'

/**
 * A sheet that rises over the page. The scrim, the grab bar and the phone's
 * back gesture all close it.
 *
 * It owns exactly one history entry while it is open, and gives it back when
 * it closes by any other route, so the back gesture never lands on a sheet
 * that is no longer there.
 */
export function RwSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    if (!open) return
    const id = Math.random().toString(36).slice(2)
    history.pushState({ ...(history.state ?? {}), sheet: id }, '')
    let popped = false
    const onPop = () => {
      if (history.state?.sheet === id) return
      popped = true
      close.current()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      if (!popped && history.state?.sheet === id) history.back()
    }
  }, [open])
  if (!open) return null
  return (
    <>
      <div className="rw-scrim" onClick={() => history.back()} />
      <div className="rw-sheet" role="dialog" aria-modal="true">
        <button className="rw-grab" onClick={() => history.back()} aria-label="Close" />
        <div className="rw-sheet-body">{children}</div>
      </div>
    </>
  )
}
