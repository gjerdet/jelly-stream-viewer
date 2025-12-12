import { Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface MediaCardProps {
  title: string;
  image: string;
  year?: string;
  rating?: string;
  episodeCount?: number;
  type?: string;
  onClick?: () => void;
}

const MediaCard = ({ title, image, year, rating, episodeCount, type, onClick }: MediaCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const isSeries = type === 'Series';

  return (
    <Card
      className="group relative overflow-hidden bg-card border-border/50 cursor-pointer smooth-transition active:scale-95 sm:hover:scale-105 hover:z-10 touch-manipulation"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div className="aspect-[2/3] relative">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {/* Always visible gradient on mobile for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent sm:opacity-0 sm:group-hover:opacity-100 smooth-transition" />
        
        {/* Play button - visible on hover for desktop only */}
        <div className={`absolute inset-0 flex items-center justify-center opacity-0 sm:group-hover:opacity-100 smooth-transition ${isHovered ? 'cinema-glow' : ''}`}>
          <Button size="icon" className="rounded-full h-10 w-10 sm:h-12 sm:w-12 cinema-glow">
            <Play className="h-4 w-4 sm:h-5 sm:w-5 fill-current" />
          </Button>
        </div>
      </div>
      
      <div className="p-1.5 sm:p-2 md:p-3 space-y-0.5 sm:space-y-1">
        <h3 className="font-semibold text-[10px] sm:text-xs md:text-sm line-clamp-2 sm:line-clamp-1 leading-tight">{title}</h3>
        <div className="flex items-center gap-1 sm:gap-2 text-[9px] sm:text-xs text-muted-foreground flex-wrap">
          {year && <span>{year}</span>}
          {rating && (
            <>
              <span className="hidden sm:inline">•</span>
              <span className="text-accent">★{rating}</span>
            </>
          )}
          {isSeries && episodeCount !== undefined && (
            <>
              <span className="hidden sm:inline">•</span>
              <span className="sm:hidden">{episodeCount}ep</span>
              <span className="hidden sm:inline">{episodeCount} ep</span>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};

export default MediaCard;
