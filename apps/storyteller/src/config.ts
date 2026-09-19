/**
 * Deployment wiring.
 *
 * `RELAY_URL` is what decides how roles are handed out. Set it and the whole
 * table scans one code; leave it empty and the app falls back to one code per
 * player, which needs no server and works on a dead venue network. The fallback
 * is the foundation, not a degraded mode.
 */
export const RELAY_URL: string = import.meta.env.VITE_RELAY_URL ?? ''

/** Where the player companion is served from. */
export const PLAYER_ORIGIN: string =
  import.meta.env.VITE_PLAYER_ORIGIN ?? `${window.location.origin}/player`
