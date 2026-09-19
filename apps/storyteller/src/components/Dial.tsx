import { useMemo } from 'react'
import { getCharacter } from '@botc/rules'
import { Token, Moon, Dawn } from '@botc/ui'
import { useStore, currentBlock } from '../state/store.js'
import { CharacterToken } from './CharacterToken.js'

/**
 * The centre of the ring.
 *
 * At night: who is awake, and how far through the night, as a flat arc. By
 * day: the running tally during a vote, or the player about to die. This is
 * the most valuable space on screen, so it carries the one thing the
 * Storyteller needs right now and nothing else.
 */
export function Dial() {
  const game = useStore((s) => s.game)
  const nightOrder = useStore((s) => s.nightOrder)
  const order = useMemo(
    () => (game?.phase.k === 'night' ? nightOrder() : []),
    [nightOrder, game],
  )
  const block = useMemo(() => currentBlock(game), [game])
  if (!game) return null

  if (game.phase.k === 'night') {
    const step = Math.min(game.phase.step, Math.max(order.length - 1, 0))
    const entry = order[step]
    const character = entry?.kind === 'character' ? getCharacter(entry.id) : undefined
    const fraction = order.length > 0 ? (step + 1) / order.length : 0
    return (
      <DialFrame fraction={fraction} caption={entry ? `${step + 1} of ${order.length}` : 'dawn'}>
        {character ? (
          <CharacterToken character={character} size="44px" />
        ) : (
          <Token name="" size="44px">
            <span className="text-(--color-ink-2)">
              {entry?.id === 'dawn' ? <Dawn size={22} /> : <Moon size={22} />}
            </span>
          </Token>
        )}
      </DialFrame>
    )
  }

  if (game.phase.k === 'day') {
    const open = game.nominations.find((n) => n.day === game.phase.n && !n.settled)
    if (open) {
      return (
        <DialFrame fraction={Math.min(1, open.tally / Math.max(open.majority, 1))} caption={`of ${open.majority} to die`} now>
          <span className="tabular display text-[34px] leading-none text-(--now)">{open.tally}</span>
        </DialFrame>
      )
    }
    const blockSeat = game.seats.find((s) => s.id === block.seatId)
    if (blockSeat) {
      const c = getCharacter(blockSeat.characterId ?? '')
      return (
        <DialFrame fraction={0} caption={`${blockSeat.name} · ${block.votes}`}>
          <CharacterToken character={c} size="44px" />
        </DialFrame>
      )
    }
    return (
      <DialFrame fraction={0} caption={block.tied ? 'tied' : 'no one'}>
        <span className="caps text-(--text-faint)">Day {game.phase.n}</span>
      </DialFrame>
    )
  }

  return null
}

function DialFrame({
  fraction,
  caption,
  now = false,
  children,
}: {
  fraction: number
  caption: string
  now?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className="dial"
      data-now={now || undefined}
      style={{ ['--fraction' as string]: fraction }}
      role="status"
      aria-label={caption}
    >
      <span className="dial-arc" aria-hidden />
      <div className="dial-body">
        {children}
        <span className="caps dial-caption">{caption}</span>
      </div>
    </div>
  )
}
