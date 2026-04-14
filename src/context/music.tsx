"use client";

import { createContext, useContext, useRef, useState, useEffect, useCallback } from "react";
import { Music } from "@/src/declaration/music";

interface MusicContextValue {
  playlist: Music[];
  setPlaylist: (playlist: Music[]) => void;
  currentTrack: number;
  setCurrentTrack: (index: number) => void;
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
  currentTime: number;
  duration: number;
  volume: number[];
  setVolume: (v: number[]) => void;
  isShuffled: boolean;
  setIsShuffled: (v: boolean) => void;
  repeatMode: number;
  setRepeatMode: (v: number) => void;
  isLoading: boolean;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  handleSeek: (value: number[]) => void;
  formatTime: (time: number) => string;
  // Floating box visibility
  isFloatingVisible: boolean;
  setIsFloatingVisible: (v: boolean) => void;
  isBoxExpanded: boolean;
  setIsBoxExpanded: (v: boolean) => void;
}

const MusicContext = createContext<MusicContextValue | null>(null);

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const [playlist, setPlaylist] = useState<Music[]>([]);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState([75]);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isFloatingVisible, setIsFloatingVisible] = useState(true);
  const [isBoxExpanded, setIsBoxExpanded] = useState(true);

  const audioRef = useRef<HTMLAudioElement>(null);

  const nextTrack = useCallback(() => {
    if (isShuffled) {
      let randomIndex: number;
      do {
        randomIndex = Math.floor(Math.random() * playlist.length);
      } while (randomIndex === currentTrack && playlist.length > 1);
      setCurrentTrack(randomIndex);
    } else {
      setCurrentTrack((prev) => (prev + 1) % playlist.length);
    }
  }, [isShuffled, currentTrack, playlist.length]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      switch (repeatMode) {
        case 2:
          audio.play();
          break;
        case 1:
          nextTrack();
          break;
        default:
          if (currentTrack < playlist.length - 1) {
            nextTrack();
          } else {
            setIsPlaying(false);
          }
      }
    };
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

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
  }, [currentTrack, repeatMode, nextTrack, playlist.length]);

  // Play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Volume
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume[0] / 100;
  }, [volume]);

  // Track change
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playlist[currentTrack]) return;
    audio.src = playlist[currentTrack].source;
    audio.load();
    if (isPlaying) {
      audio.play().catch(console.error);
    }
  }, [currentTrack, playlist]);

  // Random first track when playlist loads
  useEffect(() => {
    if (playlist.length > 0) {
      const randomIndex = Math.floor(Math.random() * playlist.length);
      setCurrentTrack(randomIndex);
    }
  }, [playlist.length]);

  const togglePlay = () => setIsPlaying((prev) => !prev);

  const prevTrack = () => {
    if (isShuffled) {
      let randomIndex: number;
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
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <MusicContext.Provider
      value={{
        playlist,
        setPlaylist,
        currentTrack,
        setCurrentTrack,
        isPlaying,
        setIsPlaying,
        currentTime,
        duration,
        volume,
        setVolume,
        isShuffled,
        setIsShuffled,
        repeatMode,
        setRepeatMode,
        isLoading,
        audioRef,
        togglePlay,
        nextTrack,
        prevTrack,
        handleSeek,
        formatTime,
        isFloatingVisible,
        setIsFloatingVisible,
        isBoxExpanded,
        setIsBoxExpanded,
      }}
    >
      <audio ref={audioRef} preload="metadata" />
      {children}
    </MusicContext.Provider>
  );
}

export function useMusicContext() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusicContext must be used within MusicProvider");
  return ctx;
}
