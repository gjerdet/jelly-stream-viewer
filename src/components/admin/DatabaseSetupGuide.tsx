import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Database, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp,
  Server,
  Shield,
  Table,
  Key,
  Users
} from "lucide-react";
import { toast } from "sonner";

const SQL_SECTIONS = [
  {
    id: "enums",
    title: "1. Opprett Enums",
    icon: Key,
    description: "Definer roller og status-typer",
    sql: `-- Opprett enum for brukerroller
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Opprett enum for kompatibilitetsstatus
CREATE TYPE public.compatibility_status AS ENUM ('compatible', 'needs_transcode', 'unknown', 'error');

-- Opprett enum for rapport-kategorier
CREATE TYPE public.media_report_category AS ENUM ('buffering', 'no_audio', 'no_video', 'subtitle_issues', 'wrong_file', 'quality_issues', 'other');`
  },
  {
    id: "functions",
    title: "2. Opprett Funksjoner",
    icon: Server,
    description: "Hjelpefunksjoner for RLS og oppsett",
    sql: `-- Funksjon for å sjekke brukerrolle (brukes i RLS policies)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Funksjon for å oppdatere updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Funksjon for å opprette ny bruker med profil og rolle
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, jellyfin_username, jellyfin_user_id)
  VALUES (
    NEW.id, 
    NEW.email,
    NEW.raw_user_meta_data->>'jellyfin_username',
    NEW.raw_user_meta_data->>'jellyfin_user_id'
  );
  
  -- Første bruker blir admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Funksjon for initialt server-oppsett (bypasser RLS)
CREATE OR REPLACE FUNCTION public.setup_server_settings(p_server_url text, p_api_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jellyfin_configured BOOLEAN;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  SELECT EXISTS (
    SELECT 1 FROM server_settings 
    WHERE setting_key = 'jellyfin_server_url' 
    AND setting_value IS NOT NULL 
    AND setting_value != ''
  ) INTO jellyfin_configured;
  
  IF jellyfin_configured THEN
    IF current_user_id IS NULL THEN
      RAISE EXCEPTION 'Du må være innlogget for å oppdatere server-innstillinger';
    ELSIF NOT public.has_role(current_user_id, 'admin'::app_role) THEN
      RAISE EXCEPTION 'Bare administratorer kan oppdatere server-innstillinger';
    END IF;
  END IF;

  INSERT INTO server_settings (setting_key, setting_value, updated_at)
  VALUES ('jellyfin_server_url', p_server_url, now())
  ON CONFLICT (setting_key)
  DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = now();

  INSERT INTO server_settings (setting_key, setting_value, updated_at)
  VALUES ('jellyfin_api_key', p_api_key, now())
  ON CONFLICT (setting_key)
  DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = now();
END;
$$;`
  },
  {
    id: "core-tables",
    title: "3. Kjernetabeller",
    icon: Table,
    description: "Profiler, roller og innstillinger",
    sql: `-- Brukerprofiler
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  jellyfin_username TEXT,
  jellyfin_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Brukerroller
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Server-innstillinger
CREATE TABLE public.server_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID
);

-- Side-innstillinger (synlig for alle)
CREATE TABLE public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID
);

-- Trigger for ny bruker (kobles til auth.users)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();`
  },
  {
    id: "media-tables",
    title: "4. Media-tabeller",
    icon: Database,
    description: "Favoritter, historikk og likes",
    sql: `-- Bruker-favoritter
CREATE TABLE public.user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  jellyfin_item_id TEXT NOT NULL,
  jellyfin_item_name TEXT NOT NULL,
  jellyfin_item_type TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Se-historikk
CREATE TABLE public.watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  jellyfin_item_id TEXT NOT NULL,
  jellyfin_item_name TEXT NOT NULL,
  jellyfin_item_type TEXT NOT NULL,
  jellyfin_series_name TEXT,
  jellyfin_series_id TEXT,
  jellyfin_season_id TEXT,
  image_url TEXT,
  last_position_ticks BIGINT DEFAULT 0,
  runtime_ticks BIGINT,
  watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bruker-likes
CREATE TABLE public.user_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  jellyfin_item_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bruker-tilbakemeldinger
CREATE TABLE public.user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`
  },
  {
    id: "admin-tables",
    title: "5. Admin-tabeller",
    icon: Shield,
    description: "Nyheter, versjoner og forespørsler",
    sql: `-- Nyhetsposter
CREATE TABLE public.news_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  published BOOLEAN DEFAULT true,
  pinned BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- App-versjoner
CREATE TABLE public.app_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number TEXT NOT NULL,
  description TEXT,
  changelog TEXT,
  release_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Oppdateringsstatus
CREATE TABLE public.update_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  current_step TEXT,
  error TEXT,
  logs JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Jellyseerr-forespørsler
CREATE TABLE public.jellyseerr_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  media_id INTEGER NOT NULL,
  media_type TEXT NOT NULL,
  media_title TEXT NOT NULL,
  media_poster TEXT,
  media_overview TEXT,
  seasons JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`
  },
  {
    id: "compatibility-tables",
    title: "6. Kompatibilitet & Rapporter",
    icon: Table,
    description: "Media-kompatibilitet og brukerrapporter",
    sql: `-- Media-kompatibilitet
CREATE TABLE public.media_compatibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jellyfin_item_id TEXT NOT NULL,
  jellyfin_item_name TEXT NOT NULL,
  jellyfin_item_type TEXT NOT NULL,
  jellyfin_series_name TEXT,
  jellyfin_series_id TEXT,
  jellyfin_season_id TEXT,
  image_url TEXT,
  video_codec TEXT,
  audio_codec TEXT,
  container TEXT,
  status compatibility_status NOT NULL DEFAULT 'unknown',
  transcode_reason TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  last_scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Media-rapporter fra brukere
CREATE TABLE public.media_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  jellyfin_item_id TEXT NOT NULL,
  jellyfin_item_name TEXT NOT NULL,
  jellyfin_item_type TEXT NOT NULL,
  jellyfin_series_name TEXT,
  image_url TEXT,
  category media_report_category NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Skannings-tidsplan
CREATE TABLE public.scan_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN NOT NULL DEFAULT false,
  cron_expression TEXT NOT NULL DEFAULT '0 3 * * *',
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  last_run_items_scanned INTEGER DEFAULT 0,
  last_run_issues_found INTEGER DEFAULT 0,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sett inn standard tidsplan
INSERT INTO public.scan_schedule (enabled, cron_expression) VALUES (false, '0 3 * * *');`
  },
  {
    id: "rls-policies",
    title: "7. RLS Policies",
    icon: Shield,
    description: "Row Level Security regler",
    sql: `-- Aktiver RLS på alle tabeller
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.update_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jellyseerr_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_compatibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_schedule ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- User roles policies
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Server settings policies
CREATE POLICY "Only admins can read server settings" ON public.server_settings FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can insert server settings" ON public.server_settings FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can update server settings" ON public.server_settings FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- Site settings policies
CREATE POLICY "Everyone can read site settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Only admins can insert site settings" ON public.site_settings FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can update site settings" ON public.site_settings FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- User favorites policies
CREATE POLICY "Users can view their own favorites" ON public.user_favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own favorites" ON public.user_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own favorites" ON public.user_favorites FOR DELETE USING (auth.uid() = user_id);

-- Watch history policies
CREATE POLICY "Users can view their own watch history" ON public.watch_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own watch history" ON public.watch_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own watch history" ON public.watch_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own watch history" ON public.watch_history FOR DELETE USING (auth.uid() = user_id);

-- User likes policies
CREATE POLICY "Users can view their own likes" ON public.user_likes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own likes" ON public.user_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own likes" ON public.user_likes FOR DELETE USING (auth.uid() = user_id);

-- User feedback policies
CREATE POLICY "Anyone can view feedback" ON public.user_feedback FOR SELECT USING (true);
CREATE POLICY "Users can create their own feedback" ON public.user_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own feedback" ON public.user_feedback FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own feedback" ON public.user_feedback FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update any feedback" ON public.user_feedback FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete any feedback" ON public.user_feedback FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- News posts policies
CREATE POLICY "Everyone can read published posts" ON public.news_posts FOR SELECT USING (published = true);
CREATE POLICY "Admins can view all posts" ON public.news_posts FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can create posts" ON public.news_posts FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update posts" ON public.news_posts FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete posts" ON public.news_posts FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- App versions policies
CREATE POLICY "Everyone can view versions" ON public.app_versions FOR SELECT USING (true);
CREATE POLICY "Admins can manage versions" ON public.app_versions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Update status policies
CREATE POLICY "Admins can view update status" ON public.update_status FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert update status" ON public.update_status FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update update status" ON public.update_status FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- Jellyseerr requests policies
CREATE POLICY "Users can view their own requests" ON public.jellyseerr_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own requests" ON public.jellyseerr_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all requests" ON public.jellyseerr_requests FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update requests" ON public.jellyseerr_requests FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete requests" ON public.jellyseerr_requests FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Media compatibility policies
CREATE POLICY "Everyone can view compatibility status" ON public.media_compatibility FOR SELECT USING (true);
CREATE POLICY "Admins can manage compatibility" ON public.media_compatibility FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Media reports policies
CREATE POLICY "Users can create their own reports" ON public.media_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own reports" ON public.media_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all reports" ON public.media_reports FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update reports" ON public.media_reports FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete reports" ON public.media_reports FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Scan schedule policies
CREATE POLICY "Admins can manage scan schedule" ON public.scan_schedule FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));`
  },
  {
    id: "indexes",
    title: "8. Indexes",
    icon: Database,
    description: "Optimaliser database-ytelse",
    sql: `-- Indexes for bedre ytelse
CREATE INDEX idx_user_favorites_user ON public.user_favorites(user_id);
CREATE INDEX idx_watch_history_user ON public.watch_history(user_id);
CREATE INDEX idx_watch_history_item ON public.watch_history(jellyfin_item_id);
CREATE INDEX idx_user_likes_user ON public.user_likes(user_id);
CREATE INDEX idx_media_compatibility_status ON public.media_compatibility(status) WHERE resolved = false;
CREATE INDEX idx_media_reports_status ON public.media_reports(status);
CREATE INDEX idx_jellyseerr_requests_user ON public.jellyseerr_requests(user_id);
CREATE INDEX idx_jellyseerr_requests_status ON public.jellyseerr_requests(status);`
  }
];

export const DatabaseSetupGuide = () => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>(["enums"]);

  const copyToClipboard = async (text: string, sectionId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(sectionId);
      toast.success("SQL kopiert til utklippstavlen!");
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      toast.error("Kunne ikke kopiere til utklippstavlen");
    }
  };

  const copyAllSQL = async () => {
    const allSQL = SQL_SECTIONS.map(section => 
      `-- ============================================\n-- ${section.title}\n-- ${section.description}\n-- ============================================\n\n${section.sql}`
    ).join("\n\n\n");
    
    try {
      await navigator.clipboard.writeText(allSQL);
      toast.success("All SQL kopiert til utklippstavlen!");
    } catch (err) {
      toast.error("Kunne ikke kopiere til utklippstavlen");
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Setup Guide
          </CardTitle>
          <CardDescription>
            Komplett SQL for å sette opp databasen fra bunnen av. Kjør disse i Supabase SQL Editor i rekkefølge.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border border-primary/20">
            <div>
              <p className="font-medium">Kopier all SQL på én gang</p>
              <p className="text-sm text-muted-foreground">
                Kjør alt i Supabase SQL Editor for fullstendig oppsett
              </p>
            </div>
            <Button onClick={copyAllSQL} className="gap-2">
              <Copy className="h-4 w-4" />
              Kopier alt
            </Button>
          </div>

          <div className="space-y-3">
            {SQL_SECTIONS.map((section) => {
              const Icon = section.icon;
              const isExpanded = expandedSections.includes(section.id);
              const isCopied = copiedSection === section.id;

              return (
                <div key={section.id} className="border border-border/50 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-secondary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">{section.title}</p>
                        <p className="text-sm text-muted-foreground">{section.description}</p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border/50">
                      <div className="flex items-center justify-between px-4 py-2 bg-secondary/30">
                        <span className="text-sm text-muted-foreground">SQL</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(section.sql, section.id)}
                          className="gap-2"
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-4 w-4 text-green-500" />
                              Kopiert!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Kopier
                            </>
                          )}
                        </Button>
                      </div>
                      <ScrollArea className="h-[300px]">
                        <pre className="p-4 text-xs font-mono bg-background overflow-x-auto whitespace-pre-wrap">
                          {section.sql}
                        </pre>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <h4 className="font-medium text-yellow-500 mb-2">Viktig!</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Kjør SQL-en i rekkefølge fra 1 til 8</li>
              <li>• Sørg for at du er i SQL Editor i Supabase Dashboard</li>
              <li>• Første bruker som registrerer seg blir automatisk admin</li>
              <li>• Trigger for nye brukere kobles automatisk til auth.users</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
