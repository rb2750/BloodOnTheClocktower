import { getCharacter } from '@botc/rules'
import { useStore } from '../state/store.js'

/**
 * When the game looks over, say so, and offer the door.
 *
 * The app never ends a game on its own: the Storyteller decides, because
 * there are characters that change what "the Demon is dead" means. But the
 * two ordinary endings are spotted and put one tap away.
 */
export function likelyWinner(game: {
  seats: { alive: boolean; isTraveller: boolean; characterId?: string; trueCharacterId?: string }[]
}): { winner: 'good' | 'evil'; reason: string } | null {
  const table = game.seats.filter((s) => !s.isTraveller)
  const demons = table.filter(
    (s) => getCharacter(s.trueCharacterId ?? s.characterId ?? '')?.team === 'demon',
  )
  if (demons.length > 0 && demons.every((s) => !s.alive)) {
    return { winner: 'good', reason: 'No Demon is alive.' }
  }
  const alive = table.filter((s) => s.alive).length
  if (alive <= 2 && table.length > 2) {
    return { winner: 'evil', reason: `Only ${alive} player${alive === 1 ? '' : 's'} left alive.` }
  }
  return null
}

export function GameOverHint({ onEnd }: { onEnd: () => void }) {
  const game = useStore((s) => s.game)
  if (!game) return null
  const likely = likelyWinner(game)
  if (!likely) return null
  return (
    <button
      onClick={onEnd}
      className="mt-3 flex w-full items-center justify-between gap-3 border-y border-(--now) py-2.5 text-left"
    >
      <span>
        <span className="display block text-[18px] leading-none text-(--now)">
          {likely.winner === 'good' ? 'Good' : 'Evil'} may have won
        </span>
        <span className="serif mt-1 block text-[14px] text-(--text-dim)">{likely.reason}</span>
      </span>
      <span className="caps shrink-0 text-(--now)">End the game</span>
    </button>
  )
}
