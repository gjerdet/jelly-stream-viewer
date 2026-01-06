import { useState, useEffect, useRef } from "react";
import { Activity, X, Wifi, HardDrive, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StatsData {
  downloadSpeed: number | null;
  bufferedSeconds: number;
  totalBytes: number;
}

interface PlayerStatsPanelProps {
  stats: StatsData;
  streamStatus: {
    isTranscoding: boolean;
    codec: string | null;
    bitrate: string | null;
    container: string | null;
    resolution: string | null;
  };
  isOpen: boolean;
  onClose: () => void;
}

const MAX_HISTORY = 30; // 30 seconds of history

const PlayerStatsPanel = ({ stats, streamStatus, isOpen, onClose }: PlayerStatsPanelProps) => {
  const [speedHistory, setSpeedHistory] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Update speed history every second
  useEffect(() => {
    if (!isOpen) return;
    
    const interval = setInterval(() => {
      setSpeedHistory(prev => {
        const newHistory = [...prev, stats.downloadSpeed || 0];
        if (newHistory.length > MAX_HISTORY) {
          return newHistory.slice(-MAX_HISTORY);
        }
        return newHistory;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isOpen, stats.downloadSpeed]);
  
  // Draw the graph
  useEffect(() => {
    if (!canvasRef.current || speedHistory.length < 2) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const padding = 4;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, width, height);
    
    // Find max value for scaling
    const maxSpeed = Math.max(...speedHistory, 1);
    
    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Draw the line graph
    ctx.strokeStyle = stats.downloadSpeed && stats.downloadSpeed > 500000 ? '#22c55e' : 
                      stats.downloadSpeed && stats.downloadSpeed > 100000 ? '#eab308' : '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const stepX = (width - padding * 2) / (MAX_HISTORY - 1);
    
    speedHistory.forEach((speed, index) => {
      const x = padding + index * stepX;
      const normalizedSpeed = speed / maxSpeed;
      const y = height - padding - (normalizedSpeed * (height - padding * 2));
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Draw gradient fill under the line
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, stats.downloadSpeed && stats.downloadSpeed > 500000 ? 'rgba(34, 197, 94, 0.3)' : 
                            stats.downloadSpeed && stats.downloadSpeed > 100000 ? 'rgba(234, 179, 8, 0.3)' : 'rgba(239, 68, 68, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.lineTo(padding + (speedHistory.length - 1) * stepX, height - padding);
    ctx.lineTo(padding, height - padding);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    
  }, [speedHistory, stats.downloadSpeed]);
  
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B/s`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB/s`;
  };
  
  const formatTotalBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="absolute bottom-24 right-4 w-72 bg-black/90 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl overflow-hidden pointer-events-auto z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-white">Nettverksstatistikk</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-6 w-6 text-white/60 hover:text-white hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Stats Grid */}
      <div className="p-3 space-y-3">
        {/* Download Speed */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wifi className="h-4 w-4" />
            <span className="text-xs">Nedlastingshastighet</span>
          </div>
          <span className={`text-sm font-mono font-medium ${
            stats.downloadSpeed && stats.downloadSpeed > 500000 ? 'text-green-400' :
            stats.downloadSpeed && stats.downloadSpeed > 100000 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {stats.downloadSpeed ? formatBytes(stats.downloadSpeed) : '—'}
          </span>
        </div>
        
        {/* Buffer Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-xs">Buffret video</span>
          </div>
          <span className={`text-sm font-mono font-medium ${
            stats.bufferedSeconds > 10 ? 'text-green-400' :
            stats.bufferedSeconds > 3 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {stats.bufferedSeconds.toFixed(1)}s
          </span>
        </div>
        
        {/* Total Downloaded */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <HardDrive className="h-4 w-4" />
            <span className="text-xs">Totalt lastet ned</span>
          </div>
          <span className="text-sm font-mono font-medium text-blue-400">
            {formatTotalBytes(stats.totalBytes)}
          </span>
        </div>
        
        {/* Stream Info */}
        <div className="pt-2 border-t border-white/10 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Status</span>
            <span className={streamStatus.isTranscoding ? 'text-amber-400' : 'text-green-400'}>
              {streamStatus.isTranscoding ? '⚡ Transkoding' : '✓ Direktestrøm'}
            </span>
          </div>
          {streamStatus.codec && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Codec</span>
              <span className="text-white/80 font-mono">{streamStatus.codec}</span>
            </div>
          )}
          {streamStatus.resolution && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Oppløsning</span>
              <span className="text-white/80 font-mono">{streamStatus.resolution}</span>
            </div>
          )}
        </div>
        
        {/* Mini Graph */}
        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Hastighet siste 30 sek</span>
          </div>
          <canvas 
            ref={canvasRef} 
            width={248} 
            height={60} 
            className="w-full h-[60px] rounded-md"
          />
        </div>
      </div>
    </div>
  );
};

export default PlayerStatsPanel;
