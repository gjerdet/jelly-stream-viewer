import { Play, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface HeroProps {
  title: string;
  description: string;
  image: string;
  rating?: string;
  year?: string;
}

const Hero = ({ title, description, image, rating, year }: HeroProps) => {
  const { t } = useLanguage();
  const common = t.common as any;
  
  return (
    <div className="relative h-[70vh] w-full overflow-hidden">
      {/* Backdrop with Enhanced Effects */}
      <div className="absolute inset-0">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover scale-110 animate-fade-in"
        />
        {/* Multiple gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-background/50" />
        {/* Vignette effect */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
        {/* Color overlay for warmth */}
        <div className="absolute inset-0 bg-primary/5 mix-blend-overlay" />
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
              {common.playNow}
            </Button>
            <Button size="lg" variant="secondary" className="smooth-transition hover:scale-105">
              <Info className="mr-2 h-5 w-5" />
              {common.moreInfo}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
