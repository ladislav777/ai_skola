/**
 * Kopíruje webový build z dist/ do Android projektu – náhrada `cap copy android`
 * bez Capacitor CLI.
 *
 * Prečo: `cap copy` / `cap sync` v GitHub Actions zlyháva za 0 s, pretože CLI
 * na čerstvom checkout-e nemá `android/local.properties` a pokúša sa riešiť
 * Android cez `@ionic/utils-process` (process.kill). Tento skript robí presne
 * to, čo CLI robí pri behu a nič viac:
 *   1. skopíruje dist/ → android/app/src/main/assets/public/,
 *   2. zapíše android/app/src/main/assets/capacitor.config.json z capacitor.config.ts,
 *   3. zapíše android/app/src/main/assets/capacitor.plugins.json zo zoznamu pluginov.
 *
 * Spustenie:  node scripts/copy-web-to-android.mjs
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const ASSETS = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets')
const PUBLIC = path.join(ASSETS, 'public')

if (!existsSync(path.join(DIST, 'index.html'))) {
  console.error('dist/index.html neexistuje – najprv spusti `npm run build`.')
  process.exit(1)
}

// 1. webové assety
rmSync(PUBLIC, { recursive: true, force: true })
mkdirSync(PUBLIC, { recursive: true })
cpSync(DIST, PUBLIC, { recursive: true })
console.log('copy dist → android assets/public OK')

// 2. capacitor.config.json – musí byť zhodný s capacitor.config.ts
const capacitorConfig = {
  appId: 'sk.skai.skola',
  appName: 'AI škola',
  webDir: 'dist',
  android: { allowMixedContent: false },
  server: { androidScheme: 'https' },
}
writeFileSync(
  path.join(ASSETS, 'capacitor.config.json'),
  `${JSON.stringify(capacitorConfig, null, '\t')}\n`,
  'utf8',
)
console.log('capacitor.config.json OK')

// 3. capacitor.plugins.json – plugin(y) z package.json dependencies
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const PLUGIN_CLASS_PATHS = {
  '@capacitor-community/text-to-speech': 'com.getcapacitor.community.tts.TextToSpeechPlugin',
}
const plugins = Object.keys(pkg.dependencies ?? {})
  .filter((dep) => dep.startsWith('@capacitor/') || dep in PLUGIN_CLASS_PATHS)
  .filter((dep) => dep !== '@capacitor/core' && dep !== '@capacitor/cli')
  .filter((dep) => dep !== '@capacitor/android')
  .map((dep) => ({ pkg: dep, classpath: PLUGIN_CLASS_PATHS[dep] }))
  .filter((p) => p.classpath)

writeFileSync(
  path.join(ASSETS, 'capacitor.plugins.json'),
  `${JSON.stringify(plugins, null, '\t')}\n`,
  'utf8',
)
console.log(`capacitor.plugins.json OK (${plugins.length} pluginov)`)
