import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CarouselItem {
  id: string;
  title: string;
  imageUrl: string;
  year?: string;
}

interface FeaturedCarouselProps {
  items: CarouselItem[];
  onItemClick: (id: string) => void;
}

const FeaturedCarousel = ({ items, onItemClick }: FeaturedCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [items.length]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  if (items.length === 0) return null;

  const currentItem = items[currentIndex];

  return (
    <div className="relative w-full h-[400px] md:h-[500px] overflow-hidden rounded-lg group">
      {/* Carousel Images */}
      <div className="absolute inset-0 z-0">
        <img
          src={currentItem.imageUrl}
          alt={currentItem.title}
          className="w-full h-full object-cover transition-opacity duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end p-8 md:p-12 z-10">
        <h2 className="text-3xl md:text-5xl font-bold mb-2 text-white drop-shadow-lg">
          {currentItem.title}
        </h2>
        {currentItem.year && (
          <p className="text-lg text-white/90 mb-4">{currentItem.year}</p>
        )}
        <Button 
          onClick={() => onItemClick(currentItem.id)}
          className="w-fit"
        >
          Se detaljer
        </Button>
      </div>

      {/* Navigation Buttons */}
      <Button
        variant="ghost"
        size="icon"
        onClick={goToPrevious}
        className="absolute left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white z-20"
      >
        <ChevronLeft className="h-8 w-8" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={goToNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white z-20"
      >
        <ChevronRight className="h-8 w-8" />
      </Button>

      {/* Indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
        {items.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentIndex 
                ? 'bg-white w-8' 
                : 'bg-white/50 hover:bg-white/75'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default FeaturedCarousel;
