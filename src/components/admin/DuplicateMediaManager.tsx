import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Film, Tv, Copy, HardDrive, RefreshCw, Trash2, AlertTriangle, ShieldAlert, History, CheckCircle, FolderOpen, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteLogEntry {
  timestamp: Date;
  fileName: string;
  filePath: string;
  fileSize: number;
  title: string;
  status: 'success' | 'error';
  error?: string;
}

interface MediaFile {
  id: string;
  name: string;
  path: string;
  container: string;
  videoCodec: string;
  audioCodec: string;
  width: number;
  height: number;
  bitrate: number;
  size: number;
  radarrFileId?: number;
  sonarrFileId?: number;
  manualDeleteReason?: string;
}

interface DuplicateGroup {
  title: string;
  type: "Movie" | "Episode";
  seriesName?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  files: MediaFile[];
  radarrMovieId?: number;
  sonarrSeriesId?: number;
}

export const DuplicateMediaManager = () => {
  const { language } = useLanguage();
  const [scanning, setScanning] = useState(false);
  const [refreshingLibrary, setRefreshingLibrary] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [manualDuplicates, setManualDuplicates] = useState<DuplicateGroup[]>([]);
  const [scanComplete, setScanComplete] = useState(false);
  const [deletingFile, setDeletingFile] = useState<{groupIndex: number, fileIndex: number} | null>(null);
  const [fileToDelete, setFileToDelete] = useState<{group: DuplicateGroup, file: MediaFile, groupIndex: number, fileIndex: number} | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [deleteLog, setDeleteLog] = useState<DeleteLogEntry[]>([]);
  const [showDeleteLog, setShowDeleteLog] = useState(false);
  const [jellyfinError, setJellyfinError] = useState<string | null>(null);

  // Generate a random 4-digit code for confirmation
  const getConfirmationCode = () => {
    if (!fileToDelete) return "";
    // Use last 4 chars of file path hash for consistent code per file
    const hash = fileToDelete.file.path.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return Math.abs(hash % 10000).toString().padStart(4, '0');
  };

  const refreshJellyfinLibrary = async () => {
    setRefreshingLibrary(true);

    try {
      const { error } = await supabase.functions.invoke('jellyfin-proxy', {
        body: {
          endpoint: '/Library/Refresh',
          method: 'POST',
        },
      });

      if (error) throw error;

      toast.success(
        language === 'no'
          ? 'Bibliotek-oppdatering startet. Vent litt og skann på nytt.'
          : 'Library refresh started. Wait a bit and rescan.',
        { duration: 6000 }
      );
    } catch (error) {
      console.error('Error refreshing library:', error);
      toast.error(language === 'no' ? 'Kunne ikke oppdatere bibliotek' : 'Could not refresh library');
    } finally {
      setRefreshingLibrary(false);
    }
  };

  const removeFileFromDuplicatesUI = (groupIndex: number, fileIndex: number) => {
    const newDuplicates = [...duplicates];
    newDuplicates[groupIndex].files.splice(fileIndex, 1);

    // Remove group if only one file left
    if (newDuplicates[groupIndex].files.length <= 1) {
      newDuplicates.splice(groupIndex, 1);
    }

    setDuplicates(newDuplicates);
  };

  const addManualDuplicate = (group: DuplicateGroup, file: MediaFile, reason: string) => {
    const manualFile: MediaFile = { ...file, manualDeleteReason: reason };

    setManualDuplicates((prev) => {
      const idx = prev.findIndex((g) =>
        g.type === group.type &&
        g.title === group.title &&
        g.seriesName === group.seriesName &&
        g.seasonNumber === group.seasonNumber &&
        g.episodeNumber === group.episodeNumber
      );

      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], files: [manualFile, ...updated[idx].files] };
        return updated;
      }

      return [{ ...group, files: [manualFile] }, ...prev];
    });
  };

  const scanForDuplicates = async () => {
    setScanning(true);
    setScanComplete(false);
    setDuplicates([]);
    setManualDuplicates([]);
    setJellyfinError(null);

    try {
      // Get all movies from Jellyfin
      const { data: moviesData, error: moviesError } = await supabase.functions.invoke('jellyfin-proxy', {
        body: {
          endpoint: '/Items?IncludeItemTypes=Movie&Recursive=true&Fields=MediaSources,Path',
          method: 'GET',
        },
      });

      if (moviesError) {
        if (moviesError.message?.includes('Unauthorized') || moviesError.message?.includes('401')) {
          setJellyfinError('unauthorized');
        }
        throw moviesError;
      }
      
      if (moviesData?.error === 'Unauthorized') {
        setJellyfinError('unauthorized');
        throw new Error('Unauthorized');
      }

      // Get all episodes from Jellyfin  
      const { data: episodesData, error: episodesError } = await supabase.functions.invoke('jellyfin-proxy', {
        body: {
          endpoint: '/Items?IncludeItemTypes=Episode&Recursive=true&Fields=MediaSources,Path,SeriesName,ParentIndexNumber,IndexNumber',
          method: 'GET',
        },
      });

      if (episodesError) throw episodesError;

      const foundDuplicates: DuplicateGroup[] = [];

      // Process movies - group by name and find those with multiple MediaSources or similar names
      const movies = moviesData?.Items || [];
      const moviesByName = new Map<string, any[]>();
      
      movies.forEach((movie: any) => {
        // Normalize title for comparison
        const normalizedName = movie.Name?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
        if (!moviesByName.has(normalizedName)) {
          moviesByName.set(normalizedName, []);
        }
        moviesByName.get(normalizedName)!.push(movie);
      });

      moviesByName.forEach((movieGroup, normalizedName) => {
        // Check for multiple versions of the same movie
        const allFiles: MediaFile[] = [];
        const seenPaths = new Set<string>();
        const seenItemIds = new Set<string>();
        
        movieGroup.forEach((movie: any) => {
          // Skip if we've already processed this exact Jellyfin item
          if (seenItemIds.has(movie.Id)) return;
          seenItemIds.add(movie.Id);
          
          if (movie.MediaSources && movie.MediaSources.length > 0) {
            movie.MediaSources.forEach((source: any) => {
              const filePath = source.Path || '';
              // Skip if we've already seen this exact file path (avoid duplicates from same file)
              const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');
              
              // Also check by filename only (handles different mount points showing same file)
              const fileName = normalizedPath.split('/').pop() || '';
              
              if (seenPaths.has(normalizedPath) || (fileName && seenPaths.has(fileName))) return;
              if (filePath) {
                seenPaths.add(normalizedPath);
                if (fileName) seenPaths.add(fileName);
              }
              
              const videoStream = source.MediaStreams?.find((s: any) => s.Type === 'Video');
              const audioStream = source.MediaStreams?.find((s: any) => s.Type === 'Audio');
              
              allFiles.push({
                id: source.Id || movie.Id,
                name: source.Name || movie.Name,
                path: filePath,
                container: source.Container || 'unknown',
                videoCodec: videoStream?.Codec || 'unknown',
                audioCodec: audioStream?.Codec || 'unknown',
                width: videoStream?.Width || 0,
                height: videoStream?.Height || 0,
                bitrate: source.Bitrate || 0,
                size: source.Size || 0,
              });
            });
          }
        });

        // Only add if there are multiple UNIQUE files (different actual files, not same file from different libraries)
        if (allFiles.length > 1) {
          console.log(`Found potential duplicates for "${movieGroup[0].Name}":`, allFiles.map(f => ({ path: f.path, size: f.size })));
          foundDuplicates.push({
            title: movieGroup[0].Name,
            type: "Movie",
            files: allFiles,
          });
        }
      });

      // Process episodes - group by series + season + episode
      const episodes = episodesData?.Items || [];
      const episodesByKey = new Map<string, any[]>();
      
      episodes.forEach((episode: any) => {
        const key = `${episode.SeriesName}-S${episode.ParentIndexNumber}E${episode.IndexNumber}`;
        if (!episodesByKey.has(key)) {
          episodesByKey.set(key, []);
        }
        episodesByKey.get(key)!.push(episode);
      });

      episodesByKey.forEach((episodeGroup, key) => {
        const allFiles: MediaFile[] = [];
        const seenPaths = new Set<string>();
        
        episodeGroup.forEach((episode: any) => {
          if (episode.MediaSources && episode.MediaSources.length > 0) {
            episode.MediaSources.forEach((source: any) => {
              const filePath = source.Path || '';
              // Skip if we've already seen this exact file path (avoid duplicates from same file)
              const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');
              if (seenPaths.has(normalizedPath)) return;
              if (filePath) seenPaths.add(normalizedPath);
              
              const videoStream = source.MediaStreams?.find((s: any) => s.Type === 'Video');
              const audioStream = source.MediaStreams?.find((s: any) => s.Type === 'Audio');
              
              allFiles.push({
                id: source.Id || episode.Id,
                name: source.Name || episode.Name,
                path: filePath,
                container: source.Container || 'unknown',
                videoCodec: videoStream?.Codec || 'unknown',
                audioCodec: audioStream?.Codec || 'unknown',
                width: videoStream?.Width || 0,
                height: videoStream?.Height || 0,
                bitrate: source.Bitrate || 0,
                size: source.Size || 0,
              });
            });
          }
        });

        // Only add if there are multiple UNIQUE files
        if (allFiles.length > 1) {
          const firstEpisode = episodeGroup[0];
          foundDuplicates.push({
            title: firstEpisode.Name,
            type: "Episode",
            seriesName: firstEpisode.SeriesName,
            seasonNumber: firstEpisode.ParentIndexNumber,
            episodeNumber: firstEpisode.IndexNumber,
            files: allFiles,
          });
        }
      });

      setDuplicates(foundDuplicates);
      setScanComplete(true);
    } catch (error) {
      console.error('Error scanning for duplicates:', error);
      toast.error(language === 'no' ? 'Kunne ikke skanne etter duplikater' : 'Could not scan for duplicates');
    } finally {
      setScanning(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return 'Ukjent';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  const getResolutionLabel = (width: number, height: number) => {
    if (height >= 2160) return '4K';
    if (height >= 1080) return '1080p';
    if (height >= 720) return '720p';
    if (height >= 480) return '480p';
    return `${height}p`;
  };

  const getResolutionColor = (height: number) => {
    if (height >= 2160) return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    if (height >= 1080) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (height >= 720) return 'bg-green-500/20 text-green-400 border-green-500/30';
    return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  };

  const totalDuplicateSize = duplicates.reduce((total, group) => {
    // Count all but the largest file as "duplicate" size
    const sizes = group.files.map(f => f.size).sort((a, b) => b - a);
    return total + sizes.slice(1).reduce((sum, size) => sum + size, 0);
  }, 0);

  const handleDeleteFile = async () => {
    if (!fileToDelete) return;
    
    // Verify confirmation code
    const expectedCode = getConfirmationCode();
    if (confirmCode !== expectedCode) {
      toast.error(language === 'no' ? 'Feil bekreftelseskode' : 'Wrong confirmation code');
      return;
    }
    
    const { group, file, groupIndex, fileIndex } = fileToDelete;
    setDeletingFile({ groupIndex, fileIndex });
    
    const logEntry: DeleteLogEntry = {
      timestamp: new Date(),
      fileName: file.path.split('/').pop() || file.name,
      filePath: file.path,
      fileSize: file.size,
      title: group.title,
      status: 'success'
    };
    
    try {
      if (group.type === "Movie") {
        // Normalize path for comparison
        const normalizePath = (p: string) => {
          if (!p) return '';
          return p.toLowerCase().replace(/\\/g, '/').replace(/^[a-z]:/i, '').trim();
        };
        
        // Extract just the filename from a path
        const getFileName = (p: string) => {
          if (!p) return '';
          const parts = p.replace(/\\/g, '/').split('/');
          return parts[parts.length - 1]?.toLowerCase() || '';
        };
        
        const filePathNorm = normalizePath(file.path);
        const fileName = getFileName(file.path);
        
        console.log('Searching for file to delete:', { 
          originalPath: file.path, 
          normalizedPath: filePathNorm, 
          fileName
        });
        
        // Get all movies from Radarr first
        const moviesResp = await supabase.functions.invoke('radarr-proxy', {
          body: { action: 'movies' }
        });
        
        if (moviesResp.error) throw moviesResp.error;
        const movies: any[] = Array.isArray(moviesResp.data) ? moviesResp.data : [];
        
        // Find the movie that might have this file
        let matchedFile: any = null;
        
        for (const movie of movies) {
          if (!movie.hasFile || !movie.id) continue;
          
          // Get files for this movie
          const filesResp = await supabase.functions.invoke('radarr-proxy', {
            body: { action: 'movieFiles', params: { movieId: movie.id } }
          });
          
          if (filesResp.error) continue;
          const movieFiles: any[] = Array.isArray(filesResp.data) ? filesResp.data : [];
          
          // Check if any file matches our target
          for (const f of movieFiles) {
            if (!f.path) continue;
            
            const radarrPathNorm = normalizePath(f.path);
            const radarrFileName = getFileName(f.path);
            
            // Strategy 1: Exact path match
            if (radarrPathNorm === filePathNorm) {
              matchedFile = f;
              break;
            }
            
            // Strategy 2: Filename exact match
            if (radarrFileName === fileName && fileName.length > 5) {
              matchedFile = f;
              break;
            }
            
            // Strategy 3: Path ends-with (handles different mount points)
            if (filePathNorm.endsWith(radarrFileName) || radarrPathNorm.endsWith(fileName)) {
              matchedFile = f;
              break;
            }
          }
          
          if (matchedFile) break;
        }
        
        const movieFileId = matchedFile?.id;
        
        console.log('Delete search result:', { 
          filePathNorm, 
          fileName, 
          matchedFile: matchedFile?.path,
          movieFileId
        });
        
        if (movieFileId) {
          const { error: deleteError } = await supabase.functions.invoke('radarr-proxy', {
            body: { action: 'deleteMovieFile', params: { movieFileId } }
          });
          
          if (deleteError) throw deleteError;
          
          toast.success(
            language === 'no' 
              ? `✅ Slettet: ${logEntry.fileName}` 
              : `✅ Deleted: ${logEntry.fileName}`,
            { duration: 5000 }
          );
        } else {
          console.warn('Movie file not found in Radarr - requires manual deletion:', {
            searchingFor: { path: file.path, title: group.title }
          });

          const reason = language === 'no'
            ? 'Filen er ikke indeksert i Radarr og må slettes manuelt'
            : 'File is not indexed in Radarr and must be deleted manually';

          logEntry.status = 'error';
          logEntry.error = reason;
          setDeleteLog(prev => [logEntry, ...prev]);

          toast.warning(
            language === 'no'
              ? `⚠️ Må slettes manuelt: ${file.path}`
              : `⚠️ Must be deleted manually: ${file.path}`,
            { duration: 10000 }
          );

          addManualDuplicate(group, file, reason);
          removeFileFromDuplicatesUI(groupIndex, fileIndex);

          setDeletingFile(null);
          setFileToDelete(null);
          setConfirmCode("");
          return;
        }
      } else {
        // Episodes via Sonarr
        const normalizePath = (p: string) => {
          if (!p) return '';
          return p.toLowerCase().replace(/\\/g, '/').replace(/^[a-z]:/i, '').trim();
        };

        const getFileName = (p: string) => {
          if (!p) return '';
          const parts = p.replace(/\\/g, '/').split('/');
          return parts[parts.length - 1]?.toLowerCase() || '';
        };

        const normalizeTitle = (t: string) => (t || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        const filePathNorm = normalizePath(file.path);
        const fileName = getFileName(file.path);
        const targetSeriesNorm = normalizeTitle(group.seriesName || '');

        const seriesResp = await supabase.functions.invoke('sonarr-proxy', {
          body: { action: 'series' }
        });

        if (seriesResp.error) throw seriesResp.error;
        const seriesList: any[] = Array.isArray(seriesResp.data) ? seriesResp.data : [];

        const candidates = targetSeriesNorm
          ? seriesList.filter((s: any) => {
              const t = normalizeTitle(s?.title || '');
              return t === targetSeriesNorm || t.includes(targetSeriesNorm) || targetSeriesNorm.includes(t);
            })
          : seriesList;

        let matchedEpisodeFile: any = null;

        for (const s of candidates) {
          if (!s?.id) continue;

          const filesResp = await supabase.functions.invoke('sonarr-proxy', {
            body: { action: 'episodeFiles', params: { seriesId: s.id } }
          });

          if (filesResp.error) continue;
          const episodeFiles: any[] = Array.isArray(filesResp.data) ? filesResp.data : [];

          for (const f of episodeFiles) {
            if (!f?.path) continue;

            const sonarrPathNorm = normalizePath(f.path);
            const sonarrFileName = getFileName(f.path);

            if (sonarrPathNorm === filePathNorm) {
              matchedEpisodeFile = f;
              break;
            }

            if (sonarrFileName === fileName && fileName.length > 5) {
              matchedEpisodeFile = f;
              break;
            }

            if (filePathNorm.endsWith(sonarrFileName) || sonarrPathNorm.endsWith(fileName)) {
              matchedEpisodeFile = f;
              break;
            }
          }

          if (matchedEpisodeFile) break;
        }

        const episodeFileId = matchedEpisodeFile?.id;

        if (episodeFileId) {
          const { error: deleteError } = await supabase.functions.invoke('sonarr-proxy', {
            body: { action: 'deleteEpisodeFile', params: { episodeFileId } }
          });

          if (deleteError) throw deleteError;

          toast.success(
            language === 'no'
              ? `✅ Slettet episodefil: ${logEntry.fileName}`
              : `✅ Deleted episode file: ${logEntry.fileName}`,
            { duration: 5000 }
          );
        } else {
          const reason = language === 'no'
            ? 'Filen er ikke indeksert i Sonarr og må slettes manuelt'
            : 'File is not indexed in Sonarr and must be deleted manually';

          logEntry.status = 'error';
          logEntry.error = reason;
          setDeleteLog(prev => [logEntry, ...prev]);

          toast.warning(
            language === 'no'
              ? `⚠️ Må slettes manuelt: ${file.path}`
              : `⚠️ Must be deleted manually: ${file.path}`,
            { duration: 10000 }
          );

          addManualDuplicate(group, file, reason);
          removeFileFromDuplicatesUI(groupIndex, fileIndex);

          setDeletingFile(null);
          setFileToDelete(null);
          setConfirmCode("");
          return;
        }
      }
      
      // Remove file from UI
      removeFileFromDuplicatesUI(groupIndex, fileIndex);

      setDeleteLog(prev => [logEntry, ...prev]);
    } catch (error) {
      console.error('Error deleting file:', error);
      logEntry.status = 'error';
      logEntry.error = error instanceof Error ? error.message : 'Unknown error';
      setDeleteLog(prev => [logEntry, ...prev]);
      toast.error(language === 'no' ? 'Kunne ikke slette filen' : 'Could not delete file');
    } finally {
      setDeletingFile(null);
      setFileToDelete(null);
      setConfirmCode("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Delete confirmation dialog with code verification */}
      <AlertDialog open={!!fileToDelete} onOpenChange={(open) => { if (!open) { setFileToDelete(null); setConfirmCode(""); } }}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-6 w-6" />
              {language === 'no' ? '⚠️ ADVARSEL: Permanent sletting' : '⚠️ WARNING: Permanent deletion'}
            </AlertDialogTitle>
            <div className="space-y-4 pt-2">
              <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                <p className="text-sm font-medium text-destructive">
                  {language === 'no' 
                    ? 'Denne handlingen kan IKKE angres! Filen vil bli permanent slettet fra disken.'
                    : 'This action CANNOT be undone! The file will be permanently deleted from disk.'}
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">{language === 'no' ? 'Fil som vil bli slettet:' : 'File to be deleted:'}</p>
                <div className="p-3 bg-secondary/50 rounded-lg border">
                  <p className="text-sm font-medium">{fileToDelete?.group.title}</p>
                  <p className="font-mono text-xs break-all text-muted-foreground mt-1">{fileToDelete?.file.path}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      {fileToDelete && formatFileSize(fileToDelete.file.size)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {fileToDelete?.file.videoCodec.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {fileToDelete && getResolutionLabel(fileToDelete.file.width, fileToDelete.file.height)}
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-code" className="text-sm font-medium">
                  {language === 'no' 
                    ? `Skriv inn koden "${getConfirmationCode()}" for å bekrefte:`
                    : `Type the code "${getConfirmationCode()}" to confirm:`}
                </Label>
                <Input
                  id="confirm-code"
                  type="text"
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  placeholder={language === 'no' ? 'Skriv bekreftelseskode...' : 'Enter confirmation code...'}
                  className="font-mono text-center text-lg tracking-widest"
                  maxLength={4}
                />
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel onClick={() => setConfirmCode("")}>
              {language === 'no' ? 'Avbryt' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteFile}
              disabled={confirmCode !== getConfirmationCode()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {language === 'no' ? 'Slett fil permanent' : 'Delete file permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete log panel */}
      {deleteLog.length > 0 && (
        <Card className="border-border/50 border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" />
                {language === 'no' ? 'Slettelogg' : 'Deletion Log'}
                <Badge variant="secondary" className="ml-2">{deleteLog.length}</Badge>
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowDeleteLog(!showDeleteLog)}
              >
                {showDeleteLog ? (language === 'no' ? 'Skjul' : 'Hide') : (language === 'no' ? 'Vis' : 'Show')}
              </Button>
            </div>
          </CardHeader>
          {showDeleteLog && (
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {deleteLog.map((entry, i) => (
                    <div 
                      key={i}
                      className={`p-3 rounded-lg text-sm ${
                        entry.status === 'success' 
                          ? 'bg-green-500/10 border border-green-500/20' 
                          : 'bg-destructive/10 border border-destructive/20'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {entry.status === 'success' ? (
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{entry.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{entry.fileName}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{entry.timestamp.toLocaleTimeString()}</span>
                            <span>•</span>
                            <span>{formatFileSize(entry.fileSize)}</span>
                            {entry.error && (
                              <>
                                <span>•</span>
                                <span className="text-destructive">{entry.error}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          )}
        </Card>
      )}

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            {language === 'no' ? 'Duplikatskanner' : 'Duplicate Scanner'}
          </CardTitle>
          <CardDescription>
            {language === 'no' 
              ? 'Finn innhold som finnes i flere kvaliteter (f.eks. 1080p og 4K versjoner av samme film)'
              : 'Find content that exists in multiple qualities (e.g. 1080p and 4K versions of the same movie)'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-center">
            <Button 
              onClick={scanForDuplicates}
              disabled={scanning}
              className="gap-2"
            >
              {scanning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {language === 'no' ? 'Skanner...' : 'Scanning...'}
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  {language === 'no' ? 'Skann etter duplikater' : 'Scan for duplicates'}
                </>
              )}
            </Button>

            <Button
              onClick={refreshJellyfinLibrary}
              disabled={scanning || refreshingLibrary}
              variant="outline"
              className="gap-2"
            >
              {refreshingLibrary ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {language === 'no' ? 'Oppdaterer bibliotek...' : 'Refreshing library...'}
                </>
              ) : (
                <>
                  <HardDrive className="h-4 w-4" />
                  {language === 'no' ? 'Oppdater bibliotek' : 'Refresh library'}
                </>
              )}
            </Button>
            
            {scanComplete && (
              <Button 
                onClick={scanForDuplicates}
                variant="outline"
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                {language === 'no' ? 'Skann på nytt' : 'Rescan'}
              </Button>
            )}
          </div>

          {/* Jellyfin Unauthorized Banner */}
          {jellyfinError === 'unauthorized' && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">
                    {language === 'no' ? 'Kunne ikke koble til Jellyfin' : 'Could not connect to Jellyfin'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {language === 'no' 
                      ? 'Sesjonen din har utløpt eller Jellyfin er ikke tilgjengelig. Logg inn på nytt for å fortsette.' 
                      : 'Your session has expired or Jellyfin is unavailable. Log in again to continue.'}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => window.location.href = '/login'}
              >
                <LogIn className="h-4 w-4" />
                {language === 'no' ? 'Logg inn' : 'Log in'}
              </Button>
            </div>
          )}

          {scanComplete && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                <div className="text-2xl font-bold">{duplicates.length}</div>
                <div className="text-sm text-muted-foreground">
                  {language === 'no' ? 'Duplikatgrupper funnet' : 'Duplicate groups found'}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                <div className="text-2xl font-bold">
                  {duplicates.reduce((sum, g) => sum + g.files.length, 0)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {language === 'no' ? 'Totale filer' : 'Total files'}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <div className="text-2xl font-bold text-orange-400">
                  {formatFileSize(totalDuplicateSize)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {language === 'no' ? 'Potensielt frigjørbar plass' : 'Potentially freeable space'}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {scanComplete && duplicates.length === 0 && manualDuplicates.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="py-8 text-center">
            <div className="text-muted-foreground">
              {language === 'no' 
                ? '✅ Ingen duplikater funnet! Biblioteket ditt er rent.'
                : '✅ No duplicates found! Your library is clean.'}
            </div>
          </CardContent>
        </Card>
      )}

      {duplicates.length > 0 && (
        <ScrollArea className="h-[600px]">
          <div className="space-y-4 pr-4">
            {duplicates.map((group, index) => (
              <Card key={index} className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {group.type === "Movie" ? (
                        <Film className="h-5 w-5 text-primary" />
                      ) : (
                        <Tv className="h-5 w-5 text-primary" />
                      )}
                      <div>
                        <CardTitle className="text-base">{group.title}</CardTitle>
                        {group.seriesName && (
                          <CardDescription>
                            {group.seriesName} - S{group.seasonNumber?.toString().padStart(2, '0')}E{group.episodeNumber?.toString().padStart(2, '0')}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {group.files.length} {language === 'no' ? 'versjoner' : 'versions'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {group.files
                      .sort((a, b) => b.height - a.height)
                      .map((file, fileIndex) => {
                        const isDeleting = deletingFile?.groupIndex === index && deletingFile?.fileIndex === fileIndex;
                        return (
                          <div
                            key={fileIndex}
                            className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-secondary/20 border border-border/30"
                          >
                            <Badge className={`${getResolutionColor(file.height)} border`}>
                              {getResolutionLabel(file.width, file.height)}
                            </Badge>
                            <Badge variant="outline" className="font-mono text-xs">
                              {file.videoCodec.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className="font-mono text-xs">
                              {file.audioCodec.toUpperCase()}
                            </Badge>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <HardDrive className="h-3 w-3" />
                              {formatFileSize(file.size)}
                            </div>
                            <div className="flex-1 min-w-0 flex items-center justify-end gap-2">
                              <div className="min-w-0 text-right space-y-0.5">
                                <div className="text-xs text-muted-foreground truncate" title={file.path}>
                                  {file.path.split('/').pop() || file.path}
                                </div>
                                <div className="text-[11px] font-mono text-muted-foreground/80 break-all">
                                  {file.path || (language === 'no' ? 'Ukjent sti' : 'Unknown path')}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={isDeleting}
                                onClick={() => setFileToDelete({ group, file, groupIndex: index, fileIndex })}
                              >
                                {isDeleting ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      {manualDuplicates.length > 0 && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {language === 'no' ? 'Må slettes manuelt' : 'Must be deleted manually'}
            </CardTitle>
            <CardDescription>
              {language === 'no'
                ? 'Disse filene er ikke indeksert i Radarr/Sonarr og kan ikke slettes via appen. Slett dem direkte på disken, oppdater biblioteket, og skann på nytt.'
                : 'These files are not indexed in Radarr/Sonarr and cannot be deleted via the app. Delete them on disk, refresh the library, and rescan.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {manualDuplicates.map((group, gi) => (
                <div key={gi} className="rounded-lg border border-border/50 bg-secondary/10 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{group.title}</div>
                      {group.seriesName && (
                        <div className="text-xs text-muted-foreground">
                          {group.seriesName} - S{group.seasonNumber?.toString().padStart(2, '0')}E{group.episodeNumber?.toString().padStart(2, '0')}
                        </div>
                      )}
                    </div>
                    <Badge variant="destructive">
                      {language === 'no' ? 'Manuell' : 'Manual'}
                    </Badge>
                  </div>

                  <div className="mt-2 space-y-2">
                    {group.files.map((file, fi) => (
                      <div key={fi} className="p-2 rounded-md bg-secondary/20 border border-border/30">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-xs break-all text-muted-foreground">{file.path}</div>
                            {file.manualDeleteReason && (
                              <div className="text-[11px] text-destructive mt-1">{file.manualDeleteReason}</div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0 h-7 px-2 gap-1.5 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              navigator.clipboard.writeText(file.path);
                              toast.success(language === 'no' ? 'Sti kopiert!' : 'Path copied!');
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            {language === 'no' ? 'Kopier' : 'Copy'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-2 border-t border-border/30">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FolderOpen className="h-3.5 w-3.5" />
                      <span>
                        {language === 'no' 
                          ? 'Åpne filutforsker på NAS og naviger til stien over for å slette filen manuelt.' 
                          : 'Open file explorer on NAS and navigate to the path above to delete manually.'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
