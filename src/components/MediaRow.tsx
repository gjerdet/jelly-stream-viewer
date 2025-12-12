import MediaCard from "./MediaCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";

interface MediaItem {
  id: string;
  title: string;
  image: string;
  year?: string;
  rating?: string;
  episodeCount?: number;
  type?: string;
}

interface MediaRowProps {
  title: string;
  items: MediaItem[];
  onItemClick?: (id: string) => void;
}

const MediaRow = ({ title, items, onItemClick }: MediaRowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      const newScrollLeft =
        scrollRef.current.scrollLeft +
        (direction === "left" ? -scrollAmount : scrollAmount);
      
      scrollRef.current.scrollTo({
        left: newScrollLeft,
        behavior: "smooth",
      });

      setTimeout(() => {
        if (scrollRef.current) {
          setShowLeftArrow(scrollRef.current.scrollLeft > 0);
          setShowRightArrow(
            scrollRef.current.scrollLeft <
              scrollRef.current.scrollWidth - scrollRef.current.clientWidth - 10
          );
        }
      }, 300);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4 group/row">
      <h2 className="text-lg sm:text-xl md:text-2xl font-bold px-3 sm:px-4">{title}</h2>
      
      <div className="relative">
        {showLeftArrow && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-full w-8 sm:w-12 rounded-none bg-gradient-to-r from-background to-transparent opacity-0 group-hover/row:opacity-100 smooth-transition hover:scale-110 hidden sm:flex"
            onClick={() => scroll("left")}
          >
            <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
          </Button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-2 sm:gap-3 md:gap-4 overflow-x-auto scrollbar-hide px-3 sm:px-4 pb-2 sm:pb-4 snap-x snap-mandatory"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {items.map((item) => (
            <div key={item.id} className="flex-none w-28 sm:w-36 md:w-44 lg:w-48 snap-start">
              <MediaCard
                title={item.title}
                image={item.image}
                year={item.year}
                rating={item.rating}
                episodeCount={item.episodeCount}
                type={item.type}
                onClick={() => onItemClick?.(item.id)}
              />
            </div>
          ))}
        </div>

        {showRightArrow && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-full w-8 sm:w-12 rounded-none bg-gradient-to-l from-background to-transparent opacity-0 group-hover/row:opacity-100 smooth-transition hover:scale-110 hidden sm:flex"
            onClick={() => scroll("right")}
          >
            <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default MediaRow;
