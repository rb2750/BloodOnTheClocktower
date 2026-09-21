// Runs inside the service worker. A notification carries no game content: it
// names the kind of thing that happened, and the app has the rest, sealed.
const LINES = {
  word: 'The Storyteller has something for you.',
  role: 'Your character has changed.',
  vote: 'A vote is open.',
  closed: 'Hands down.',
  night: 'Night falls. Close your eyes.',
  day: 'Open your eyes.',
  chat: 'You have a message.',
  grimoire: 'The Storyteller is showing you the grimoire.',
  nudge: 'The Storyteller needs you. Look up.',
  floor: 'You have the floor. Speak.',
  nominations: 'Nominations are open.',
}

self.addEventListener('push', (event) => {
  let kind = ''
  try {
    kind = event.data ? event.data.json().kind : ''
  } catch {}
  event.waitUntil(
    self.registration.showNotification('Ravenswood', {
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
