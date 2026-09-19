/**
 * Vendors the official Blood on the Clocktower data published by
 * The Pandemonium Institute for toolmakers, and reshapes it into the single
 * combined file the app consumes.
 *
 * TPI warn that these URLs may move as the game evolves, which is why we pin a
 * copy into the repo rather than fetching at runtime. Re-run with `pnpm data`.
 *
 * Character names, ability text and art remain the property of
 * The Pandemonium Institute, used non-commercially under their
 * Community Created Content Policy. This project is not affiliated with TPI.
 */
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'packages/rules/data')

const BASE =
  'https://raw.githubusercontent.com/ThePandemoniumInstitute/botc-release/main'

const SOURCES = {
  roles: `${BASE}/resources/data/roles.json`,
  jinxes: `${BASE}/resources/data/jinxes.json`,
  nightsheet: `${BASE}/resources/data/nightsheet.json`,
  schema: `${BASE}/script-schema.json`,
} as const

/** Art is served from the same repo, by edition and id. */
export const ART_BASE = `${BASE}/resources/characters`

/**
 * The night sheet references four Storyteller steps that are not characters and
 * have no entry in roles.json (verified). The official app hardcodes their text.
 * We write our own operational phrasing rather than reproducing almanac prose,
 * which is not covered by the content policy.
 */
const PSEUDO_STEPS: Record<
  string,
  { name: string; firstNight?: string; otherNight?: string }
> = {
  dusk: {
    name: 'Dusk',
    firstNight: 'Check that every eye is closed before you begin. Some Travellers act now.',
    otherNight: 'Check that every eye is closed before you begin. Some Travellers act now.',
  },
  minioninfo: {
    name: 'Minion Info',
    firstNight:
      'Seven or more players: wake all Minions together and let them see each other. Show the *THIS IS THE DEMON* token and point to the Demon.',
  },
  demoninfo: {
    name: 'Demon Info & Bluffs',
    firstNight:
      'Seven or more players: wake the Demon. Show *THESE ARE YOUR MINIONS* and point to each Minion. Show *THESE CHARACTERS ARE NOT IN PLAY* and show three good characters that are not in play.',
  },
  dawn: {
    name: 'Dawn',
    firstNight:
      'Wait about ten seconds, so the last wake cannot be timed by anyone listening. Call for eyes open, then immediately announce who died.',
    otherNight:
      'Wait about ten seconds, so the last wake cannot be timed by anyone listening. Call for eyes open, then immediately announce who died.',
  },
}

type RawRole = {
  id: string
  name: string
  edition: string
  team: string
  ability: string
  flavor?: string
  reminders?: string[]
  remindersGlobal?: string[]
  setup: boolean
  firstNightReminder?: string
  otherNightReminder?: string
  special?: { type: string; name: string; value?: unknown; time?: string; global?: string }[]
}

type RawJinx = { id: string; jinx: { id: string; reason: string }[] }
type NightSheet = { firstNight: string[]; otherNight: string[] }

async function getJson<T>(url: string): Promise<{ data: T; sha256: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  const text = await res.text()
  return {
    data: JSON.parse(text) as T,
    sha256: createHash('sha256').update(text).digest('hex'),
  }
}

async function main() {
  console.log('Fetching official TPI data…')
  const [roles, jinxes, nightsheet, schema] = await Promise.all([
    getJson<RawRole[]>(SOURCES.roles),
    getJson<RawJinx[]>(SOURCES.jinxes),
    getJson<NightSheet>(SOURCES.nightsheet),
    getJson<unknown>(SOURCES.schema),
  ])

  const ids = new Set(roles.data.map((r) => r.id))
  const pseudo = new Set(Object.keys(PSEUDO_STEPS))
  const problems: string[] = []

  // --- Integrity checks. These are the assumptions the night engine rests on. ---
  for (const key of ['firstNight', 'otherNight'] as const) {
    for (const entry of nightsheet.data[key]) {
      if (!ids.has(entry) && !pseudo.has(entry)) {
        problems.push(`nightsheet.${key} references unknown id "${entry}"`)
      }
    }
  }

  const firstIdx = new Map(nightsheet.data.firstNight.map((id, i) => [id, i + 1]))
  const otherIdx = new Map(nightsheet.data.otherNight.map((id, i) => [id, i + 1]))

  for (const r of roles.data) {
    if (r.firstNightReminder && !firstIdx.has(r.id)) {
      problems.push(`${r.id} has a first-night reminder but no sheet position`)
    }
    if (!r.firstNightReminder && firstIdx.has(r.id)) {
      problems.push(`${r.id} has a first-night sheet position but no reminder`)
    }
    if (r.otherNightReminder && !otherIdx.has(r.id)) {
      problems.push(`${r.id} has an other-night reminder but no sheet position`)
    }
    if (!r.otherNightReminder && otherIdx.has(r.id)) {
      problems.push(`${r.id} has an other-night sheet position but no reminder`)
    }
  }

  // --- Jinxes are published one-directionally; index both ways. ---
  const jinxIndex = new Map<string, { with: string; reason: string }[]>()
  const addJinx = (a: string, b: string, reason: string) => {
    if (!ids.has(a)) problems.push(`jinx references unknown id "${a}"`)
    if (!ids.has(b)) problems.push(`jinx references unknown id "${b}"`)
    const list = jinxIndex.get(a) ?? []
    if (!list.some((j) => j.with === b)) list.push({ with: b, reason })
    jinxIndex.set(a, list)
  }
  for (const root of jinxes.data) {
    for (const j of root.jinx) {
      addJinx(root.id, j.id, j.reason)
      addJinx(j.id, root.id, j.reason)
    }
  }

  if (problems.length) {
    console.error('\nData integrity problems:')
    for (const p of problems) console.error('  -', p)
    throw new Error(`${problems.length} integrity problem(s); refusing to write.`)
  }

  const characters = roles.data.map((r) => ({
    id: r.id,
    name: r.name,
    edition: r.edition,
    team: r.team,
    ability: r.ability,
    flavor: r.flavor ?? '',
    setup: r.setup,
    reminders: r.reminders ?? [],
    remindersGlobal: r.remindersGlobal ?? [],
    firstNight: firstIdx.get(r.id) ?? 0,
    firstNightReminder: r.firstNightReminder ?? '',
    otherNight: otherIdx.get(r.id) ?? 0,
    otherNightReminder: r.otherNightReminder ?? '',
    special: r.special ?? [],
    jinxes: jinxIndex.get(r.id) ?? [],
    image: `${ART_BASE}/${r.edition}/${r.id}`,
  }))

  const steps = Object.entries(PSEUDO_STEPS).map(([id, s]) => ({
    id,
    name: s.name,
    firstNight: firstIdx.get(id) ?? 0,
    firstNightReminder: s.firstNight ?? '',
    otherNight: otherIdx.get(id) ?? 0,
    otherNightReminder: s.otherNight ?? '',
  }))

  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(
    join(OUT_DIR, 'characters.json'),
    JSON.stringify(characters, null, 0) + '\n',
  )
  await writeFile(join(OUT_DIR, 'steps.json'), JSON.stringify(steps, null, 2) + '\n')
  await writeFile(
    join(OUT_DIR, 'script-schema.json'),
    JSON.stringify(schema.data, null, 2) + '\n',
  )
  await writeFile(
    join(OUT_DIR, 'provenance.json'),
    JSON.stringify(
      {
        fetchedAt: new Date().toISOString(),
        source: BASE,
        notice:
          'Blood on the Clocktower is a trademark of Steven Medway and The Pandemonium Institute. Character text and art are used non-commercially under the Community Created Content Policy. This project is not affiliated with The Pandemonium Institute.',
        sha256: {
          roles: roles.sha256,
          jinxes: jinxes.sha256,
          nightsheet: nightsheet.sha256,
          schema: schema.sha256,
        },
        counts: {
          characters: characters.length,
          jinxPairs: [...jinxIndex.values()].reduce((n, l) => n + l.length, 0) / 2,
          firstNightSteps: nightsheet.data.firstNight.length,
          otherNightSteps: nightsheet.data.otherNight.length,
        },
      },
      null,
      2,
    ) + '\n',
  )

  const byTeam = characters.reduce<Record<string, number>>((acc, c) => {
    acc[c.team] = (acc[c.team] ?? 0) + 1
    return acc
  }, {})

  console.log(`\n  ${characters.length} characters`, byTeam)
  console.log(`  ${characters.filter((c) => c.setup).length} setup-modifying`)
  console.log(`  ${[...jinxIndex.values()].reduce((n, l) => n + l.length, 0) / 2} jinx pairs`)
  console.log(`  all integrity checks passed\n  written to ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
