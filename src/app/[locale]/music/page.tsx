"use client";

import { MusicPlayer } from "@/src/components/music/MusicPlayer";
import { useTranslations } from "next-intl";
import { useMusicContext } from "@/src/context/music";

export default function MusicPage() {
  const t = useTranslations("Music");
  const { playlist } = useMusicContext();

  if (playlist.length === 0) {
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

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          {t("title")}
        </h1>
        <p className="text-xl text-muted-foreground">{t("description")}</p>
      </div>

      <MusicPlayer />
    </div>
  );
}
