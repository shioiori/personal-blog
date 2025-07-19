"use client";

import { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Shuffle,
  Repeat
} from "lucide-react";
import { Card, CardContent } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Slider } from "@/src/components/ui/slider";
import { Badge } from "@/src/components/ui/badge";
import { Playlist } from "./music-playlist";
import { Music } from "../declaration/music";
import { useTranslations } from "next-intl";

export function MusicPlayer({ playlist }: { playlist: Music[] }) {
  const t = useTranslations("Music");
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState([75]);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState(0); // 0: no repeat, 1: repeat all, 2: repeat one
  const [isLoading, setIsLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);

  // Auto play random song on mount
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * playlist.length);
    setCurrentTrack(randomIndex);
  }, [playlist.length]);

  // Handle audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      handleTrackEnd();
    };

    const handleLoadStart = () => {
      setIsLoading(true);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("loadstart", handleLoadStart);
    audio.addEventListener("canplay", handleCanPlay);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("loadstart", handleLoadStart);
      audio.removeEventListener("canplay", handleCanPlay);
    };
  }, [currentTrack]);

  // Handle play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Handle volume changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume[0] / 100;
  }, [volume]);

  // Handle track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playlist[currentTrack]) return;

    audio.src = playlist[currentTrack].source;
    audio.load();

    if (isPlaying) {
      audio.play().catch(console.error);
    }
  }, [currentTrack, playlist]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleTrackEnd = () => {
    switch (repeatMode) {
      case 2: // repeat one
        audioRef.current?.play();
        break;
      case 1: // repeat all
        nextTrack();
        break;
      default: // no repeat
        if (currentTrack < playlist.length - 1) {
          nextTrack();
        } else {
          setIsPlaying(false);
        }
        break;
    }
  };

  const nextTrack = () => {
    if (isShuffled) {
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * playlist.length);
      } while (randomIndex === currentTrack && playlist.length > 1);
      setCurrentTrack(randomIndex);
    } else {
      setCurrentTrack((prev) => (prev + 1) % playlist.length);
    }
  };

  const prevTrack = () => {
    if (isShuffled) {
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * playlist.length);
      } while (randomIndex === currentTrack && playlist.length > 1);
      setCurrentTrack(randomIndex);
    } else {
      setCurrentTrack((prev) => (prev - 1 + playlist.length) % playlist.length);
    }
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = value[0];
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const currentSong = playlist[currentTrack];

  if (!currentSong) {
    return <div>`${t("noSong")}`</div>;
  }

  return (
    <div className="mx-auto space-y-8">
      <audio ref={audioRef} preload="metadata" />

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="grid md:grid-cols-1 gap-0">
            <div className="p-8 flex flex-col justify-center space-y-6">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-2xl font-bold">{currentSong.title}</h2>
                  <Badge variant="secondary" className="mb-2">
                    {currentSong.genre}
                  </Badge>
                </div>
                <p className="text-lg opacity-90">{currentSong.artist}</p>
                <p className="opacity-75">{currentSong.album}</p>
              </div>

              <div className="space-y-2">
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={1}
                  className="w-full"
                  onValueChange={handleSeek}
                  disabled={isLoading}
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center justify-center space-x-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsShuffled(!isShuffled)}
                  className={isShuffled ? "text-primary" : ""}
                  title={isShuffled ? "Shuffle On" : "Shuffle Off"}
                >
                  <Shuffle className="h-5 w-5" />
                </Button>

                <Button variant="ghost" size="icon" onClick={prevTrack}>
                  <SkipBack className="h-6 w-6" />
                </Button>

                <Button
                  size="icon"
                  className="h-12 w-12"
                  onClick={togglePlay}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-current"></div>
                  ) : isPlaying ? (
                    <Pause className="h-6 w-6" />
                  ) : (
                    <Play className="h-6 w-6" />
                  )}
                </Button>

                <Button variant="ghost" size="icon" onClick={nextTrack}>
                  <SkipForward className="h-6 w-6" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRepeatMode((prev) => (prev + 1) % 3)}
                  className={repeatMode > 0 ? "text-primary" : ""}
                  title={
                    repeatMode === 0
                      ? "No Repeat"
                      : repeatMode === 1
                      ? "Repeat All"
                      : "Repeat One"
                  }
                >
                  <Repeat className="h-5 w-5" />
                  {repeatMode === 2 && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full text-xs flex items-center justify-center text-primary-foreground">
                      1
                    </span>
                  )}
                </Button>
              </div>

              <div className="flex items-center space-x-3">
                <Volume2 className="h-5 w-5 text-muted-foreground" />
                <Slider
                  value={volume}
                  onValueChange={setVolume}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground w-8">
                  {volume[0]}
                </span>
              </div>

              <Playlist
                playlist={playlist}
                currentTrack={currentTrack}
                setCurrentTrack={setCurrentTrack}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
