import { useState } from 'react'
import { Button, Sheet, inputClass } from '@botc/ui'
import { useStore } from '../state/store.js'
import { likelyWinner } from './GameOverHint.js'

/** Ending the game is a decision, so it is a sheet with two clear doors. */
export function EndGameSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const game = useStore((s) => s.game)
  const finishGame = useStore((s) => s.finishGame)
  const [note, setNote] = useState('')
  if (!game) return null
  const likely = likelyWinner(game)

  const finish = (winner: 'good' | 'evil') => {
    const reason =
      note.trim() ||
      (likely?.winner === winner ? likely.reason : winner === 'good' ? 'The Demon is dead.' : 'Evil holds the town.')
    finishGame(winner, reason)
    onClose()
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="End the game"
      subtitle="Who won? The recap opens straight after, for reading out while everyone reveals."
    >
      {likely && (
        <p className="serif mb-4 border-l-2 border-(--now) pl-3 text-[15px] leading-snug text-(--text-dim)">
          It looks like <strong className="text-(--text)">{likely.winner}</strong> has it: {likely.reason}
        </p>
      )}
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="How it ended, in a line (optional)"
        className={`${inputClass} mb-4`}
      />
      <div className="flex flex-col gap-2 pb-2">
        <Button
          live
          variant={likely?.winner === 'good' ? 'primary' : 'quiet'}
          className="w-full text-(--color-blue-2)"
          onClick={() => finish('good')}
        >
          Good wins
        </Button>
        <Button
          live
          variant={likely?.winner === 'evil' ? 'primary' : 'quiet'}
          className="w-full text-(--color-red-2)"
          onClick={() => finish('evil')}
        >
          Evil wins
        </Button>
      </div>
    </Sheet>
  )
}
