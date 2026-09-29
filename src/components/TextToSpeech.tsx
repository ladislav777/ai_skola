import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { TextToSpeech as NativeTTS, QueueStrategy } from '@capacitor-community/text-to-speech'

/**
 * Offline hovorená verzia textu.
 *
 * Na počítači a v prehliadači používame natívne Web Speech API
 * (window.speechSynthesis) – žiadne knižnice, žiadne sieťové požiadavky.
 *
 * V aplikácii pre Android je Web Speech API nedostupné (WebView ho neposkytuje
 * spoľahlivo), preto používame natívny systémový TTS cez Capacitor plugin.
 * Oboje je offline a bez kľúčov – hlas berie zo zariadenia.
 */

type SpeechState = 'idle' | 'speaking' | 'paused'

/** Rýchlosti čítania. */
const RATES = [0.9, 1, 1.25, 1.5] as const

/** Jazyk hlasu – primárne slovenský. */
const LANG = 'sk-SK'
/** Poradie hľadania hlasu, ak nie je dostupný sk-SK. */
const FALLBACK_LANGS = ['sk-SK', 'sk', 'cs-CZ', 'cs', 'en-US', 'en']

/** Hranica, pri ktorej delíme po interpunkcii. */
const SENTENCE_LIMIT = 150
/** Horná hranica pre úsek po delení po slovách. */
const WORD_LIMIT = 120

/** Vysvetlenie pre značku, keď systém neposkytuje syntézu reči. */
const UNSUPPORTED_TITLE_SK =
  'Tento prehliadač nepodporuje syntézu reči. Nainštalujte si hlas v Nastaveniach systému (Slovensko) a stránku obnovte.'
const UNSUPPORTED_TITLE_EN =
  'This browser does not support speech synthesis. Install a system voice and reload.'

/** Vysvetlenie pre značku, keď systém hlas má, ale chýba slovenský hlas. */
const NO_SLOVAK_TITLE_SK =
  'Zariadenie nemá slovenský hlas. Nastavenia → Systém → Jazyky a vstup → Prevod textu na reč → nainštalujte slovenský hlas.'
const NO_SLOVAK_TITLE_EN =
  'No Slovak voice installed. Install it in Settings → System → Languages → Text-to-speech output.'

/**
 * Dvojfázové delenie textu na úseky vhodné pre prehrávanie.
 *
 * Fáza 1 – delenie podľa interpunkcie (. ! ? ; : … a nový riadok).
 *          Celé vety nechávame intactné, aby neboli roztrhané v polovici.
 * Fáza 2 – ak je úsek po interpunkcii stále dlhší ako SENTENCE_LIMIT,
 *          delíme ho po slovách na úseky s dĺžkou približne WORD_LIMIT.
 *
 * Chrome má známy timeout ~15 s, po ktorom speechSynthesis ticho zastaví
 * prehrávanie. Krátke úseky sa na tomto limite nepretrhnú.
 */
export function splitForSpeech(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []

  // ── Fáza 1: delenie po interpunkcii (interpunkcia ostáva v úseku) ──
  const sentences = clean.match(/[^.!?…;:\n]+[.!?…;:\n]*\s*/g) ?? [clean]

  // ── Fáza 2: prípadné sekundárne delenie po slovách ──
  const chunks: string[] = []
  for (const sentence of sentences) {
    const trimmed = sentence.trim()
    if (!trimmed) continue

    if (trimmed.length <= SENTENCE_LIMIT) {
      chunks.push(trimmed)
      continue
    }

    // rozrežeme po slovách, pričom každý úsek približne dodržíme WORD_LIMIT
    const words = trimmed.split(/\s+/)
    let buffer = ''
    for (const word of words) {
      if (buffer.length + word.length + 1 <= WORD_LIMIT) {
        buffer += (buffer ? ' ' : '') + word
      } else {
        if (buffer) chunks.push(buffer)
        buffer = word
      }
      // jeden slovo absurdne dlhé (napr. base64) – rozrežeme ako poslednú rezervu
      while (buffer.length > WORD_LIMIT) {
        chunks.push(buffer.slice(0, WORD_LIMIT).trim())
        buffer = buffer.slice(WORD_LIMIT)
      }
    }
    if (buffer) chunks.push(buffer)
  }

  return chunks
}

/** Bežíme v natívnej aplikácii (Android), kde Web Speech API chýba. */
function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

function isSupported(): boolean {
  if (isNativeApp()) return true
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

/**
 * Vyberie najvhodnejší hlas z dostupných.
 * android WebView často vracia prázdne pole, preto je vstup voliteľný
 * a hlas sa môže načítať neskôr cez onvoiceschanged.
 */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null
  const norm = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-')
  for (const lang of FALLBACK_LANGS) {
    const found = voices.find((v) => norm(v) === lang.toLowerCase())
    if (found) return found
  }
  return voices[0] ?? null
}


interface Props {
  /** Text, ktorý sa má prečítať. */
  text: string
  /** Nápoveda pre čitateľa obrazovky. */
  label?: string
  /** `full` = tri tlačidlá + rýchlosti, `inline` = kompaktná verzia. */
  variant?: 'full' | 'inline'
}

export default function TextToSpeech({ text, label = 'Prečítať nahlas', variant = 'full' }: Props) {
  const [state, setState] = useState<SpeechState>('idle')
  const [rate, setRate] = useState<number>(1)
  const [voiceName, setVoiceName] = useState<string>('')
  // Podporu zisťujeme hneď – na zariadení bez TTS tlačidlá nesmú ani bliknúť.
  const [native] = useState<boolean>(isNativeApp)
  const [supported] = useState<boolean>(isSupported)
  /** V natívnej aplikácii nevieme zistiť, či je slovenský hlas nainštalovaný. */
  const [missingSlovak, setMissingSlovak] = useState<boolean>(false)

  /** Aktuálne načítané hlasy (naplní sa asynchrone cez onvoiceschanged). */
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  /** Rýchlosť čítania – ref, aby sa callbacky nemuseli re-kreovať. */
  const rateRef = useRef(rate)
  /** Identifikátor „behu“ prehrávania; staré callbacky sa ním overia a zahodia. */
  const tokenRef = useRef(0)
  /** Timeouty po dokončení úseku – ukladáme ich, aby sme ich vedeli zrušiť. */
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  rateRef.current = rate

  /* ------------------------------------------- natívny hlas (Android) -- */
  useEffect(() => {
    if (!native) return
    // Zisťujeme, či zariadenie pozná slovenský hlas. Ak nie, povieme používateľovi
    // presne čo má nainštalovať, namiesto tichej hlášky „niečo nefunguje“.
    let cancelled = false
    const probe = async () => {
      try {
        const { supported: sk } = await NativeTTS.isLanguageSupported({ lang: LANG })
        if (cancelled) return
        setMissingSlovak(!sk)
        if (sk) setVoiceName('slovenský hlas zariadenia')
      } catch {
        /* zariadenie nemá TTS vôbec – zobrazí sa značka 🔇 */
      }
    }
    void probe()
    return () => {
      cancelled = true
    }
  }, [native])

  /* ---------------------------------------------- načítanie hlasov (async) -- */
  useEffect(() => {
    if (!supported || native) return

    const refresh = () => {
      const voices = window.speechSynthesis.getVoices()
      voicesRef.current = voices
      const voice = pickVoice(voices)
      setVoiceName(voice ? `${voice.name} (${voice.lang})` : '')
    }

    refresh()

    // Android WebView načítava hlasy oneskoro – čakáme na udalosť.
    const synth = window.speechSynthesis
    synth.addEventListener('voiceschanged', refresh)

    // Poistka pre prehliadače, ktoré event nevyvolajú.
    const poll = setInterval(() => {
      if (voicesRef.current.length === 0) refresh()
    }, 500)
    const pollStop = clearInterval.bind(null, poll)

    return () => {
      synth.removeEventListener('voiceschanged', refresh)
      pollStop()
    }
  }, [supported, native])

  /* ----------------------------------------------- zastavenie a čistenie -- */
  /** Zruší front aj všetky čakajúce timeorty (aby nič neviselo v pamäti). */
  const clearTimers = useCallback(() => {
    for (const timer of timersRef.current) clearTimeout(timer)
    timersRef.current = []
  }, [])

  const stop = useCallback(() => {
    if (!isSupported()) return
    tokenRef.current += 1
    clearTimers()
    if (native) {
      // Natívny TTS nemá „pause“, preto tlačidlo ⏸ proste zastaví prehrávanie.
      void NativeTTS.stop().catch(() => undefined)
    } else {
      window.speechSynthesis.cancel()
    }
    setState('idle')
  }, [clearTimers, native])

  // Odchod z obrazovky alebo zmena textu → vždy zastavíme a vyčistíme.
  useEffect(() => stop, [stop, text])

  const chunks = useMemo(() => splitForSpeech(text), [text])

  /* ---------------------------------------------------------- prehrávanie -- */
  const speakFrom = useCallback(
    (startIndex: number) => {
      if (!isSupported() || chunks.length === 0) return

      const token = tokenRef.current + 1
      tokenRef.current = token
      clearTimers()

      /* --- Android: celý text pošleme naraz systémovému TTS --- */
      if (native) {
        // Systémový TTS nemá 15-sekundový limit Chrome, preto netreba deliť
        // text na úseky a riešiť ich medzi sebou.
        const full = chunks.join(' ')
        setState('speaking')
        void NativeTTS.speak({
          text: full,
          lang: LANG,
          rate: rateRef.current,
          pitch: 1,
          queueStrategy: QueueStrategy.Flush,
        })
          .then(() => {
            if (tokenRef.current === token) setState('idle')
          })
          .catch(() => {
            if (tokenRef.current === token) setState('idle')
          })
        return
      }

      window.speechSynthesis.cancel()

      // Hlas čítame až teraz – medzi tým mohol byť načítaný.
      const voice = pickVoice(voicesRef.current)
      const lang = voice?.lang ?? LANG
      const startChunk = Math.max(0, Math.min(startIndex, chunks.length - 1))

      // Prehrávame úseky postupne: ďalší sa začne až po onend predchádzajúceho.
      const speakChunk = (i: number) => {
        if (tokenRef.current !== token) return

        if (i >= chunks.length) {
          setState('idle')
          return
        }

        const utterance = new SpeechSynthesisUtterance(chunks[i])
        utterance.lang = lang
        utterance.rate = rateRef.current
        if (voice) utterance.voice = voice

        utterance.onend = () => {
          if (tokenRef.current !== token) return
          // Chrome občas nevyvolá onend okamžite – dáme mu malú rezervu.
          const timer = setTimeout(() => speakChunk(i + 1), 0)
          timersRef.current.push(timer)
        }

        utterance.onerror = (event) => {
          if (tokenRef.current !== token) return
          clearTimers()
          // prerušenie používateľom nie je chyba
          if (event.error !== 'canceled' && event.error !== 'interrupted') setState('idle')
        }

        window.speechSynthesis.speak(utterance)
      }

      setState('speaking')
      speakChunk(startChunk)
    },
    [chunks, clearTimers, native],
  )


  const play = useCallback(() => {
    if (!isSupported() || chunks.length === 0) return
    if (!native && state === 'paused') {
      window.speechSynthesis.resume()
      setState('speaking')
      return
    }
    speakFrom(0)
  }, [chunks.length, speakFrom, state, native])

  const pause = useCallback(() => {
    if (!isSupported() || state !== 'speaking') return
    // Android TTS nepodporuje pauzu v polovici vety – tlačidlo ho zastaví
    // a opätovné stlačenie 🔊 rozbehne text od začiatku.
    if (native) {
      stop()
      return
    }
    window.speechSynthesis.pause()
    setState('paused')
  }, [state, native, stop])

  const changeRate = useCallback(
    (next: number) => {
      setRate(next)
      rateRef.current = next
      // zmena rýchlosti počas prehrávania = spustíme front odznova s novou rýchlosťou
      if (state !== 'idle') {
        clearTimers()
        const timer = setTimeout(() => speakFrom(0), 60)
        timersRef.current.push(timer)
      }
    },
    [speakFrom, state, clearTimers],
  )

  // Prázdny text → tlačidlá nemajú čo čítať, schováme ich.
  if (chunks.length === 0) return null

  // Systém bez TTS: tlačidlá NECHÁVAME VIDITEĽNÉ (len nefunkčné) a s vysvetlením.
  // Predtým tu bolo `return null`, čo v praxi znamenalo, že na telefóne
  // bez podporovanej syntézy reči hlasový modul úplne zmizol bez varovania.
  if (!supported) {
    const sk =
      typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('sk')
    return (
      <span
        className="inline-flex items-center gap-1 text-xs muted"
        title={sk ? UNSUPPORTED_TITLE_SK : UNSUPPORTED_TITLE_EN}
      >
        {sk ? '🔇 Hlas nedostupný' : '🔇 Voice unavailable'}
      </span>
    )
  }

  // TTS funguje, ale zariadenie nemá slovenský hlas. Bez upozornenia by
  // aplikácia čítala po anglicky a nikto by nevedel prečo.
  if (native && missingSlovak) {
    const sk = !label.startsWith('Read')
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-amber-400/90"
        title={sk ? NO_SLOVAK_TITLE_SK : NO_SLOVAK_TITLE_EN}
      >
        {sk ? '⚠️ Chýba slovenský hlas' : '⚠️ No Slovak voice'}
      </span>
    )
  }

  const active = state !== 'idle'
  const title = voiceName ? `${label} · hlas: ${voiceName}` : label

  if (variant === 'inline') {
    return (
      <span className="inline-flex items-center gap-1" title={title}>
        <button
          type="button"
          className="tts-btn"
          onClick={state === 'paused' ? play : pause}
          disabled={state !== 'speaking' && state !== 'paused'}
          aria-label={state === 'paused' ? 'Pokračovať' : 'Pozastaviť'}
        >
          {state === 'paused' ? '▶' : '⏸'}
        </button>
        <button type="button" className="tts-btn" onClick={play} aria-label="Prehrať">
          🔊
        </button>
        <button type="button" className="tts-btn" onClick={stop} disabled={!active} aria-label="Zastaviť">
          ⏹
        </button>
      </span>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={`btn-ghost !px-3 !py-1.5 text-xs ${state === 'speaking' ? 'tts-active' : ''}`}
        onClick={play}
        disabled={state === 'speaking'}
        title={title}
      >
        🔊 {active ? 'Číta…' : 'Prehrať'}
      </button>
      <button
        type="button"
        className="btn-ghost !px-3 !py-1.5 text-xs"
        onClick={pause}
        disabled={state !== 'speaking'}
        title={state === 'paused' ? 'Pozastavené' : 'Pozastaviť'}
      >
        ⏸
      </button>
      <button
        type="button"
        className="btn-ghost !px-3 !py-1.5 text-xs"
        onClick={stop}
        disabled={!active}
        title="Zastaviť"
      >
        ⏹
      </button>

      {RATES.map((r) => (
        <button
          key={r}
          type="button"
          className={`chip !px-2 !py-0.5 ${rate === r ? 'accent border-current' : ''}`}
          onClick={() => changeRate(r)}
          title={`Rýchlosť čítania ${r}×`}
        >
          {r}×
        </button>
      ))}

      {voiceName && <span className="text-[10px] muted">{voiceName}</span>}
    </div>
  )
}

/** Zastaví všetko hovorené (volá sa pri zmene obrazovky). */
export function stopAllSpeech() {
  if (isSupported()) window.speechSynthesis.cancel()
}


