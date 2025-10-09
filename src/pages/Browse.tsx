import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import MediaRow from "@/components/MediaRow";

const Browse = () => {
  const navigate = useNavigate();

  // Mock data - will be replaced with Jellyfin API data
  const featuredContent = {
    title: "Inception",
    description: "En tyv som stjeler bedriftshemmeligheter gjennom bruk av drømmeandeling-teknologi får i oppgave å plante en idé i hodet på en CEO.",
    image: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920&h=1080&fit=crop",
    rating: "8.8",
    year: "2010",
  };

  const trendingNow = [
    {
      id: "1",
      title: "The Dark Knight",
      image: "https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?w=400&h=600&fit=crop",
      year: "2008",
      rating: "9.0",
    },
    {
      id: "2",
      title: "Interstellar",
      image: "https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=400&h=600&fit=crop",
      year: "2014",
      rating: "8.6",
    },
    {
      id: "3",
      title: "The Matrix",
      image: "https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=400&h=600&fit=crop",
      year: "1999",
      rating: "8.7",
    },
    {
      id: "4",
      title: "Pulp Fiction",
      image: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400&h=600&fit=crop",
      year: "1994",
      rating: "8.9",
    },
    {
      id: "5",
      title: "Fight Club",
      image: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=400&h=600&fit=crop",
      year: "1999",
      rating: "8.8",
    },
    {
      id: "6",
      title: "Forrest Gump",
      image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&h=600&fit=crop",
      year: "1994",
      rating: "8.8",
    },
  ];

  const continueWatching = [
    {
      id: "7",
      title: "Breaking Bad",
      image: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=400&h=600&fit=crop",
      year: "2008",
      rating: "9.5",
    },
    {
      id: "8",
      title: "Stranger Things",
      image: "https://images.unsplash.com/photo-1512070679279-8988d32161be?w=400&h=600&fit=crop",
      year: "2016",
      rating: "8.7",
    },
    {
      id: "9",
      title: "The Crown",
      image: "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=400&h=600&fit=crop",
      year: "2016",
      rating: "8.6",
    },
    {
      id: "10",
      title: "Game of Thrones",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop",
      year: "2011",
      rating: "9.2",
    },
  ];

  const handleItemClick = (id: string) => {
    navigate(`/detail/${id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero {...featuredContent} />
      
      <div className="space-y-12 py-12">
        <MediaRow
          title="Populært nå"
          items={trendingNow}
          onItemClick={handleItemClick}
        />
        <MediaRow
          title="Fortsett å se"
          items={continueWatching}
          onItemClick={handleItemClick}
        />
        <MediaRow
          title="Anbefalt for deg"
          items={trendingNow}
          onItemClick={handleItemClick}
        />
      </div>
    </div>
  );
};

export default Browse;
