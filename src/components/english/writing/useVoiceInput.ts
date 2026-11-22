"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal ambient typings for the Web Speech API — not in default TS DOM
// libs, and not used anywhere else in this project yet.
interface SpeechRecognitionResultEvent extends Event {
  resultIndex: number;
  results: {
    [index: number]: { isFinal: boolean; [index: number]: { transcript: string } };
    length: number;
  };
}
interface SpeechRecognitionErrorEventLike extends Event {
  error?: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Errors after which restarting would just fail again (mic denied/missing).
const FATAL_ERRORS = new Set(["not-allowed", "service-not-allowed", "audio-capture"]);

/**
 * Keeps listening until the user presses stop. Browsers end a recognition
 * session on their own after a short pause (or after ~a minute even in
 * continuous mode), so we run in continuous mode and transparently restart
 * the session whenever it ends without the user asking.
 */
export function useVoiceInput(lang = "en-US") {
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => getSpeechRecognitionCtor() !== null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // True while the user wants to keep listening (cleared only by stop/fatal error).
  const wantListeningRef = useRef(false);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    rec?.stop();
    setListening(false);
  }, []);

  const start = useCallback(
    (onResult: (text: string) => void) => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) return;
      recognitionRef.current?.stop();
      wantListeningRef.current = true;

      const startSession = () => {
        const recognition = new Ctor();
        recognition.lang = lang;
        recognition.interimResults = false;
        recognition.continuous = true;
        recognition.onresult = (e) => {
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const result = e.results[i];
            if (!result?.isFinal) continue;
            const transcript = result[0]?.transcript?.trim() ?? "";
            if (transcript) onResult(transcript);
          }
        };
        recognition.onerror = (e) => {
          if (e.error && FATAL_ERRORS.has(e.error)) wantListeningRef.current = false;
        };
        recognition.onend = () => {
          if (recognitionRef.current !== recognition) return; // superseded or stopped
          if (wantListeningRef.current) {
            try {
              startSession();
              return;
            } catch {
              wantListeningRef.current = false;
            }
          }
          recognitionRef.current = null;
          setListening(false);
        };
        recognitionRef.current = recognition;
        recognition.start();
      };

      setListening(true);
      try {
        startSession();
      } catch {
        wantListeningRef.current = false;
        recognitionRef.current = null;
        setListening(false);
      }
    },
    [lang]
  );

  // Don't leave the mic open after leaving the page.
  useEffect(() => stop, [stop]);

  return { supported, listening, start, stop };
}
