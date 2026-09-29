import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import TextToSpeech, { stopAllSpeech } from './components/TextToSpeech'

/* ============================================================================
 * AI Masterclass – navigácia, onboarding, moduly, kvízy a aplikácia
 * Celá aplikácia je v jednom súbore: typy, texty SK/EN, obsah kurzov
 * a všetky obrazovky. Progress sa ukladá iba do localStorage.
 * ========================================================================== */

/* ------------------------------------------------------------------ typy -- */
type Locale = 'sk' | 'en'
type L = { sk: string; en: string }
type Level = 'beginner' | 'intermediate' | 'advanced'

const t = (pair: [string, string]): L => ({ sk: pair[0], en: pair[1] })

/** Autor kurzu – zobrazuje sa v päte, na vstupnej stránke a v certifikáte. */
const AUTHOR = 'Muller'

interface QuizQuestion {
  id: string
  q: L
  options: L[]
  correct: number
  why: L
}

interface ModuleSection {
  heading: L
  body: L[]
  tips?: L[]
}

interface Module {
  id: string
  icon: string
  title: L
  subtitle: L
  minutes: number
  xp: number
  sections: ModuleSection[]
  quiz: QuizQuestion[]
}

interface CompareTask {
  id: string
  task: L
  weak: L
  good: L
  outcomeWeak: L
  outcomeGood: L
  why: L[]
}

interface CaseStudy {
  id: string
  icon: string
  title: L
  situation: L
  bad: L
  good: L
  steps: L[]
  takeaway: L
}

interface Challenge {
  id: string
  title: L
  task: L
  hint: L
}

interface Progress {
  name: string
  level: Level | null
  placementDone: boolean
  modulePassed: string[]
  moduleScores: Record<string, number>
  playgroundRuns: number
  playgroundHistory: { prompt: string; score: number }[]
  challengeDone: string[]
  casesViewed: string[]
  finalScore: number | null
  finalPassed: boolean
  finalAttempts: number
  completedAt: string | null
  xp: number
  theme: 'dark' | 'light'
  locale: Locale
}

type View = 'home' | 'modules' | 'module' | 'playground' | 'compare' | 'cases' | 'challenge' | 'final'

const EMPTY_PROGRESS: Progress = {
  name: '',
  level: null,
  placementDone: false,
  modulePassed: [],
  moduleScores: {},
  playgroundRuns: 0,
  playgroundHistory: [],
  challengeDone: [],
  casesViewed: [],
  finalScore: null,
  finalPassed: false,
  finalAttempts: 0,
  completedAt: null,
  xp: 0,
  theme: 'dark',
  locale: 'sk',
}

/* ------------------------------------------------------------- texty UI -- */
const T = {
  appName: t(['AI škola', 'AI škola']),
  brandLine: t(['promptovanie · overovanie · zodpovednosť', 'prompting · verification · responsibility']),
  tagline: t([
    'Naučte sa AI nielen používať, ale aj kontrolovať',
    'Learn not just to use AI, but to check it',
  ]),
  heroLine: t([
    'Žiadny kľúč. Žiadna sieť. Len vaša hlava a poriadne otázky.',
    'No key. No network. Just your brain and better questions.',
  ]),
  navHome: t(['Prehľad', 'Overview']),
  navModules: t(['Moduly', 'Modules']),
  navPlayground: t(['Laboratórium', 'Laboratory']),
  navCompare: t(['Porovnanie', 'Comparison']),
  navCases: t(['Prípadové štúdie', 'Case studies']),
  navChallenge: t(['Denná výzva', 'Daily challenge']),
  navFinal: t(['Záverečný test', 'Final test']),

  welcome: t(['Vitajte v AI Masterclasse', 'Welcome to AI Masterclass']),
  welcomeIntro: t([
    'Najprv 5 krátkych otázok, aby sme prispôsobili cestu vašim skúsenostiam. Nič sa neukladá na server.',
    'First 5 short questions so we can tailor the path to your experience. Nothing is stored on a server.',
  ]),
  nameLabel: t(['Ako sa voláš?', 'What is your name?']),
  namePlaceholder: t(['napr. Jana', 'e.g. Jana']),
  startQuiz: t(['Začať kvíz', 'Start the quiz']),
  question: t(['Otázka', 'Question']),
  next: t(['Ďalej', 'Next']),
  finish: t(['Dokončiť', 'Finish']),
  of: t(['z', 'of']),
  points: t(['bodov', 'points']),
  recommendedLevel: t(['Odporúčaná úroveň', 'Recommended level']),
  levelBeginner: t(['Začiatkár', 'Beginner']),
  levelIntermediate: t(['Pokročilý', 'Intermediate']),
  levelAdvanced: t(['Expert', 'Expert']),
  levelBeginnerDesc: t([
    'Začíname od základov: čo AI je a čo nie je, ako sa bezpečne pýtať a ako výsledok overiť. Odomknuté sú všetky moduly.',
    'We start with the basics: what AI is and is not, how to ask safely and how to verify results. All modules are unlocked.',
  ]),
  levelIntermediateDesc: t([
    'Predpokladáme, že ste AI už používali. Poďeme do štruktúry promptu, iterácií a overovania.',
    'We assume you have used AI before. We move to prompt structure, iteration and verification.',
  ]),
  levelAdvancedDesc: t([
    'Ideme rýchlo: efektívne prompty, hranice zodpovednosti a overiteľnosť výstupov.',
    'We go fast: efficient prompts, responsibility limits and output verifiability.',
  ]),
  startModules: t(['Začať s modulmi', 'Start with the modules']),

  dashboardTitle: t(['Tvoj postup', 'Your progress']),
  xp: t(['XP', 'XP']),
  modulesDone: t(['Absolvované moduly', 'Completed modules']),
  levelUp: t(['Úroveň odomknutá! Nové moduly sú dostupné.', 'Level unlocked! New modules are available.']),
  continueStudy: t(['Pokračovať v štúdiu', 'Continue studying']),
  nextStep: t(['Ďalší krok', 'Next step']),
  moduleUnit: t(['moduly', 'modules']),

  locked: t(['Zamknuté', 'Locked']),
  unlockHint: t([
    'Modul odomknete absolvovaním minikvízu v predchádzajúcom module.',
    'Unlock a module by passing the mini-quiz of the previous one.',
  ]),
  startModule: t(['Začať modul', 'Start module']),
  reviewModule: t(['Zopakovať', 'Review']),
  min: t(['min', 'min']),
  passed: t(['Absolvované', 'Passed']),
  score: t(['Skóre', 'Score']),
  moduleQuiz: t(['Minikvíz modulu', 'Module mini-quiz']),
  tryAgain: t(['Skúsiť znova', 'Try again']),
  nextModule: t(['Ďalší modul', 'Next module']),
  passHint: t([
    'Na odomknutie ďalšieho modulu potrebujete 2 z 3 správnych odpovedí.',
    'You need 2 of 3 correct answers to unlock the next module.',
  ]),

  /* --- Vyhodnotenie odpovede (kvíz) --- */
  answerRight: t(['✅ Správne!', '✅ Correct!']),
  answerWrong: t(['❌ Nie je to správne.', '❌ Not quite.']),

  /* --- Prompt laboratórium (beží lokálne, bez siete) --- */
  authorCredit: t(['Kurz pripravil', 'Course by']),
  issuedBy: t(['Vydal', 'Issued by']),
  pgTitle: t(['Prompt laboratórium', 'Prompt laboratory']),
  pgIntro: t([
    'Napíšte prompt a laboratórium vám ukáže, čo mu chýba. Funguje úplne lokálne – nič neodchádza z vášho počítača.',
    'Write a prompt and the lab shows you what is missing. It runs fully locally – nothing leaves your computer.',
  ]),
  pgPlaceholder: t([
    'Napr. Si skúsený učiteľ biológie. Vysvetli fotosyntézu pre 8. ročník v 3 bodoch s analógiou z denného života, max 200 slov.',
    'E.g. You are an experienced biology teacher. Explain photosynthesis to a 13-year-old in 3 bullet points with an everyday analogy, max 200 words.',
  ]),
  pgSend: t(['Analyzovať prompt', 'Analyse prompt']),
  pgSending: t(['Analyzujem…', 'Analysing…']),
  pgClear: t(['Vymazať', 'Clear']),
  pgSimulated: t(['Lokálna simulácia', 'Local simulation']),
  pgNoNetwork: t(['Beží offline – bez API kľúča', 'Runs offline – no API key']),
  pgCheckTitle: t(['Rozbor promptu', 'Prompt breakdown']),
  pgScore: t(['Kvalita promptu', 'Prompt quality']),
  pgFixTitle: t(['Čo doplniť', 'What to add']),
  pgUseFix: t(['Použiť vylepšený prompt', 'Use improved prompt']),
  pgSimulation: t(['Simulovaná odpoveď', 'Simulated answer']),
  pgSimulationNote: t([
    'Toto nie je odpoveď skutočného AI modelu. Laboratórium vám ukazuje, ako by odpoveď mala štruktúrovanú – to je celý point kurzu.',
    'This is not a real model answer. The lab shows how a good answer should be structured – that is the point of the course.',
  ]),
  pgHistory: t(['Posledné pokusy', 'Recent attempts']),
  pgLibrary: t(['Knihovnica promptov', 'Prompt library']),
  pgUse: t(['Použiť', 'Use']),
  pgEmptyHistory: t(['Zatiaľ ste nič neposlali.', 'No attempts yet.']),
  /* jednotlivé kritériá */
  chkRole: t(['Rola', 'Role']),
  chkRoleOk: t(['Uvedli ste, kto má odpovedať.', 'You defined who is answering.']),
  chkRoleNo: t(['Chýba rola. Pridajte „Si [profesia]“…', 'Role missing. Add "You are [profession]"…']),
  chkContext: t(['Kontext', 'Context']),
  chkContextOk: t(['Zadanie má dostatok súvislostí.', 'The task has enough background.']),
  chkContextNo: t(['Chýba kontext: pre koho, za aky cieľ.', 'Context missing: for whom, for what goal.']),
  chkFormat: t(['Formát', 'Format']),
  chkFormatOk: t(['Povedali ste, ako má výstup vyzerať.', 'You specified the output shape.']),
  chkFormatNo: t(['Chýba formát: dĺžka, počet bodov, štruktúra.', 'Format missing: length, number of points, structure.']),
  chkProof: t(['Dôkazy', 'Evidence']),
  chkProofOk: t(['Žiadate overiteľnosť a zdroje.', 'You asked for verifiability and sources.']),
  chkProofNo: t(['Chýba overenie. Pridajte „ak nevieš, napíš to“.', 'Verification missing. Add "say so if you do not know".']),
  chkAudience: t(['Publikum', 'Audience']),
  chkAudienceOk: t(['Viete, pre koho to píšete.', 'You know who the text is for.']),
  chkAudienceNo: t(['Chýba publikum. Komu to bude čítať?', 'Audience missing. Who is going to read it?']),
  pgVerdictGood: t(['Solídny základ. Otestujte ho a porovnajte výsledky.', 'Solid base. Test it and compare the results.']),
  pgVerdictWeak: t(['Ešte je to zadanie, nie prompt. Začnite rolou a cieľom.', 'Still a wish, not a prompt. Start with a role and a goal.']),

  cmpIntro: t([
    'Rozdiel medzi promptom a zadaniem je priamo úmerný kvalite výsledku.',
    'The difference between a prompt and a wish is directly proportional to the result quality.',
  ]),
  cmpTask: t(['Zadanie', 'Task']),
  cmpWeak: t(['Slabý prompt', 'Weak prompt']),
  cmpGood: t(['Dobrý prompt', 'Good prompt']),
  cmpOutcome: t(['Pravdepodobný výsledok', 'Likely outcome']),
  cmpRevealWeak: t(['Ukáž slabý prompt', 'Show weak prompt']),
  cmpRevealGood: t(['Ukáž dobrý prompt', 'Show good prompt']),
  cmpNext: t(['Ďalšie zadanie', 'Next task']),

  casesIntro: t([
    'Reálne situácie z praxe a postup, ktorý vedie k overiteľnému výsledku.',
    'Real-world situations and the process that leads to a verifiable result.',
  ]),
  casesRead: t(['Prečítať štúdiu', 'Read case study']),
  casesReadDone: t(['Prečítané', 'Read']),
  casesBad: t(['Zly postup', 'Bad move']),
  casesGood: t(['Dobrý postup', 'Good move']),

  chIntro: t([
    'Jedna malá úloha denne. Zlepšuje promptovanie viac než hodina čítania.',
    'One small task per day. Improves prompting more than an hour of reading.',
  ]),
  chDone: t(['Označiť ako splnené', 'Mark as done']),
  chRepeat: t(['Znova zopakovať', 'Repeat it']),
  chHint: t(['Rada', 'Hint']),
  chDoneTotal: t(['Splnené výzvy', 'Completed challenges']),
  chDoneConfirm: t([
    '✅ Hotovo! Táto výzva je splnená a zapísaná do vášho postupu.',
    '✅ Done! This challenge is completed and recorded in your progress.',
  ]),

  finalIntro: t([
    '20 otázok. Na certifikát potrebujete aspoň 16 správnych odpovedí (80 %).',
    '20 questions. You need at least 16 correct answers (80 %) for the certificate.',
  ]),
  finalLocked: t([
    'Záverečný test odomknete po absolvovaní všetkých šiestich modulov.',
    'The final test unlocks after completing all six modules.',
  ]),
  finalSubmit: t(['Vyhodnotiť', 'Submit']),
  finalPassed: t(['Certifikát získaný!', 'Certificate earned!']),
  finalFailed: t([
    'Ešte nie ste na 16 správnych. Prečítajte si vysvetlenia a skúste to znova.',
    'Not 16 correct yet. Review the explanations and try again.',
  ]),
  finalAttempts: t(['Pokusy', 'Attempts']),
  finalBest: t(['Najlepšie', 'Best']),
  finalCertificate: t(['Stiahnuť certifikát (SVG)', 'Download certificate (SVG)']),

  back: t(['Späť', 'Back']),
  home: t(['Prehľad', 'Overview']),
  correct: t(['Správne', 'Correct']),
  explanation: t(['Vysvetlenie', 'Explanation']),
  localOnly: t([
    'Postup sa ukladá iba do localStorage. Bez registrácie a zberu osobných údajov.',
    'Progress is stored in localStorage only. No sign-up, no personal data collected.',
  ]),
  resetProgress: t(['Zmazať postup', 'Reset progress']),
  confirmReset: t([
    'Naozaj chcete zmazať všetok postup? Táto akcia sa nedá vrátiť.',
    'Really reset all progress? This cannot be undone.',
  ]),
  certIssuedTo: t(['Issued to', 'Issued to']),
  certSubtitle: t([
    ' absolvoval(a) 6 modulov a záverečný test aplikácie AI škola',
    ' completed 6 modules and the final test of AI škola',
  ]),
  certDate: t(['Dátum', 'Date']),
  certScore: t(['Skóre', 'Score']),
  certFooter: t([
    'Potvrdzuje, že promptoval(a) zodpovedne, overoval(a) výstupy a rešpektoval(a) súkromie.',
    'Confirms responsible prompting, output verification and respect for privacy.',
  ]),
} as const

/* ------------------------------------------------ vstupný kvíz (5 otázok) -- */
const placementQuiz: QuizQuestion[] = [
  {
    id: 'p1',
    q: t([
      'Ako často ste dotazovali jazykový model (napr. ChatGPT, Claude)?',
      'How often do you use a language model (e.g. ChatGPT, Claude)?',
    ]),
    options: [
      t(['Nikdy', 'Never']),
      t(['Zriedkavo, raz za čas', 'Rarely, once in a while']),
      t(['Pravidelne, skôr každý deň', 'Regularly, almost daily']),
      t(['Súčasť mojej práce', 'Part of my work']),
    ],
    correct: 3,
    why: t([
      'Denná prax dáva solídnu základňu, no stále sa dajú zlepšiť formulácie zadaní.',
      'Daily practice gives you a solid base, but prompts can still be improved.',
    ]),
  },
  {
    id: 'p2',
    q: t([
      'Ktorá vlastnosť promptu má najväčší vplyv na kvalitu odpovede?',
      'Which prompt element has the biggest impact on answer quality?',
    ]),
    options: [
      t(['Použitie veľa slov', 'Using many words']),
      t(['Presný kontext, rola a formát výstupu', 'Precise context, role and output format']),
      t(['Použitie angličtiny', 'Using English']),
      t(['Čím dlhší prompt, tým lepšie', 'The longer the prompt, the better']),
    ],
    correct: 1,
    why: t([
      'Model netuší, čo máte v hlave. Kontext, rola a formát sú najúčinnejší spôsob, ako mu dať informácie.',
      'The model does not know what is on your mind. Context, role and format inform it most effectively.',
    ]),
  },
  {
    id: 'p3',
    q: t([
      'Ako zvyčajne reagujete, keď je odpoveď modelu nesprávna?',
      'How do you usually react when the model answer is wrong?',
    ]),
    options: [
      t(['Skúšam to znova dovtedy, kým to nevyjde', 'I retry until it works']),
      t(['Opravujem prompt: dodám kontext a spresňujem zadanie', 'I fix the prompt: add context and refine the task']),
      t(['Končím, AI nefunguje', 'I give up, AI does not work']),
      t(['Používam výsledok aj tak', 'I use the result anyway']),
    ],
    correct: 1,
    why: t([
      'Model je ako neskúsený kolega: chyba je signál, že zadanie bolo nepresné, nie dôvod prestať.',
      'The model is like an inexperienced colleague: a mistake signals an unclear task, not a reason to stop.',
    ]),
  },
  {
    id: 'p4',
    q: t([
      'Vložili ste do AI osobné údaje (meno klienta, rodné číslo, firemné detaily)?',
      'Have you ever pasted personal data into AI (client name, ID number, company details)?',
    ]),
    options: [
      t(['Áno, pravidelne', 'Yes, regularly']),
      t(['Áno, raz', 'Yes, once']),
      t(['Nie, a mám na to pravidlo', 'No, and I have a rule against it']),
      t(['Neviem, čo sa smie', 'I do not know what is allowed']),
    ],
    correct: 2,
    why: t([
      'Neposielajte údaje, na ktoré nemáte právo posielať. Anonymizácia je základná hygiena.',
      'Do not send data you are not allowed to send. Anonymisation is basic hygiene.',
    ]),
  },
  {
    id: 'p5',
    q: t(['Ktorú oblasť chcete zlepšiť najviac?', 'Which area do you want to improve the most?']),
    options: [
      t(['Písanie a komunikáciu', 'Writing and communication']),
      t(['Programovanie a techniku', 'Programming and technical work']),
      t(['Analýzu dát a rozhodovanie', 'Data analysis and decision making']),
      t(['Učenie sa nových vecí', 'Learning new things']),
    ],
    correct: 0,
    why: t([
      'Oblasť, ktorá vás motivuje, je tá, v ktorej odporúčame začať.',
      'The area that motivates you most is where we recommend starting.',
    ]),
  },
]

/* ------------------------------------------------------------ šesť modulov -- */
const modules: Module[] = [
  {
    id: 'm1',
    icon: '🧭',
    title: t(['Základy zodpovedného používania AI', 'Responsible AI basics']),
    subtitle: t(['Čo AI je, čo nie je a kde sú jej hranice.', 'What AI is, what it is not, and where its limits are.']),
    minutes: 6,
    xp: 100,
    sections: [
      {
        heading: t(['Jazykový model je predpovedací stroj', 'A language model is a prediction engine']),
        body: [
          t([
            'Veľký jazykový model nevytvára odpovede z pravdy. Vytvára pravdepodobne najpravdepodobnejšie pokračovanie textu. Je to ako veľmi inteligentný súkromník, ktorý sa nikdy nenaučil, že môže byť nesprávny.',
            'A large language model does not produce answers from truth. It produces the most probable continuation of text. Think of a very smart sibling who never learned they can be wrong.',
          ]),
          t([
            'Praktický dôsledok: odpoveď môže znieť sebaistejšie, než ako je. Sebavedomý tón nie je dôkaz správnosti.',
            'Practical consequence: an answer can sound more confident than it is. A confident tone is not proof of correctness.',
          ]),
        ],
        tips: [
          t([
            'Všimnite si, či odpoveď obsahuje konkrétne overiteľné tvrdenia, alebo len pocitovo silné formulácie.',
            'Check whether the answer contains verifiable claims or just strongly worded feelings.',
          ]),
        ],
      },
      {
        heading: t(['Čo model nikdy neurobí sám', 'What the model never does on its own']),
        body: [
          t([
            'Nevykonáva akcie vo vašom systéme, kým mu ich výslovne nedáte. Nemá pamäť medzi konverzáciami, pokiaľ ju nenastavíte. A nepozná vaše interné procesy, kým ich nespíšete.',
            'It does not act inside your system unless you explicitly allow it. It has no memory between conversations unless you set one up. And it does not know your internal processes until you describe them.',
          ]),
        ],
      },
    ],
    quiz: [
      {
        id: 'm1q1',
        q: t([
          'Prečo môže byť AI odpoveď nesprávna, aj keď znie veľmi presvedčivo?',
          'Why can an AI answer be wrong even when it sounds convincing?',
        ]),
        options: [
          t(['Model nemá pripojený internet', 'The model has no internet access']),
          t(['Model generuje pravdepodobný text, nie overenú pravdu', 'The model generates likely text, not verified truth']),
          t(['Vadné jazykové schopnosti Slovákov', 'Broken Slovak language skills']),
          t(['Vysoké ceny za používanie', 'High usage costs']),
        ],
        correct: 1,
        why: t([
          'Chyba prichádza z mechanizmu generovania, nie z nedostatku informácií.',
          'The error comes from the generation mechanism, not from missing information.',
        ]),
      },
      {
        id: 'm1q2',
        q: t(['Čo je najlepšia praktika po získaní odpovede?', 'What is the best practice after receiving an answer?']),
        options: [
          t(['Poslať ju ďalej bez úprav', 'Forward it without changes']),
          t(['Skontrolovať fakty a citácie', 'Verify facts and citations']),
          t(['Pridať ďalších 50 slov kontextu', 'Add another 50 words of context']),
          t(['Vyskúšať iný model', 'Try a different model']),
        ],
        correct: 1,
        why: t([
          'Overenie je jediná spoľahlivá ochrana pred chybou a halucináciou.',
          'Verification is the only reliable protection against errors and hallucinations.',
        ]),
      },
      {
        id: 'm1q3',
        q: t(['Prečo do AI neposielame osobné údaje?', 'Why should personal data not be sent to AI?']),
        options: [
          t(['Spomaľuje to odpoveď', 'It slows the answer down']),
          t([
            'Môžu skončiť v tréningových dátach a únikom; GDPR to bez právneho základu zakazuje',
            'They may end up in training data or leak; GDPR forbids it without a legal basis',
          ]),
          t(['Model ich nevie spracovať', 'The model cannot process them']),
          t(['Zvyšujú cenu', 'They increase the cost']),
        ],
        correct: 1,
        why: t([
          'Ochrana osobných údajov je právna a etická povinnosť, nie iba technická opatrnosť.',
          'Data protection is a legal and ethical duty, not just technical caution.',
        ]),
      },
    ],
  },
  {
    id: 'm2',
    icon: '🧩',
    title: t(['Umenie promptovania: rola, kontext, formát', 'Prompting skills: role, context, format']),
    subtitle: t(['Tri stavebné bloky kvalitného promptu.', 'The three building blocks of a quality prompt.']),
    minutes: 8,
    xp: 120,
    sections: [
      {
        heading: t(['1. Rola (kto má odpovedať)', '1. Role (who answers)']),
        body: [
          t([
            '„Si skúsený daňový poradca so 15-ročnou praxou“ zmení slovník, hĺbku aj to, na čo sa poradca zamera. Rola určuje register a kritériá kvality.',
            '"You are a tax advisor with 15 years of experience" changes vocabulary, depth and focus. The role sets the register and the quality criteria.',
          ]),
        ],
      },
      {
        heading: t(['2. Kontext (o čom to je)', '2. Context (what it is about)']),
        body: [
          t([
            'Vložte maximum relevantných faktov: pre koho, aký cieľ, aké obmedzenia, čo už máte hotové. Model nepozná vašu situáciu, kým ju nenapíšete.',
            'Provide as many relevant facts as possible: for whom, what goal, what constraints, what is already done. The model does not know your situation until you write it.',
          ]),
        ],
      },
      {
        heading: t(['3. Formát (ako má vyzerať výstup)', '3. Format (how the output should look)']),
        body: [
          t([
            'Povedzte, čo chcete dostať: tabuľka, 5 bodov, kód s komentárom, e-mail do 150 slov. Formát nielen skracuje odpoveď, ale aj zvyšuje jej použiteľnosť.',
            'Say what you want to get: a table, 5 bullet points, commented code, an email of 150 words. Format shortens the answer and increases its usability.',
          ]),
        ],
        tips: [
          t([
            'Vzor: „Si [rola]. Potrebujem [cieľ] pre [publikum]. Použi [formát]. Obmedzenia: [limity].“',
            'Template: "You are [role]. I need [goal] for [audience]. Use [format]. Constraints: [limits]".',
          ]),
        ],
      },
    ],
    quiz: [
      {
        id: 'm2q1',
        q: t(['Čo z toho nie je súčasťou kvalitného promptu?', 'Which of these is NOT part of a quality prompt?']),
        options: [
          t(['Rola', 'Role']),
          t(['Kontext', 'Context']),
          t(['Formát', 'Format']),
          t(['Pestrosť slovníka', 'Rich vocabulary']),
        ],
        correct: 3,
        why: t([
          'Model produkuje bohatý slovník sám. Rozhoduje kvalita informácií, nie zdobnosť.',
          'The model produces rich vocabulary by itself. Information quality matters, not ornamentation.',
        ]),
      },
      {
        id: 'm2q2',
        q: t([
          'Ako najlepšie zistiť, či AI pochopilo vašu úlohu správne?',
          'How do you best check that AI understood your task correctly?',
        ]),
        options: [
          t(['Nechať si zadanie zopakovať vlastnými slovami', 'Have it restate the task in its own words']),
          t(['Počítať slová v prompte', 'Count the words in the prompt']),
          t(['Pýtať sa, či si je istý', 'Ask whether it is sure']),
          t(['Skúsiť to trikrát', 'Try it three times']),
        ],
        correct: 0,
        why: t([
          'Model, ktoré zadanie vystihne, ho zopakuje. Nepresné zopakovanie odhalí chybu skôr než dlhá odpoveď.',
          'A model that grasped the task will repeat it. An inaccurate repetition reveals the error earlier than a long answer.',
        ]),
      },
      {
        id: 'm2q3',
        q: t(['Kedy je najlepšie pridať do promptu ukážku (few-shot)?', 'When is it best to add an example (few-shot) to the prompt?']),
        options: [
          t(['Vždy, aby bol prompt dlhší', 'Always, to make the prompt longer']),
          t(['Keď potrebujete konkrétny štýl, formát alebo klasifikáciu', 'When you need a specific style, format or classification']),
          t(['Vôbec, model si poradí', 'Never, the model will cope']),
          t(['Len pri kóde', 'Only for code']),
        ],
        correct: 1,
        why: t([
          'Jedna ukážka zadá formát aj jazyk presnejšie než slovný opis.',
          'A single example specifies format and language far better than a verbal description.',
        ]),
      },
    ],
  },
  {
    id: 'm3',
    icon: '🔁',
    title: t(['Iterácia: zdokonaľovanie promptu', 'Iteration: refining your prompt']),
    subtitle: t(['Ako opravovať zadanie namiesto opakovania.', 'Fix the task instead of repeating it.']),
    minutes: 8,
    xp: 140,
    sections: [
      {
        heading: t(['Prvý pokus je probe', 'The first attempt is a probe']),
        body: [
          t([
            'Nevadí vám, že prvá odpoveď nie je dokonalá. Je to údaj: zistili ste, čo model potrebuje. Zlé výsledky sú lacné informácie, drahé je ich ignorovať.',
            'It is fine that the first answer is not perfect. It is data: you learned what the model needs. Bad results are cheap information; ignoring them is expensive.',
          ]),
        ],
      },
      {
        heading: t(['Korektívny prompt', 'The corrective prompt']),
        body: [
          t([
            'Namiesto celého nového pokusu napíšte presne to, čo zlyhalo: „Časť 2 je príliš všeobecná, chcem konkrétne čísla a zdroje.“ Model tak dostane presnú opravu.',
            'Instead of a whole new attempt, name exactly what failed: "Part 2 is too general, I want concrete numbers and sources." The model then gets a precise correction.',
          ]),
          t([
            'Formulácia „skús to lepšie“ je najmenej efektívny feedback, aký existuje. Aká je chyba, kde je chyba a čo presne chcete namiesto toho?',
            '"Try it better" is the least effective feedback that exists. What is wrong, where is it wrong, and what do you want instead?',
          ]),
        ],
        tips: [
          t([
            'Technika „chain of thought“: najprv nechajte model zapísať kroky riešenia, až potom výsledok.',
            'Chain of thought: first let the model write the steps, then the result.',
          ]),
        ],
      },
    ],
    quiz: [
      {
        id: 'm3q1',
        q: t(['Čo je najúčinnejší spôsob, ako reagovať na zlú odpoveď?', 'What is the most effective reaction to a bad answer?']),
        options: [
          t(['Skúsiť rovnaký prompt znova', 'Retry the same prompt']),
          t(['Napísať, čo konkrétne zlyhalo a ako to opraviť', 'Describe what specifically failed and how to fix it']),
          t(['Skrátiť prompt', 'Shorten the prompt']),
          t(['Prejsť na iný jazyk', 'Switch language']),
        ],
        correct: 1,
        why: t(['Presná korekcia mení najviac informácie za jednu iteráciu.', 'A precise correction changes the most information per iteration.']),
      },
      {
        id: 'm3q2',
        q: t(['Prečo nefunguje spätná väzba „skús to lepšie“?', 'Why does the feedback "try it better" not work?']),
        options: [
          t(['Je príliš dlhá', 'It is too long']),
          t(['Nevymedzuje, čo má byť iné', 'It does not define what should be different']),
          t(['Model ju nepodporuje', 'The model does not support it']),
          t(['Funguje, len pomaly', 'It works, just slowly']),
        ],
        correct: 1,
        why: t([
          'Bez kritéria sa model nemá čoho zachytiť a zopakuje ten istý postup.',
          'Without a criterion the model has nothing to hold on to and repeats the same path.',
        ]),
      },
      {
        id: 'm3q3',
        q: t(['Načo je technika chain of thought?', 'What is chain of thought used for?']),
        options: [
          t(['Na skrátenie odpovede', 'To shorten the answer']),
          t(['Na lepšie zreasonovanie zložitých úloh', 'To reason better about complex tasks']),
          t(['Na obmedzenie výstupu', 'To limit the output']),
          t(['Na preklady', 'For translations']),
        ],
        correct: 1,
        why: t([
          'Krokové premýšľanie výrazne zvyšuje presnosť pri viacstupňových úlohách.',
          'Step-by-step reasoning significantly improves accuracy on multi-step tasks.',
        ]),
      },
    ],
  },
  {
    id: 'm4',
    icon: '🔍',
    title: t(['Overovanie a práca s halucináciami', 'Verification and hallucinations']),
    subtitle: t(['Ako nespadnúť do pasívneho dôverovania.', 'How to avoid passive trust.']),
    minutes: 7,
    xp: 150,
    sections: [
      {
        heading: t(['Ako halucinácia vzniká', 'How a hallucination is born']),
        body: [
          t([
            'Model vytvára text, ktorý znie pravdepodobne. Ak nepozná odpoveď, nevypovie „neviem“, ale doplní niečo, čo štátne vyzerá správne: neexistujúci zákon, vymyslený odkaz, neexistujúcu funkciu knižnice.',
            'The model generates likely-looking text. If it does not know the answer, it does not say "I do not know" but fills in something plausible: a non-existent law, an invented link, a library function that does not exist.',
          ]),
          t([
            'Najrizikovejšie oblasti sú presné čísla, dátumy, citácie, právne predpisy a rozhrania programovacích jazykov.',
            'The riskiest areas are exact numbers, dates, citations, legal regulations and programming language APIs.',
          ]),
        ],
        tips: [
          t([
            'Vždy si nechajte model uviesť zdroj. Ak odkaz neexistuje, odpoveď je vymyslená.',
            'Always ask for a source. If the link does not exist, the answer is invented.',
          ]),
        ],
      },
      {
        heading: t(['Tri-päť minútové overenie', 'A three-to-five minute verification']),
        body: [
          t([
            '1. Vyhľadajte kľúčové tvrdenia. 2. Skontrolujte aspoň jedno číslo a jeden fakt. 3. Pri kóde si ho nechajte vysvetliť riadok po riadku. Len potom použite.',
            '1. Look up the key claims. 2. Check at least one number and one fact. 3. For code, have it explained line by line. Only then use it.',
          ]),
          t([
            'AI vám ušetrí čas na prvom koncepte. Nikdy vám neodstráni zodpovednosť za výsledok.',
            'AI saves you time on the first draft. It never removes your responsibility for the result.',
          ]),
        ],
      },
    ],
    quiz: [
      {
        id: 'm4q1',
        q: t(['Čo je typický príznak halucinácie?', 'What is a typical sign of a hallucination?']),
        options: [
          t(['Odpoveď je príliš krátka', 'The answer is too short']),
          t(['Veľmi konkrétne číslo alebo citácia, ktorú neviete nájsť', 'A very specific number or citation you cannot find']),
          t(['Použitie jednoduchých viet', 'Use of simple sentences']),
          t(['Odpoveď v slovenčine', 'The answer in Slovak']),
        ],
        correct: 1,
        why: t([
          'Náročnosť na detail je najpravdepodobnejšie miesto, kde sa chyba prejaví.',
          'Specificity is the most likely place where an error shows up.',
        ]),
      },
      {
        id: 'm4q2',
        q: t(['Ktoré tvrdenie o dôvere je správne?', 'Which statement about trust is correct?']),
        options: [
          t(['Ak to znie presvedčivo, je to pravdepodobne pravda', 'If it sounds convincing, it is probably true']),
          t(['Zodpovednosť za výsledok zostáva na človeku', 'Responsibility for the result stays with the human']),
          t(['Dlhá odpoveď je spoľahlivejšia', 'A long answer is more reliable']),
          t(['Novšie modaly neklamú', 'Newer models do not lie']),
        ],
        correct: 1,
        why: t([
          'Zodpovednosť sa nedelegovať nedá, aj keď je odpoveď veľmi presvedčivá.',
          'Responsibility cannot be delegated, however convincing the answer is.',
        ]),
      },
      {
        id: 'm4q3',
        q: t(['Čo by ste overili ako prvé pri výstupe s právnymi radami?', 'What would you verify first in an output with legal advice?']),
        options: [
          t(['Gramatiku', 'Grammar']),
          t(['Znenie predpisov a aktuálnosť', 'The wording of regulations and their currency']),
          t(['Dĺžku odpovede', 'The length of the answer']),
          t(['Názov spoločnosti', 'The company name']),
        ],
        correct: 1,
        why: t([
          'Právo sa mení a vymyslené ustanovenie má vážne následky.',
          'Law changes and an invented provision has serious consequences.',
        ]),
      },
    ],
  },
  {
    id: 'm5',
    icon: '⚙️',
    title: t(['AI v praxi: práca, dáta, rozhodnutia', 'AI in practice: work, data, decisions']),
    subtitle: t(['Kde vám AI reálne ušetrí čas.', 'Where AI actually saves you time.']),
    minutes: 9,
    xp: 180,
    sections: [
      {
        heading: t(['Tri najsilnejšie použitia', 'The three strongest use cases']),
        body: [
          t([
            'Prvý koncept: návrh, osnova, prvý draft. Druhý koncept: vysvetlenie a preklad zložitého textu do jazyka publika. Tretí: transformácia formátu (tabuľka → text e-mailu, poznámky → úlohy).',
            'First draft: outline, skeleton, first version. Second: explaining and translating complex text for an audience. Third: format transformation (table to email text, notes to tasks).',
          ]),
          t([
            'Čo naopak nepriraďujte AI: konečné rozhodnutia o ľuďoch, peniazoch a práve. Tam je zodpovedný človek, ktorý si musí vysvetliť prečo.',
            'What not to delegate to AI: final decisions about people, money and law. There a responsible human must be able to explain why.',
          ]),
        ],
        tips: [
          t([
            'Pred každým použitím si pýtajte: je to reverzibilné? Ak nie, musí vstúpiť človek.',
            'Before every use ask: is it reversible? If not, a human must step in.',
          ]),
        ],
      },
      {
        heading: t(['Dáta a tabuľky', 'Data and spreadsheets']),
        body: [
          t([
            'Formulujte cielene: „V tabuľke v stĺpcoch A a B spoj hodnoty, ak sa opakujú, a vráť výsledok v treťom stĺpci.“ Bez pomenovania stĺpcov model háda.',
            'Be specific: "In the table, join values from columns A and B when they repeat and return the result in column C." Without naming the columns the model guesses.',
          ]),
        ],
      },
    ],
    quiz: [
      {
        id: 'm5q1',
        q: t(['Ktorú úlohu má AI právo pomôcť, no nie rozhodnúť?', 'Which task may AI help with, but not decide?']),
        options: [
          t(['Príprava osnovy e-mailu', 'Preparing an email outline']),
          t(['Priatie konečného rozhodnutia o prijatí zamestnanca', 'Making the final hiring decision']),
          t(['Preformátovanie poznámok do úloh', 'Reformatting notes into tasks']),
          t(['Vysvetlenie zákona po laicky', 'A plain-language explanation of a law']),
        ],
        correct: 1,
        why: t([
          'Rozhodnutia s dopadom na ľudí musia zostať u človeka, ktorý ich zdôvodní.',
          'Decisions affecting people must stay with a human who can justify them.',
        ]),
      },
      {
        id: 'm5q2',
        q: t(['Ako najlepšie zadáť prácu s tabuľkou?', 'How do you best instruct AI with a spreadsheet?']),
        options: [
          t(['Vložiť celý súbor a čakať', 'Upload the whole file and wait']),
          t(['Pomenovať stĺpce, pravidlo a požadovaný výstup', 'Name the columns, the rule and the expected output']),
          t(['Opýtať sa „čo s tým mám“', 'Ask "what do I do with this"']),
          t(['Požiadať o súhrn čísel', 'Ask for a summary of numbers']),
        ],
        correct: 1,
        why: t(['Bez presnej schémy model vymýšľa, čo ste mali na mysli.', 'Without an exact schema the model invents what you meant.']),
      },
      {
        id: 'm5q3',
        q: t(['Čo znamená kritérium „reverzibilné“?', 'What does the "reversible" criterion mean?']),
        options: [
          t(['Dá sa to vrátiť späť do stavu, v ktorom ste boli', 'It can be undone to the state you were in']),
          t(['Je to rýchle', 'It is fast']),
          t(['Je to zadarmo', 'It is free']),
          t(['Je to jednoduché', 'It is simple']),
        ],
        correct: 0,
        why: t([
          'Nereverzibilné kroky (výplata, zmluva, zverejnenie) vždy overujte človekom.',
          'Irreversible steps (payments, contracts, publishing) are always verified by a human.',
        ]),
      },
    ],
  },
  {
    id: 'm6',
    icon: '🛡️',
    title: t(['Etika, súkromie a tímové pravidlá', 'Ethics, privacy and team rules']),
    subtitle: t(['Aby bol AI nástroj, ktorý vám nekazí prácu.', 'So AI is a tool that does not harm your work.']),
    minutes: 8,
    xp: 200,
    sections: [
      {
        heading: t(['Tri pravidlá pre tím', 'Three rules for a team']),
        body: [
          t([
            '1. Čo nesmie do AI: osobné údaje, obchodné tajomstvá, heslá, klientské kontrakty bez súhlasu. 2. Čo musí byť označené: výstup AI, ktorý ide do klienta. 3. Kto zodpovedá: autor výstupu, nie nástroj.',
            '1. What must not enter AI: personal data, trade secrets, passwords, client contracts without consent. 2. What must be labelled: AI output going to a client. 3. Who is responsible: the author of the output, not the tool.',
          ]),
        ],
      },
      {
        heading: t(['Autori a priznanie', 'Authorship and disclosure']),
        body: [
          t([
            'V škole, na univerzite aj v práci platí: uveďte, kde a ako ste AI použili. Prezentačný štýl, obrázky, kód aj preklady podliehajú pravidlám originality.',
            'In school, at university and at work: state where and how you used AI. Presentation style, images, code and translations all follow originality rules.',
          ]),
          t([
            'Najsilnejšie podpisy sú: „Túto časť som vygeneroval a následne overil“ alebo „Túto prácu som napísal s pomocou AI“. Tichošľpnosť je oveľa riskantnejšia než priznanie.',
            'The strongest disclaimers are: "This part was generated and then verified by me" or "I wrote this with AI assistance." Silence is far riskier than disclosure.',
          ]),
        ],
        tips: [
          t([
            'Pred odoslaním von sa spýtajte: bol by som ochotný povedať kolegovi presne to, čo som dal AI?',
            'Before sending: would I be comfortable telling a colleague exactly what I gave to AI?',
          ]),
        ],
      },
    ],
    quiz: [
      {
        id: 'm6q1',
        q: t(['Ktoré informácie by ste do firemného AI nikdy neposielali?', 'Which information would you never send to a company AI?']),
        options: [
          t(['Verejné novinky', 'Public news']),
          t(['Obchodné tajomstvá a osobné údaje klientov', 'Trade secrets and client personal data']),
          t(['Všeobecné návody', 'General tutorials']),
          t(['Prázdnu šablónu e-mailu', 'An empty email template']),
        ],
        correct: 1,
        why: t(['Tajomstvá a osobné údaje chráni zákon aj zmluvné záväzky.', 'Both law and contractual commitments protect secrets and personal data.']),
      },
      {
        id: 'm6q2',
        q: t(['Kto zodpovedá za chybu vo výstupe AI, ktorý podpísal človek?', 'Who is responsible for an error in AI output signed by a human?']),
        options: [
          t(['Poskytovateľ modelu', 'The model provider']),
          t(['Človek, ktorý výstup podpísal', 'The human who signed the output']),
          t(['Nikto, je to strojová chyba', 'Nobody, it is a machine error']),
          t(['IT oddelenie', 'The IT department']),
        ],
        correct: 1,
        why: t(['Podpis je prevzatím zodpovednosti, nie prenosom na nástroj.', 'Signing takes over responsibility; it does not transfer it to the tool.']),
      },
      {
        id: 'm6q3',
        q: t(['Ako najlepšie vyznie priznanie použitia AI?', 'What is the best way to disclose AI use?']),
        options: [
          t(['Nepovedať, ak to nie je zakázané', 'Say nothing if it is not forbidden']),
          t(['Povedať, kde a ako ste AI použili', 'State where and how you used AI']),
          t(['Spýtať sa kolegu, čo on používa', 'Ask a colleague what they use']),
          t(['Spomenúť to až vtedy, keď sa to niekoho týka', 'Mention it only when it affects someone']),
        ],
        correct: 1,
        why: t(['Transparentnosť chráni vás aj ostatných viac než mlčanie.', 'Transparency protects you and others more than silence.']),
      },
    ],
  },
]

const FINAL_PASS_SCORE = 16
const FINAL_TOTAL = 20

/* ------------------------------------------------------- záverečný test -- */
const finalTest: QuizQuestion[] = [
  {
    id: 'f1',
    q: t(['Ako v skutočnosti vzniká text v jazykovom modeli?', 'How does a language model actually produce text?']),
    options: [
      t(['Vyhľadáva v databáze hotových odpovedí', 'It searches a database of finished answers']),
      t(['Postupne predpovedá najpravdepodobnejšie pokračovanie', 'It predicts the most probable continuation step by step']),
      t(['Kopíruje z Wikipédie', 'It copies from Wikipedia']),
      t(['Používa pravidlá slovenskej gramatiky', 'It uses Slovak grammar rules']),
    ],
    correct: 1,
    why: t(['Nejde o vyhľadávanie faktov, ale o generovanie pravdepodobného textu.', 'It is not fact lookup but generation of likely text.']),
  },
  {
    id: 'f2',
    q: t(['Ktoré tri prvky tvoria efektívny prompt?', 'Which three elements make up an effective prompt?']),
    options: [
      t(['Rola, kontext, formát', 'Role, context, format']),
      t(['Dĺžka, gramatika, slovník', 'Length, grammar, vocabulary']),
      t(['Angličtina, formálnosť, zdvorilosť', 'English, formality, politeness']),
      t(['Čísla, dátumy, názvy', 'Numbers, dates, names']),
    ],
    correct: 0,
    why: t(['Táto trojica rieši hlavné nejasnosti: kto odpovedá, o čom a ako.', 'This trio resolves the main ambiguities: who answers, about what and how.']),
  },
  {
    id: 'f3',
    q: t(['Čo je halucinácia?', 'What is a hallucination?']),
    options: [
      t(['Výpadok siete', 'A network outage']),
      t(['Presvedčivá, ale vymyslená informácia', 'Confident but invented information']),
      t(['Príliš dlhá odpoveď', 'An overly long answer']),
      t(['Odmietnutie odpovedať', 'A refusal to answer']),
    ],
    correct: 1,
    why: t([
      'Model vymýšľa preto, že generuje pravdepodobne znejúce pokračovanie, nie preto, že by klamal zámerne.',
      'The model invents because it generates likely continuations, not because it intends to deceive.',
    ]),
  },
  {
    id: 'f4',
    q: t(['Prečo nedávať do AI osobné údaje klientov?', 'Why not send client personal data to AI?']),
    options: [
      t(['Lebo je to pomalšie', 'Because it is slower']),
      t(['Môžu byť použité na tréning alebo uniknúť; chráni ich zákon', 'They may be used for training or leak; the law protects them']),
      t(['Lebo model ich nevie čítať', 'Because the model cannot read them']),
      t(['Lebo to zvyšuje cenu', 'Because it increases the cost']),
    ],
    correct: 1,
    why: t(['Osobné údaje sú chránené zákonom a ich poslanie môže znamenať únik aj škodu.', 'Personal data is protected by law; sending it may cause a leak and harm.']),
  },
  {
    id: 'f5',
    q: t(['Čo znamená iteratívne promptovanie?', 'What does iterative prompting mean?']),
    options: [
      t(['Posielať ten istý prompt dovtedy, kým nevyjde', 'Sending the same prompt until it works']),
      t(['Postupne upresňovať zadanie na základe výsledku', 'Refining the task step by step based on the result']),
      t(['Používať viac modelov naraz', 'Using several models at once']),
      t(['Skracovať prompt, kým to nesedí', 'Shortening the prompt until it fits']),
    ],
    correct: 1,
    why: t(['Každá iterácia pridá informáciu o tom, čo model potrebuje.', 'Each iteration adds information about what the model needs.']),
  },
  {
    id: 'f6',
    q: t(['Ktorá spätná väzba je pre model najnajúčinnejšia?', 'Which feedback is most effective for the model?']),
    options: [
      t(['Skús to lepšie', 'Try it better']),
      t(['Treba viac', 'Needs more']),
      t(['V bode 3 je nesprávny dátum, má byť 2026, nie 2024', 'In point 3 the date is wrong, it should be 2026, not 2024']),
      t(['Skús iný model', 'Try another model']),
    ],
    correct: 2,
    why: t(['Presná oprava s kritériom skracuje cyklus na jednu iteráciu.', 'A precise correction with a criterion shortens the cycle to one iteration.']),
  },
  {
    id: 'f7',
    q: t(['Načo slúži few-shot príklad?', 'What is a few-shot example for?']),
    options: [
      t(['Na predĺženie promptu', 'To lengthen the prompt']),
      t(['Na presné zadanie formátu alebo štýlu', 'To specify format or style precisely']),
      t(['Na zvýšenie ceny', 'To increase the cost']),
      t(['Na obmedzenie modelu', 'To limit the model']),
    ],
    correct: 1,
    why: t(['Ukážka je presnejšia než slovný opis.', 'An example is more precise than a verbal description.']),
  },
  {
    id: 'f8',
    q: t(['Kde je hranica zodpovednosti pri použití AI?', 'Where is the boundary of responsibility when using AI?']),
    options: [
      t(['Zodpovedný je poskytovateľ modelu', 'The model provider is responsible']),
      t(['Zodpovedný je používateľ, ktorý výsledok použije', 'The user who applies the result is responsible']),
      t(['Zodpovedný je prekladací softvér', 'The translation software is responsible']),
      t(['Nikto, je to automatizovaný proces', 'Nobody, it is an automated process']),
    ],
    correct: 1,
    why: t(['Použitie a podpísanie výsledku je vždy ľudské rozhodnutie.', 'Applying and signing a result is always a human decision.']),
  },
  {
    id: 'f9',
    q: t(['Prečo je dôležitý formát výstupu?', 'Why does the output format matter?']),
    options: [
      t(['Ušetrí tokeny', 'It saves tokens']),
      t(['Umožní výsledok priamo použiť bez úprav', 'It makes the result directly usable without editing']),
      t(['Najde chyby', 'It finds errors']),
      t(['Urýchli odpoveď', 'It speeds up the answer']),
    ],
    correct: 1,
    why: t(['Dobrá štruktúra znamená menej ručnej práce.', 'A good structure means less manual work.']),
  },
  {
    id: 'f10',
    q: t(['Čo má model urobiť, keď niečo nevie?', 'What should the model do when it does not know something?']),
    options: [
      t(['Uhádnuť pravdepodobnú odpoveď', 'Guess a likely answer']),
      t(['Priamať vypísať, že to nevie', 'Admit that it does not know']),
      t(['Vrátiť prázdnu odpoveď', 'Return an empty answer']),
      t(['Zmeniť tému', 'Change the topic']),
    ],
    correct: 1,
    why: t(['Výslovné dovolenie priznať neznalosť znižuje počet vymyslených detailov.', 'Explicitly allowing an admission reduces invented detail.']),
  },
  {
    id: 'f11',
    q: t(['Ktorú úlohu by ste nikdy nenechali AI rozhodnúť?', 'Which task would you never let AI decide?']),
    options: [
      t(['Napísať osnovu prezentácie', 'Writing a presentation outline']),
      t(['Rozhodnúť, koho prijať na pozíciu', 'Deciding whom to hire']),
      t(['Preložiť text do angličtiny', 'Translating a text into English']),
      t(['Vytvoriť zoznam úloh z poznámok', 'Creating a task list from notes']),
    ],
    correct: 1,
    why: t(['Rozhodnutie s dopadom na človeka musí mať na svedomí konkrétny človek.', 'A decision affecting a person must be owned by a named human.']),
  },
  {
    id: 'f12',
    q: t(['Prečo nie je vhodné žiadať AI o právny výklad?', 'Why is it unsuitable to ask AI for a legal interpretation?']),
    options: [
      t(['Lebo právo sa mení a model môže citovať neexistujúce ustanovenie', 'Because law changes and the model may cite a non-existent provision']),
      t(['Lebo je to príliš drahé', 'Because it is too expensive']),
      t(['Lebo AI nepozná slovenčinu', 'Because AI does not know Slovak']),
      t(['Lebo právnici sú len ľudia', 'Because lawyers are only human']),
    ],
    correct: 0,
    why: t(['Vymyslené ustanovenie má vážne právne následky.', 'An invented provision has serious legal consequences.']),
  },
  {
    id: 'f13',
    q: t(['Čo znamená transparentnosť v práci s AI?', 'What does transparency in AI work mean?']),
    options: [
      t(['Priznať, kde a ako ste AI použili', 'Disclosing where and how you used AI']),
      t(['Použiť čo najviac modelov', 'Using as many models as possible']),
      t(['Nikdy nemeniť výstup modelu', 'Never editing model output']),
      t(['Skrývať použitie AI', 'Hiding the use of AI']),
    ],
    correct: 0,
    why: t(['Priznanie chráni vás aj ostatných viac než tichošľpnosť.', 'Disclosure protects you and others more than silence.']),
  },
  {
    id: 'f14',
    q: t(['Ako najlepšie zabezpečiť, aby AI nevymýšľalo zdroje?', 'How do you best prevent AI from inventing sources?']),
    options: [
      t(['Žiadať citácie a následne ich overiť', 'Ask for citations and then verify them']),
      t(['Zakázať mu citovať', 'Forbid it to cite']),
      t(['Žiadať citácie iba v slovenčine', 'Ask for citations in Slovak only']),
      t(['Použiť kratší prompt', 'Use a shorter prompt']),
    ],
    correct: 0,
    why: t(['Overenie je jediná spoľahlivá metóda. Čím viac zdrojov, tým väčšia šansa na chybu.', 'Verification is the only reliable method. The more sources, the higher the chance of error.']),
  },
  {
    id: 'f15',
    q: t(['Ktoré kritérium určuje, či je výstup použiteľný?', 'Which criterion determines whether an output is usable?']),
    options: [
      t(['Estetický dojem', 'Aesthetic impression']),
      t(['Zhoda s kritériami, ktoré ste si stanovili vopred', 'Agreement with criteria you set in advance']),
      t(['Dĺžka odpovede', 'The length of the answer']),
      t(['Počet interpunkcie', 'The amount of punctuation']),
    ],
    correct: 1,
    why: t(['Bez vopred stanovených kritérií si výsledok vždy posúdite ako „super“.', 'Without predefined criteria you always judge the result as "great".']),
  },
  {
    id: 'f16',
    q: t(['Ako reagovať, keď AI vráti vymyslený zákon?', 'How to react when AI returns an invented law?']),
    options: [
      t(['Iba to opraviť', 'Just correct it']),
      t(['Nahlásiť to v konverzácii ako pravidlo a výstup označiť ako neoverený', 'Report it in the conversation as a rule and mark the output as unverified']),
      t(['Použiť to, lebo znie odborne', 'Use it because it sounds professional']),
      t(['Skrátiť odpoveď', 'Shorten the answer']),
    ],
    correct: 1,
    why: t(['Oprava bez záznamu sa zopakuje. Záznam chyby zlepšuje ďalšie odpovede.', 'A correction without a record repeats itself. Logging the error improves later answers.']),
  },
  {
    id: 'f17',
    q: t(['Ktorý typ úlohy je pre AI najvhodnejší?', 'Which type of task suits AI best?']),
    options: [
      t(['Konečné právne rozhodnutie', 'A final legal decision']),
      t(['Vytvorenie prvého konceptu textu', 'Creating a first draft of a text']),
      t(['Schválenie výplaty', 'Approving a payout']),
      t(['Rozhodnutie o prepustení', 'Deciding on a dismissal']),
    ],
    correct: 1,
    why: t(['Prvý koncept je lacný na kontrolu a šetrí najviac času.', 'A first draft is cheap to review and saves the most time.']),
  },
  {
    id: 'f18',
    q: t(['Čo je najlepší spôsob, ako chrániť súkromie v prompte?', 'What is the best way to protect privacy in a prompt?']),
    options: [
      t(['Anonymizovať údaje pred odoslaním', 'Anonymise the data before sending']),
      t(['Napísať, že sú dôverné', 'Write that it is confidential']),
      t(['Použiť angličtinu', 'Use English']),
      t(['Požiadať o zmazanie konverzácie', 'Ask for the conversation to be deleted']),
    ],
    correct: 0,
    why: t(['Anonymizácia pred cestou k API je jediná ochrana, ktorú máte úplne pod kontrolou.', 'Anonymising before the request leaves your machine is the only fully controllable protection.']),
  },
  {
    id: 'f19',
    q: t(['Čo znamená „reverzibilný“ krok?', 'What is a "reversible" step?']),
    options: [
      t(['Krok, ktorý sa dá vrátiť späť', 'A step that can be undone']),
      t(['Krok, ktorý rýchlo prebehne', 'A step that happens quickly']),
      t(['Krok, ktorý je zadarmo', 'A step that is free']),
      t(['Krok, ktorý je jednoduchý', 'A step that is simple']),
    ],
    correct: 0,
    why: t(['Nereverzibilné kroky vždy posúďte dvakrát.', 'Always double-check irreversible steps.']),
  },
  {
    id: 'f20',
    q: t(['Aká je najlepšia dlhodobá prax pri práci s AI?', 'What is the best long-term practice when working with AI?']),
    options: [
      t(['Skupovať prompty a pravidlá do vlastnej knihovnice', 'Collect prompts and rules into your own library']),
      t(['Používať vždy najdrahší model', 'Always use the most expensive model']),
      t(['Skúšať nový nástroj každý deň', 'Try a new tool every day']),
      t(['Snažiť sa AI nahradiť', 'Try to replace AI']),
    ],
    correct: 0,
    why: t(['Osvedčené prompty a pravidlá sú zisk, ktorý rastie s každým prípadom.', 'Proven prompts and rules are an asset that grows with every case.']),
  },
]

/* -------------------------------------------- porovnanie dobrý vs. slabý -- */
const compareTasks: CompareTask[] = [
  {
    id: 'c1',
    task: t(['Pripraviť návrh e-mailu pre klienta o meškaní dodávky.', 'Draft an email to a client about a delayed delivery.']),
    weak: t(['Napíš mi e-mail pre klienta.', 'Write me an email for a client.']),
    good: t([
      'Si komunikačný špecialista pre B2B logistiku. Napíš e-mail pre manažera klientskej firmy, ktorému meškáme s dodávkou 4 dni. Tón: profesionálny, úprimný, bez výčitok. Dĺžka max. 120 slov. Uveď: dôvod meškania, nový termín, čo robíme na kompenzácii a telefon na kontakt. Nepoužívaj všeobecné ospravedlnenie, uveď konkrétny dôvod.',
      'You are a B2B logistics communication specialist. Write an email to the client manager we are 4 days late on. Tone: professional, honest, without blame. Max 120 words. Include: reason for the delay, new date, what we do as compensation and a contact number. No generic apology, state a concrete reason.',
    ]),
    outcomeWeak: t([
      'Všeobecný, dlhý text s klišé. Bez dátumu, bez konkrétneho dôvodu. Pred podpisom by ste ho prepísali od nuly.',
      'Generic, long text with clichés. No date, no concrete reason. You would rewrite it from scratch before signing.',
    ]),
    outcomeGood: t([
      'Mail má 90 slov, obsahuje konkrétny termín aj dôvod. Posielate ho po malej redakcii a podpisujete.',
      'The mail has 90 words, contains a concrete date and reason. You send it after minor editing and sign it.',
    ]),
    why: [
      t(['Rola určuje register a odborný jazyk.', 'The role sets the register and professional language.']),
      t(['Číselné obmedzenia (dĺžka) bránia rozbehu do vody.', 'Numeric limits (length) prevent rambling.']),
      t(['Vylúčenie klišé odstraňuje najčastejšiu chybu.', 'Excluding clichés removes the most common failure.']),
    ],
  },
  {
    id: 'c2',
    task: t(['Vysvetliť novému kolegovi proces fakturácie.', 'Explain the invoicing process to a new colleague.']),
    weak: t(['Vysvetli mi fakturáciu.', 'Explain invoicing to me.']),
    good: t([
      'Si senior účtový pracovník. Priprav 6-krokový návod pre nového kolegu, ktorý nastupuje do slovenskej firmy. Kroky číslované, max 2 vety na krok. Uveď: kedy vystaviť faktúru, čo musí byť na nej podľa našich interných pravidiel, kedy je splatnosť, kto schvaľuje, čo robiť pri chybe a kam sa obracať. Čo závisí od zákona, označ ako „over v našom SOP“.',
      'You are a senior accountant. Prepare a 6-step guide for a new colleague joining a Slovak company. Numbered steps, max 2 sentences per step. Include: when to issue an invoice, what must be on it per our internal rules, due dates, who approves, what to do on an error and who to contact. Mark anything depending on law as "verify in our SOP".',
    ]),
    outcomeWeak: t(['Všeobecný popis, ktorý sa hodí pre žiadnu firmu a neobsahuje vaše pravidlá.', 'A generic description that fits no company and contains none of your rules.']),
    outcomeGood: t(['Konkretný postup, ktorý nový kolega splní bez ďalších otázok.', 'A concrete procedure the new colleague can follow without further questions.']),
    why: [
      t(['Počet krokov a dĺžka vety sú merateľné kritériá.', 'Step count and sentence length are measurable criteria.']),
      t(['Bodový zoznam tém zabráni, aby model vynechal krok.', 'A topic list prevents the model from skipping a step.']),
    ],
  },
  {
    id: 'c3',
    task: t(['Napísať testovacie scenáre pre prihlasovaciu funkciu.', 'Write test scenarios for a login feature.']),
    weak: t(['Napíš testy na login.', 'Write tests for login.']),
    good: t([
      'Si senior QA testér. Vytvor 8 testovacích scenárov pre prihlásenie do aplikácie: ID, názov, očakávaný výsledok. Pokryj: platné prihlásenie, zlé heslo, neexistujúci účet, zamknutý účet po 3 neúspešných pokusoch, obnovenie hesla, vypršanie sesie, prázdne polia, SQL injekcia v poli hesla. Pri každom scenári uveď očakávaný stav po teste a či ide o blokujúcu chybu.',
      'You are a senior QA tester. Create 8 test scenarios for logging into an app: ID, title, expected result. Cover: valid login, wrong password, non-existent account, account locked after 3 failed attempts, password reset, session expiry, empty fields, SQL injection in the password field. For each scenario state the expected state afterwards and whether it is a blocking bug.',
    ]),
    outcomeWeak: t(['Päť všeobecných scenárov bez hraničných prípadov, ktoré zaručene odhalia chyby.', 'Five generic scenarios without edge cases that would catch real bugs.']),
    outcomeGood: t(['Scenáre pokrývajú bezpečnost aj UX chyby, testy sa dajú priamo preniesť do reportu.', 'Scenarios cover security and UX bugs and can be moved directly into a report.']),
    why: [
      t(['Výslovný zoznam hraničných prípadov je najcennejšia časť promptu.', 'An explicit list of edge cases is the most valuable part of the prompt.']),
      t(['Štruktúra výstupu nahrádza manuálnu úpravu.', 'The output structure replaces manual editing.']),
    ],
  },
  {
    id: 'c4',
    task: t(['Zhrnúť 40-stránovú zmluvu pre školského rodiča.', 'Summarise a 40-page contract for a school parent.']),
    weak: t(['Zhrň túto zmluvu.', 'Summarise this contract.']),
    good: t([
      'Si právna asistentka špecializovaná na školské zmluvy. Vyextrahuj z vloženého textu body, ktoré môžu ovplyvniť rodiča: termíny, platby, zodpovednosť, možnosť odstúpenia. Uveď článok a stranu pre každý bod. Ak niečo v zmluve chýba, napíš „neuvedené“. Žiadne právne poradenstvo, len zhrnutie faktov zo zadania, max 200 slov.',
      'You are a legal assistant specialising in school contracts. Extract from the pasted text the points that may affect a parent: deadlines, fees, liability, termination options. Give the article and page for each point. If something is missing write "not stated". No legal advice, only a summary of facts from the input, max 200 words.',
    ]),
    outcomeWeak: t(['Hrubý súhrn alebo vymyslené body, ktoré treba čítať celé znova.', 'A rough summary or invented points, forcing you to reread the whole contract.']),
    outcomeGood: t(['Pol strany namiesto dvoch hodín čítania. Každý bod má odkaz na článok.', 'Half a page instead of two hours of reading. Every point references an article.']),
    why: [
      t(['Odkaz na článok umožní overiť, či model zmluvu nepochopil.', 'Article references let you check whether the model misread the contract.']),
      t(['„Ak niečo chýba, napíš neuvedené“ zabraňuje halucinácii.', '"If something is missing, write not stated" prevents hallucination.']),
    ],
  },
]

/* ------------------------------------------------- prípadové štúdie (4) -- */
const caseStudies: CaseStudy[] = [
  {
    id: 'k1',
    icon: '🏢',
    title: t(['Malá firma a zákaznícka objednávka', 'A small company and a customer order']),
    situation: t([
      'Obchodník dostal od klienta 12 fotografií a zoznam tovaru, ktorý chce objednať. Má vypracovať návrh objednávky do dvoch hodín.',
      'A salesperson received 12 photos and a list of items from a client and must draft an order proposal within two hours.',
    ]),
    bad: t([
      'Nahrá všetky fotografie do AI s otázkou „čo to je“ a výsledok skopíruje do e-mailu. Polovica názvov je nepresná a dve položky vôbec neexistujú.',
      'They upload all photos to AI asking "what is this" and copy the result into an email. Half the names are wrong and two items do not exist.',
    ]),
    good: t([
      'Najprv dôkladne opíše kontext, potom žiada jednoznačný formát s príznakmi istoty a na konci zoznam nejasností na overenie s klientom.',
      'First describe the context thoroughly, then request a strict format with confidence flags and finally a list of uncertainties to verify with the client.',
    ]),
    steps: [
      t([
        'Prompt: „Si vedúca evidencie v obchode. Dostávam 12 fotografií. Vráť tabuľku: názov, kód, množstvo, istota (vysoká/stredná/nízka). Ak si nie si istý, napíš otázku namiesto názvu.“',
        'Prompt: "You are a head of inventory in trade. I am sending 12 photos. Return a table: name, code, quantity, confidence (high/medium/low). If unsure, write a question instead of a name."',
      ]),
      t(['Skontroluje všetky riadky s nízkou istotou a opýta sa klienta na 3 položky.', 'They check every low-confidence row and ask the client about 3 items.']),
      t(['E-mail poslaný s jasným zoznamom potvrdených položiek a otázok do večera.', 'The email is sent in the evening with a clear list of confirmed items and questions.']),
    ],
    takeaway: t([
      'Nízka istota je užitočný údaj. Prompt, ktorý ju vyžaduje, je lepší než prompt, ktorý ju skrýva.',
      'Low confidence is useful data. A prompt that demands it beats a prompt that hides it.',
    ]),
  },
  {
    id: 'k2',
    icon: '🎓',
    title: t(['Študent a esej z biochémie', 'A student and a biochemistry essay']),
    situation: t(['Študent druhého ročníka píše esej o enzymatických dráhach. Má 4 týždne, deadline je pevný.', 'A second-year student writes an essay on enzymatic pathways. They have four weeks and a fixed deadline.']),
    bad: t([
      'Požiada o „Esej o enzýmoch, 1000 slov“ a väčšinu textu prekopíruje. Učiteľ to rozpozná po formuláciách.',
      'They ask for "an essay about enzymes, 1000 words" and copy most of it. The teacher recognises it by phrasing.',
    ]),
    good: t([
      'Použije AI ako učiteľa, nie autora: vysvetľuje si koncept a žiada o otázky, ktoré mu pomôžu štruktúrovať vlastný text.',
      'They use AI as a tutor, not an author: they explain the concept and ask for questions that help them structure their own text.',
    ]),
    steps: [
      t(['Krok 1: „Vysvetli mi jednoducho, ako funguje inhibícia spätnou väzbou, potom ma nechaj na to odpovedať.“', 'Step 1: "Explain feedback inhibition simply, then let me answer it myself."']),
      t(['Krok 2: „Daj mi 5 otázok, ktoré by mi učiteľ položil na tému regulácie metabolizmu.“', 'Step 2: "Give me 5 questions a teacher would ask about metabolic regulation."']),
      t(['Esej napíše sám, pri citáciách použije skutočné zdroje a prizná sa, kde si pomohol s formuláciou.', 'They write the essay themselves, use real sources for citations and disclose where AI helped with wording.']),
    ],
    takeaway: t(['Najcennejšie prompty sú tie, ktoré vás učia. Generovanie textu je lacné, pochopenie nie.', 'The most valuable prompts are the ones that teach you. Generating text is cheap, understanding is not.']),
  },
  {
    id: 'k3',
    icon: '💻',
    title: t(['Vývojár a bezpečný prihlasovací formulár', 'A developer and a secure login form']),
    situation: t(['Tím píše prihlasovací formulár a potrebuje ho skontrolovať pred produkciou.', 'A team writes a login form and needs a review before production.']),
    bad: t(['Vloží 400 riadkov kódu bez kontextu a žiada „skontroluj bezpečnosť“. Model nájde 3 veci, z toho 2 sú nezmysly.', 'They paste 400 lines of code without context and ask "review the security". The model finds 3 things, 2 of them nonsense.']),
    good: t(['Opíše architektúru, verzie knižníc a hrozby, ktoré sa obávajú, a žiada o štruktúrovaný prehľad podľa závažnosti.', 'They describe the architecture, library versions and their threats, and ask for a severity-based review.']),
    steps: [
      t([
        'Prompt: „Kontext: Node 20, Express 4, sesie v Redis, heslá cez bcrypt. Bojujeme sa s únikom sesie a credential stuffingom. Skontroluj nasledujúci kód. Vráť tabuľku: nález, závažnosť, dôvod, konkrétna oprava.“',
        'Prompt: "Context: Node 20, Express 4, sessions in Redis, passwords via bcrypt. We worry about session hijacking and credential stuffing. Review the code below. Return a table: finding, severity, reason, concrete fix."',
      ]),
      t(['Nálezy overí podľa oficiálnej dokumentácie; tie, ktoré neobstojú, zahodí.', 'Findings are verified against official docs; those that do not hold up are discarded.']),
      t(['Ostatné reálne chyby opraví ručne a pridá test.', 'The remaining real errors are fixed manually and covered by a test.']),
    ],
    takeaway: t(['Bez kontextu a bez formátu je odpoveď taká všeobecná, že ju nemožno použiť.', 'Without context and format the answer is so generic that it cannot be used.']),
  },
  {
    id: 'k4',
    icon: '📊',
    title: t(['Manažér a podávanie reportu', 'A manager and a status report']),
    situation: t(['Manažér musí do 15 minút pripraviť status pre vedenie banky po oneskorení projektu.', 'A manager must prepare a status briefing for bank leadership within 15 minutes after a project delay.']),
    bad: t(['Pýta si „napíš status report“ a posiela 40 riadkov bez čísel a bez žiadneho návrhu riešenia.', 'They ask to "write a status report" and send 40 lines without numbers and without any proposed solution.']),
    good: t(['Požiada o štruktúru, ktorú vedenie reálne používa, a výslovne vyžaduje 3 čísla, ktoré musia byť v hlave správy.', 'They ask for the structure leadership actually uses and explicitly require the 3 numbers that must be in the headline.']),
    steps: [
      t([
        'Prompt: „Si projektový manažér. Píšem pre vedenie: stav, príčina, čo robíme, čo potrebujem. Dĺžka 150 slov, bez žargonu. Prvý odstavec musí obsahovať 3 čísla.“',
        'Prompt: "You are a project manager. I am writing for leadership: status, cause, actions, what I need. 150 words, no jargon. The first paragraph must contain 3 numbers."',
      ]),
      t(['Doplní reálne čísla z reportu a ručne skontroluje formulácie.', 'They insert the real numbers from the report and manually check the wording.']),
      t(['Odošle a počká na otázky – odpovede z nich si zapíše do ďalšieho statusu.', 'They send it and wait for questions, writing the answers into the next status.']),
    ],
    takeaway: t(['Formát, ktorý používa človek, je cennejší než formát, ktorý len vyzerá pekne.', 'A format the human actually uses beats one that merely looks nice.']),
  },
]

/* -------------------------------------------------------- denná výzva (20) -- */
const challenges: Challenge[] = [
  {
    id: 'ch1',
    title: t(['Pridaj formát', 'Add a format']),
    task: t([
      'Vezmite poslednú úlohu, ktorú ste riešili, a pridajte do promptu presný formát výstupu (napr. tabuľka s 3 stĺpcami). Porovnajte výsledky.',
      'Take the last task you solved and add an exact output format (e.g. a table with 3 columns). Compare the results.',
    ]),
    hint: t(['Povedzte slovo „tabuľka“ a vypíšte stĺpce.', 'Say the word "table" and name the columns.']),
  },
  {
    id: 'ch2',
    title: t(['Nastav rolu', 'Set a role']),
    task: t([
      'Pridajte na začiatok promptu rolu: „Si [profesia] s 10-ročnou praxou.“ Spustite to isté zadanie s a bez role.',
      'Add a role at the start of the prompt: "You are [profession] with 10 years of experience." Run the same task with and without the role.',
    ]),
    hint: t(['Roba zmení slovník aj to, na čo sa odpoveď zameria.', 'The role changes vocabulary and focus.']),
  },
  {
    id: 'ch3',
    title: t(['Ukáž mi chybu', 'Show me the error']),
    task: t([
      'Namiesto slova „oprav to“ napíšte presnú chybu: ktorá veta, ktorý bod, čo je v nej zlé a čo tam má byť.',
      'Instead of "fix it", state the exact error: which sentence, which point, what is wrong and what should be there.',
    ]),
    hint: t(['Čím konkrétnejšie kritérium, tým menej iterácií.', 'The more specific the criterion, the fewer iterations.']),
  },
  {
    id: 'ch4',
    title: t(['Ukážka namiesto opisu', 'Example instead of description']),
    task: t([
      'Namiesto slovného opisu formátu vložte jeden krátky vzor, ktorý chcete zopakovať.',
      'Instead of describing the format, paste one short sample you want repeated.',
    ]),
    hint: t(['Jedna ukážka je presnejšia ako tri vety popisu.', 'One example is more precise than three sentences of description.']),
  },
  {
    id: 'ch5',
    title: t(['Krok za krokom', 'Step by step']),
    task: t([
      'Pridaj do zadania: „Najprv vypíš kroky riešenia, až potom výsledok.“ Porovnaj presnosť.',
      'Add to the task: "First list the solution steps, then the result." Compare accuracy.',
    ]),
    hint: t(['Intermediárne kroky zlepšujú presnosť zložitých úloh.', 'Intermediate steps improve accuracy on complex tasks.']),
  },
  {
    id: 'ch6',
    title: t(['Skontroluj zdroje', 'Check the sources']),
    task: t(['Nechajte si model vypísať zdroje k faktu a potom aspoň jeden overiť mimo AI.', 'Have the model list sources for a fact, then verify at least one outside of AI.']),
    hint: t(['Neexistujúci odkaz je spoľahlivé znamenie halucinácie.', 'A non-existent link is a reliable hallucination sign.']),
  },
  {
    id: 'ch7',
    title: t(['Anonymizuj', 'Anonymise']),
    task: t([
      'Vezmite skutočné zadanie a nahradte osobné údaje zástupnými (Klient A, Mesto B). Spustite znova.',
      'Take a real task and replace personal data with placeholders (Client A, City B). Run it again.',
    ]),
    hint: t(['Rovnaký výsledok, nulové riziko úniku.', 'Same result, zero leak risk.']),
  },
  {
    id: 'ch8',
    title: t(['Skráť o tretinu', 'Cut by a third']),
    task: t([
      'Skráťte svoj posledný prompt o tretinu slov. Zistite, či kvalita klesla. Ak nie, mali ste zbytočné slová.',
      'Shorten your last prompt by a third. See if quality drops. If not, you had unnecessary words.',
    ]),
    hint: t(['Dobré prompty sú husté, nie dlhé.', 'Good prompts are dense, not long.']),
  },
  {
    id: 'ch9',
    title: t(['Definuj nespokojnosť', 'Define dissatisfaction']),
    task: t(['Pred pokusom si napíšte tri kritériá spokojnosti s výsledkom. Po odpovedi ich ohodnoťte.', 'Before the attempt, write three criteria of satisfaction. After the answer, score them.']),
    hint: t(['Bez kritéria neviete, či sa zlepšujete.', 'Without criteria you cannot tell if you are improving.']),
  },
  {
    id: 'ch10',
    title: t(['Dva modely, jedno zadanie', 'Two models, one task']),
    task: t(['Pošlite rovnaký prompt dvom modelom a porovnajte, kde sa líšia.', 'Send the same prompt to two models and compare where they differ.']),
    hint: t(['Nie je jeden najlepší model, je len najlepší pre danú úlohu.', 'There is no best model, only the best fit for a task.']),
  },
  {
    id: 'ch11',
    title: t(['Kritická recenzia', 'Critical review']),
    task: t(['Nechajte si odporučiť tri najslabšie miesta v predtým napísanom texte. Odstránite ich ručne.', 'Have it recommend the three weakest spots in a text you wrote. Remove them yourself.']),
    hint: t(['Najlepšie využitie AI je čítanie, nie písanie.', 'The best use of AI is reading, not writing.']),
  },
  {
    id: 'ch12',
    title: t(['Jeden prompt, dva štýly', 'One prompt, two styles']),
    task: t(['Požiadajte o dve verzie tej istej odpovede: formálnu a priateľskú.', 'Ask for two versions of the same answer: formal and friendly.']),
    hint: t(['Publikum určuje tón, nie len obsah.', 'The audience determines tone, not just content.']),
  },
  {
    id: 'ch13',
    title: t(['Čo sa zmenilo', 'What changed']),
    task: t(['Pred opravou textu si nechajte zapísať jeho slabiny, po oprave to isté. Ukáže to reálny prínos.', 'Before revising a text, have it list the weaknesses; after, do the same.']),
    hint: t(['Bez „pred“ a „po“ si zlepšenie len predstavíte.', 'Without before and after you only imagine improvement.']),
  },
  {
    id: 'ch14',
    title: t(['Limity', 'Limits']),
    task: t(['Pridaj do promptu: „Ak niečo nevieš, napíš to rovno.“ Sledujte, či pribudnú ďalšie chyby.', 'Add to the prompt: "If you do not know something, say so." Check whether other errors appear.']),
    hint: t(['Otázka „vieš to?“ znižuje počet vymyslených detailov.', 'Asking "are you sure?" reduces invented details.']),
  },
  {
    id: 'ch15',
    title: t(['Zhrnutie pre šéfa', 'Summary for the boss']),
    task: t(['Nechajte si zo 3 strán textu spraviť 5 viet pre riaditeľa: rozhodnutie, riziko, čo potrebujete vy.', 'Turn three pages into five sentences for a manager: decision, risk, what you need.']),
    hint: t(['Uprednostniť číslo, dátum a meno pred všeobecnosťami.', 'Prioritise numbers, dates and names over generalities.']),
  },
  {
    id: 'ch16',
    title: t(['Predchádzajúca chyba', 'Previous mistake']),
    task: t(['Keď AI urobí chybu, zapíšte ju do konverzácie ako pravidlo: „Vždy kontroluj dátumy.“', 'When AI makes a mistake, store it as a rule: "Always check the dates."']),
    hint: t(['Konverzácia je najlacnejší spôsob, ako si model „naučiť“ pravidlá.', 'The conversation is the cheapest way to teach the model rules.']),
  },
  {
    id: 'ch17',
    title: t(['Jedno slovo navyše', 'One word more']),
    task: t(['Pridajte do promptu jedno slovo: „kriticky“, „dôkladne“ alebo „stručne“. Sledujte rozdiel.', 'Add one word to the prompt: "critically", "thoroughly" or "briefly". Observe the difference.']),
    hint: t(['Aj jedno presné slovo zmení celý tón odpovede.', 'Even one precise word changes the whole tone.']),
  },
  {
    id: 'ch18',
    title: t(['Dnes bez AI', 'No AI today']),
    task: t(['Riešte dnešnú úlohu bez AI a zapíšte si, čo vás brzdilo. To je najlepší prompt na zajtrajšok.', 'Solve the task without AI today and note what slowed you down. That is tomorrow\'s best prompt.']),
    hint: t(['Najlepšie prompty vychádzajú z vlastného obmedzenia.', 'The best prompts come from your own constraints.']),
  },
  {
    id: 'ch19',
    title: t(['Kontrolný zoznam', 'Checklist']),
    task: t(['Pred odoslaním von prejdite štyri otázky: je to fakt? je súkromie v poriadku? vie to overiť aj ostatný? kto to podpíše?', 'Before sending a result out, check four questions: is it factual? is privacy fine? can others verify it? who signs it?']),
    hint: t(['Štyri otázky zachytia väčšinu chýb.', 'Four questions catch most mistakes.']),
  },
  {
    id: 'ch20',
    title: t(['Zdokumentujte prompt', 'Document the prompt']),
    task: t(['Uložte si dva prompty, ktoré sa vám osvedčili, do súboru.', 'Save two prompts that worked into a file.']),
    hint: t(['Osvedčený prompt je aktívum, nie rozptyl.', 'A proven prompt is an asset, not a distraction.']),
  },
]

/* ------------------------------------------- knihovnica promptov (6 receptov) -- */
interface PromptRecipe {
  id: string
  icon: string
  title: L
  why: L
  prompt: L
}

const promptLibrary: PromptRecipe[] = [
  {
    id: 'r1',
    icon: '🎓',
    title: t(['Učiteľ, ktorý neustáli zdieľať', 'The teacher who never runs out of analogies']),
    why: t([
      'Rola + publikum + dĺžka. Analógia z bežného života znižuje riziko, že vysvetlenie skĺzne do odborného žargonu.',
      'Role + audience + length. An everyday analogy lowers the risk of slipping into jargon.',
    ]),
    prompt: t([
      'Si učiteľ biológie s 15-ročnou praxou. Vysvetli fotosyntézu 8-ročnému žiakovi v 3 bodoch, každý bod začni analógiou z denného života. Max 200 slov, bez odbornej terminológie.',
      'You are a biology teacher with 15 years of experience. Explain photosynthesis to an 8-year-old in 3 bullet points, each starting with an everyday analogy. Max 200 words, no jargon.',
    ]),
  },
  {
    id: 'r2',
    icon: '⚖️',
    title: t(['Odmietnutie, ktoré chráni', 'The refusal that protects']),
    why: t([
      'Výslovné „ak niečo nevieš, napíš to“ znižuje počet vymyslených detailov. Je to najlacnejšia ochrana proti halucinácii.',
      'Explicitly allowing "I do not know" reduces invented details. It is the cheapest protection against hallucination.',
    ]),
    prompt: t([
      'Si právny asistent špecializovaný na GDPR. Vypíš 7 najčastejších chýb firiem, keď posielajú údaje do AI. Pri každej chybe uveď: právny základ, príklad porušenia a konkrétnu opravu. Ak niečo nevieš overiť, napíš to rovno a označ to ako „over v praxi“. Akékoľvek číslo, ktoré nevieš overiť, neuvádzaj.',
      'You are a legal assistant specialising in GDPR. List the 7 most common mistakes companies make when sending data to AI. For each: the legal basis, an example of a violation and a concrete fix. If you cannot verify something, say so and mark it "verify in practice". Do not state any number you cannot verify.',
    ]),
  },
  {
    id: 'r3',
    icon: '🧱',
    title: t(['Kód, ktorý sa dá prečítať', 'Code you can actually read']),
    why: t([
      'Formát, typy a pokrytie hraničných prípadov. Bez nich dostanete úryvok, ktorý nikto neoverí.',
      'Format, types and edge cases. Without them you get a snippet nobody can verify.',
    ]),
    prompt: t([
      'Si senior Python developer. Napíš funkciu na validáciu slovenského IČO. Použi type hints, docstring, ktorý vysvetľuje aj prípady neplatnosti, a 4 unit testy: platné IČO, príliš krátke, nečíselné znaky, kontrolný súčet nesedí. Vysvetli každý riadok ladenia v komentári.',
      'You are a senior Python developer. Write a function validating a Slovak company ID. Use type hints, a docstring that also explains invalid cases, and 4 unit tests: valid ID, too short, non-numeric characters, failed checksum. Explain every validation line in a comment.',
    ]),
  },
  {
    id: 'r4',
    icon: '📉',
    title: t(['Status, ktorý nepreťažuje', 'A status that does not overload']),
    why: t([
      'Formát + priorita čísel. Vedenie nechce esej, chce tri veci: číslo, dátum, riziko.',
      'Format + number priority. Leadership does not want an essay, it wants three things: a number, a date, a risk.',
    ]),
    prompt: t([
      'Si projektový manažér. Zhrň priložený text na 5 bodov pre vedenie banky. Prvý bod musí obsahovať jedno číslo, druhý dátum, tretí hlavné riziko. Bez žargonu, max 150 slov, ak niečo v texte chýba napíš „neuvedené“.',
      'You are a project manager. Summarise the attached text into 5 bullets for bank leadership. The first bullet must contain a number, the second a date, the third the main risk. No jargon, max 150 words, and if something is missing write "not stated".',
    ]),
  },
  {
    id: 'r5',
    icon: '🔎',
    title: t(['E-mail bez klišé', 'The email without clichés']),
    why: t([
      'Rezistancia voči klišé. Zákaz všeobecných fráz je najúčinnejší spôsob, ako zvýšiť hustotu textu.',
      'Resistance to clichés. Banning filler phrases is the most effective way to increase text density.',
    ]),
    prompt: t([
      'Si komunikačný špecialista pre B2B logistiku. Napíš e-mail pre manažera klienta, ktorému meškáme 4 dni. Tón profesionálny, úprimný, bez výčitok. Max 120 slov. Uveď dôvod meškania, nový termín a čo robíme na kompenzácii. Zákaz: „ospravedlňujeme sa za oneskorenie“, „vážime si vášho času“ a všetky podobné frázy.',
      'You are a B2B logistics communication specialist. Write an email to the client manager we are 4 days late on. Tone: professional, honest, without blame. Max 120 words. Include the reason, the new date and what we do as compensation. Banned: "we apologise for the delay", "we value your time" and similar filler.',
    ]),
  },
  {
    id: 'r6',
    icon: '🧠',
    title: t(['Kritická recenzia namiesto pochvaly', 'Critique instead of praise']),
    why: t([
      'Najlepšie využitie AI je čítanie. Požiadajte o konkrétnu slabinu, nie o „daj mi radu“ – rada bez pravidla nič nemení.',
      'The best use of AI is reading. Ask for one concrete weakness, not "give me advice" – advice without a rule changes nothing.',
    ]),
    prompt: t([
      'Si kritický editor. Prečítaj si môj text a nájdi 3 najslabšie miesta. Pre každé miesto uveď: veta, čo s ňou nie je v poriadku a konkrétna oprava. Potom napíš 1 vetu, ktorá text zhrnie najlepšie. Ak je text dobrý, povedz to rovno a nevymyšľaj si chyby.',
      'You are a critical editor. Read my text and find the 3 weakest spots. For each: the sentence, what is wrong with it and a concrete fix. Then write 1 sentence that captures the text best. If the text is good, say so and do not invent problems.',
    ]),
  },
]

/* ============================================ Prompt laboratórium: lokálna logika == */
interface Check {
  key: string
  label: L
  ok: boolean
  hint: L
}

interface Analysis {
  score: number
  checks: Check[]
  improved: string
  simulated: string
}

const has = (prompt: string, re: RegExp) => re.test(prompt)

/** Päť kritérií kvalitného promptu – čisto lokálna pravidlá, bez siete. */
function analyzePrompt(prompt: string, locale: Locale): Analysis {
  const p = prompt.trim()
  const words = p.split(/\s+/).filter(Boolean).length

  const checks: Check[] = [
    {
      key: 'role',
      label: T.chkRole,
      ok: has(p, /(^|\s)(si|you are|act as|ako si|inštinkt|expert|špecialista|specialista|poradca|teacher|učiteľ|developer|vývojár)/i),
      hint: has(p, /(^|\s)(si|you are|act as)/i) ? T.chkRoleOk : T.chkRoleNo,
    },
    {
      key: 'context',
      label: T.chkContext,
      ok: words >= 15,
      hint: words >= 15 ? T.chkContextOk : T.chkContextNo,
    },
    {
      key: 'format',
      label: T.chkFormat,
      ok: has(p, /(tabuľka|table|bod|bullet|zoznam|list|max \d|\d slov|words|krok|step|formát|format|čísla|numbers)/i),
      hint: has(p, /(tabuľka|table|bod|bullet|max \d|\d slov|words)/i) ? T.chkFormatOk : T.chkFormatNo,
    },
    {
      key: 'proof',
      label: T.chkProof,
      ok: has(p, /(zdroj|source|over|verify|overiť|ak nevieš|if you (do not|don't) know|neuvádzaj|cituj|cite|aktuál|aktuálne)/i),
      hint: has(p, /(zdroj|source|over|verify|ak nevieš|if you (do not|don't) know)/i) ? T.chkProofOk : T.chkProofNo,
    },
    {
      key: 'audience',
      label: T.chkAudience,
      ok: has(p, /(pre |for |žiak|student|klient|client|riaditeľ|leadership|manager|kolég|colleague|študent|študentk|publi)/i),
      hint: has(p, /(pre |for |žiak|student|klient|client|riaditeľ|leadership|manager)/i) ? T.chkAudienceOk : T.chkAudienceNo,
    },
  ]

  const score = checks.filter((c) => c.ok).length
  const isSk = locale === 'sk'

  /* Vylepšený prompt: doplníme presne to, čo chýba */
  const parts = [p]
  if (!checks[0].ok) parts.push(isSk ? 'Si [doplňte profesiu] s X-ročnou praxou.' : 'You are [add a profession] with X years of experience.')
  if (!checks[2].ok) parts.push(isSk ? 'Výstup: 3–5 bodov, max 200 slov.' : 'Output: 3–5 bullet points, max 200 words.')
  if (!checks[3].ok) parts.push(isSk ? 'Ak niečo nevieš overiť, napíš to rovno.' : 'If you cannot verify something, say so.')
  if (!checks[4].ok) parts.push(isSk ? 'Píšem to pre [publikum].' : 'I am writing this for [audience].')
  const improved = parts.join(' ')

  /* Simulovaná odpoveď – ukazuje štruktúru, ktorú by dobrá odpoveď mala */
  const topic = p.length > 120 ? `${p.slice(0, 117).trimEnd()}…` : p
  const lines = isSk
    ? [
        `1. Čo ste chceli dosiahnuť`,
        `   Zadanie som si prečítal takto: „${topic}“. Bez upresnenia cieľa a publiká by odpoveď skĺzla do všeobecnosti.`,
        '',
        `2. Ako by odpoveď mala vyzerať`,
        checks[2].ok
          ? '   Rešpektujem vami zadaný formát a nepridávam navyše vlastné štruktúry.'
          : '   Keďže ste neuviedli formát, riskoval by som 800 slov namiesto 5 riadkov. Pri ďalšom pokuse uveďte dĺžku alebo počet bodov.',
        '',
        `3. Čo treba overiť`,
        checks[3].ok
          ? '   Žiadate dôkazy, takže každé číslo a každý odkaz treba preveriť mimo AI. Zapíšte si, čo ste skontrolovali.'
          : '   Žiadali ste dôkazy a zdroje. Bez nich sa ľahko dostanete k vymyslenému faktu, ktorý znie úplne vierohodne.',
      ]
    : [
        `1. What you actually wanted`,
        `   I read the task like this: "${topic}". Without a goal and an audience the answer would slide into generalities.`,
        '',
        `2. How the answer should look`,
        checks[2].ok
          ? '   I follow the format you specified and do not add structure of my own.'
          : '   Since you did not specify a format, I risked 800 words instead of 5 lines. In your next attempt state a length or a number of points.',
        '',
        `3. What has to be verified`,
        checks[3].ok
          ? '   You asked for evidence, so every number and every link must be checked outside of AI. Note down what you verified.'
          : '   You asked for evidence and sources. Without them you easily end up with an invented fact that sounds completely credible.',
      ]

  return {
    score,
    checks,
    improved,
    simulated: lines.join('\n'),
  }
}

/* __APPEND2__ */

/* ------------------------------------------------- ukladanie do localStorage -- */
const STORAGE_KEY = 'ai-skola-progress-v1'

function loadProgress(): Progress {
  if (typeof window === 'undefined') return { ...EMPTY_PROGRESS }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...EMPTY_PROGRESS }
    return { ...EMPTY_PROGRESS, ...(JSON.parse(raw) as Partial<Progress>) }
  } catch {
    return { ...EMPTY_PROGRESS }
  }
}

function useProgress() {
  const [progress, setProgress] = useState<Progress>(loadProgress)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
    } catch {
      /* localStorage môže byť vypnutý – aplikácia funguje aj bez neho */
    }
  }, [progress])

  const update = (patch: Partial<Progress>) => setProgress((prev) => ({ ...prev, ...patch }))

  const reset = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    setProgress({ ...EMPTY_PROGRESS })
  }

  return { progress, update, reset }
}

/* ---------------------------------------------------------- certifikát SVG -- */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildCertificateSvg(progress: Progress, locale: Locale): string {
  const isSk = locale === 'sk'
  const name = progress.name.trim() || (isSk ? 'Absolvent' : 'Graduate')
  const year = new Date().getFullYear()
  const date = progress.completedAt
    ? new Date(progress.completedAt).toLocaleDateString(isSk ? 'sk-SK' : 'en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toISOString().slice(0, 10)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="850" viewBox="0 0 1200 850" role="img" aria-label="AI Masterclass certificate">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1024"/><stop offset="55%" stop-color="#141b38"/><stop offset="100%" stop-color="#0d2b3e"/>
    </linearGradient>
    <linearGradient id="stroke" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#22d3ee"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="850" fill="url(#bg)"/>
  <rect x="36" y="36" width="1128" height="778" rx="28" fill="none" stroke="url(#stroke)" stroke-width="3"/>
  <rect x="56" y="56" width="1088" height="738" rx="20" fill="none" stroke="#27324f" stroke-width="1.5"/>
  <circle cx="600" cy="150" r="52" fill="none" stroke="url(#stroke)" stroke-width="2.5"/>
  <text x="600" y="168" text-anchor="middle" font-family="Segoe UI, Inter, sans-serif" font-size="46">🧠</text>
  <text x="600" y="250" text-anchor="middle" font-family="Segoe UI, Inter, sans-serif" font-size="30" letter-spacing="8" fill="#94a3b8">AI ŠKOLA</text>
  <text x="600" y="288" text-anchor="middle" font-family="Segoe UI, Inter, sans-serif" font-size="16" letter-spacing="3" fill="#475569">${T.brandLine[locale].toUpperCase()}</text>
  <text x="600" y="330" text-anchor="middle" font-family="Segoe UI, Inter, sans-serif" font-size="20" fill="#64748b">${isSk ? 'Osvedčenie o absolvovaní' : 'Certificate of completion'}</text>
  <text x="600" y="415" text-anchor="middle" font-family="Segoe UI, Inter, sans-serif" font-size="54" font-weight="700" fill="#e2e8f0">${escapeXml(name)}</text>
  <line x1="360" y1="440" x2="840" y2="440" stroke="url(#stroke)" stroke-width="2"/>
  <text x="600" y="495" text-anchor="middle" font-family="Segoe UI, Inter, sans-serif" font-size="24" fill="#94a3b8">${T.certSubtitle[locale]}</text>
  <g font-family="Segoe UI, Inter, sans-serif" font-size="22">
    <text x="300" y="580" text-anchor="middle" fill="#64748b">${T.certDate[locale]}</text>
    <text x="300" y="620" text-anchor="middle" fill="#e2e8f0" font-size="26">${escapeXml(date)}</text>
    <text x="900" y="580" text-anchor="middle" fill="#64748b">${T.certScore[locale]}</text>
    <text x="900" y="620" text-anchor="middle" fill="#e2e8f0" font-size="26">${progress.finalScore ?? 0} / ${FINAL_TOTAL}</text>
  </g>
  <line x1="450" y1="660" x2="750" y2="660" stroke="url(#stroke)" stroke-width="1.5"/>
  <text x="600" y="690" text-anchor="middle" font-family="Segoe UI, Inter, sans-serif" font-size="20" fill="#e2e8f0">${escapeXml(AUTHOR)}</text>
  <text x="600" y="712" text-anchor="middle" font-family="Segoe UI, Inter, sans-serif" font-size="14" fill="#64748b">${T.issuedBy[locale]}</text>
  <text x="600" y="756" text-anchor="middle" font-family="Segoe UI, Inter, sans-serif" font-size="15" fill="#475569">${escapeXml(T.certFooter[locale])} · ${escapeXml(T.appName[locale])} ${year}</text>
</svg>`
}

function downloadCertificate(progress: Progress, locale: Locale) {
  const blob = new Blob([buildCertificateSvg(progress, locale)], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const safeName =
    (progress.name.trim() || 'certifikat')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'certifikat'
  link.href = url
  link.download = `ai-skola-${safeName}.svg`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ================================================================ obrazovky == */

const NAV: { id: View; icon: string; label: keyof typeof T }[] = [
  { id: 'home', icon: '🏠', label: 'navHome' },
  { id: 'modules', icon: '📚', label: 'navModules' },
  { id: 'playground', icon: '🧪', label: 'navPlayground' },
  { id: 'compare', icon: '⚖️', label: 'navCompare' },
  { id: 'cases', icon: '💡', label: 'navCases' },
  { id: 'challenge', icon: '🎯', label: 'navChallenge' },
  { id: 'final', icon: '🎓', label: 'navFinal' },
]

function Header({
  locale,
  theme,
  xp,
  active,
  onNavigate,
  onLocale,
  onTheme,
}: {
  locale: Locale
  theme: 'dark' | 'light'
  xp: number
  active: View
  onNavigate: (v: View) => void
  onLocale: (l: Locale) => void
  onTheme: () => void
}) {
  return (
    <header className="safe-top sticky top-0 z-20 border-b backdrop-blur" style={{ background: 'rgb(var(--bg) / 0.85)' }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <button className="flex items-center gap-2" onClick={() => onNavigate('home')}>
          <span className="text-xl">🧠</span>
          <div>
            <span className="block text-sm font-bold leading-tight">{T.appName[locale]}</span>
            <span className="hidden text-[10px] muted sm:block">
              {T.brandLine[locale]} · {AUTHOR}
            </span>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <span className="chip accent border-current">{xp} {T.xp[locale]}</span>
          <button className={`chip ${locale === 'sk' ? 'accent border-current' : ''}`} onClick={() => onLocale('sk')}>
            SK
          </button>
          <button className={`chip ${locale === 'en' ? 'accent border-current' : ''}`} onClick={() => onLocale('en')}>
            EN
          </button>
          <button className="chip" onClick={onTheme} aria-label="toggle theme">
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>
        </div>
      </div>
      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2">
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => onNavigate(n.id)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              active === n.id || (n.id === 'modules' && active === 'module')
                ? 'accent bg-[rgb(var(--accent)/0.12)]'
                : 'muted hover:text-[rgb(var(--text))]'
            }`}
          >
            {n.icon} {T[n.label][locale]}
          </button>
        ))}
      </nav>
    </header>
  )
}

function ProgressRing({ value, total, label }: { value: number; total: number; label: string }) {
  const pct = total > 0 ? Math.min(1, value / total) : 0
  const size = 120
  const stroke = 10
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(var(--border))" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--accent))"
          strokeLinecap="round"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct) }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold">
          {value}
          <span className="text-sm muted">/{total}</span>
        </div>
        <div className="text-[10px] uppercase tracking-wider muted">{label}</div>
      </div>
    </div>
  )
}

function Quiz({
  questions,
  locale,
  passMark,
  submitLabel,
  onFinish,
  onRetry,
  onNext,
  nextLabel,
}: {
  questions: QuizQuestion[]
  locale: Locale
  passMark?: number
  submitLabel?: L
  onFinish: (correct: number, total: number) => void
  onRetry?: () => void
  onNext?: () => void
  nextLabel?: L
}) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [answers, setAnswers] = useState<number[]>([])
  const [done, setDone] = useState(false)

  const current = questions[index]
  const isLast = index === questions.length - 1
  const correctCount = answers.filter((a, i) => a === questions[i].correct).length
  const passed = passMark === undefined || correctCount >= passMark

  function next() {
    if (picked === null) return
    const nextAnswers = [...answers, picked]
    setAnswers(nextAnswers)
    setPicked(null)
    if (isLast) {
      const score = nextAnswers.filter((a, i) => a === questions[i].correct).length
      setDone(true)
      onFinish(score, questions.length)
    } else {
      setIndex((i) => i + 1)
    }
  }

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
        <p className="text-4xl font-bold accent">
          {correctCount} / {questions.length}
        </p>
        {passMark !== undefined && (
          <p className={`mt-2 text-sm font-semibold ${passed ? 'text-emerald-400' : 'text-rose-400'}`}>
            {passed ? T.passed[locale] : T.tryAgain[locale]}
          </p>
        )}

        <ul className="mt-5 space-y-3">
          {questions.map((q, i) => {
            const ok = answers[i] === q.correct
            return (
              <li key={q.id} className={`card p-3 ${ok ? 'option-ok' : 'option-bad'}`}>
                <p className="text-sm font-semibold">
                  {i + 1}. {q.q[locale]}
                </p>
                <p className="mt-1 text-xs muted">
                  {ok ? '✓' : '✕'} {q.why[locale]}
                </p>
              </li>
            )
          })}
        </ul>

        <div className="mt-5 flex flex-wrap gap-3">
          {onRetry && (
            <button className="btn-ghost" onClick={onRetry}>
              {T.tryAgain[locale]}
            </button>
          )}
          {onNext && (
            <button className="btn" onClick={onNext}>
              {(nextLabel ?? T.home)[locale]}
            </button>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div key={current.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} className="card p-6">
      <div className="mb-4 flex items-center justify-between text-xs muted">
        <span>
          {T.question[locale]} {index + 1} {T.of[locale]} {questions.length}
        </span>
        <span>{correctCount} ✓</span>
      </div>
      <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'rgb(var(--border))' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'rgb(var(--accent))' }}
          initial={false}
          animate={{ width: `${((index + (picked !== null ? 1 : 0)) / questions.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <h3 className="text-lg font-semibold">{current.q[locale]}</h3>

      <div className="mt-4 space-y-2">
        {current.options.map((o, i) => {
          const state =
            picked === null ? '' : i === current.correct ? 'option-ok' : picked === i ? 'option-bad' : 'opacity-50'
          return (
            <button key={i} className={`option ${state}`} onClick={() => setPicked(i)} disabled={picked !== null}>
              <span className="mt-0.5 font-bold accent">{String.fromCharCode(65 + i)}.</span>
              <span>{o[locale]}</span>
            </button>
          )
        })}
      </div>

      <AnimatePresence>
        {picked !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
              picked === current.correct ? 'option-ok' : 'option-bad'
            }`}
          >
            <p className="font-bold">
              {picked === current.correct ? T.answerRight[locale] : T.answerWrong[locale]}
            </p>
            <p className="mt-1 muted">
              <strong className="text-[rgb(var(--text))]">{T.explanation[locale]}: </strong>
              {current.why[locale]}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-5 flex justify-end">
        <button className="btn" onClick={next} disabled={picked === null}>
          {isLast ? (submitLabel ?? T.finish)[locale] : T.next[locale]}
        </button>
      </div>
    </motion.div>
  )
}

function levelName(level: Level): L {
  return level === 'advanced' ? T.levelAdvanced : level === 'intermediate' ? T.levelIntermediate : T.levelBeginner
}

/** Text jednej sekcie modulu pripravený na čítanie. */
function sectionText(section: ModuleSection, locale: Locale): string {
  const parts = [section.heading[locale], ...section.body.map((p) => p[locale])]
  if (section.tips) parts.push(...section.tips.map((tip) => tip[locale]))
  return parts.join('. ')
}

/** Celý modul (názov + všetky sekcie) pripravený na čítanie. */
function moduleLessonText(mod: Module, locale: Locale): string {
  return [mod.title[locale], mod.subtitle[locale], ...mod.sections.map((s) => sectionText(s, locale))].join('. ')
}

/** Celá prípadová štúdia pripravená na čítanie. */
function caseStudyText(c: CaseStudy, locale: Locale): string {
  return [
    c.title[locale],
    c.situation[locale],
    c.bad[locale],
    c.good[locale],
    ...c.steps.map((s) => s[locale]),
    c.takeaway[locale],
  ].join('. ')
}

function Onboarding({
  locale,
  onComplete,
}: {
  locale: Locale
  onComplete: (name: string, score: number, level: Level) => void
}) {
  const [name, setName] = useState('')
  const [phase, setPhase] = useState<'name' | 'quiz' | 'result'>('name')
  const [score, setScore] = useState(0)
  const [run, setRun] = useState(0)

  const level: Level = score >= 12 ? 'advanced' : score >= 7 ? 'intermediate' : 'beginner'
  const levelDesc =
    level === 'advanced' ? T.levelAdvancedDesc : level === 'intermediate' ? T.levelIntermediateDesc : T.levelBeginnerDesc

  if (phase === 'name') {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-xl">
        <div className="card p-8 text-center">
          <div className="text-5xl">🧠</div>
          <h1 className="mt-4 text-3xl font-bold">{T.welcome[locale]}</h1>
          <p className="mt-1 text-xs font-semibold accent">{T.brandLine[locale]}</p>
          <p className="mt-3 muted">{T.welcomeIntro[locale]}</p>
          <p className="mt-2 text-sm font-medium">{T.heroLine[locale]}</p>

          <label className="mt-7 block text-left text-sm font-semibold" htmlFor="learner-name">
            {T.nameLabel[locale]}
          </label>
          <input
            id="learner-name"
            className="input mt-2"
            value={name}
            maxLength={40}
            placeholder={T.namePlaceholder[locale]}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) setPhase('quiz')
            }}
          />

          <button className="btn mt-5 w-full" disabled={!name.trim()} onClick={() => setPhase('quiz')}>
            {T.startQuiz[locale]} →
          </button>
          <p className="mt-4 text-xs muted">{T.localOnly[locale]}</p>
          <p className="mt-1 text-xs font-semibold accent">
            {T.authorCredit[locale]} {AUTHOR}
          </p>
        </div>
      </motion.div>
    )
  }

  if (phase === 'quiz') {
    return (
      <div className="mx-auto max-w-2xl">
        <Quiz
          key={run}
          questions={placementQuiz}
          locale={locale}
          onFinish={(correct) => {
            setScore(correct)
            setPhase('result')
          }}
          onRetry={() => setRun((r) => r + 1)}
          onNext={() => setPhase('result')}
          nextLabel={T.next}
        />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl">
      <div className="card p-8 text-center">
        <div className="text-5xl">🏅</div>
        <h2 className="mt-3 text-2xl font-bold">{T.recommendedLevel[locale]}</h2>
        <p className="mt-2 text-sm muted">
          {score} / {placementQuiz.length} {T.points[locale]}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {(['beginner', 'intermediate', 'advanced'] as Level[]).map((l) => (
            <span key={l} className={`chip ${l === level ? 'accent border-current' : 'opacity-50'}`}>
              {levelName(l)[locale]}
            </span>
          ))}
        </div>
        <p className="mt-4 muted">{levelDesc[locale]}</p>

        <button className="btn mt-7 w-full" onClick={() => onComplete(name.trim(), score, level)}>
          {T.startModules[locale]} →
        </button>
      </div>
    </motion.div>
  )
}

function Dashboard({
  locale,
  progress,
  onOpenModule,
  onNavigate,
}: {
  locale: Locale
  progress: Progress
  onOpenModule: (id: string) => void
  onNavigate: (v: View) => void
}) {
  const passedCount = progress.modulePassed.length
  const nextModule = modules.find((m) => !progress.modulePassed.includes(m.id))
  const levelGoal = { beginner: 900, intermediate: 1500, advanced: 2000 }[progress.level ?? 'beginner']
  const levelUp = progress.xp >= levelGoal

  const cards: { id: View; icon: string; title: L; body: L; action: L }[] = [
    { id: 'modules', icon: '📚', title: T.navModules, body: t(['Šesť modulov od základov po tímové pravidlá.', 'Six modules from basics to team rules.']), action: T.continueStudy },
    { id: 'playground', icon: '🧪', title: T.navPlayground, body: t(['Rozbor promptu na 5 kritérií, offline a bez kľúča.', 'Prompt breakdown against 5 criteria, offline and keyless.']), action: T.navPlayground },
    { id: 'compare', icon: '⚖️', title: T.navCompare, body: t(['Ukážka, prečo jeden prompt funguje a druhý nie.', 'See why one prompt works and the other does not.']), action: T.navCompare },
    { id: 'challenge', icon: '🎯', title: T.navChallenge, body: T.chIntro, action: T.navChallenge },
  ]

  return (
    <div className="space-y-6">
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-6 sm:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">
              {locale === 'sk' ? `Ahoj, ${progress.name || 'priateľu'}` : `Hello, ${progress.name || 'friend'}`}
            </h1>
            <p className="mt-1 muted">{T.dashboardTitle[locale]}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="chip accent border-current">
                {progress.xp} {T.xp[locale]}
              </span>
              <span className="chip">
                {T.modulesDone[locale]}: {passedCount}/{modules.length}
              </span>
              {progress.level && <span className="chip">{levelName(progress.level)[locale]}</span>}
            </div>
            {levelUp && nextModule && <p className="mt-4 text-sm font-semibold text-emerald-400">{T.levelUp[locale]}</p>}
          </div>
          <ProgressRing value={passedCount} total={modules.length} label={T.moduleUnit[locale]} />
        </div>
      </motion.section>

      {nextModule && (
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="card w-full p-6 text-left transition hover:border-[rgb(var(--accent))]"
          onClick={() => onOpenModule(nextModule.id)}
        >
          <div className="flex items-center gap-4">
            <span className="text-4xl">{nextModule.icon}</span>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider muted">{T.nextStep[locale]}</p>
              <h2 className="text-lg font-semibold">{nextModule.title[locale]}</h2>
              <p className="text-sm muted">{nextModule.subtitle[locale]}</p>
            </div>
            <span className="text-2xl">→</span>
          </div>
        </motion.button>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c, i) => (
          <motion.button
            key={c.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * (i + 1) }}
            className="card p-6 text-left transition hover:border-[rgb(var(--accent))]"
            onClick={() => (c.id === 'modules' ? onOpenModule(modules[0].id) : onNavigate(c.id))}
          >
            <span className="text-3xl">{c.icon}</span>
            <h3 className="mt-3 text-lg font-semibold">{c.title[locale]}</h3>
            <p className="mt-1 text-sm muted">{c.body[locale]}</p>
            <p className="mt-3 text-xs font-semibold accent">{c.action[locale]} →</p>
          </motion.button>
        ))}
      </div>
    </div>
  )
}

function ModuleList({
  locale,
  progress,
  onOpen,
}: {
  locale: Locale
  progress: Progress
  onOpen: (id: string) => void
}) {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">{T.navModules[locale]}</h1>
        <p className="muted text-sm">{T.unlockHint[locale]}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {modules.map((m, i) => {
          const passed = progress.modulePassed.includes(m.id)
          const unlocked = i === 0 || progress.modulePassed.includes(modules[i - 1].id)
          const score = progress.moduleScores[m.id]
          return (
            <motion.button
              key={m.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => unlocked && onOpen(m.id)}
              disabled={!unlocked}
              className={`card p-5 text-left transition ${unlocked ? 'hover:border-[rgb(var(--accent))]' : 'opacity-55'}`}
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl">{unlocked ? m.icon : '🔒'}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold">{m.title[locale]}</h2>
                    {passed && <span className="chip accent border-current">✓</span>}
                  </div>
                  <p className="mt-1 text-sm muted">{m.subtitle[locale]}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="chip">
                      {i + 1}/{modules.length}
                    </span>
                    <span className="chip">
                      {m.minutes} {T.min[locale]}
                    </span>
                    <span className="chip">
                      {m.xp} {T.xp[locale]}
                    </span>
                    {score !== undefined && (
                      <span className="chip">
                        {T.score[locale]} {score}/{m.quiz.length}
                      </span>
                    )}
                    {!unlocked && <span className="chip">{T.locked[locale]}</span>}
                  </div>
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

function ModuleDetail({
  locale,
  progress,
  moduleId,
  onPass,
  onBack,
  onNextModule,
}: {
  locale: Locale
  progress: Progress
  moduleId: string
  onPass: (moduleId: string, score: number) => void
  onBack: () => void
  onNextModule: (id: string) => void
}) {
  const mod = modules.find((m) => m.id === moduleId) ?? modules[0]
  const index = modules.findIndex((m) => m.id === mod.id)
  const next = modules[index + 1]
  const [phase, setPhase] = useState<'read' | 'quiz'>('read')
  const [run, setRun] = useState(0)
  const passed = progress.modulePassed.includes(mod.id)

  useEffect(() => {
    setPhase('read')
    setRun((r) => r + 1)
  }, [mod.id])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button className="btn-ghost" onClick={onBack}>
          ← {T.back[locale]}
        </button>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="chip">
            {mod.icon} {index + 1}/{modules.length}
          </span>
          <span className="chip">
            {mod.minutes} {T.min[locale]}
          </span>
          <span className="chip">
            {mod.xp} {T.xp[locale]}
          </span>
          {passed && <span className="chip accent border-current">✓ {T.passed[locale]}</span>}
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold sm:text-3xl">{mod.title[locale]}</h1>
        <p className="mt-1 muted">{mod.subtitle[locale]}</p>

        <div className="mt-4">
          <TextToSpeech
            text={moduleLessonText(mod, locale)}
            label={`${locale === 'sk' ? 'Prečítať celý modul' : 'Read the whole module'}: ${mod.title[locale]}`}
          />
        </div>

        <div className="mt-7 space-y-7">
          {mod.sections.map((s) => (
            <section key={s.heading[locale]}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold accent">{s.heading[locale]}</h2>
                <TextToSpeech
                  variant="inline"
                  text={sectionText(s, locale)}
                  label={`${locale === 'sk' ? 'Prečítať sekciu' : 'Read section'}: ${s.heading[locale]}`}
                />
              </div>
              <div className="prose mt-2 text-sm">
                {s.body.map((p, i) => (
                  <p key={i}>{p[locale]}</p>
                ))}
              </div>
              {s.tips && s.tips.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {s.tips.map((tip, i) => (
                    <li key={i} className="rounded-xl border px-4 py-3 text-sm">
                      <span className="mr-2">💡</span>
                      {tip[locale]}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button className="btn" onClick={() => setPhase('quiz')}>
            {phase === 'quiz' ? T.moduleQuiz[locale] : passed ? T.reviewModule[locale] : T.startModule[locale]}
          </button>
          {next && passed && (
            <button className="btn-ghost" onClick={() => onNextModule(next.id)}>
              {T.nextModule[locale]} →
            </button>
          )}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {phase === 'quiz' && (
          <motion.div
            key={`${mod.id}-${run}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
          >
            <p className="mb-2 text-sm muted">{T.passHint[locale]}</p>
            <Quiz
              questions={mod.quiz}
              locale={locale}
              passMark={2}
              onFinish={(score) => onPass(mod.id, score)}
              onRetry={() => setRun((r) => r + 1)}
              onNext={() => (next ? onNextModule(next.id) : onBack())}
              nextLabel={next ? T.nextModule : T.home}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Playground({
  locale,
  history,
  onRun,
}: {
  locale: Locale
  history: { prompt: string; score: number }[]
  onRun: (prompt: string, score: number) => void
}) {
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState<Analysis | null>(null)

  function analyze() {
    if (!prompt.trim()) return
    const analysis = analyzePrompt(prompt, locale)
    setResult(analysis)
    onRun(prompt.trim(), analysis.score)
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{T.pgTitle[locale]}</h1>
          <p className="muted text-sm">{T.pgIntro[locale]}</p>
        </div>
        <span className="chip accent border-current">{T.pgNoNetwork[locale]}</span>
      </header>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
        <textarea
          className="input min-h-[140px] resize-y"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={T.pgPlaceholder[locale]}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) analyze()
          }}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className="btn" onClick={analyze} disabled={!prompt.trim()}>
            {T.pgSend[locale]}
          </button>
          <button
            className="btn-ghost"
            onClick={() => {
              setPrompt('')
              setResult(null)
            }}
            disabled={!prompt && !result}
          >
            {T.pgClear[locale]}
          </button>
          <span className="text-xs muted">Ctrl + Enter</span>
        </div>
      </motion.div>

      {result && (
        <>
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">{T.pgCheckTitle[locale]}</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm muted">{T.pgScore[locale]}:</span>
                <span className="text-2xl font-bold accent">
                  {result.score}
                  <span className="text-sm muted">/{result.checks.length}</span>
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {result.checks.map((c) => (
                <div key={c.key} className={`card p-3 ${c.ok ? 'option-ok' : 'option-bad'}`}>
                  <p className="text-sm font-semibold">
                    {c.ok ? '✓' : '✕'} {c.label[locale]}
                  </p>
                  <p className="mt-1 text-xs muted">{c.hint[locale]}</p>
                </div>
              ))}
            </div>

            <p className="mt-4 rounded-xl border px-4 py-3 text-sm font-medium">
              {result.score >= 4 ? T.pgVerdictGood[locale] : T.pgVerdictWeak[locale]}
            </p>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
            <h2 className="font-semibold">{T.pgFixTitle[locale]}</h2>
            <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl border px-4 py-3 text-sm">{result.improved}</pre>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                className="btn"
                onClick={() => {
                  setPrompt(result.improved)
                  setResult(analyzePrompt(result.improved, locale))
                }}
              >
                {T.pgUseFix[locale]}
              </button>
              <TextToSpeech
                text={result.improved}
                label={locale === 'sk' ? 'Prečítať vylepšený prompt' : 'Read improved prompt'}
              />
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">{T.pgSimulation[locale]}</h2>
              <span className="flex items-center gap-2">
                <TextToSpeech
                  text={result.simulated}
                  label={locale === 'sk' ? 'Prečítať odpoveď' : 'Read the answer'}
                />
                <span className="chip">{T.pgSimulated[locale]}</span>
              </span>
            </div>
            <pre className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{result.simulated}</pre>
            <p className="mt-3 text-xs muted">{T.pgSimulationNote[locale]}</p>
          </motion.section>
        </>
      )}
      <section className="card p-5">
        <h2 className="font-semibold">{T.pgLibrary[locale]}</h2>
        <p className="mt-1 text-xs muted">{T.brandLine[locale]}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {promptLibrary.map((r) => (
            <div key={r.id} className="card p-4">
              <p className="text-sm font-semibold">
                {r.icon} {r.title[locale]}
              </p>
              <p className="mt-1 text-xs muted">{r.why[locale]}</p>
              <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg border px-3 py-2 text-xs leading-relaxed">
                {r.prompt[locale]}
              </pre>
              <button
                className="btn-ghost mt-3"
                onClick={() => {
                  setPrompt(r.prompt[locale])
                  setResult(null)
                }}
              >
                {T.pgUse[locale]} →
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">{T.pgHistory[locale]}</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm muted">{T.pgEmptyHistory[locale]}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {history.map((h, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm">
                <span className="chip accent border-current">{h.score}/5</span>
                <span className="flex-1 truncate muted">{h.prompt}</span>
                <button
                  className="text-xs font-semibold accent"
                  onClick={() => {
                    setPrompt(h.prompt)
                    setResult(null)
                  }}
                >
                  {T.pgUse[locale]}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function CompareView({ locale }: { locale: Locale }) {
  const [i, setI] = useState(0)
  const [show, setShow] = useState({ weak: false, good: false })
  const task = compareTasks[i]

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">{T.navCompare[locale]}</h1>
        <p className="muted text-sm">{T.cmpIntro[locale]}</p>
      </header>

      <motion.div key={task.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="card p-5 sm:p-6">
        <p className="text-xs uppercase tracking-wider muted">{T.cmpTask[locale]}</p>
        <h2 className="mt-1 text-lg font-semibold">{task.task[locale]}</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card option-bad p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-rose-400">{T.cmpWeak[locale]}</p>
            {show.weak ? (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 whitespace-pre-wrap text-sm">
                {task.weak[locale]}
              </motion.p>
            ) : (
              <button className="btn-ghost mt-3 w-full" onClick={() => setShow((s) => ({ ...s, weak: true }))}>
                {T.cmpRevealWeak[locale]}
              </button>
            )}
            {show.weak && (
              <div className="mt-3 border-t pt-3">
                <p className="text-xs muted">
                  <strong>{T.cmpOutcome[locale]}: </strong>
                  {task.outcomeWeak[locale]}
                </p>
                <div className="mt-2">
                  <TextToSpeech
                    variant="inline"
                    text={`${task.weak[locale]} ${task.outcomeWeak[locale]}`}
                    label={`${locale === 'sk' ? 'Prečítať slabý prompt' : 'Read weak prompt'}`}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="card option-ok p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-400">{T.cmpGood[locale]}</p>
            {show.good ? (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 whitespace-pre-wrap text-sm">
                {task.good[locale]}
              </motion.p>
            ) : (
              <button className="btn-ghost mt-3 w-full" onClick={() => setShow((s) => ({ ...s, good: true }))}>
                {T.cmpRevealGood[locale]}
              </button>
            )}
            {show.good && (
              <div className="mt-3 border-t pt-3">
                <p className="text-xs muted">
                  <strong>{T.cmpOutcome[locale]}: </strong>
                  {task.outcomeGood[locale]}
                </p>
                <div className="mt-2">
                  <TextToSpeech
                    variant="inline"
                    text={`${task.good[locale]} ${task.outcomeGood[locale]}`}
                    label={locale === 'sk' ? 'Prečítať dobrý prompt' : 'Read good prompt'}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {(show.weak || show.good) && (
          <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-5 space-y-2">
            {task.why.map((b, idx) => (
              <li key={idx} className="rounded-xl border px-4 py-2.5 text-sm">
                <span className="mr-2 accent">→</span>
                {b[locale]}
              </li>
            ))}
          </motion.ul>
        )}

        <div className="mt-6 flex items-center justify-between">
          <span className="text-xs muted">
            {i + 1} / {compareTasks.length}
          </span>
          <button
            className="btn"
            onClick={() => {
              setShow({ weak: false, good: false })
              setI((v) => (v + 1) % compareTasks.length)
            }}
          >
            {T.cmpNext[locale]} →
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function CasesView({
  locale,
  read,
  onRead,
}: {
  locale: Locale
  read: string[]
  onRead: (id: string) => void
}) {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">{T.navCases[locale]}</h1>
        <p className="muted text-sm">{T.casesIntro[locale]}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {caseStudies.map((c, i) => {
          const isOpen = open === c.id
          const isRead = read.includes(c.id)
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="card p-5"
            >
              <div className="flex items-start gap-3">
                <span className="text-3xl">{c.icon}</span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-semibold">{c.title[locale]}</h2>
                    <TextToSpeech
                      variant="inline"
                      text={caseStudyText(c, locale)}
                      label={`${locale === 'sk' ? 'Prečítať štúdiu' : 'Read case study'}: ${c.title[locale]}`}
                    />
                  </div>
                  <p className="mt-1 text-sm muted">{c.situation[locale]}</p>
                </div>
                {isRead && <span className="chip accent border-current">✓</span>}
              </div>

              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3">
                  <p className="text-xs font-bold uppercase text-rose-400">{T.casesBad[locale]}</p>
                  <p className="mt-1">{c.bad[locale]}</p>
                </div>
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3">
                  <p className="text-xs font-bold uppercase text-emerald-400">{T.casesGood[locale]}</p>
                  <p className="mt-1">{c.good[locale]}</p>
                </div>

                {isOpen && (
                  <motion.ol initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                    {c.steps.map((s, idx) => (
                      <li key={idx} className="rounded-xl border px-3 py-2 text-sm muted">
                        <span className="mr-2 font-bold accent">{idx + 1}.</span>
                        {s[locale]}
                      </li>
                    ))}
                  </motion.ol>
                )}
              </div>

              <button
                className="btn mt-4"
                onClick={() => {
                  const next = isOpen ? null : c.id
                  setOpen(next)
                  if (next) onRead(c.id)
                }}
              >
                {isOpen ? T.back[locale] : isRead ? T.casesReadDone[locale] : T.casesRead[locale]}
              </button>

              {isOpen && <p className="mt-4 rounded-xl border px-4 py-3 text-sm font-medium">💡 {c.takeaway[locale]}</p>}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

function ChallengeView({
  locale,
  done,
  onComplete,
}: {
  locale: Locale
  done: string[]
  onComplete: (id: string) => void
}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const dayIndex = useMemo(() => {
    const d = new Date()
    return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2024, 0, 1)) / 86400000)
  }, [])
  const task = challenges[dayIndex % challenges.length]
  const doneToday = done.includes(task.id)

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">{T.navChallenge[locale]}</h1>
        <p className="muted text-sm">{T.chIntro[locale]}</p>
      </header>

      <motion.div key={task.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="card p-6 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <span className="chip accent border-current">🎯 {task.title[locale]}</span>
          <span className="text-xs muted">{today}</span>
        </div>

        <p className="mt-5 text-lg leading-relaxed">{task.task[locale]}</p>

        <div className="mt-3">
          <TextToSpeech
            text={`${task.title[locale]}. ${task.task[locale]} ${task.hint[locale]}`}
            label={locale === 'sk' ? 'Prečítať dnešnú výzvu' : "Read today's challenge"}
          />
        </div>

        <p className="mt-4 rounded-xl border px-4 py-3 text-sm muted">
          <strong>{T.chHint[locale]}: </strong>
          {task.hint[locale]}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button className={doneToday ? 'btn-ghost' : 'btn'} onClick={() => onComplete(task.id)}>
            {doneToday ? T.chRepeat[locale] : T.chDone[locale]}
          </button>
          <span className="text-sm muted">
            {T.chDoneTotal[locale]}: {done.length}/{challenges.length}
          </span>
        </div>

        {/* Viditeľné potvrdenie – bez neho stlačenie tlačidla vyzerá ako „nič sa nestalo“. */}
        <AnimatePresence>
          {doneToday && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
              role="status"
            >
              {T.chDoneConfirm[locale]}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

function FinalTestView({
  locale,
  progress,
  locked,
  onFinish,
}: {
  locale: Locale
  progress: Progress
  locked: boolean
  onFinish: (score: number) => void
}) {
  const [run, setRun] = useState(0)

  if (locked) {
    return (
      <div className="card p-8 text-center">
        <div className="text-4xl">🔒</div>
        <h1 className="mt-3 text-2xl font-bold">{T.navFinal[locale]}</h1>
        <p className="mt-2 muted">{T.finalLocked[locale]}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{T.navFinal[locale]}</h1>
          <p className="muted text-sm">{T.finalIntro[locale]}</p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="chip">
            {T.finalAttempts[locale]}: {progress.finalAttempts}
          </span>
          <span className="chip">
            {T.finalBest[locale]}: {progress.finalScore ?? 0}/{FINAL_TOTAL}
          </span>
        </div>
      </header>

      {progress.finalPassed && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-6 text-center">
          <div className="text-4xl">🎓</div>
          <p className="mt-2 text-lg font-semibold text-emerald-400">{T.finalPassed[locale]}</p>
          <p className="mt-1 text-sm muted">
            {progress.finalScore} / {FINAL_TOTAL}
          </p>
          <button className="btn mt-5" onClick={() => downloadCertificate(progress, locale)}>
            ⬇ {T.finalCertificate[locale]}
          </button>
        </motion.div>
      )}

      <Quiz
        key={run}
        questions={finalTest}
        locale={locale}
        passMark={FINAL_PASS_SCORE}
        submitLabel={T.finalSubmit}
        onFinish={onFinish}
        onRetry={() => setRun((r) => r + 1)}
        onNext={() => setRun((r) => r + 1)}
        nextLabel={T.home}
      />
    </div>
  )
}

/* ==================================================================== App == */
/* Android skratky z launchera (?view=modules, ?view=playground, …) */
function readViewFromUrl(): View {
  if (typeof window === 'undefined') return 'home'
  const requested = new URLSearchParams(window.location.search).get('view')
  if (requested === 'modules' || requested === 'playground' || requested === 'compare' || requested === 'cases' || requested === 'challenge' || requested === 'final') {
    return requested
  }
  return 'home'
}

export default function App() {
  const { progress, update, reset } = useProgress()
  const [initialView] = useState<View>(readViewFromUrl)
  const [view, setView] = useState<View>(readViewFromUrl)
  const [activeModule, setActiveModule] = useState<string>(modules[0].id)
  const [showOnboarding, setShowOnboarding] = useState(!progress.placementDone)

  const locale: Locale = progress.locale
  const allModulesPassed = modules.every((m) => progress.modulePassed.includes(m.id))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', progress.theme === 'dark')
    document.documentElement.classList.toggle('light', progress.theme === 'light')
    document.documentElement.lang = locale
  }, [progress.theme, locale])

  useEffect(() => {
    window.scrollTo({ top: 0 })
    // pri zmene obrazovky sa hovorené prehrávanie vždy zastaví
    stopAllSpeech()
  }, [view, activeModule])

  function openModule(id: string) {
    setActiveModule(id)
    setView('module')
  }

  function handleModulePass(moduleId: string, score: number) {
    const mod = modules.find((m) => m.id === moduleId)
    const passed = score >= 2
    const alreadyPassed = progress.modulePassed.includes(moduleId)
    update({
      moduleScores: { ...progress.moduleScores, [moduleId]: score },
      modulePassed: passed ? Array.from(new Set([...progress.modulePassed, moduleId])) : progress.modulePassed,
      xp: passed && !alreadyPassed ? progress.xp + (mod?.xp ?? 0) : progress.xp,
    })
  }

  function handleFinal(score: number) {
    const passed = score >= FINAL_PASS_SCORE
    update({
      finalAttempts: progress.finalAttempts + 1,
      finalScore: Math.max(progress.finalScore ?? 0, score),
      finalPassed: passed || progress.finalPassed,
      completedAt: passed && !progress.completedAt ? new Date().toISOString() : progress.completedAt,
      xp: progress.xp + (passed ? 300 : 25),
    })
  }

  if (showOnboarding) {
    return (
      <div className="min-h-screen px-4 py-10">
        <div className="mx-auto mb-6 flex max-w-3xl justify-end">
          <div className="flex items-center gap-1">
            <button className={`chip ${locale === 'sk' ? 'accent border-current' : ''}`} onClick={() => update({ locale: 'sk' })}>
              SK
            </button>
            <button className={`chip ${locale === 'en' ? 'accent border-current' : ''}`} onClick={() => update({ locale: 'en' })}>
              EN
            </button>
            <button className="chip" onClick={() => update({ theme: progress.theme === 'dark' ? 'light' : 'dark' })}>
              {progress.theme === 'dark' ? '🌙' : '☀️'}
            </button>
          </div>
        </div>
        <Onboarding
          locale={locale}
          onComplete={(name, _score, level) => {
            update({ name, level, placementDone: true, xp: 50 })
            setShowOnboarding(false)
            setView(initialView)
          }}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Header
        locale={locale}
        theme={progress.theme}
        xp={progress.xp}
        active={view}
        onNavigate={setView}
        onLocale={(l) => update({ locale: l })}
        onTheme={() => update({ theme: progress.theme === 'dark' ? 'light' : 'dark' })}
      />
      <main className="mx-auto max-w-6xl px-4 py-6 safe-bottom">
        <AnimatePresence mode="wait">
          <motion.div
            key={view + activeModule + locale}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            {view === 'home' && (
              <Dashboard locale={locale} progress={progress} onOpenModule={openModule} onNavigate={setView} />
            )}
            {view === 'modules' && <ModuleList locale={locale} progress={progress} onOpen={openModule} />}
            {view === 'module' && (
              <ModuleDetail
                locale={locale}
                progress={progress}
                moduleId={activeModule}
                onPass={handleModulePass}
                onBack={() => setView('modules')}
                onNextModule={openModule}
              />
            )}
            {view === 'playground' && (
              <Playground
                locale={locale}
                history={progress.playgroundHistory}
                onRun={(p, score) =>
                  update({
                    playgroundRuns: progress.playgroundRuns + 1,
                    playgroundHistory: [{ prompt: p, score }, ...progress.playgroundHistory].slice(0, 5),
                  })
                }
              />
            )}
            {view === 'compare' && <CompareView locale={locale} />}
            {view === 'cases' && (
              <CasesView
                locale={locale}
                read={progress.casesViewed}
                onRead={(id) =>
                  update({
                    casesViewed: progress.casesViewed.includes(id)
                      ? progress.casesViewed
                      : [...progress.casesViewed, id],
                  })
                }
              />
            )}
            {view === 'challenge' && (
              <ChallengeView
                locale={locale}
                done={progress.challengeDone}
                onComplete={(id) => {
                  const has = progress.challengeDone.includes(id)
                  update({
                    challengeDone: has ? progress.challengeDone : [...progress.challengeDone, id],
                    xp: has ? progress.xp : progress.xp + 15,
                  })
                }}
              />
            )}
            {view === 'final' && (
              <FinalTestView locale={locale} progress={progress} locked={!allModulesPassed} onFinish={handleFinal} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="border-t py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-xs muted">
          <span>
            {T.appName[locale]} · {T.authorCredit[locale]} {AUTHOR} · {T.localOnly[locale]}
          </span>
          <div className="flex gap-3">
            {progress.finalPassed && (
              <button className="font-semibold accent" onClick={() => downloadCertificate(progress, locale)}>
                ⬇ {T.finalCertificate[locale]} ({progress.finalScore}/{FINAL_TOTAL})
              </button>
            )}
            <button
              className="font-semibold"
              onClick={() => {
                if (window.confirm(T.confirmReset[locale])) {
                  reset()
                  setShowOnboarding(true)
                  setView('home')
                }
              }}
            >
              {T.resetProgress[locale]}
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
