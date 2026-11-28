"use client";

// Offline Vietnamese speech with Piper (VITS models run in the browser via
// ONNX Runtime WebAssembly). The model is downloaded once from Hugging Face on
// request and kept in the browser's private file system (OPFS); after that,
// synthesis needs no network and no server.

import type { Progress } from "@mintplex-labs/piper-tts-web";

// Only VAIS1000 works: the other Vietnamese Piper voices (25hours_single-low,
// vivos-x_low) are old 0.2.0 models with 130 phoneme symbols, while the
// library's phonemizer emits ids above that → "indices element out of data bounds".
export const PIPER_VI_VOICES = [{ id: "vi_VN-vais1000-medium", label: "VAIS1000 (medium)", sizeMb: 63 }] as const;
export type PiperVoiceId = (typeof PIPER_VI_VOICES)[number]["id"];

export function isPiperVoice(id: string): id is PiperVoiceId {
  return PIPER_VI_VOICES.some((v) => v.id === id);
}

type PiperModule = typeof import("@mintplex-labs/piper-tts-web");
let modPromise: Promise<PiperModule> | null = null;
function lib(): Promise<PiperModule> {
  if (!modPromise) modPromise = import("@mintplex-labs/piper-tts-web");
  return modPromise;
}

export function piperSupported(): boolean {
  return typeof window !== "undefined" && typeof WebAssembly !== "undefined" && !!navigator.storage?.getDirectory;
}

export async function storedPiperVoices(): Promise<string[]> {
  if (!piperSupported()) return [];
  try {
    return await (await lib()).stored();
  } catch {
    return [];
  }
}

export async function downloadPiperVoice(id: PiperVoiceId, onProgress?: (fraction: number) => void): Promise<void> {
  // The library's own download() resolves before the files are written to OPFS
  // (it doesn't await the write), so stored() would still miss the voice.
  // Loading a session fetches the model, awaits the write, and keeps it ready for use.
  await engineLoad(id, (p) => {
    if (p.total > 1_000_000) onProgress?.(p.loaded / p.total);
  });
}

export async function removePiperVoice(id: PiperVoiceId): Promise<void> {
  const tts = await lib();
  await tts.remove(id);
  engineReset();
  clearCache();
}

// ---- synthesis ----------------------------------------------------------

const ORT_VERSION = "1.31.1";
const ORT_WASM_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

const WASM_PATHS = {
  // The library points at the 1.18 runtime files on cdnjs, but npm installs a newer
  // onnxruntime-web whose loader needs files 1.18 doesn't have. Load the runtime files
  // matching the installed version (pinned in package.json — keep ORT_VERSION in sync).
  onnxWasm: ORT_WASM_BASE,
  // The library's defaults for the phonemizer.
  piperData: "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.data",
  piperWasm: "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.wasm",
};

type ProgressFn = (p: { loaded: number; total: number }) => void;

// ---- engine: a Web Worker (keeps the page responsive), falling back to the main thread

type Pending = { resolve: (blob: Blob | undefined) => void; reject: (e: Error) => void; onProgress?: ProgressFn };
let worker: Worker | null | undefined; // undefined: not tried yet; null: unavailable
let nextId = 0;
const pending = new Map<number, Pending>();

function failWorker(reason: string) {
  worker?.terminate();
  worker = null;
  for (const p of pending.values()) p.reject(new Error(reason));
  pending.clear();
}

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("./piper.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent) => {
      const { id, type } = e.data;
      const p = pending.get(id);
      if (!p) return;
      if (type === "progress") p.onProgress?.(e.data);
      else {
        pending.delete(id);
        if (type === "done") p.resolve(e.data.blob);
        else p.reject(new Error(e.data.message));
      }
    };
    worker.onerror = () => failWorker("Piper worker crashed");
  } catch {
    worker = null;
  }
  return worker;
}

function callWorker(w: Worker, msg: Record<string, unknown>, onProgress?: ProgressFn): Promise<Blob | undefined> {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject, onProgress });
    w.postMessage({ ...msg, id, wasmPaths: WASM_PATHS });
  });
}

type Session = InstanceType<PiperModule["TtsSession"]>;
let mainSession: Promise<Session> | null = null;
let mainVoice: string | null = null;

async function mainThreadSession(id: PiperVoiceId, progress?: ProgressFn): Promise<Session> {
  if (mainSession && mainVoice === id) return mainSession;
  const tts = await lib();
  tts.TtsSession._instance = null; // the library's singleton ignores a voice change otherwise
  mainVoice = id;
  mainSession = tts.TtsSession.create({ voiceId: id, progress, wasmPaths: WASM_PATHS }).catch((e) => {
    mainSession = null;
    mainVoice = null;
    throw e;
  });
  return mainSession;
}

/** Runs a job in the worker; if the worker can't run Piper at all, switches to the main thread for good. */
async function run<T>(inWorker: (w: Worker) => Promise<T>, onMain: () => Promise<T>): Promise<T> {
  const w = getWorker();
  if (w) {
    try {
      return await inWorker(w);
    } catch (e) {
      if (worker) throw e; // a real error for this job — the worker itself is fine
      console.warn("Piper worker unavailable, running on the main thread", e);
    }
  }
  return onMain();
}

async function engineLoad(id: PiperVoiceId, onProgress?: ProgressFn): Promise<void> {
  await run(
    async (w) => {
      await callWorker(w, { type: "load", voiceId: id }, onProgress);
    },
    async () => {
      await mainThreadSession(id, onProgress);
    }
  );
}

async function enginePredict(id: PiperVoiceId, text: string): Promise<Blob> {
  return run(
    async (w) => (await callWorker(w, { type: "predict", voiceId: id, text })) as Blob,
    async () => (await mainThreadSession(id)).predict(text)
  );
}

function engineReset() {
  if (worker) callWorker(worker, { type: "reset" }).catch(() => {});
  mainSession = null;
  mainVoice = null;
}

// Synthesised clips, keyed by voice + text. Loops replay the same phrases
// (lead-ins, meanings), so caching saves most of the work.
const CACHE_LIMIT = 300;
let queue: Promise<void> = Promise.resolve();
const cache = new Map<string, Promise<string>>();

function clearCache() {
  for (const p of cache.values()) p.then((url) => URL.revokeObjectURL(url)).catch(() => {});
  cache.clear();
}

/** Object URL of a WAV for the text; starts the synthesis if needed (call early to prefetch). */
export function synthesize(text: string, id: PiperVoiceId): Promise<string> {
  const key = `${id}\u0000${text}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit); // keep recently used entries
    return hit;
  }
  // One at a time, in request order: parallel runs on the same model just compete,
  // so the phrase needed first would finish last.
  const job = queue
    .then(() => enginePredict(id, text))
    .then((wav) => URL.createObjectURL(wav));
  queue = job.then(
    () => undefined,
    () => undefined
  );
  job.catch(() => cache.delete(key));
  cache.set(key, job);
  if (cache.size > CACHE_LIMIT) {
    const [oldKey, oldJob] = cache.entries().next().value as [string, Promise<string>];
    cache.delete(oldKey);
    oldJob.then((url) => URL.revokeObjectURL(url)).catch(() => {});
  }
  return job;
}
