import { useState } from "react";
import { Play, CheckCircle, Subtitles, ChevronDown, ChevronUp, Cast } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MediaStream {
  Index: number;
  Type: string;
  DisplayTitle?: string;
  Language?: string;
  Codec?: string;
  IsDefault?: boolean;
}

interface Episode {
  Id: string;
  Name: string;
  IndexNumber?: number;
  SeasonId: string;
  Overview?: string;
  ImageTags?: { Primary?: string };
  RunTimeTicks?: number;
  UserData?: {
    Played?: boolean;
    PlaybackPositionTicks?: number;
  };
  MediaStreams?: MediaStream[];
}

interface EpisodeCardProps {
  episode: Episode;
  seriesName?: string;
  episodeImageUrl: string | null;
  isSelected?: boolean;
  isConnectedToCast?: boolean;
  onPlay: () => void;
  onSubtitleSearch: () => void;
  refCallback?: (el: HTMLDivElement | null) => void;
}

export const EpisodeCard = ({
  episode,
  seriesName,
  episodeImageUrl,
  isSelected = false,
  isConnectedToCast = false,
  onPlay,
  onSubtitleSearch,
  refCallback,
}: EpisodeCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const episodeRuntime = episode.RunTimeTicks 
    ? Math.round(episode.RunTimeTicks / 600000000) 
    : null;
  const watchedPercentage = episode.UserData?.PlaybackPositionTicks && episode.RunTimeTicks
    ? (episode.UserData.PlaybackPositionTicks / episode.RunTimeTicks) * 100
    : 0;
  const isWatched = episode.UserData?.Played || watchedPercentage >= 95;
  const episodeSubtitleCount = episode.MediaStreams?.filter(s => s.Type === 'Subtitle').length || 0;

  return (
    <div
      ref={refCallback}
      className={cn(
        "group bg-card rounded-lg border smooth-transition overflow-hidden",
        isSelected ? 'border-primary ring-2 ring-primary' : 'border-border hover:border-primary'
      )}
    >
      {/* Main content - clickable for mobile expand, play on desktop */}
      <div className="flex gap-2 sm:gap-4 p-2 sm:p-3">
        {/* Thumbnail - tap to play */}
        <div 
          className="relative w-24 h-14 sm:w-52 sm:h-28 flex-shrink-0 bg-secondary rounded overflow-hidden cursor-pointer"
          onClick={onPlay}
        >
          {episodeImageUrl ? (
            <img
              src={episodeImageUrl}
              alt={episode.Name}
              className="w-full h-full object-cover group-hover:scale-105 smooth-transition"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Play className="h-5 w-5 sm:h-8 sm:w-8 text-muted-foreground" />
            </div>
          )}
          {isWatched && (
            <div className="absolute top-1 right-1 sm:top-2 sm:right-2 bg-green-600 rounded-full p-0.5 sm:p-1">
              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
            </div>
          )}
          {watchedPercentage > 0 && watchedPercentage < 95 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-secondary/50">
              <div 
                className="h-full bg-primary"
                style={{ width: `${watchedPercentage}%` }}
              />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 smooth-transition flex items-center justify-center">
            {isConnectedToCast ? <Cast className="h-5 w-5 sm:h-8 sm:w-8 text-white" /> : <Play className="h-5 w-5 sm:h-8 sm:w-8 text-white" />}
          </div>
        </div>
        
        {/* Info section */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm sm:text-lg line-clamp-2 sm:line-clamp-1">
              {episode.IndexNumber && `${episode.IndexNumber}. `}{episode.Name}
            </h3>
            {/* Desktop runtime */}
            {episodeRuntime && (
              <span className="hidden sm:block text-sm text-muted-foreground whitespace-nowrap">
                {episodeRuntime} min
              </span>
            )}
          </div>
          
          {/* Mobile: runtime + expand button */}
          <div className="flex items-center gap-2 mt-1 sm:hidden">
            {episodeRuntime && (
              <span className="text-xs text-muted-foreground">
                {episodeRuntime} min
              </span>
            )}
            {episode.Overview && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Skjul
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Detaljer
                  </>
                )}
              </Button>
            )}
          </div>
          
          {/* Desktop: always show overview */}
          {episode.Overview && (
            <p className="hidden sm:block text-sm text-muted-foreground line-clamp-2 mt-1">
              {episode.Overview}
            </p>
          )}
        </div>
        
        {/* Desktop subtitle button */}
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "hidden sm:flex gap-2 flex-shrink-0 border-border hover:bg-primary hover:text-primary-foreground hover:border-primary",
            episodeSubtitleCount > 0 ? 'bg-green-900/30 border-green-700/50' : 'bg-secondary/50'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onSubtitleSearch();
          }}
          title={episodeSubtitleCount > 0 ? `${episodeSubtitleCount} undertekster tilgjengelig` : 'Søk undertekster'}
        >
          <Subtitles className="h-4 w-4" />
          {episodeSubtitleCount > 0 ? (
            <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {episodeSubtitleCount}
            </span>
          ) : (
            <span className="text-muted-foreground">Ingen</span>
          )}
        </Button>
      </div>
      
      {/* Mobile expanded content */}
      {isExpanded && episode.Overview && (
        <div className="sm:hidden px-2 pb-2 space-y-2 animate-accordion-down">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {episode.Overview}
          </p>
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              className="flex-1 h-9 gap-2"
              onClick={onPlay}
            >
              {isConnectedToCast ? <Cast className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isConnectedToCast ? 'Cast' : 'Spill av'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 gap-2",
                episodeSubtitleCount > 0 ? 'bg-green-900/30 border-green-700/50' : ''
              )}
              onClick={(e) => {
                e.stopPropagation();
                onSubtitleSearch();
              }}
            >
              <Subtitles className="h-4 w-4" />
              {episodeSubtitleCount > 0 && (
                <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {episodeSubtitleCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
