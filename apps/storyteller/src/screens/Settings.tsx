import { PROVENANCE } from '@botc/rules'
import { Label, Rows, Row, Switch } from '@botc/ui'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useStore } from '../state/store.js'
import { hostKey } from '../state/sync.js'
import { Screen } from '../components/Screen.js'
import type { Screen as ScreenName } from '../App.js'

const TOGGLES = [
  {
    key: 'cinematics',
    label: 'Phase cinematics',
    hint: 'The full transition when night falls and day breaks. Always skippable with a tap.',
  },
  {
    key: 'sound',
    label: 'Sound at nightfall',
    hint: 'One quiet tone as night begins. Off by default, because a chime from your phone tells players something.',
  },
  {
    key: 'dim',
    label: 'Extra dim',
    hint: 'Softer text for very dark rooms.',
  },
  {
    key: 'showFlavour',
    label: 'Suggested wording',
    hint: 'Lines to read aloud during the day. Turn off for mechanics only.',
  },
  {
    key: 'keepAwake',
    label: 'Keep the screen on',
    hint: 'Holds a wake lock while a game is running.',
  },
] as const

export function SettingsScreen({ go }: { go: (s: ScreenName) => void }) {
  const settings = useStore((s) => s.settings)
  const setSetting = useStore((s) => s.setSetting)
  const history = useStore((s) => s.history)

  return (
    <Screen title="Settings" onBack={() => go('home')}>
      <section className="pb-8">
        <Label>Running a game</Label>
        <ul className="m-0 list-none border-t border-(--hairline) p-0">
          {TOGGLES.map((t) => (
            <li key={t.key} className="flex items-start gap-4 border-b border-(--hairline) py-3">
              <div className="min-w-0 flex-1">
                <div className="text-[15px]">{t.label}</div>
                <p className="serif mt-0.5 text-[14px] leading-snug text-(--text-faint)">{t.hint}</p>
              </div>
              <Switch
                checked={settings[t.key]}
                onChange={(v) => setSetting(t.key, v)}
                label={t.label}
              />
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <Label>Your games</Label>
          <Rows>
            <Row trailing={String(history.length)} onClick={() => go('history')}>
              Past games
            </Row>
            <OtherDevice />
          </Rows>
        </div>

        <div className="mt-8 border-t border-(--hairline) pt-5">
          <p className="serif text-[14px] leading-snug text-(--text-faint)">
            Blood on the Clocktower is a trademark of Steven Medway and The Pandemonium
            Institute. This app is unofficial, free and not affiliated with them. Character
            text and art are used non-commercially under their Community Created Content
            Policy.
          </p>
          <p className="caps mt-3 text-(--text-faint)">
            Game data from {new Date(PROVENANCE.fetchedAt).toLocaleDateString()} ·{' '}
            {PROVENANCE.counts.characters} characters
          </p>
        </div>
      </section>
    </Screen>
  )
}

/**
 * The game is kept on the server under this phone's key. The link carries the
 * key, so opening it on a laptop or a second phone opens the same game. Anyone
 * with the link can see every character, so it is copied, never shown.
 */
function OtherDevice() {
  const [key, setKey] = useState<string | null>(null)
  useEffect(() => void hostKey().then(setKey), [])
  if (!key) return null
  const link = `${window.location.origin}/#host=${key}`
  return (
    <Row
      trailing="copy link"
      onClick={() => {
        void navigator.clipboard?.writeText(link).then(
          () => toast('Link copied. Open it on the other device. Keep it private: it shows every character.'),
          () => toast.error('Could not copy the link.'),
        )
      }}
    >
      Open this game on another device
    </Row>
  )
}
