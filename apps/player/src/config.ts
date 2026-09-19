/**
 * Where the optional relay lives. Empty means the app only ever handles
 * per-player codes, which is a complete product on its own.
 */
export const RELAY_URL: string = import.meta.env.VITE_RELAY_URL ?? ''

/** Which build this is, for the foot of the home screen. */
export const BUILD: string = __BUILD__
