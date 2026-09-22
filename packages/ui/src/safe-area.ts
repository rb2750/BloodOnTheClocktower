/**
 * Room for the phone's own bars, even when the phone won't say how much.
 *
 * Installed web apps on recent Android draw edge to edge, under the status
 * bar and the gesture bar, and some versions report the space those bars
 * take as zero. Every header then sits behind the clock. When the page fills
 * the whole screen and the reported inset is zero, this assumes the usual
 * bar sizes instead. Everything that avoids the bars reads --safe-top and
 * --safe-bottom, never env() directly.
 */
export function watchSafeArea() {
  const root = document.documentElement
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none'
  document.body.appendChild(probe)
  const check = () => {
    const installed =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    const reportedTop = probe.getBoundingClientRect().height
    const reportedBottom = parseFloat(getComputedStyle(probe).paddingBottom) || 0
    const fillsScreen = window.innerHeight >= window.screen.height - 2
    const android = /Android/i.test(navigator.userAgent)
    const guess = installed && android && fillsScreen
    root.style.setProperty('--safe-top', reportedTop > 0 || !guess ? `${reportedTop}px` : '32px')
    root.style.setProperty('--safe-bottom', reportedBottom > 0 || !guess ? `${reportedBottom}px` : '20px')
  }
  check()
  window.addEventListener('resize', check)
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change', check)
}
