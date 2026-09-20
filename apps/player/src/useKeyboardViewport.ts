import { useEffect, useState } from 'react'

/**
 * The part of the screen the keyboard has not taken.
 *
 * iOS never shrinks the page for its keyboard. It slides the visual viewport
 * up and leaves anything pinned to the bottom of the page underneath the keys,
 * which is where a message box goes to die. The visual viewport reports the
 * truth, so the thread is sized to it and moved with it, and the page under it
 * is pinned so Safari cannot scroll it about on its own.
 */
export function useKeyboardViewport() {
  const read = () => {
    const vv = window.visualViewport
    return vv
      ? { height: Math.round(vv.height), top: Math.round(vv.offsetTop) }
      : { height: window.innerHeight, top: 0 }
  }
  const [box, setBox] = useState(read)

  useEffect(() => {
    const vv = window.visualViewport
    const update = () => setBox(read())
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    // Pin the page while a thread is open, so the keyboard cannot scroll it.
    const html = document.documentElement
    const was = { overflow: html.style.overflow, position: document.body.style.position, width: document.body.style.width }
    html.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.width = '100%'
    return () => {
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      html.style.overflow = was.overflow
      document.body.style.position = was.position
      document.body.style.width = was.width
    }
  }, [])

  return box
}
