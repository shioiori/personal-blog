"use client";

import { useCallback, useRef, useState } from "react";

const FEMALE_VOICE_HINTS = [
  "female",
  "zira",
  "samantha",
  "susan",
  "victoria",
  "karen",
  "moira",
  "tessa",
  "fiona",
  "google us english",
  "google uk english female",
  "ting-ting",
  "mei-jia",
  "yaoyao",
  "huihui",
  "aria",
  "jenny",
];

function pickFemaleVoice(lang: string): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !window.speechSynthesis) return undefined;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return undefined;
  const langPrefix = lang.slice(0, 2).toLowerCase();
  const langVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));
  const pool = langVoices.length > 0 ? langVoices : voices;
  return (
    pool.find((v) => FEMALE_VOICE_HINTS.some((hint) => v.name.toLowerCase().includes(hint))) ??
    pool[0]
  );
}

export function useSpeech(lang = "zh-CN") {
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.8;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    const voice = pickFemaleVoice(lang);
    if (voice) utterance.voice = voice;

    utteranceRef.current = utterance;

    if (!voice && window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.addEventListener(
        "voiceschanged",
        () => {
          const lateVoice = pickFemaleVoice(lang);
          if (lateVoice) utterance.voice = lateVoice;
          window.speechSynthesis.speak(utterance);
        },
        { once: true }
      );
      return;
    }

    window.speechSynthesis.speak(utterance);
  }, [lang]);

  const cancel = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  return { speak, cancel, speaking };
}
