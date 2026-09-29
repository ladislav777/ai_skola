/**
 * Self-test aplikácie AI škola – bez externých testovacích knižníc.
 *
 *   npm test
 *
 * Overuje:
 *  1. dvojfázové delenie textu pre TTS (interpunkcia → slová),
 *  2. kontrakt service workera (čistenie starých cache + clients.claim),
 *  3. integritu obsahu kurzu (počty, jazyky, platné indexy).
 *
 * TTS testuje naozajstnú implementáciu zo src/components/TextToSpeech.tsx –
 * esbuild (závislosť Vite) ju zbundluje do dočasného súboru, ktorý načítame.
 */
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { userInfo } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let failed = 0
let passed = 0

function check(label, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`  ok   ${label}${detail ? `  (${detail})` : ''}`)
  } else {
    failed++
    console.log(`  FAIL ${label}${detail ? `  (${detail})` : ''}`)
  }
}

const section = (title) => console.log(`\n${title}`)

/* ------------------------------------------- 1. načítanie reálneho kódu TTS -- */
const tmp = mkdtempSync(path.join(tmpdir(), 'ai-skola-test-'))
const entry = path.join(tmp, 'entry.ts')
const bundle = path.join(tmp, 'bundle.mjs')

writeFileSync(
  entry,
  `export { splitForSpeech } from ${JSON.stringify(path.join(ROOT, 'src', 'components', 'TextToSpeech.tsx'))}\n`,
)

await build({
  entryPoints: [entry],
  outfile: bundle,
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  external: ['react', 'react-dom'],
  logLevel: 'silent',
})

const { splitForSpeech } = await import(pathToFileURL(bundle).href)

/* ------------------------------------------------------ 2. testy delenia -- */
section('TTS – dvojfázové delenie textu')

const stats = (chunks) => `chunks=${chunks.length}, max=${Math.max(...chunks.map((c) => c.length))}`

const a = splitForSpeech('Krátka veta. Druhá veta je dlhšia, ale stále pod limit. Tretia veta.')
check('krátke vety sa nerozdelia zbytočne', a.length === 3, stats(a))
check('interpunkcia zostáva na konci úseku', a[0].endsWith('.') && a[1].endsWith('.'), JSON.stringify(a[0]))

const noPunctuation = 'word '.repeat(600).trim()
const b = splitForSpeech(noPunctuation)
check('text bez interpunkcie sa rozdelí', b.length > 20, stats(b))
check('žiadny úsek neprekročí 150 znakov', Math.max(...b.map((c) => c.length)) <= 150, stats(b))
check('nesmie vzniknúť prázdny úsek', b.every((c) => c.trim().length > 0))
check('rekonštrukcia textu je identická', b.join(' ') === noPunctuation, `${noPunctuation.length} vs ${b.join(' ').length} znakov`)

const mixed = 'Krátka veta. ' + 'slovo '.repeat(120).trim() + ' Koniec vety.'
const c = splitForSpeech(mixed)
check('krátka veta pred dlhou zostane vcelku', c[0] === 'Krátka veta.', JSON.stringify(c[0]))
check('všetky úseky dodržia limit', Math.max(...c.map((x) => x.length)) <= 150, stats(c))
check('záverečná veta sa zachová', c[c.length - 1] === 'Koniec vety.', JSON.stringify(c[c.length - 1]))

check('nový riadok je oddeľovač', splitForSpeech('Prvý.\nDruhý.\nTretý.').length === 3)
check('bodkobodka je oddeľovač', splitForSpeech('Prvá; druhá; tretia.').length === 3)
check('prázdny text → žiadne úseky', splitForSpeech('').length === 0 && splitForSpeech('   ').length === 0)
check('jedno slovo → jeden úsek', splitForSpeech('ahoj').length === 1)
const huge = 'x'.repeat(500)
const d = splitForSpeech(huge)
check('absurdne dlhé slovo sa rozreže', d.length > 1 && d.join('') === huge, stats(d))


/* ------------------------------------------------- 3. service worker kontrakt -- */
section('Service worker')

const sw = readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8')
check('používa CURRENT_CACHE_NAME', sw.includes('CURRENT_CACHE_NAME'))
check('activate listener existuje', sw.includes("addEventListener('activate'"))
check('čistí staré cache cez caches.delete', /caches\.delete\(/.test(sw))
check('porovnáva cache !== CURRENT_CACHE_NAME', /cache !== CURRENT_CACHE_NAME/.test(sw))
check('enumeruje cache cez caches.keys()', /caches\s*\.\s*keys\(\)/.test(sw))
check('prevezme kontrolu cez clients.claim()', sw.includes('self.clients.claim()'))
check('celé čistenie je vo waitUntil', /addEventListener\('activate'[\s\S]*?event\.waitUntil\(/.test(sw))
check('žiadna stará konštanta VERSION', !/const VERSION =/.test(sw))
check('navigácia je network-first', /request\.mode === 'navigate'/.test(sw))
check('assety sú cache-first', sw.includes('caches.match(request)'))

/* ------------------------------------------- 4. životný cyklus TTS a async hlasy -- */
section('TTS – životný cyklus a async hlasy')

const tts = readFileSync(path.join(ROOT, 'src', 'components', 'TextToSpeech.tsx'), 'utf8')
check('listener na voiceschanged', tts.includes("addEventListener('voiceschanged'"))
check('listener sa odpája pri unmount', tts.includes("removeEventListener('voiceschanged'"))
check('poistný interval pre hlasy', tts.includes('setInterval') && tts.includes('clearInterval'))
check('hlas sa vyberá až pri speak()', /pickVoice\(voicesRef\.current\)/.test(tts))
check('front je rekurzívny (onend → ďalší úsek)', /const speakChunk = \(i: number\)/.test(tts))
check('beh prehrávania má token', tts.includes('tokenRef.current'))
check('používa useMemo pre úseky', tts.includes('useMemo(() => splitForSpeech(text)'))
check('bez zbytočného eslint-disable', !tts.includes('eslint-disable'))
check('bez mŕtveho indexRef', !tts.includes('indexRef'))

const timeouts = (tts.match(/setTimeout\(/g) || []).length
const tracked = (tts.match(/timersRef\.current\.push\(timer\)/g) || []).length
check(
  'každý setTimeout je evidovaný (nezvisí po unmount)',
  timeouts > 0 && timeouts === tracked,
  `${timeouts} setTimeout / ${tracked} push`,
)

/* ------------------------------------------------- 5. integrita obsahu kurzu -- */
section('Obsah kurzu')

const app = readFileSync(path.join(ROOT, 'src', 'App.tsx'), 'utf8')
const count = (needle) => (app.match(new RegExp(needle, 'g')) || []).length
const moduleCount = count("id: 'm\\d',")
const finalCount = count("id: 'f\\d+',")
const challengeCount = count("id: 'ch\\d+',")

check('6 modulov', moduleCount === 6, `${moduleCount}`)
check('20 otázok záverečného testu', finalCount === 20, `${finalCount}`)
check('20 denných výziev', challengeCount === 20, `${challengeCount}`)
check('autor je konštanta', /const AUTHOR = 'Muller'/.test(app))
check('autor je v certifikáte', app.includes('escapeXml(AUTHOR)'))
check('žiadny API kľúč ani sieť', !app.includes('ANTHROPIC') && !app.includes('api_key') && !app.includes('fetch('))

/**
 * Každý preklad v App.tsx má tvar t(['slovensky', 'english']).
 * Rozparsujeme ich a overíme, že žiadny nemá chýbajúci jazyk.
 */
function parseTranslations(source) {
  const results = []
  let i = 0
  while (true) {
    const start = source.indexOf('t([', i)
    if (start === -1) break
    // musí ísť o volanie funkcie t(…), nie o koniec iného identifikátora
    // (napr. Array.from(new Set([...])) by inak obsahovalo „t([“)
    const before = start > 0 ? source[start - 1] : ''
    if (/[A-Za-z0-9_$.]/.test(before)) {
      i = start + 1
      continue
    }
    let j = start + 3
    let depth = 1
    let inString = false
    for (; j < source.length && depth > 0; j++) {
      const ch = source[j]
      if (inString) {
        if (ch === '\\') j++
        else if (ch === "'") inString = false
        continue
      }
      if (ch === "'") inString = true
      else if (ch === '[' || ch === '(') depth++
      else if (ch === ']' || ch === ')') depth--
    }
    const inner = source.slice(start + 3, j - 1)
    // rozdelíme na časti podľa čiarok na najvyššej úrovni
    const parts = []
    let current = ''
    let level = 0
    let str = false
    for (let k = 0; k < inner.length; k++) {
      const ch = inner[k]
      if (str) {
        if (ch === '\\') {
          current += ch + (inner[++k] ?? '')
          continue
        }
        if (ch === "'") str = false
        current += ch
        continue
      }
      if (ch === "'") str = true
      if (ch === '[') level++
      if (ch === ']') level--
      if (ch === ',' && level === 0) {
        parts.push(current.trim())
        current = ''
        continue
      }
      current += ch
    }
    parts.push(current.trim())
    // viacriadkové zápisy majú za posledným prvkom čiarku – tú ignorujeme
    if (parts.length > 1 && parts[parts.length - 1] === '') parts.pop()
    results.push(parts)
    i = j
  }
  return results
}

const translations = parseTranslations(app)
const isQuoted = (p) => p.length > 2 && p.startsWith("'") && p.endsWith("'")
const valid = (parts) => parts.length === 2 && parts.every(isQuoted)
const broken = translations.filter((p) => !valid(p))

check('nájdené preklady t([…])', translations.length > 100, `${translations.length} kusov`)
check(
  'každý preklad má SK aj EN (žiadny chýbajúci jazyk)',
  broken.length === 0,
  broken.length ? `zlé: ${JSON.stringify(broken.slice(0, 2))}` : '0 chýbnych',
)
check(
  'žiadny preklad nemá prázdny jazyk',
  translations.every((p) => valid(p) && p.every((x) => isQuoted(x) && x.slice(1, -1).trim().length > 0)),
)

/* --------------------------------- 6. hygiena pred zverejnením (verejný repo) -- */
section('Hygiena verejného repozitára')

const gitignore = readFileSync(path.join(ROOT, '.gitignore'), 'utf8')
for (const ignored of ['node_modules', 'dist', '*.apk', 'android/local.properties', 'android/app/build', '.env']) {
  check(`ignoruje sa ${ignored}`, gitignore.includes(ignored))
}

/** Vráti zoznam súborov, ktoré obsahujú daný vzor (git grep -l). */
function trackedWith(pattern) {
  try {
    return execFileSync('git', ['grep', '-I', '-l', '-i', '-e', pattern], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

/**
 * Rizikom pri zverejnení nie je samotné meno (2-znakové mená ako „HP“ by
 * matchovali aj výrazy ako *.hprof), ale cesta domovského priečinka.
 * Preto hľadáme presne tvar Users\<meno> – ten je jednoznačný.
 */
const OS_USER = userInfo().username
const GENERIC_USERS = /^(system|container|root|user|administrator|runneradmin|default)$/i

if (!OS_USER || GENERIC_USERS.test(OS_USER)) {
  check('kontrola cesty domovského priečinka sa preskočila', true, `generické prostredie (${OS_USER})`)
} else {
  // Tvar Users\<meno> je jednoznačný aj pre 2-znakové meno – na rozdiel od
  // hľadania samotného mena, ktoré by matchovalo napr. „*.hprof“ alebo „splashPng“.
  const homeRefs = trackedWith(`Users\\\\${OS_USER}`)
  check(
    `cesta C:\\Users\\${OS_USER} neuniká do repozitára`,
    homeRefs === '',
    homeRefs.split('\n').slice(0, 3).join(', '),
  )
}

// Cesty na Android SDK obsahujú domovský priečinok používateľa.
const sdkPaths = trackedWith('Android\\\\Sdk')
check('žiadne cesty na Android SDK vo verzovaných súboroch', sdkPaths === '', sdkPaths.split('\n').slice(0, 3).join(', '))




rmSync(tmp, { recursive: true, force: true })

/* ------------------------------------------------------------- výsledok -- */
console.log(`\n${failed === 0 ? 'VŠETKO PREŠLO' : 'CHYBY'}: ${passed} ok, ${failed} zlyhaných`)
process.exit(failed === 0 ? 0 : 1)
