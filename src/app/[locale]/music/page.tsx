"use client";

import { MusicPlayer } from "@/src/components/music/music-player";
import { Music } from "@/src/components/declaration/music";
import { useEffect, useState } from "react";
import { loadMusicFromAssets } from "@/src/utils/music";
import { useTranslations } from "next-intl";

export default function MusicPage() {
  const t = useTranslations("Music");
  const [playlist, setPlaylist] = useState<Music[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPlaylist = async () => {
      try {
        setIsLoading(true);

        const musicPlaylist = await loadMusicFromAssets();
        setPlaylist(musicPlaylist);

        console.log("Loaded playlist:", musicPlaylist);
      } catch (error) {
        console.error("Error loading playlist:", error);
        setPlaylist([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadPlaylist();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {t("title")}
          </h1>
          <p className="text-xl text-muted-foreground">{t("onLoading")}</p>
        </div>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (playlist.length === 0) {
    return (
      <div className="space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {t("title")}
          </h1>
          <p className="text-xl text-muted-foreground">{t("noSong")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          {t("title")}
        </h1>
        <p className="text-xl text-muted-foreground">{t("description")}</p>
      </div>

      {process.env.NODE_ENV === "development" && (
        <details className="bg-muted p-4 rounded-lg">
          <summary className="cursor-pointer font-medium">Debug Info</summary>
          <pre className="mt-2 text-sm overflow-x-auto">
            {JSON.stringify(playlist, null, 2)}
          </pre>
        </details>
      )}

      <MusicPlayer playlist={playlist} />
    </div>
  );
}
