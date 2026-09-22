const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty']

/** "Seven", or "21" past the words anyone would read aloud. */
export const word = (n: number) => WORDS[n] ?? String(n)

/** "Seven alive, one dead", the line under the day. */
export function aliveLine(alive: number, dead: number) {
  if (alive + dead === 0) return ''
  const a = `${word(alive)} alive`
  return dead === 0 ? a : `${a}, ${word(dead).toLowerCase()} dead`
}

/** Runs `fn` once the phone's back gesture has finished closing whatever was open. */
export function afterBack(fn: () => void) {
  const once = () => {
    window.removeEventListener('popstate', once)
    setTimeout(fn, 0)
  }
  window.addEventListener('popstate', once)
  history.back()
}

export const list = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
