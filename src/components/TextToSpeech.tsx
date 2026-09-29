import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Offline hovorená verzia textu.
 * Využíva výhradne natívne Web Speech API (window.speechSynthesis):
 * žiadne knižnice, žiadne sieťové požiadavky, žiadne kľúče.
 * Ak systém TTS nepodporuje, tlačidlá sa nezobrazia.
 */

type SpeechState = 'idle' | 'speaking' | 'paused'

/** Rýchlosti čítania. */
const RATES = [0.9, 1, 1.25, 1.5] as const

/** Jazyk hlasu – primárne slovenský. */
const LANG = 'sk-SK'
const FALLBACK_LANGS = ['sk', 'cs', 'en-US', 'en']

/**
 * Chrome ukončí prednášanie po ~15 s. Preto text delíme na vety
 * a prehrávame ich postupne – inak by ste počuli len prvých 15 sekúnd.
 */
function splitForSpeech(text: string, maxLen = 220): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []

  const sentences = clean.match(/[^.!?…]+[.!?…]*\s*/g) ?? [clean]
  const chunks: string[] = []
  let current = ''

  for (const sentence of sentences) {
    if ((current + sentence).length > maxLen && current.trim()) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current += sentence
    }
    // jedna obrovská veta bez bodiek → rozrežeme
    while (current.length > maxLen * 1.6) {
      chunks.push(current.slice(0, maxLen).trim())
      current = current.slice(maxLen)
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

function isSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

/** Vyberie slovenský hlas, inak prvý dostupný podľa jazyka. */
function pickVoice(): SpeechSynthesisVoice | null {
  if (!isSupported()) return null
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null

  const normalized = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-')
  const byLang = FALLBACK_LANGS.map((lang) => voices.find((v) => normalized(v) === lang.toLowerCase())).find(
    Boolean,
  )
  return voices.find((v) => normalized(v) === 'sk-sk') ?? voices.find((v) => normalized(v).startsWith('sk')) ?? byLang ?? voices[0]
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
  const [supported] = useState<boolean>(isSupported)

  const indexRef = useRef(0)
  const rateRef = useRef(rate)
  const tokenRef = useRef(0)

  rateRef.current = rate

  // Načítanie hlasov (Android ich sprístupňuje oneskoro)
  useEffect(() => {
    if (!supported) return
    const refresh = () => {
      const voice = pickVoice()
      setVoiceName(voice ? `${voice.name} (${voice.lang})` : '')
    }
    refresh()
    window.speechSynthesis.addEventListener('voiceschanged', refresh)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', refresh)
  }, [supported])

  const stop = useCallback(() => {
    if (!isSupported()) return
    tokenRef.current += 1
    window.speechSynthesis.cancel()
    setState('idle')
  }, [])

  // Zastaví prehrávanie pri odchode z obrazovky aj pri zmene textu
  useEffect(() => stop, [stop, text])

  const chunks = splitForSpeech(text)

  const speakFrom = useCallback(
    (startIndex: number) => {
      if (!isSupported() || chunks.length === 0) return

      window.speechSynthesis.cancel()
      const token = tokenRef.current + 1
      tokenRef.current = token

      const voice = pickVoice()
      const startChunk = Math.min(startIndex, chunks.length - 1)

      for (let i = startChunk; i < chunks.length; i++) {
        if (tokenRef.current !== token) return
        const utterance = new SpeechSynthesisUtterance(chunks[i])
        utterance.lang = voice?.lang ?? LANG
        utterance.rate = rateRef.current
        if (voice) utterance.voice = voice

        utterance.onend = () => {
          if (tokenRef.current !== token) return
          if (i === chunks.length - 1) {
            setState('idle')
            indexRef.current = 0
          }
        }
        utterance.onerror = (event) => {
          if (tokenRef.current !== token) return
          // prerušenie používateľom nie je chyba
          if (event.error !== 'canceled' && event.error !== 'interrupted') setState('idle')
        }
        window.speechSynthesis.speak(utterance)
      }
      setState('speaking')
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text],
  )

  const play = useCallback(() => {
    if (!isSupported() || chunks.length === 0) return
    if (state === 'paused') {
      window.speechSynthesis.resume()
      setState('speaking')
      return
    }
    indexRef.current = 0
    speakFrom(0)
  }, [chunks.length, speakFrom, state])

  const pause = useCallback(() => {
    if (!isSupported() || state !== 'speaking') return
    window.speechSynthesis.pause()
    setState('paused')
  }, [state])

  const changeRate = useCallback(
    (next: number) => {
      setRate(next)
      rateRef.current = next
      // zmena rýchlosti počas prehrávania = začneme odznova
      if (state !== 'idle') {
        indexRef.current = 0
        setTimeout(() => speakFrom(0), 60)
      }
    },
    [speakFrom, state],
  )

  // Systém bez TTS alebo prázdny text → tlačidlá vôbec nezobrazujeme
  if (!supported || chunks.length === 0) return null

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


