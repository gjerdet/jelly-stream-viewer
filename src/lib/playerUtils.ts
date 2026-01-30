/**
 * Helper function to format seconds to time string (MM:SS or HH:MM:SS)
 */
export const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Format bytes to human readable string
 */
export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B/s';
  
  if (bytes < 1024) return `${bytes} B/s`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`;
};

/**
 * Convert seconds to Jellyfin ticks (1 tick = 100 nanoseconds)
 */
export const secondsToTicks = (seconds: number): number => {
  return Math.floor(seconds * 10000000);
};

/**
 * Convert Jellyfin ticks to seconds
 */
export const ticksToSeconds = (ticks: number): number => {
  return ticks / 10000000;
};

/**
 * Normalize server URL to ensure http:// or https:// prefix
 */
export const normalizeServerUrl = (serverUrl: string): string => {
  if (!serverUrl) return '';
  if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
    return `http://${serverUrl}`;
  }
  return serverUrl.replace(/\/$/, '');
};
