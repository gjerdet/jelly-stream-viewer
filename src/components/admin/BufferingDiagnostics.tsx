import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Activity, AlertTriangle, CheckCircle, Server, Film, Wifi, HardDrive, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DiagnosticResult {
  category: string;
  status: "good" | "warning" | "critical";
  message: string;
  details?: string;
}

export const BufferingDiagnostics = () => {
  const { language } = useLanguage();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [progress, setProgress] = useState(0);

  const runDiagnostics = async () => {
    setRunning(true);
    setResults([]);
    setProgress(0);

    const diagnostics: DiagnosticResult[] = [];

    try {
      // Step 1: Check media compatibility issues
      setProgress(20);
      const { data: compatibilityData, error: compatError } = await supabase
        .from('media_compatibility')
        .select('*')
        .eq('status', 'needs_transcode')
        .eq('resolved', false);

      if (!compatError && compatibilityData) {
        const needsTranscode = compatibilityData.length;
        if (needsTranscode > 50) {
          diagnostics.push({
            category: language === 'no' ? 'Video-kodeker' : 'Video Codecs',
            status: "critical",
            message: language === 'no' 
              ? `${needsTranscode} filer krever transkoding`
              : `${needsTranscode} files require transcoding`,
            details: language === 'no'
              ? 'Mange filer bruker kodeker som ikke støttes av nettleseren (f.eks. HEVC/H.265). Vurder å konvertere til H.264.'
              : 'Many files use codecs not supported by browsers (e.g. HEVC/H.265). Consider converting to H.264.'
          });
        } else if (needsTranscode > 0) {
          diagnostics.push({
            category: language === 'no' ? 'Video-kodeker' : 'Video Codecs',
            status: "warning",
            message: language === 'no' 
              ? `${needsTranscode} filer krever transkoding`
              : `${needsTranscode} files require transcoding`,
            details: language === 'no'
              ? 'Noen filer bruker HEVC eller andre kodeker som krever transkoding.'
              : 'Some files use HEVC or other codecs that require transcoding.'
          });
        } else {
          diagnostics.push({
            category: language === 'no' ? 'Video-kodeker' : 'Video Codecs',
            status: "good",
            message: language === 'no' 
              ? 'Alle filer er kompatible'
              : 'All files are compatible',
          });
        }
      }

      // Step 2: Check for 4K content
      setProgress(40);
      const { data: mediaItems, error: mediaError } = await supabase.functions.invoke('jellyfin-proxy', {
        body: {
          endpoint: '/Items?IncludeItemTypes=Movie,Episode&Recursive=true&Fields=MediaSources&Limit=500',
          method: 'GET',
        },
      });

      if (!mediaError && mediaItems?.Items) {
        const items4K = mediaItems.Items.filter((item: any) => {
          const videoStream = item.MediaSources?.[0]?.MediaStreams?.find((s: any) => s.Type === 'Video');
          return videoStream?.Height >= 2160;
        });

        if (items4K.length > 0) {
          diagnostics.push({
            category: language === 'no' ? '4K-innhold' : '4K Content',
            status: "warning",
            message: language === 'no' 
              ? `${items4K.length} 4K-filer i biblioteket`
              : `${items4K.length} 4K files in library`,
            details: language === 'no'
              ? '4K-innhold krever høy båndbredde (25+ Mbps). Kan forårsake buffering ved tregere nettverk.'
              : '4K content requires high bandwidth (25+ Mbps). May cause buffering on slower networks.'
          });
        }

        // Check for high bitrate files
        const highBitrateItems = mediaItems.Items.filter((item: any) => {
          const bitrate = item.MediaSources?.[0]?.Bitrate;
          return bitrate && bitrate > 40000000; // > 40 Mbps
        });

        if (highBitrateItems.length > 10) {
          diagnostics.push({
            category: language === 'no' ? 'Høy bitrate' : 'High Bitrate',
            status: "warning",
            message: language === 'no' 
              ? `${highBitrateItems.length} filer med høy bitrate (>40 Mbps)`
              : `${highBitrateItems.length} files with high bitrate (>40 Mbps)`,
            details: language === 'no'
              ? 'Filer med svært høy bitrate kan forårsake buffering selv med god nettverkstilkobling.'
              : 'Files with very high bitrate may cause buffering even with good network connection.'
          });
        }
      }

      // Step 3: Check server health
      setProgress(60);
      const { data: healthData, error: healthError } = await supabase.functions.invoke('server-stats', {
        body: {}
      });

      if (!healthError && healthData) {
        // Check CPU usage if available
        if (healthData.cpu?.currentLoad > 80) {
          diagnostics.push({
            category: language === 'no' ? 'Server CPU' : 'Server CPU',
            status: "critical",
            message: language === 'no' 
              ? `Høy CPU-bruk: ${healthData.cpu.currentLoad.toFixed(0)}%`
              : `High CPU usage: ${healthData.cpu.currentLoad.toFixed(0)}%`,
            details: language === 'no'
              ? 'Serveren sliter med å håndtere forespørsler. Kan forårsake buffering under transkoding.'
              : 'Server is struggling to handle requests. May cause buffering during transcoding.'
          });
        }

        // Check memory usage
        if (healthData.memory?.usedMemory && healthData.memory?.totalMemory) {
          const memoryUsage = (healthData.memory.usedMemory / healthData.memory.totalMemory) * 100;
          if (memoryUsage > 90) {
            diagnostics.push({
              category: language === 'no' ? 'Server minne' : 'Server Memory',
              status: "warning",
              message: language === 'no' 
                ? `Høy minnebruk: ${memoryUsage.toFixed(0)}%`
                : `High memory usage: ${memoryUsage.toFixed(0)}%`,
            });
          }
        }
      }

      // Step 4: Check transcode queue
      setProgress(80);
      const { data: transcodeJobs, error: transcodeError } = await supabase
        .from('transcode_jobs')
        .select('*')
        .in('status', ['pending', 'running']);

      if (!transcodeError && transcodeJobs) {
        if (transcodeJobs.length > 0) {
          diagnostics.push({
            category: language === 'no' ? 'Transkode-kø' : 'Transcode Queue',
            status: "warning",
            message: language === 'no' 
              ? `${transcodeJobs.length} aktive transkode-jobber`
              : `${transcodeJobs.length} active transcode jobs`,
            details: language === 'no'
              ? 'Pågående transkoding kan påvirke serverytelse og strømming.'
              : 'Ongoing transcoding may affect server performance and streaming.'
          });
        }
      }

      // Add general recommendations if no issues found
      setProgress(100);
      if (diagnostics.filter(d => d.status !== 'good').length === 0) {
        diagnostics.push({
          category: language === 'no' ? 'Generelt' : 'General',
          status: "good",
          message: language === 'no' 
            ? 'Ingen åpenbare problemer funnet'
            : 'No obvious issues found',
          details: language === 'no'
            ? 'Buffering kan skyldes nettverksproblemer mellom din enhet og serveren.'
            : 'Buffering may be caused by network issues between your device and the server.'
        });
      }

      setResults(diagnostics);
    } catch (error) {
      console.error('Diagnostics error:', error);
      setResults([{
        category: language === 'no' ? 'Feil' : 'Error',
        status: "critical",
        message: language === 'no' ? 'Kunne ikke kjøre diagnostikk' : 'Could not run diagnostics',
      }]);
    } finally {
      setRunning(false);
    }
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'good':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
    }
  };

  const getStatusBadge = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'good':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">OK</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{language === 'no' ? 'Advarsel' : 'Warning'}</Badge>;
      case 'critical':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">{language === 'no' ? 'Kritisk' : 'Critical'}</Badge>;
    }
  };

  const getCategoryIcon = (category: string) => {
    if (category.includes('kodek') || category.includes('Codec')) return <Film className="h-4 w-4" />;
    if (category.includes('4K')) return <Zap className="h-4 w-4" />;
    if (category.includes('Server') || category.includes('CPU')) return <Server className="h-4 w-4" />;
    if (category.includes('bitrate')) return <Wifi className="h-4 w-4" />;
    if (category.includes('Transko')) return <HardDrive className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          {language === 'no' ? 'Buffering-diagnostikk' : 'Buffering Diagnostics'}
        </CardTitle>
        <CardDescription>
          {language === 'no' 
            ? 'Identifiser potensielle årsaker til bufferproblemer'
            : 'Identify potential causes of buffering issues'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runDiagnostics}
          disabled={running}
          className="gap-2"
        >
          {running ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {language === 'no' ? 'Kjører diagnostikk...' : 'Running diagnostics...'}
            </>
          ) : (
            <>
              <Activity className="h-4 w-4" />
              {language === 'no' ? 'Kjør diagnostikk' : 'Run Diagnostics'}
            </>
          )}
        </Button>

        {running && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground">
              {language === 'no' ? 'Sjekker systemet...' : 'Checking system...'}
            </p>
          </div>
        )}

        {results.length > 0 && !running && (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3 pr-4">
              {results.map((result, index) => (
                <div 
                  key={index}
                  className={`p-4 rounded-lg border ${
                    result.status === 'critical' ? 'bg-destructive/5 border-destructive/20' :
                    result.status === 'warning' ? 'bg-yellow-500/5 border-yellow-500/20' :
                    'bg-green-500/5 border-green-500/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {getStatusIcon(result.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                          {getCategoryIcon(result.category)}
                          {result.category}
                        </span>
                        {getStatusBadge(result.status)}
                      </div>
                      <p className="font-medium mt-1">{result.message}</p>
                      {result.details && (
                        <p className="text-sm text-muted-foreground mt-1">{result.details}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {results.length === 0 && !running && (
          <div className="text-center py-8 text-muted-foreground">
            {language === 'no' 
              ? 'Klikk "Kjør diagnostikk" for å starte analysen'
              : 'Click "Run Diagnostics" to start the analysis'}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
