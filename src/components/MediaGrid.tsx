import MediaCard from "./MediaCard";

interface MediaItem {
  id: string;
  title: string;
  image: string;
  year?: string;
  rating?: string;
}

interface MediaGridProps {
  title: string;
  items: MediaItem[];
  onItemClick?: (id: string) => void;
}

const MediaGrid = ({ title, items, onItemClick }: MediaGridProps) => {
  return (
    <div className="space-y-4 sm:space-y-6">
      {title && <h2 className="text-xl sm:text-2xl font-bold px-3 sm:px-4">{title}</h2>}
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 px-3 sm:px-4">
        {items.map((item) => (
          <MediaCard
            key={item.id}
            title={item.title}
            image={item.image}
            year={item.year}
            rating={item.rating}
            onClick={() => onItemClick?.(item.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default MediaGrid;
