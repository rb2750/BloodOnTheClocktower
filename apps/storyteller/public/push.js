// Runs inside the service worker. A notification carries no game content: it
// names the kind of thing that happened, and the app has the rest, sealed.
const LINES = {
  hand: 'A hand went up.',
  seat: 'Someone sat down.',
  chat: 'Two players are talking.',
}

self.addEventListener('push', (event) => {
  let kind = ''
  try {
    kind = event.data ? event.data.json().kind : ''
  } catch {}
  event.waitUntil(
    self.registration.showNotification('Grimoire', {
      body: LINES[kind] || 'Look at your phone.',
      tag: 'botc-' + kind,
      renotify: true,
      vibrate: [80, 60, 80],
      icon: './icon-192.png',
      badge: './icon-192.png',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => 'focus' in c)
      return open ? open.focus() : self.clients.openWindow('./')
    }),
  )
})
