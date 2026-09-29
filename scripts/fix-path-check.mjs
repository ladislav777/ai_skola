/** Pridá android.overridePathCheck=true do gradle.properties (cesta s diakritikou blokuje AGP). */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const targets = process.argv.slice(2)
if (targets.length === 0) targets.push('C:\\Users\\jpjpj\\Ai_škola')

for (const project of targets) {
  const file = path.join(project, 'android', 'gradle.properties')
  if (!existsSync(file)) {
    console.log(`preskočené (chýba): ${file}`)
    continue
  }
  const text = readFileSync(file, 'utf8')
  if (text.includes('android.overridePathCheck')) {
    console.log(`už nastavené: ${file}`)
    continue
  }
  const addition = [
    '',
    '# Priečinok obsahuje diakritiku (š) – AGP to v predvolenom nastavení blokuje.',
    '# https://developer.android.com/build/building-gradle (konfigurácia cesty projektu)',
    'android.overridePathCheck=true',
    '',
  ].join('\n')
  writeFileSync(file, text.trimEnd() + '\n' + addition)
  console.log(`pridané: ${file}`)
}
