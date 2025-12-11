-- Add new permissions to the enum
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'view_radarr';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'view_sonarr';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'view_bazarr';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'view_media';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'view_compatibility';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'view_health';