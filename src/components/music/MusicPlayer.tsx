'use client'

import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Shuffle,
  Repeat
} from 'lucide-react'
import { Card, CardContent } from '@/src/components/ui/Card'
import { Button } from '@/src/components/ui/Button'
import { Slider } from '@/src/components/ui/Slider'
import { Badge } from '@/src/components/ui/Badge'
import { Playlist } from './MusicPlaylist'
import { useTranslations } from 'next-intl'
import { useMusicContext } from '@/src/context/music'
import { useEffect } from 'react'

export function MusicPlayer() {
  const t = useTranslations('Music')
  const {
    playlist,
    currentTrack,
    setCurrentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    setVolume,
    isShuffled,
    setIsShuffled,
    repeatMode,
    setRepeatMode,
    isLoading,
    togglePlay,
    nextTrack,
    prevTrack,
    handleSeek,
    formatTime,
    setIsBoxExpanded
  } = useMusicContext()

  useEffect(() => {
    setIsBoxExpanded(false)
  }, [setIsBoxExpanded])

  const currentSong = playlist[currentTrack]

  if (!currentSong) {
    return <div>{t('noSong')}</div>
  }

  return (
    <Card className="h-[500px] overflow-hidden">
      <CardContent className="p-0 flex h-full">
        <div className="flex-1 p-8 flex flex-col justify-center space-y-6 border-r">
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
              className={isShuffled ? 'text-primary' : ''}
              title={isShuffled ? 'Shuffle On' : 'Shuffle Off'}
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
              onClick={() => setRepeatMode((repeatMode + 1) % 3)}
              className={repeatMode > 0 ? 'text-primary' : ''}
              title={
                repeatMode === 0
                  ? 'No Repeat'
                  : repeatMode === 1
                    ? 'Repeat All'
                    : 'Repeat One'
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
        </div>

        <div className="flex-1 flex flex-col min-h-0 p-6">
          <Playlist
            playlist={playlist}
            currentTrack={currentTrack}
            setCurrentTrack={setCurrentTrack}
          />
        </div>
      </CardContent>
    </Card>
  )
}
