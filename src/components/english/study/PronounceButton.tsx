"use client";

import { useRef, useState } from "react";
import { Volume2 } from "lucide-react";
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
export function PronounceButton({ word, audioUrl, className, size = "sm" }: PronounceButtonProps) {
  const { speak } = useSpeech("en-US");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (audioUrl) {
      if (!audioRef.current) audioRef.current = new Audio(audioUrl);
      audioRef.current.currentTime = 0;
      setPlaying(true);
      audioRef.current.onended = () => setPlaying(false);
      audioRef.current.play().catch(() => {
        setPlaying(false);
        speak(word);
      });
    } else {
      speak(word);
    }
  }

  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Phát âm"
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
