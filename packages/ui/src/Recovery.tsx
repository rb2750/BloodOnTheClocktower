import { Component, type ErrorInfo, type ReactNode } from 'react'

const TRIED = 'botc-recovered'

/**
 * The last line of defence against a broken build.
 *
 * A crash leaves an empty screen, and an app served by a service worker keeps
 * being served by it, so a cached build that crashes on boot can never show its
 * own update prompt: the only ways out are closing every window or clearing the
 * site's data, neither of which a Storyteller should have to know. So a crash
 * drops the worker and reloads once, which lands on whatever the server has.
 * Once per session, because a crash that survives that is not a stale build and
 * reloading again would only loop.
 */
export class Recovery extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('The app crashed.', error, info.componentStack)
    if (sessionStorage.getItem(TRIED)) return
    sessionStorage.setItem(TRIED, '1')
    void reset()
  }

  render() {
    if (!this.state.crashed) return this.props.children
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="display text-[22px] text-(--text)">Something went wrong</p>
        <p className="text-[15px] text-(--muted)">
          Your game is saved. Starting the app again is usually enough.
        </p>
        <button
          className="rounded-full border border-(--line) px-5 py-2 text-[15px] text-(--text)"
          onClick={() => void reset()}
        >
          Start again
        </button>
      </div>
    )
  }
}

/** Drops the worker serving this build, then comes back on the server's. */
async function reset() {
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations()
    await Promise.all((registrations ?? []).map((r) => r.unregister()))
  } catch {
    // Nothing to drop, or no worker at all. Reloading is still worth a try.
  }
  window.location.reload()
}
