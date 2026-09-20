import { useState } from 'react'
import {
  getCharacter,
  infoPhrase,
  infoShape,
  teamAlignment,
  type Character,
  type InfoParts,
} from '@botc/rules'
import { Button, Chip, Label, Sheet, Switch, haptic, inputClass } from '@botc/ui'
import { toast } from 'sonner'
import { useStore } from '../state/store.js'
import { useRoom } from '../room.js'
import { CharacterToken } from './CharacterToken.js'
import { suggestion } from '../truth.js'

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

export function WhisperSheet({
  seatId,
  characterId,
  onClose,
}: {
  seatId: string | null
  /** The character being woken, when this was opened from a night step. */
  characterId?: string
  onClose: () => void
}) {
  const game = useStore((s) => s.game)
  const log = useStore((s) => s.log)
  const { whisper, reachable, status } = useRoom()

  const [text, setText] = useState('')
  const [part, setPart] = useState<Part>(null)
  const [parts, setParts] = useState<InfoParts>({})
  const [free, setFree] = useState(false)
  const [truthful, setTruthful] = useState<boolean | null>(null)
  const [sending, setSending] = useState(false)

  const seat = game?.seats.find((s) => s.id === seatId)
  if (!game || !seat) return null

  const here = reachable.includes(seat.id)
  const characters = (game.script.characterIds ?? [])
    .map((id) => getCharacter(id))
    .filter((c): c is Character => Boolean(c))

  // The character being woken decides whether there is a template at all.
  const woken = characterId ? getCharacter(characterId) : undefined
  const shape = woken ? infoShape(woken) : { kind: 'none' as const }
  const truth = woken && shape.kind !== 'none' ? suggestion(game, woken.id, seat.id) : null
  const templated = shape.kind !== 'none' && !free
  const sentence = woken ? infoPhrase(woken.id, parts) : ''
  const matchesTruth =
    !truth ||
    ((truth.number === undefined || truth.number === parts.number) &&
      (truth.character === undefined || truth.character === parts.character) &&
      (truth.players === undefined || truth.players.join() === (parts.players ?? []).join()))
  const honest = truthful ?? matchesTruth
  const ready = templated ? sentence.length > 0 && !sentence.includes('…') : text.trim().length > 0

  const add = (word: string) => {
    setText((t) => (t ? `${t.replace(/\s+$/, '')} ${word}` : word))
    setPart(null)
  }

  const send = async () => {
    const line = templated ? sentence : text.trim()
    if (!line) return
    setSending(true)
    haptic('confirm')
    const id = Math.random().toString(36).slice(2, 10)
    const sent = await whisper(seat.id, line, id)
    setSending(false)
    if (!sent) {
      toast.error(`${seat.name}'s phone is not connected.`)
      return
    }
    log('info', `Told ${seat.name}: ${line}`, [seat.id], {
      toSeatId: seat.id,
      given: line,
      truthful: honest,
      id,
    })
    setText('')
    setParts({})
    setTruthful(null)
    setFree(false)
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
        {templated ? (
          <>
            {truth && (
              <button
                onClick={() =>
                  setParts({
                    number: truth.number,
                    players: truth.players,
                    character: truth.character,
                  })
                }
                className="w-full rounded-xl border border-(--hairline-strong) px-4 py-3 text-left"
              >
                <span className="caps block text-(--text-faint)">The grimoire says</span>
                <span className="serif mt-1 block text-[16px] leading-snug text-(--text)">
                  {infoPhrase(woken!.id, {
                    number: truth.number,
                    players: truth.players,
                    character: truth.character,
                  })}
                </span>
                <span className="mt-1 block text-[12px] text-(--text-faint)">
                  {truth.because} Tap to use it.
                </span>
              </button>
            )}

            {shape.kind === 'number' && (
              <div>
                <Label>How many</Label>
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <Chip
                      key={n}
                      active={parts.number === n}
                      onClick={() => setParts((p) => ({ ...p, number: n }))}
                    >
                      {n}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {shape.kind === 'yesNo' && (
              <div>
                <Label>Which is it</Label>
                <div className="flex gap-2">
                  <Chip active={parts.yes === true} onClick={() => setParts((p) => ({ ...p, yes: true }))}>
                    Yes
                  </Chip>
                  <Chip active={parts.yes === false} onClick={() => setParts((p) => ({ ...p, yes: false }))}>
                    No
                  </Chip>
                </div>
              </div>
            )}

            {(shape.kind === 'pair' || shape.kind === 'character') && (
              <>
                <div>
                  <Label>{shape.kind === 'pair' ? 'Which two players' : 'Which player'}</Label>
                  <div className="flex flex-wrap gap-2">
                    {game.seats.map((s) => {
                      const picked = (parts.players ?? []).includes(s.name)
                      const limit = shape.kind === 'pair' ? 2 : 1
                      return (
                        <Chip
                          key={s.id}
                          active={picked}
                          onClick={() =>
                            setParts((p) => {
                              const chosen = p.players ?? []
                              if (chosen.includes(s.name)) {
                                return { ...p, players: chosen.filter((n) => n !== s.name) }
                              }
                              return { ...p, players: [...chosen, s.name].slice(-limit) }
                            })
                          }
                        >
                          {s.name}
                        </Chip>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <Label>Which character</Label>
                  <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5">
                    {characters
                      .filter((c) => (shape.kind === 'pair' ? c.team === shape.team : true))
                      .map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setParts((p) => ({ ...p, character: c.name }))}
                          aria-pressed={parts.character === c.name}
                          className={`flex flex-col items-center gap-1 rounded-xl py-1.5 ${
                            parts.character === c.name ? 'bg-(--surface-raised)' : ''
                          }`}
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
                </div>
              </>
            )}

            <div>
              <Label>They will read</Label>
              <p className="serif text-[16px] leading-snug text-(--text)">
                {sentence || 'Nothing yet.'}
              </p>
            </div>

            <button
              onClick={() => {
                setFree(true)
                setText(sentence.includes('…') ? '' : sentence)
              }}
              className="caps min-h-(--tap-min) text-[11px] text-(--text-faint)"
            >
              Say it another way
            </button>
          </>
        ) : (
          <>
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
          </>
        )}

        <Switch
          checked={honest}
          onChange={setTruthful}
          label={honest ? 'This is true' : 'This is a lie, and only the log will know'}
        />

        <Button className="w-full" variant="primary" disabled={!ready || sending} onClick={send}>
          {sending ? 'Sending…' : `Send it to ${seat.name}`}
        </Button>
      </div>
    </Sheet>
  )
}
