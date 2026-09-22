import { memo } from 'react'

export type Light = 'day' | 'dusk' | 'night' | 'dawn'

/** Seeded so the stars never jump between renders or reloads. */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

const ticks = (cx: number, cy: number, r: number) =>
  Array.from({ length: 12 }, (_, i) => {
    const a = (2 * Math.PI * i) / 12
    return `<line x1="${(cx + Math.cos(a) * (r - 3)).toFixed(1)}" y1="${(cy + Math.sin(a) * (r - 3)).toFixed(1)}" x2="${(cx + Math.cos(a) * r).toFixed(1)}" y2="${(cy + Math.sin(a) * r).toFixed(1)}" stroke="#251F17" stroke-width="${i % 3 === 0 ? 1.4 : 0.8}"/>`
  }).join('')

function sky(light: Light, props: boolean): string {
  const r = rng(11)
  const colours = {
    day: ['#101827', '#18233A', '#243149'],
    dusk: ['#0A0F1C', '#121A2C', '#1D2436'],
    night: ['#03050A', '#060911', '#0A0E18'],
    dawn: ['#0E1426', '#2B2A3E', '#7A5540'],
  }[light]
  const count = { day: 30, dusk: 90, night: 170, dawn: 0 }[light]
  let stars = ''
  for (let i = 0; i < count; i++) {
    const x = r() * 390
    const y = 40 + r() * 190
    const s = [0.5, 0.6, 0.7, 0.9, 1.2][Math.floor(r() * 5)]
    const o = r() * (light === 'day' ? 0.5 : 1)
    stars += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s}" fill="#E3E8F4" opacity="${o.toFixed(2)}"/>`
  }
  const lit = light === 'night' || light === 'dusk'
  const mr = light === 'night' ? 17 : 14
  const moon =
    !props || light === 'dawn'
      ? ''
      : `<circle cx="262" cy="96" r="${mr * 4}" fill="url(#halo-${light})" opacity="${lit ? 1 : 0.55}"/><circle cx="262" cy="96" r="${mr}" fill="#DCE2EE"/><circle cx="256" cy="91" r="2.6" fill="#C1C9D9" opacity=".7"/><circle cx="268" cy="102" r="1.8" fill="#C1C9D9" opacity=".6"/>`
  const sun = light === 'dawn' ? `<ellipse cx="300" cy="238" rx="220" ry="90" fill="url(#sun)"/>` : ''
  const face = { night: '#F4E2B0', dusk: '#EEDDB0', day: '#CFC5AE', dawn: '#D8CDB2' }[light]
  const cglow = { night: 1, dusk: 0.7, day: 0, dawn: 0 }[light]
  const win = (o: number) => (o * (lit ? 1 : 0.35)).toFixed(2)
  const hand = light === 'night' ? ['327', '169', '336', '163'] : light === 'day' ? ['334', '165', '342', '180'] : ['334', '165', '344', '172']
  const tower = !props
    ? ''
    : `<g><path d="M322 30 L334 -2 L346 30Z" fill="#0A0E17"/><rect x="332.6" y="-12" width="2.8" height="12" fill="#0A0E17"/>
<path d="M314 64 L334 26 L354 64Z" fill="#0B1019"/><rect x="312" y="62" width="44" height="72" fill="#0D121C"/>
<path d="M322 128 v-22 a12 12 0 0 1 24 0 v22" fill="#070A11"/><rect x="308" y="132" width="52" height="7" fill="#0A0E17"/>
<rect x="310" y="138" width="48" height="112" fill="#0C111A"/>
<circle cx="334" cy="176" r="42" fill="url(#cglow)" opacity="${cglow}"/><circle cx="334" cy="176" r="18.5" fill="#1A1F2A"/>
<circle cx="334" cy="176" r="16" fill="${face}"/><circle cx="334" cy="176" r="12.5" fill="none" stroke="#251F17" stroke-width=".5" opacity=".55"/>${ticks(334, 176, 15.6)}
<line x1="334" y1="176" x2="${hand[0]}" y2="${hand[1]}" stroke="#251F17" stroke-width="1.8" stroke-linecap="round"/><line x1="334" y1="176" x2="${hand[2]}" y2="${hand[3]}" stroke="#251F17" stroke-width="1.2" stroke-linecap="round"/><circle cx="334" cy="176" r="1.5" fill="#251F17"/>
<rect x="331" y="208" width="6" height="14" rx="3" fill="#EBC784" opacity="${win(0.75)}"/></g>`
  const far = `<path d="M0 214 L14 214 L14 200 L30 192 L46 200 L46 214 L70 214 L76 204 L82 214 L112 214 L112 196 L126 184 L140 196 L140 214 L178 214 L186 198 L194 214 L220 214 L220 202 L236 194 L252 202 L252 214 L290 214 L290 208 L390 208 L390 240 L0 240Z" fill="#141B2A" opacity=".9"/>`
  const near = `<path d="M0 240 L0 222 L22 222 L22 210 L36 198 L50 210 L50 222 L64 222 L64 214 L96 214 L96 226 L128 226 L140 206 L152 226 L186 226 L186 216 L204 216 L204 206 L226 206 L226 222 L262 222 L262 212 L276 202 L290 212 L290 240Z" fill="#0B0F19"/>
<rect x="30" y="212" width="3" height="4" rx=".5" fill="#EBC784" opacity="${win(0.8)}"/><rect x="40" y="212" width="3" height="4" rx=".5" fill="#EBC784" opacity="${win(0.5)}"/><rect x="144" y="216" width="3" height="4" rx=".5" fill="#EBC784" opacity="${win(0.7)}"/><rect x="212" y="212" width="3" height="4" rx=".5" fill="#EBC784" opacity="${win(0.6)}"/><rect x="72" y="218" width="3" height="4" rx=".5" fill="#EBC784" opacity="${win(0.4)}"/>`
  const ground = `<rect x="0" y="238" width="390" height="606" fill="url(#ground)"/>
<rect x="0" y="222" width="390" height="46" fill="url(#mist)"/>`
  const lamp = light === 'night' ? '' : `<ellipse cx="195" cy="800" rx="250" ry="170" fill="url(#lamp)"/>`
  return `<svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs>
<linearGradient id="sky-${light}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${colours[0]}"/><stop offset=".55" stop-color="${colours[1]}"/><stop offset="1" stop-color="${colours[2]}"/></linearGradient>
<radialGradient id="halo-${light}"><stop offset="0" stop-color="#C9D3E6" stop-opacity=".28"/><stop offset=".4" stop-color="#C9D3E6" stop-opacity=".08"/><stop offset="1" stop-color="#C9D3E6" stop-opacity="0"/></radialGradient>
<radialGradient id="sun"><stop offset="0" stop-color="#F0AE62" stop-opacity=".6"/><stop offset="1" stop-color="#F0AE62" stop-opacity="0"/></radialGradient>
<radialGradient id="cglow"><stop offset="0" stop-color="#F2D596" stop-opacity=".55"/><stop offset="1" stop-color="#F2D596" stop-opacity="0"/></radialGradient>
<linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B0F18"/><stop offset="1" stop-color="#06080D"/></linearGradient>
<linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A3346" stop-opacity="0"/><stop offset=".5" stop-color="#2A3346" stop-opacity=".35"/><stop offset="1" stop-color="#2A3346" stop-opacity="0"/></linearGradient>
<radialGradient id="lamp"><stop offset="0" stop-color="#EDBE6C" stop-opacity=".30"/><stop offset=".45" stop-color="#EDBE6C" stop-opacity=".08"/><stop offset="1" stop-color="#EDBE6C" stop-opacity="0"/></radialGradient>
</defs><rect width="390" height="844" fill="url(#sky-${light})"/>${stars}${sun}${moon}${far}${tower}${near}${ground}${lamp}</svg>`
}

const cache = new Map<string, string>()
const svg = (light: Light, props: boolean) => {
  const key = `${light}-${props}`
  if (!cache.has(key)) cache.set(key, sky(light, props))
  return cache.get(key)!
}

/**
 * The town square behind everything.
 *
 * All four lights are drawn once and stacked; changing the phase changes which
 * is showing, and the three second crossfade is nightfall. Reading pages veil
 * it and drop the moon and the tower, so nothing sits behind text.
 */
export const Scene = memo(function Scene({
  light,
  veil = 0,
  props = true,
}: {
  light: Light
  veil?: number
  props?: boolean
}) {
  const layers: Light[] = ['day', 'dusk', 'night', 'dawn']
  return (
    <div className="rw-scene" aria-hidden>
      {layers.map((l) => (
        <div
          key={l}
          style={{ position: 'absolute', inset: 0, opacity: l === light || l === 'day' ? 1 : 0, transition: 'opacity 3s cubic-bezier(.65,0,.35,1)' }}
          dangerouslySetInnerHTML={{ __html: svg(l, props) }}
        />
      ))}
      <div className="rw-veil" style={{ opacity: veil }} />
    </div>
  )
})
