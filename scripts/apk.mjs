/**
 * Pomocný skript: zostaví debug APK v priečinku C:\Users\jpjpj\Ai_škola.
 * Použitie: node scripts/apk.mjs
 */
import { spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'

const ANDROID = 'C:\\Users\\jpjpj\\Ai_škola\\android'
const APK = path.join(ANDROID, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')

if (!existsSync(APK)) {
  console.log('APK sa zostavuje…')
  const result = spawnSync('cmd', ['/c', 'gradlew.bat', 'assembleDebug', '--no-daemon'], {
    cwd: ANDROID,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    console.error(`Gradle zlyhal: ${result.status}`)
    process.exit(result.status ?? 1)
  }
}

if (!existsSync(APK)) {
  console.error('APK sa nepodarilo vytvoriť.')
  process.exit(1)
}
console.log(`APK hotový: ${APK}`)
console.log(`Veľkosť: ${(statSync(APK).size / 1048576).toFixed(2)} MB`)
