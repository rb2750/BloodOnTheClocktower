import { useState } from 'react'
import { getCharacter, teamAlignment, type Character } from '@botc/rules'
import { Button, Chip, Label, Sheet, Switch, inputClass } from '@botc/ui'
import { toast } from 'sonner'
import { useStore } from '../state/store.js'
import { useRoom } from '../room.js'
import { CharacterToken } from './CharacterToken.js'

/**
 * A private word.
 *
 * Almost everything a Storyteller tells one player is the same three
 * ingredients: a player, a character, a number. Typing those at one in the
 * morning, in the dark, with a table waiting, is the thing to avoid, so they
 * are taps that build the sentence, and the keyboard is there for the rest.
 *
 * Whether it was true is recorded but never sent. A Storyteller who gives false
 * information wants to remember that they did; the player must not find out.
 */
type Part = 'player' | 'character' | 'number' | null

export function WhisperSheet({ seatId, onClose }: { seatId: string | null; onClose: () => void }) {
  const game = useStore((s) => s.game)
  const log = useStore((s) => s.log)
  const { whisper, reachable, status } = useRoom()

  const [text, setText] = useState('')
  const [part, setPart] = useState<Part>(null)
  const [truthful, setTruthful] = useState(true)
  const [sending, setSending] = useState(false)

  const seat = game?.seats.find((s) => s.id === seatId)
  if (!game || !seat) return null

  const here = reachable.includes(seat.id)
  const characters = (game.script.characterIds ?? [])
    .map((id) => getCharacter(id))
    .filter((c): c is Character => Boolean(c))

  const add = (word: string) => {
    setText((t) => (t ? `${t.replace(/\s+$/, '')} ${word}` : word))
    setPart(null)
  }

  const send = async () => {
    const line = text.trim()
    if (!line) return
    setSending(true)
    const sent = await whisper(seat.id, line)
    setSending(false)
    if (!sent) {
      toast.error(`${seat.name}'s phone is not connected.`)
      return
    }
    log('info', `Told ${seat.name}: ${line}`, [seat.id], {
      toSeatId: seat.id,
      given: line,
      truthful,
    })
    setText('')
    setTruthful(true)
    onClose()
  }

  return (
    <Sheet
      open={Boolean(seatId)}
      onOpenChange={(o) => !o && onClose()}
      title={`Tell ${seat.name}`}
      subtitle={
        here
          ? 'Only their phone can read it. It stays covered until they hold it.'
          : status === 'open'
            ? 'Their phone has not joined the room, so there is nowhere to send this yet.'
            : 'Not connected to the room.'
      }
    >
      <div className="space-y-5 pb-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="You learn that…"
          className={`${inputClass} w-full resize-none`}
        />

        <div>
          <Label>Build it without typing</Label>
          <div className="flex flex-wrap gap-2">
            <Chip active={part === 'player'} onClick={() => setPart(part === 'player' ? null : 'player')}>
              A player
            </Chip>
            <Chip
              active={part === 'character'}
              onClick={() => setPart(part === 'character' ? null : 'character')}
            >
              A character
            </Chip>
            <Chip active={part === 'number'} onClick={() => setPart(part === 'number' ? null : 'number')}>
              A number
            </Chip>
          </div>

          {part === 'player' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {game.seats.map((s) => (
                <Chip key={s.id} onClick={() => add(s.name)}>
                  {s.name}
                </Chip>
              ))}
            </div>
          )}

          {part === 'number' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <Chip key={n} onClick={() => add(String(n))}>
                  {n}
                </Chip>
              ))}
            </div>
          )}

          {part === 'character' && (
            <div className="mt-3 grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5">
              {characters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => add(c.name)}
                  className="flex flex-col items-center gap-1"
                >
                  <CharacterToken
                    character={c}
                    size="44px"
                    alignment={teamAlignment(c.team) === 'evil' ? 'evil' : 'good'}
                  />
                  <span className="text-center text-[10px] leading-tight text-(--text-faint)">
                    {c.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <Switch
          checked={truthful}
          onChange={setTruthful}
          label={truthful ? 'This is true' : 'This is a lie, and only the log will know'}
        />

        <Button className="w-full" variant="primary" disabled={!text.trim() || sending} onClick={send}>
          {sending ? 'Sending…' : `Send it to ${seat.name}`}
        </Button>
      </div>
    </Sheet>
  )
}
