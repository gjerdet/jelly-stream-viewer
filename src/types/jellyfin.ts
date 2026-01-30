/**
 * Shared Jellyfin API types
 * Centralized type definitions for Jellyfin entities
 */

export interface MediaStream {
  Index: number;
  Type: string;
  DisplayTitle?: string;
  Language?: string;
  Codec?: string;
  IsDefault?: boolean;
}

export interface MediaSource {
  Id: string;
  DirectStreamUrl?: string;
  TranscodingUrl?: string;
}

export interface PlaybackInfo {
  MediaSources: MediaSource[];
}

export interface UserData {
  Played?: boolean;
  PlaybackPositionTicks?: number;
  IsFavorite?: boolean;
  PlayedPercentage?: number;
}

export interface JellyfinItemDetail {
  Id: string;
  Name: string;
  Type: string;
  ProductionYear?: number;
  CommunityRating?: number;
  Overview?: string;
  ImageTags?: { Primary?: string; Backdrop?: string };
  BackdropImageTags?: string[];
  RunTimeTicks?: number;
  OfficialRating?: string;
  Genres?: string[];
  Studios?: { Name: string }[];
  People?: { 
    Name: string; 
    Role: string; 
    Type: string; 
    Id?: string;
    PrimaryImageTag?: string;
  }[];
  MediaStreams?: MediaStream[];
  ChildCount?: number;
  RecursiveItemCount?: number;
  UserData?: UserData;
  // Series-specific fields
  SeriesId?: string;
  SeriesName?: string;
  SeasonId?: string;
  IndexNumber?: number;
}

export interface Season {
  Id: string;
  Name: string;
  IndexNumber?: number;
  ImageTags?: { Primary?: string };
}

export interface Episode {
  Id: string;
  Name: string;
  IndexNumber?: number;
  SeasonId: string;
  Overview?: string;
  ImageTags?: { Primary?: string };
  RunTimeTicks?: number;
  UserData?: UserData;
  MediaStreams?: MediaStream[];
}

export interface SeasonsResponse {
  Items: Season[];
}

export interface EpisodesResponse {
  Items: Episode[];
}

export interface RemoteSubtitle {
  Id: string;
  Name: string;
  Language: string;
  Provider: string;
  Comment?: string;
  DownloadCount?: number;
  Format?: string;
}

// Media segment types (intro, credits, etc.)
export interface MediaSegment {
  Type: string; // 'Intro', 'Outro', 'Commercial', 'Preview', 'Recap'
  StartTicks: number;
  EndTicks: number;
}

export interface MediaSegmentsResponse {
  Items: MediaSegment[];
}
