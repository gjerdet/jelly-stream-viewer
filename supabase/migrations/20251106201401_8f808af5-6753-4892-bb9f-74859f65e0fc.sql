-- Add server monitoring settings
INSERT INTO public.server_settings (setting_key, setting_value) 
VALUES 
  ('monitoring_url', ''),
  ('qbittorrent_url', ''),
  ('qbittorrent_username', ''),
  ('qbittorrent_password', '')
ON CONFLICT (setting_key) DO NOTHING;

-- Add comment
COMMENT ON TABLE public.server_settings IS 'Server configuration including Jellyfin, Jellyseerr, monitoring and qBittorrent settings';