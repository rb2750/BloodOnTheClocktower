/**
 * Downloads official character art into each app's `public/art` directory so the
 * service worker precaches it and the apps work with no network.
 *
 * The files are not committed: the repository does not redistribute The
 * Pandemonium Institute's art, it fetches it at build time from the toolmaker
 * resources they publish for exactly this purpose. See NOTICE.md.
 */
import { mkdir, writeFile, readFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE =
  'https://raw.githubusercontent.com/ThePandemoniumInstitute/botc-release/main/resources/characters'

const TARGETS = [
  join(ROOT, 'apps/storyteller/public/art'),
  join(ROOT, 'apps/player/public/art'),
]

type Character = { id: string; edition: string; team: string }

function filesFor(c: Character): string[] {
  if (c.team === 'fabled' || c.team === 'loric') return [`${c.edition}/${c.id}.webp`]
  const files = [`${c.edition}/${c.id}_g.webp`, `${c.edition}/${c.id}_e.webp`]
  if (c.team === 'traveller') files.push(`${c.edition}/${c.id}.webp`)
  return files
}

async function exists(p: string) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function main() {
  const characters = JSON.parse(
    await readFile(join(ROOT, 'packages/rules/data/characters.json'), 'utf8'),
  ) as Character[]

  const wanted = characters.flatMap(filesFor)
  console.log(`Fetching ${wanted.length} character images…`)

  let fetched = 0
  let cached = 0
  const failures: string[] = []

  // Modest concurrency: enough to be quick, not enough to be rude.
  const queue = [...wanted]
  const workers = Array.from({ length: 8 }, async () => {
    for (;;) {
      const file = queue.shift()
      if (!file) return
      const primary = join(TARGETS[0]!, file)
      if (await exists(primary)) {
        cached++
        continue
      }
      const res = await fetch(`${BASE}/${file}`)
      if (!res.ok) {
        failures.push(`${file} -> HTTP ${res.status}`)
        continue
      }
      const buf = Buffer.from(await res.arrayBuffer())
      for (const target of TARGETS) {
        const out = join(target, file)
        await mkdir(dirname(out), { recursive: true })
        await writeFile(out, buf)
      }
      fetched++
      if (fetched % 50 === 0) console.log(`  ${fetched} fetched…`)
    }
  })

  await Promise.all(workers)

  console.log(`\n  ${fetched} downloaded, ${cached} already present`)
  if (failures.length) {
    console.warn(`  ${failures.length} failed:`)
    for (const f of failures.slice(0, 10)) console.warn('   -', f)
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
