"use client";

"use client";

import { useEffect } from "react";
import { Music2, Pause, Play, SkipBack, SkipForward, Volume2, X } from "lucide-react";
import { useMusicContext } from "@/src/context/music";
import { loadMusicFromAssets } from "@/src/utils/music";
import { Slider } from "@/src/components/ui/Slider";

export function FloatingMusicBox() {
  const {
    setPlaylist,
    playlist,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    isLoading,
    volume,
    setVolume,
    formatTime,
    togglePlay,
    nextTrack,
    prevTrack,
    isFloatingVisible,
    setIsFloatingVisible,
    isBoxExpanded,
    setIsBoxExpanded,
  } = useMusicContext();

  useEffect(() => {
    if (playlist.length > 0) return;
    loadMusicFromAssets()
      .then((songs) => { if (songs.length > 0) setPlaylist(songs); })
      .catch(console.error);
  }, []);

  const currentSong = playlist[currentTrack];

  if (!isFloatingVisible) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Collapsed state: small round icon button
  if (!isBoxExpanded) {
    return (
      <button
        onClick={() => setIsBoxExpanded(true)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
        title={currentSong?.title}
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Music2 className="h-5 w-5" />
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 rounded-2xl bg-background/95 backdrop-blur border border-border shadow-xl overflow-hidden">
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium tracking-wide uppercase">
            Now Playing
          </span>
          <button
            onClick={() => setIsBoxExpanded(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Minimize"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {currentSong ? (
          <div className="mb-3">
            <p className="font-semibold text-sm truncate">{currentSong.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {currentSong.artist || "Unknown Artist"}
              {currentSong.album ? ` • ${currentSong.album}` : ""}
            </p>
          </div>
        ) : (
          <div className="mb-3">
            <p className="text-sm text-muted-foreground">No track selected</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={prevTrack}
            className="p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <SkipBack className="h-4 w-4" />
          </button>

          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
            ) : isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </button>

          <button
            onClick={nextTrack}
            className="p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <SkipForward className="h-4 w-4" />
          </button>

          <span className="text-xs text-muted-foreground tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <Volume2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Slider
            value={volume}
            onValueChange={setVolume}
            max={100}
            step={1}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-6 text-right">{volume[0]}</span>
        </div>
      </div>
    </div>
  );
}
