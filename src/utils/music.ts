"use server";

import { Music } from "@/src/components/declaration/music";
import { getAudioFiles } from "../service/music";

function parseFilename(filename: string): {
  title: string;
  artist?: string;
  album?: string;
  genre?: string;
  cover?: string;
} | null {
  const nameWithoutExt = filename.replace(".mp3", "");
  const parts = nameWithoutExt.split(" - ");

  if (parts.length < 2) {
    console.warn(`Invalid filename format: ${filename}`);
    return null;
  }

  const [title, artist, album = "", genre = "", cover = ""] = parts;

  return {
    title: title.trim(),
    artist: artist.trim() || undefined,
    album: album.trim() || undefined,
    genre: genre.trim() || undefined,
    cover: cover.trim() || undefined
  };
}

export async function loadMusicFromAssets(): Promise<Music[]> {
  try {
    const response = await getAudioFiles();

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const { files } = await response.json();
    const musicFiles: Music[] = [];

    files.forEach((filename: string, index: number) => {
      const musicInfo = parseFilename(filename);
      if (musicInfo) {
        musicFiles.push({
          id: `song-${index + 1}`,
          title: musicInfo.title,
          artist: musicInfo.artist,
          album: musicInfo.album,
          genre: musicInfo.genre,
          cover: musicInfo.cover
            ? `/assets/images/${musicInfo.cover}`
            : "/audio-lines.svg?height=300&width=300",
          source: `/assets/audio/${encodeURIComponent(filename)}`,
          duration: "0:00"
        });
      }
    });

    console.log(`Loaded ${musicFiles.length} songs from assets/audio/`);
    return musicFiles;
  } catch (error) {
    console.error("Error scanning music files:", error);
    return [];
  }
}
