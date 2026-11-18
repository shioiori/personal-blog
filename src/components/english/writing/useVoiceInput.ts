"use client";

import { useCallback, useRef, useState } from "react";

// Minimal ambient typings for the Web Speech API — not in default TS DOM
// libs, and not used anywhere else in this project yet.
interface SpeechRecognitionResultEvent extends Event {
  results: { [index: number]: { [index: number]: { transcript: string } }; length: number };
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoiceInput(lang = "en-US") {
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => getSpeechRecognitionCtor() !== null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const start = useCallback(
    (onResult: (text: string) => void) => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) return;
      const recognition = new Ctor();
      recognition.lang = lang;
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.onresult = (e) => {
        const transcript = e.results[e.results.length - 1]?.[0]?.transcript ?? "";
        if (transcript) onResult(transcript.trim());
      };
      recognition.onerror = () => setListening(false);
      recognition.onend = () => setListening(false);
      recognitionRef.current = recognition;
      setListening(true);
      recognition.start();
    },
    [lang]
  );

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, start, stop };
}
