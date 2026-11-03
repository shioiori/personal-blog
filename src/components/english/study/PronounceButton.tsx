"use client";

import { useCallback, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSpeech } from "@/src/hooks/useSpeech";
import { cn } from "@/src/utils/ui";

interface PronounceButtonProps {
  word: string;
  audioUrl?: string;
  className?: string;
  size?: "sm" | "md";
}

// Plays a real pronunciation audio clip when one is available (from the
// dictionary lookup), falling back to the browser's speech synthesis
// (English voice) otherwise — so there is always something to play.
export function usePronounce() {
  const { speak } = useSpeech("en-US");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const pronounce = useCallback(
    (word: string, audioUrl?: string) => {
      if (!audioUrl) {
        speak(word);
        return;
      }
      if (audioRef.current?.src !== audioUrl) audioRef.current = new Audio(audioUrl);
      const audio = audioRef.current;
      audio.currentTime = 0;
      setPlaying(true);
      audio.onended = () => setPlaying(false);
      audio.play().catch(() => {
        setPlaying(false);
        speak(word);
      });
    },
    [speak]
  );

  return { pronounce, playing };
}

export function PronounceButton({ word, audioUrl, className, size = "sm" }: PronounceButtonProps) {
  const t = useTranslations("English");
  const { pronounce, playing } = usePronounce();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    pronounce(word, audioUrl);
  }

  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <button
      type="button"
      onClick={handleClick}
      title={t("Words.pronounce")}
      className={cn(
        "text-muted-foreground/60 hover:text-primary transition-colors shrink-0",
        playing && "text-primary animate-pulse",
        className
      )}
    >
      <Volume2 className={iconSize} />
    </button>
  );
}
