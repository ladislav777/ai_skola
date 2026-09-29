/**
 * Pomocný skript pre prácu s priečinkom C:\Users\jpjpj\Ai_škola
 * (cmd.exe nevie korektne porovnávať cesty s diakritikou, preto používame Node).
 *
 *   node scripts/user-folder.mjs            – overí, čo je v priečinku
 *   node scripts/user-folder.mjs npm install
 *   node scripts/user-folder.mjs npm run build
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'

const DST = 'C:\\Users\\jpjpj\\Ai_škola'

if (!existsSync(DST)) {
  console.error(`Cieľová priečinok neexistuje: ${DST}`)
  process.exit(1)
}

function run(command, args) {
  console.log(`\n$ ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, { cwd: DST, stdio: 'inherit', shell: true })
  if (result.status !== 0) {
    console.error(`Zlyhalo: ${command} ${args.join(' ')}`)
    process.exit(result.status ?? 1)
  }
}

/**
 * Voliteľný príkaz --clean: zmaže node_modules a package-lock.json.
 * npm má bug v optional dependencies (chýba natívny rollup binárny súbor),
 * preto sa po skopírovaní čistá inštalácia musí spraviť znova.
 */
const args = process.argv.slice(2)
if (args[0] === '--clean') {
  for (const item of ['node_modules', 'package-lock.json']) {
    const target = path.join(DST, item)
    if (existsSync(target)) {
      rmSync(target, { recursive: true, force: true })
      console.log(`Zmazané: ${item}`)
    }
  }
}

const apk = path.join(DST, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
console.log(`Priečinok: ${DST} (položiek: ${readdirSync(DST).length})`)
console.log(`APK: ${existsSync(apk) ? (statSync(apk).size / 1048576).toFixed(2) + ' MB' : 'chýba'}`)

if (args.length > 0 && args[0] !== '--clean') {
  run(args[0], args.slice(1))
}

