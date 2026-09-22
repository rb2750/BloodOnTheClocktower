import { useEffect, useRef } from 'react'
import { getCharacter } from '@botc/rules'
import { Button, Quote, haptic } from '@botc/ui'
import { toast } from 'sonner'
import { useStore } from '../state/store.js'
import type { Game } from '../state/types.js'

/**
 * When the game looks over, say so, and offer the door.
 *
 * The app never ends a game on its own: the Storyteller decides, because
 * there are characters that change what "the Demon is dead" means. But the
 * two ordinary endings are spotted and put one tap away.
 */
export function likelyWinner(game: {
  seats: { name: string; alive: boolean; isTraveller: boolean; characterId?: string; trueCharacterId?: string }[]
}): { winner: 'good' | 'evil'; reason: string; say: string; sayHidden: string } | null {
  const table = game.seats.filter((s) => !s.isTraveller)
  const demons = table.filter(
    (s) => getCharacter(s.trueCharacterId ?? s.characterId ?? '')?.team === 'demon',
  )
  if (demons.length > 0 && demons.every((s) => !s.alive)) {
    const d = demons[0]!
    const c = getCharacter(d.trueCharacterId ?? d.characterId ?? '')
    return {
      winner: 'good',
      reason: 'No Demon is alive.',
      say: `The game is over. Good wins! The Demon, ${d.name} the ${c?.name ?? 'Demon'}, is dead.`,
      sayHidden: `The game is over. Good wins! The Demon, ${d.name}, is dead.`,
    }
  }
  const alive = table.filter((s) => s.alive)
  if (alive.length <= 2 && table.length > 2) {
    const d = demons.find((s) => s.alive)
    const say = `The game is over. Evil wins! Only ${alive.length === 1 ? 'one player is' : 'two players are'} left alive${d ? `, and the Demon, ${d.name}, is one of them` : ''}.`
    return { winner: 'evil', reason: `Only ${alive.length} player${alive.length === 1 ? '' : 's'} left alive.`, say, sayHidden: say }
  }
  return null
}

/** What to say once the game is decided, in order. */
export function endingScript(game: Game, hidden: boolean): string[] {
  const ended = game.phase.k === 'ended' ? game.phase : null
  const likely = likelyWinner(game)
  const winner = ended?.winner ?? likely?.winner
  const opening = likely
    ? hidden ? likely.sayHidden : likely.say
    : `The game is over. ${winner === 'good' ? 'Good' : 'Evil'} wins! ${ended?.rationale ?? ''}`.trim()
  const real = (s: Game['seats'][number]) => getCharacter(s.trueCharacterId ?? s.characterId ?? '')
  const demon = game.seats.find((s) => real(s)?.team === 'demon')
  const minions = game.seats.filter((s) => real(s)?.team === 'minion')
  const lines = [
    opening,
    'Everyone stays quiet for a moment. Nobody reveals yet.',
    demon
      ? `${demon.name}, you were the Demon. Show the table your character and say who your Minion${minions.length === 1 ? ' was' : 's were'}.`
      : 'Demon, show the table your character.',
    minions.length > 0 ? `${minions.map((m) => m.name).join(' and ')}, show your character${minions.length === 1 ? '' : 's'} too.` : '',
    'Now everyone else: hold your lantern and show the table who you were.',
  ].filter(Boolean)
  if (!hidden) lines.push(`If anyone asks: ${game.seats.map((s) => `${s.name} was the ${real(s)?.name ?? '?'}`).join(', ')}.`)
  return lines
}

export function GameOverHint({ onEnd }: { onEnd: () => void }) {
  const game = useStore((s) => s.game)
  const concealed = useStore((s) => s.concealed)
  const likely = game ? likelyWinner(game) : null
  // The moment it turns over, the phone says so, so nobody keeps playing.
  const said = useRef(false)
  useEffect(() => {
    if (!likely) {
      said.current = false
      return
    }
    if (said.current) return
    said.current = true
    haptic('warn')
    toast(`The game is over: ${likely.winner} wins. ${likely.reason}`, { duration: 8000 })
  }, [likely])
  if (!game || !likely) return null
  const good = likely.winner === 'good'
  return (
    <div className={`mt-3 rounded-(--radius-surface) border-2 p-3 ${good ? 'border-(--color-blue-2)' : 'border-(--color-red-2)'}`}>
      <div className={`display text-[26px] leading-none ${good ? 'text-(--color-blue-2)' : 'text-(--color-red-2)'}`}>
        The game is over. {good ? 'Good' : 'Evil'} wins.
      </div>
      <p className="serif mt-1 text-[14px] text-(--text-dim)">{likely.reason} Stop the game here: no more nominations, deaths or night steps.</p>
      <div className="mt-3 flex items-start gap-2 border-l-2 border-(--text) py-0.5 pl-3">
        <Quote size={14} className="mt-[3px] shrink-0 text-(--text-faint)" />
        <p className="serif m-0 text-[17px] leading-snug text-(--text)">{concealed ? likely.sayHidden : likely.say}</p>
      </div>
      <p className="mt-2 text-[13px] text-(--text-dim)">Say that out loud, then tap the button. Every phone shows the result and the next screen tells you what to say for the reveal.</p>
      <Button live variant="primary" className="mt-3 w-full" onClick={onEnd}>
        End the game
      </Button>
    </div>
  )
}
