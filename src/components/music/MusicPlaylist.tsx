import { useTranslations } from "next-intl";
import { Music } from "../declaration/music";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import Image from "next/image";
export const Playlist = ({
  playlist,
  currentTrack,
  setCurrentTrack
}: {
  playlist: Music[];
  currentTrack: number;
  setCurrentTrack: (index: number) => void;
}) => {
  const t = useTranslations("Music");
  return (
    <>
      <Card>
        <CardContent className="p-6">
          <h3 className="text-xl font-semibold mb-4">{t("playlist")}</h3>
          <div className="space-y-2">
            {playlist.map((song, index) => (
              <div
                key={song.id}
                className={`flex items-center space-x-4 p-3 rounded-lg cursor-pointer transition-colors ${
                  index === currentTrack
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-muted/50"
                }`}
                onClick={() => setCurrentTrack(index)}
              >
                <div className="relative w-12 h-12 rounded-md overflow-hidden">
                  <Image
                    src={song.cover || "/audio-lines.svg"}
                    alt={song.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-medium truncate ${
                      index === currentTrack ? "text-primary" : ""
                    }`}
                  >
                    {song.title}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {song.artist} {song.album ? "• " + song.album : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
};
