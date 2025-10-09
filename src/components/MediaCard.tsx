import { Play, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface MediaCardProps {
  title: string;
  image: string;
  year?: string;
  rating?: string;
  onClick?: () => void;
}

const MediaCard = ({ title, image, year, rating, onClick }: MediaCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Card
      className="group relative overflow-hidden bg-card border-border/50 cursor-pointer smooth-transition hover:scale-105 hover:z-10"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div className="aspect-[2/3] relative">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 gradient-card opacity-0 group-hover:opacity-100 smooth-transition" />
        
        <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 smooth-transition ${isHovered ? 'cinema-glow' : ''}`}>
          <Button size="icon" className="rounded-full h-12 w-12 cinema-glow">
            <Play className="h-5 w-5 fill-current" />
          </Button>
          <Button size="icon" variant="secondary" className="rounded-full h-10 w-10">
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="p-3 space-y-1">
        <h3 className="font-semibold text-sm line-clamp-1">{title}</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {year && <span>{year}</span>}
          {rating && (
            <>
              <span>•</span>
              <span className="text-accent">{rating}</span>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};

export default MediaCard;
