import { useEffect, useRef, useState } from 'react'
import { getCharacter } from '@botc/rules'
import { Button, ChevronLeft, inputClass } from '@botc/ui'
import { useStore } from '../state.js'
import { useRelay } from '../room.js'

/**
 * A private conversation with one other player.
 *
 * Their lines on the left, yours on the right in brass, days stamped between
 * the groups and never clock times. At night the box goes: everyone is asleep.
 * The one line at the top says the only thing that matters about it.
 */
export function ThreadScreen({ seatId, onBack }: { seatId: string; onBack: () => void }) {
  const chat = useStore((s) => s.chats[seatId])
  const person = useStore((s) => s.table.find((t) => t.id === seatId))
  const notes = useStore((s) => s.notes)
  const phase = useStore((s) => s.phase)
  const readChat = useStore((s) => s.readChat)
  const { chat: send, status } = useRelay()
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  const name = person?.name ?? '…'
  const night = /^night/i.test(phase)
  const claim = notes[name]?.claims.at(-1)
  const says = claim ? getCharacter(claim.characterId)?.name : undefined
  const lines = chat?.lines ?? []

  useEffect(() => {
    readChat(seatId)
    end.current?.scrollIntoView({ block: 'end' })
  }, [seatId, lines.length, readChat])

  const submit = async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    const ok = await send(seatId, text)
    setSending(false)
    if (ok) setDraft('')
  }

  let lastDay = ''
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center border-b border-(--hairline) bg-(--surface) px-2">
        <button onClick={onBack} className="flex min-h-(--tap-min) items-center gap-1 px-3 text-[16px] text-(--text)">
          <ChevronLeft size={20} strokeWidth={1.75} />
          Back
        </button>
        <span className="display flex-1 text-center text-[19px] text-(--text)">{name}</span>
        <span className="caps min-w-[5ch] px-3 text-right text-(--text-faint)">{says ? `says ${says}` : ''}</span>
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <p className="serif mb-4 text-center text-[13px] leading-snug text-(--text-faint)">
          Only you and {name} can read this. Not the table, not the Storyteller.
        </p>
        {lines.map((l) => {
          const stamp = l.at !== lastDay ? l.at : null
          lastDay = l.at
          return (
            <div key={l.id}>
              {stamp && <p className="caps my-3 text-center text-(--text-faint)">{stamp}</p>}
              <div className={`mb-2 flex ${l.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                <p
                  className={`serif max-w-[78%] rounded-2xl px-4 py-2.5 text-[16px] leading-snug ${
                    l.from === 'me'
                      ? 'rounded-br-md bg-(--accent) text-(--bg)'
                      : 'rounded-bl-md border border-(--hairline-strong) bg-(--surface) text-(--text)'
                  }`}
                >
                  {l.text}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={end} />
      </main>

      <div
        className="shrink-0 border-t border-(--hairline) bg-(--surface) px-4 pt-3"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
      >
        {night ? (
          <p className="serif py-2 text-center text-[15px] text-(--text-faint)">
            It is night. Everyone is asleep, and so is this.
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
            className="flex items-end gap-2"
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void submit()
                }
              }}
              rows={1}
              placeholder={`Say something to ${name}`}
              className={`${inputClass} flex-1 resize-none`}
            />
            <Button type="submit" variant="primary" disabled={!draft.trim() || sending || status !== 'open'}>
              Send
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
