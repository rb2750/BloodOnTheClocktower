import { PROVENANCE } from '@botc/rules'
import { Label } from '@botc/ui'
import { useStore } from '../state/store.js'
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
    <Screen title="Settings" onBack={() => go('plan')}>
      <section className="pb-8">
        <Label>Running a game</Label>
        <ul className="space-y-2">
          {TOGGLES.map((t) => (
            <li
              key={t.key}
              className="flex items-start gap-3 rounded-(--radius-surface) border border-(--hairline) p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[15px]">{t.label}</div>
                <p className="mt-0.5 text-[13px] leading-snug text-(--text-faint)">{t.hint}</p>
              </div>
              <button
                role="switch"
                aria-checked={settings[t.key]}
                aria-label={t.label}
                onClick={() => setSetting(t.key, !settings[t.key])}
                className={`mt-0.5 h-7 w-12 shrink-0 rounded-full border transition-colors ${
                  settings[t.key]
                    ? 'border-(--color-brass-400) bg-[color-mix(in_oklab,var(--color-brass-400)_28%,transparent)]'
                    : 'border-(--hairline)'
                }`}
              >
                <span
                  className={`block size-5 rounded-full transition-transform ${
                    settings[t.key]
                      ? 'translate-x-6 bg-(--color-brass-300)'
                      : 'translate-x-1 bg-(--color-ink-500)'
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <Label>Your games</Label>
          <button
            onClick={() => go('history')}
            className="flex min-h-(--tap-min) w-full items-center justify-between rounded-(--radius-surface) border border-(--hairline) px-4"
          >
            <span className="text-[15px]">Past games</span>
            <span className="tabular text-[13px] text-(--text-faint)">{history.length}</span>
          </button>
        </div>

        <div className="mt-8 border-t border-(--hairline) pt-5">
          <p className="serif text-[14px] leading-snug text-(--text-faint)">
            Blood on the Clocktower is a trademark of Steven Medway and The Pandemonium
            Institute. This app is unofficial, free and not affiliated with them. Character
            text and art are used non-commercially under their Community Created Content
            Policy.
          </p>
          <p className="mt-2 text-[12px] text-(--text-faint)">
            Game data from {new Date(PROVENANCE.fetchedAt).toLocaleDateString()} ·{' '}
            {PROVENANCE.counts.characters} characters
          </p>
        </div>
      </section>
    </Screen>
  )
}
