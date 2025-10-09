import { Play, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeroProps {
  title: string;
  description: string;
  image: string;
  rating?: string;
  year?: string;
}

const Hero = ({ title, description, image, rating, year }: HeroProps) => {
  return (
    <div className="relative h-[70vh] w-full overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      <div className="relative container mx-auto px-4 h-full flex items-center">
        <div className="max-w-2xl space-y-6">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            {title}
          </h1>
          
          <div className="flex items-center gap-4 text-sm">
            {rating && (
              <span className="px-3 py-1 bg-accent/20 text-accent rounded-md font-semibold">
                {rating}
              </span>
            )}
            {year && <span className="text-muted-foreground">{year}</span>}
          </div>

          <p className="text-lg text-foreground/90 max-w-xl leading-relaxed">
            {description}
          </p>

          <div className="flex items-center gap-4 pt-4">
            <Button size="lg" className="cinema-glow smooth-transition hover:scale-105">
              <Play className="mr-2 h-5 w-5 fill-current" />
              Spill av
            </Button>
            <Button size="lg" variant="secondary" className="smooth-transition hover:scale-105">
              <Info className="mr-2 h-5 w-5" />
              Mer info
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
