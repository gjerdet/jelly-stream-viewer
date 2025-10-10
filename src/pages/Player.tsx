import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useServerSettings } from "@/hooks/useServerSettings";
import { useJellyfinApi } from "@/hooks/useJellyfinApi";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Subtitles } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MediaStream {
  Index: number;
  Type: string;
  DisplayTitle?: string;
  Language?: string;
  Codec?: string;
  IsDefault?: boolean;
}

interface MediaSource {
  Id: string;
  DirectStreamUrl?: string;
  TranscodingUrl?: string;
}

interface PlaybackInfo {
  MediaSources: MediaSource[];
}

interface JellyfinItemDetail {
  Id: string;
  Name: string;
  MediaStreams?: MediaStream[];
}

const Player = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { serverUrl } = useServerSettings();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showControls, setShowControls] = useState(true);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>("");
  const [streamUrl, setStreamUrl] = useState<string>("");
  const hideControlsTimer = useRef<NodeJS.Timeout>();

  // Fetch users to get user ID
  const { data: usersData } = useJellyfinApi<{ Id: string }[]>(
    ["jellyfin-users"],
    { endpoint: `/Users` },
    !!user
  );
  const userId = usersData?.[0]?.Id;

  // Fetch item details with media streams
  const { data: item } = useJellyfinApi<JellyfinItemDetail>(
    ["item-detail-player", id || ""],
    {
      endpoint: id && userId ? `/Users/${userId}/Items/${id}?Fields=MediaStreams` : "",
    },
    !!user && !!userId && !!id
  );

  const subtitles = item?.MediaStreams?.filter(stream => stream.Type === "Subtitle") || [];

  // Fetch playback info and set stream URL
  useEffect(() => {
    const getStreamUrl = async () => {
      if (!userId || !id) return;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No session found');
        return;
      }
      
      // Create stream URL with access token in query params
      const streamEndpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jellyfin-stream?id=${id}&token=${session.access_token}`;
      
      setStreamUrl(streamEndpoint);
      console.log('Stream URL set with token');
    };

    if (item && userId) {
      console.log('Preparing stream for item:', id);
      getStreamUrl();
    }
  }, [item, userId, id]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    hideControlsTimer.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
    };
  }, []);

  if (!serverUrl || !userId || !id || !streamUrl) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        Laster...
      </div>
    );
  }

  return (
    <div 
      className="relative h-screen bg-black overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="w-full h-full"
        controls
        autoPlay
      >
        <source src={streamUrl} type="video/mp4" />
        {subtitles.map((subtitle) => (
          <track
            key={subtitle.Index}
            kind="subtitles"
            src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jellyfin-subtitle?id=${id}&index=${subtitle.Index}&token=${streamUrl.split('token=')[1]}`}
            label={subtitle.DisplayTitle || subtitle.Language || `Subtitle ${subtitle.Index}`}
            default={subtitle.IsDefault}
          />
        ))}
        Din nettleser støtter ikke videoavspilling.
      </video>

      {/* Custom overlay controls */}
      <div 
        className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50 transition-opacity duration-300 pointer-events-none ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between pointer-events-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Tilbake
          </Button>

          <h1 className="text-2xl font-bold text-white flex-1 text-center">
            {item?.Name}
          </h1>

          <div className="flex gap-2">
            {subtitles.length > 0 && (
              <Select value={selectedSubtitle} onValueChange={setSelectedSubtitle}>
                <SelectTrigger className="w-[180px] bg-black/50 backdrop-blur-sm border-white/20 text-white">
                  <Subtitles className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Undertekster" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ingen</SelectItem>
                  {subtitles.map((subtitle) => (
                    <SelectItem key={subtitle.Index} value={subtitle.Index.toString()}>
                      {subtitle.DisplayTitle || subtitle.Language || `Undertekst ${subtitle.Index}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Player;
