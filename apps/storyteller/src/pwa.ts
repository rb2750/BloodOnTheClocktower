import { registerSW } from 'virtual:pwa-register'
import { toast } from 'sonner'

const CHECK_EVERY_MS = 15 * 60 * 1000

/**
 * Registers the service worker, which is what actually makes the app work with
 * no network.
 *
 * The app must never reload itself: a Storyteller three nights into a game
 * does not want the page to disappear because a new version shipped. So the
 * worker is registered in `prompt` mode, a new version waits behind a toast
 * until they choose the moment, and the app asks for updates on its own
 * schedule rather than only at launch, since an installed app can stay open
 * for days.
 */
export function setUpServiceWorker() {
  const update = registerSW({
    onNeedRefresh() {
      toast('A new version is ready.', {
        duration: Infinity,
        action: { label: 'Reload', onClick: () => void update(true) },
      })
    },
    onOfflineReady() {
      // Nothing to say. Working offline is the expected state, not an event.
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        if (navigator.onLine) void registration.update()
      }
      window.setInterval(check, CHECK_EVERY_MS)
      // Coming back to the app is the most likely moment a new version exists.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })
}
