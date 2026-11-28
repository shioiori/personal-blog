/// <reference lib="webworker" />
// Runs Piper (phonemizer + ONNX model) off the main thread, so synthesising a
// phrase — up to a second or more — doesn't freeze the page.

import { TtsSession, type Progress } from "@mintplex-labs/piper-tts-web";

type Request =
  | { id: number; type: "load"; voiceId: string; wasmPaths: Record<string, string> }
  | { id: number; type: "predict"; voiceId: string; wasmPaths: Record<string, string>; text: string }
  | { id: number; type: "reset" };

let session: Promise<TtsSession> | null = null;
let sessionVoice: string | null = null;
let chain: Promise<unknown> = Promise.resolve();

function getSession(voiceId: string, wasmPaths: Record<string, string>, onProgress: (p: Progress) => void) {
  if (session && sessionVoice === voiceId) return session;
  TtsSession._instance = null; // the library's singleton ignores a voice change otherwise
  sessionVoice = voiceId;
  session = TtsSession.create({
    voiceId,
    progress: onProgress,
    wasmPaths: wasmPaths as { onnxWasm: string; piperData: string; piperWasm: string },
  });
  session.catch(() => {
    session = null;
    sessionVoice = null;
  });
  return session;
}

async function handle(msg: Request) {
  if (msg.type === "reset") {
    session = null;
    sessionVoice = null;
    TtsSession._instance = null;
    return undefined;
  }
  const s = await getSession(msg.voiceId, msg.wasmPaths, (p) =>
    self.postMessage({ id: msg.id, type: "progress", loaded: p.loaded, total: p.total })
  );
  if (msg.type === "predict") return s.predict(msg.text);
  return undefined;
}

self.onmessage = (e: MessageEvent<Request>) => {
  const msg = e.data;
  // One job at a time: the model can't run two inferences at once.
  chain = chain
    .then(() => handle(msg))
    .then(
      (blob) => self.postMessage({ id: msg.id, type: "done", blob }),
      (err) => self.postMessage({ id: msg.id, type: "error", message: String(err?.message ?? err) })
    );
};
