"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Download, Loader2, Play, Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/Select";
import {
  PIPER_VI_VOICES,
  downloadPiperVoice,
  isPiperVoice,
  piperSupported,
  removePiperVoice,
  storedPiperVoices,
  synthesize,
} from "./piperVoice";
import { speak, speechSupported, voicesFor, waitForVoices } from "./speechEngine";

export const BROWSER_VOICE_PREFIX = "browser:";

/** Vietnamese voices installed in this browser (they can load late, so listen for changes). */
function useBrowserViVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!speechSupported()) return;
    const update = () => setVoices(voicesFor("vi-VN"));
    waitForVoices().then(update);
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", update);
  }, []);
  return voices;
}

/** Which Piper voices are already downloaded in this browser. */
export function usePiperStore() {
  const [stored, setStored] = useState<string[]>([]);
  const refresh = useCallback(async () => setStored(await storedPiperVoices()), []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { stored, refresh };
}

interface ViVoiceSectionProps {
  value: string;
  onChange: (voice: string) => void;
  stored: string[];
  refresh: () => Promise<void>;
  rate: number;
}

export function ViVoiceSection({ value, onChange, stored, refresh, rate }: ViVoiceSectionProps) {
  const t = useTranslations("English");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const testAudio = useRef<HTMLAudioElement | null>(null);
  const testCtrl = useRef<AbortController | null>(null);
  const supported = piperSupported();
  const browserVoices = useBrowserViVoices();
  const browserVoiceName = value.startsWith(BROWSER_VOICE_PREFIX) ? value.slice(BROWSER_VOICE_PREFIX.length) : null;
  const browserVoiceMissing = !!browserVoiceName && !browserVoices.some((v) => v.name === browserVoiceName);

  const piperId = isPiperVoice(value) ? value : null;
  const voice = PIPER_VI_VOICES.find((v) => v.id === piperId);
  const isStored = !!piperId && stored.includes(piperId);

  useEffect(
    () => () => {
      testAudio.current?.pause();
      testCtrl.current?.abort();
    },
    []
  );

  async function testBrowserVoice() {
    testCtrl.current?.abort();
    const ctrl = new AbortController();
    testCtrl.current = ctrl;
    try {
      await speak(t("Listen.piperSample"), "vi-VN", rate, ctrl.signal, browserVoiceName);
    } catch {
      // aborted
    }
  }

  async function download() {
    if (!piperId) return;
    setError(null);
    setProgress(0);
    try {
      await downloadPiperVoice(piperId, setProgress);
      await refresh();
    } catch (e) {
      console.error(e);
      setError(t("Listen.piperDownloadFailed"));
    } finally {
      setProgress(null);
    }
  }

  async function remove() {
    if (!piperId) return;
    await removePiperVoice(piperId);
    await refresh();
  }

  async function test() {
    if (!piperId) return;
    setError(null);
    setTesting(true);
    try {
      const url = await synthesize(t("Listen.piperSample"), piperId);
      testAudio.current?.pause();
      const audio = new Audio(url);
      audio.playbackRate = rate;
      testAudio.current = audio;
      await audio.play();
    } catch (e) {
      console.error(e);
      setError(t("Listen.piperFailed"));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-3">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="browser">{t("Listen.browserVoice")}</SelectItem>
          {browserVoices.map((v) => (
            <SelectItem key={v.name} value={BROWSER_VOICE_PREFIX + v.name}>
              {v.name}
              {v.localService ? "" : ` · ${t("Listen.browserVoiceOnline")}`}
            </SelectItem>
          ))}
          {browserVoiceMissing && browserVoiceName && (
            <SelectItem value={value}>{browserVoiceName}</SelectItem>
          )}
          {supported &&
            PIPER_VI_VOICES.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                Piper · {v.label} · {v.sizeMb}MB{stored.includes(v.id) ? " ✓" : ""}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      {!supported && <p className="text-xs text-muted-foreground">{t("Listen.piperUnsupported")}</p>}

      {!piperId && (
        <div className="space-y-2">
          {browserVoices.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("Listen.noBrowserViVoices")}</p>
          ) : (
            <Button size="sm" variant="outline" className="h-7" onClick={testBrowserVoice}>
              <Play className="w-3.5 h-3.5 mr-1" /> {t("Listen.piperTest")}
            </Button>
          )}
          {browserVoiceMissing && <p className="text-xs text-muted-foreground">{t("Listen.browserVoiceMissing")}</p>}
        </div>
      )}

      {piperId && voice && supported && (
        <div className="space-y-2">
          {isStored ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <Check className="w-3.5 h-3.5" /> {t("Listen.piperReady")}
              </span>
              <div className="ml-auto flex gap-1">
                <Button size="sm" variant="outline" className="h-7" onClick={test} disabled={testing}>
                  {testing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-1" />}
                  {t("Listen.piperTest")}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-muted-foreground" onClick={remove} title={t("Listen.piperRemove")}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ) : progress !== null ? (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("Listen.piperDownloading")}</span>
                <span className="tabular-nums">{Math.round(progress * 100)}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{t("Listen.piperNotDownloaded", { size: voice.sizeMb })}</p>
              <Button size="sm" variant="outline" className="h-7" onClick={download}>
                <Download className="w-3.5 h-3.5 mr-1" /> {t("Listen.piperDownload", { size: voice.sizeMb })}
              </Button>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
