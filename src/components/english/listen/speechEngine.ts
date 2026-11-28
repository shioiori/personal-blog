// Promise-based, abortable building blocks for the auto reader: speak a text,
// play an audio clip, wait. Each rejects with an AbortError when the signal
// fires, so a reading sequence can be stopped at any point.

const FEMALE_VOICE_HINTS = [
  "female", "zira", "samantha", "susan", "victoria", "karen", "moira", "tessa",
  "fiona", "google us english", "google uk english female", "aria", "jenny",
  "hoaimy", "hoai my", "linh",
];

export function speechSupported(): boolean {
  return typeof window !== "undefined" && !!window.speechSynthesis;
}

/** A voice for the language, or undefined when the browser has none (we never fall back to another language's voice). */
export function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  if (!speechSupported()) return undefined;
  const prefix = lang.slice(0, 2).toLowerCase();
  const pool = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(prefix));
  if (pool.length === 0) return undefined;
  const exact = pool.filter((v) => v.lang.toLowerCase() === lang.toLowerCase());
  const ranked = exact.length > 0 ? exact : pool;
  return ranked.find((v) => FEMALE_VOICE_HINTS.some((h) => v.name.toLowerCase().includes(h))) ?? ranked[0];
}

/** Voices load asynchronously in Chrome; wait (briefly) until the list is filled. */
export function waitForVoices(timeoutMs = 1500): Promise<void> {
  if (!speechSupported() || window.speechSynthesis.getVoices().length > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      window.speechSynthesis.removeEventListener("voiceschanged", done);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    window.speechSynthesis.addEventListener("voiceschanged", done);
  });
}

function abortError() {
  return new DOMException("Aborted", "AbortError");
}

export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

// Keeps utterances referenced until they finish — Chrome may garbage-collect
// one mid-speech and then never fire its end event.
const liveUtterances = new Set<SpeechSynthesisUtterance>();

export function speak(text: string, lang: string, rate: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    if (!speechSupported() || !text.trim()) return resolve();

    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    const voice = pickVoice(lang);
    if (voice) u.voice = voice;
    liveUtterances.add(u);

    // Safety net in case the engine never reports the end.
    const safety = setTimeout(() => finish(), Math.max(6000, (text.length * 180) / rate));
    let settled = false;
    function cleanup() {
      settled = true;
      clearTimeout(safety);
      liveUtterances.delete(u);
      signal.removeEventListener("abort", onAbort);
    }
    function finish() {
      if (settled) return;
      cleanup();
      resolve();
    }
    function onAbort() {
      if (settled) return;
      cleanup();
      synth.cancel();
      reject(abortError());
    }
    u.onend = finish;
    u.onerror = finish; // an unreadable part is skipped, not fatal
    signal.addEventListener("abort", onAbort, { once: true });
    if (synth.paused) synth.resume();
    synth.speak(u);
  });
}

/** Resolves true when the clip played to the end, false when it couldn't be played. */
export function playAudio(url: string, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const audio = new Audio(url);
    let settled = false;
    function settle(fn: () => void) {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      fn();
    }
    function onAbort() {
      audio.pause();
      settle(() => reject(abortError()));
    }
    audio.onended = () => settle(() => resolve(true));
    audio.onerror = () => settle(() => resolve(false));
    signal.addEventListener("abort", onAbort, { once: true });
    audio.play().catch(() => settle(() => resolve(false)));
  });
}

export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(abortError());
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
