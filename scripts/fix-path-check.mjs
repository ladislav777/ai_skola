/**
 * Nástroj pre priečinky s diakritikou v ceste (napr. C:\Users\ty\MojaŠkola).
 *
 * Android Gradle Plugin predvolene odmietne build v priečinku, ktorého cesta
 * obsahuje nestandardné znaky, a zlyhá s:
 *   "Your project path contains non-ASCII characters."
 *
 * Tento skript do doplní odporúčaný prepínač do android/gradle.properties:
 *   android.overridePathCheck=true
 *
 *   node scripts/fix-path-check.mjs              # opraví tento projekt
 *   node scripts/fix-path-check.mjs ../ine-projekty
 *   node scripts/fix-path-check.mjs --check      # len skontroluje, nič nemení
 *
 * Alternatíva bez prepínača: presunúť projekt do priečinka bez diakritiky.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FLAG = 'android.overridePathCheck=true'

const args = process.argv.slice(2)
const dryRun = args.includes('--check')
const targets = args.filter((a) => !a.startsWith('--'))
if (targets.length === 0) targets.push(ROOT)

// Diakritika = písmená mimo ASCII
const hasNonAscii = (p) => /[^\x20-\x7E]/.test(p)
const onlyAsciiNeeded = hasNonAscii(ROOT)

for (const project of targets) {
  const file = path.join(project, 'android', 'gradle.properties')

  if (!existsSync(file)) {
    console.log(`preskočené (nemá android/gradle.properties): ${project}`)
    continue
  }

  if (!hasNonAscii(project)) {
    console.log(`OK – cesta je čistá, prepínač nie je potrebný: ${project}`)
    continue
  }

  const text = readFileSync(file, 'utf8')

  if (text.includes(FLAG)) {
    console.log(`už nastavené: ${project}`)
    continue
  }

  if (dryRun) {
    console.log(`CHÝBA ${FLAG}: ${project}`)
    continue
  }

  const addition = [
    '',
    '# Cesta k projektu obsahuje nestandardné znaky – Android Gradle Plugin',
    '# to v predvolenom nastavení odmietne. Prepínač dostupný od AGP.',
    'android.overridePathCheck=true',
    '',
  ].join('\n')

  writeFileSync(file, text.trimEnd() + '\n' + addition)
  console.log(`pridané android.overridePathCheck=true: ${project}`)
}

if (onlyAsciiNeeded && dryRun) {
  console.log('\nTip: trvalé riešenie je priečinok bez diakritiky, napr. C:\\Users\\ty\\AiSkola')
}
