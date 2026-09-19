import { registerSW } from 'virtual:pwa-register'
import { toast } from 'sonner'

/**
 * Registers the service worker, which is what actually makes the app work with
 * no network.
 *
 * Registration is done here by hand rather than injected, because the app must
 * never reload itself. A Storyteller three nights into a game does not want the
 * page to disappear because a new version shipped, so an update waits behind a
 * toast until they choose the moment.
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
  })
}
