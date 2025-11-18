import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { t } = useLanguage();
  const common = t.common as any;
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
    <div className="relative w-full h-[300px] sm:h-[400px] md:h-[500px] overflow-hidden rounded-lg group touch-manipulation">
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
      <div className="relative h-full flex flex-col justify-end p-4 sm:p-6 md:p-12 z-10">
        <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-2 text-white drop-shadow-lg line-clamp-2">
          {currentItem.title}
        </h2>
        {currentItem.year && (
          <p className="text-base sm:text-lg text-white/90 mb-3 sm:mb-4">{currentItem.year}</p>
        )}
        <Button 
          onClick={() => onItemClick(currentItem.id)}
          className="w-fit text-sm sm:text-base px-4 sm:px-6 h-10 sm:h-11"
        >
          {common.viewDetails}
        </Button>
      </div>

      {/* Navigation Buttons - Always visible on mobile for better usability */}
      <Button
        variant="ghost"
        size="icon"
        onClick={goToPrevious}
        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 md:opacity-0 md:group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white z-20 h-10 w-10 sm:h-12 sm:w-12"
      >
        <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={goToNext}
        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 md:opacity-0 md:group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white z-20 h-10 w-10 sm:h-12 sm:w-12"
      >
        <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
      </Button>

      {/* Indicators - Larger touch targets on mobile */}
      <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
        {items.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`h-2 rounded-full transition-all touch-manipulation ${
              index === currentIndex 
                ? 'bg-white w-8 sm:w-8' 
                : 'bg-white/50 hover:bg-white/75 w-2'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default FeaturedCarousel;
