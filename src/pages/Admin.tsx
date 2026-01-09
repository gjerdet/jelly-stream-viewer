import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/contexts/LanguageContext";
import { Settings, Newspaper, Server, Download, Database, HardDrive, Activity, FileText, Library, Subtitles, AlertTriangle, MessageSquare, BookOpen, Film, Tv, Copy, RefreshCw } from "lucide-react";

import { UpdateManager } from "@/components/UpdateManager";
import { UserManagement } from "@/components/UserManagement";
import { HealthCheckDashboard } from "@/components/HealthCheckDashboard";
import { SystemLogs } from "@/components/SystemLogs";
import { MediaLibraryOverview } from "@/components/MediaLibraryOverview";
import { BazarrDashboard } from "@/components/admin/BazarrDashboard";
import { MediaCompatibilityManager } from "@/components/admin/MediaCompatibilityManager";
import { TranscodeJobsDashboard } from "@/components/admin/TranscodeJobsDashboard";
import { MediaReportsManager } from "@/components/admin/MediaReportsManager";
import { DatabaseSetupGuide } from "@/components/admin/DatabaseSetupGuide";
import { RadarrDashboard } from "@/components/admin/RadarrDashboard";
import { SonarrDashboard } from "@/components/admin/SonarrDashboard";
import { UserAccessManagement } from "@/components/admin/UserAccessManagement";
import { DuplicateMediaManager } from "@/components/admin/DuplicateMediaManager";
import { DuplicateReportsManager } from "@/components/admin/DuplicateReportsManager";
import { BufferingDiagnostics } from "@/components/admin/BufferingDiagnostics";
import { DownloadsPendingManager } from "@/components/admin/DownloadsPendingManager";
import { SyncScheduleManager } from "@/components/admin/SyncScheduleManager";
import { ServerSettingsSection } from "@/components/admin/ServerSettingsSection";
import { NewsManagementSection } from "@/components/admin/NewsManagementSection";
import { SiteSettingsSection } from "@/components/admin/SiteSettingsSection";
import { MonitoringSection } from "@/components/admin/MonitoringSection";
import { QBittorrentSection } from "@/components/admin/QBittorrentSection";
import { AppServicesHealth } from "@/components/admin/AppServicesHealth";
import { SystemStatusDashboard } from "@/components/admin/SystemStatusDashboard";
import { supabase } from "@/integrations/supabase/client";


const Admin = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { data: userRole, isLoading: roleLoading } = useUserRole(user?.id);
  const { t, language } = useLanguage();
  const admin = t.admin as any;
  const common = t.common as any;
  
  // Database settings state (only used in database tab)
  const [deploymentType, setDeploymentType] = useState("");
  const [dbHost, setDbHost] = useState("");
  const [dbPort, setDbPort] = useState("");
  const [dbName, setDbName] = useState("");
  const [dbUser, setDbUser] = useState("");
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseProjectId, setSupabaseProjectId] = useState("");

  // Load database settings
  useEffect(() => {
    const loadDatabaseSettings = async () => {
      if (!user || userRole !== "admin") return;
      
      const { data } = await supabase
        .from("server_settings")
        .select("setting_key, setting_value")
        .in("setting_key", [
          "deployment_type",
          "db_host",
          "db_port",
          "db_name",
          "db_user",
          "supabase_url",
          "supabase_project_id"
        ]);
      
      data?.forEach(setting => {
        if (setting.setting_key === "deployment_type") setDeploymentType(setting.setting_value || "");
        if (setting.setting_key === "db_host") setDbHost(setting.setting_value || "");
        if (setting.setting_key === "db_port") setDbPort(setting.setting_value || "");
        if (setting.setting_key === "db_name") setDbName(setting.setting_value || "");
        if (setting.setting_key === "db_user") setDbUser(setting.setting_value || "");
        if (setting.setting_key === "supabase_url") setSupabaseUrl(setting.setting_value || "");
        if (setting.setting_key === "supabase_project_id") setSupabaseProjectId(setting.setting_value || "");
      });
    };
    
    loadDatabaseSettings();
  }, [user, userRole]);

  useEffect(() => {
    // Wait for both auth and role to finish loading
    if (authLoading || roleLoading) return;
    
    if (!user) {
      navigate("/");
    } else if (userRole && userRole !== "admin") {
      navigate("/browse");
    }
  }, [user, userRole, authLoading, roleLoading, navigate]);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <p className="text-center text-muted-foreground">{common.loading || "Loading..."}</p>
        </div>
      </div>
    );
  }


  const adminTabs = [
    { value: "health", label: "Health", icon: Activity },
    { value: "system-status", label: language === 'no' ? "System Status" : "System Status", icon: Server },
    { value: "media", label: "Media", icon: Library },
    { value: "radarr", label: "Radarr", icon: Film },
    { value: "sonarr", label: "Sonarr", icon: Tv },
    { value: "bazarr", label: "Bazarr", icon: Subtitles },
    { value: "compatibility", label: language === 'no' ? "Kompatibilitet" : "Compatibility", icon: AlertTriangle },
    { value: "duplicates", label: language === 'no' ? "Duplikater" : "Duplicates", icon: Copy },
    { value: "reports", label: language === 'no' ? "Rapporter" : "Reports", icon: MessageSquare },
    { value: "servers", label: admin.servers || "Servers", icon: Server },
    { value: "database", label: admin.database || "Database", icon: Database },
    { value: "site", label: language === 'no' ? 'Side' : 'Site', icon: Settings },
    { value: "monitoring", label: language === 'no' ? 'Status' : 'Status', icon: Activity },
    { value: "sync", label: language === 'no' ? 'Synkronisering' : 'Sync', icon: RefreshCw },
    { value: "qbittorrent", label: "qBittorrent", icon: Download },
    { value: "users", label: admin.users || "Users", icon: Settings },
    { value: "news", label: language === 'no' ? 'Nyheter' : 'News', icon: Newspaper },
    
    { value: "logs", label: admin.logs || "Logs", icon: FileText },
    { value: "updates", label: language === 'no' ? "Oppdateringer" : "Updates", icon: Download },
    { value: "db-setup", label: language === 'no' ? "DB Oppsett" : "DB Setup", icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Settings className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{admin.title || "Admin Panel"}</h1>
              <p className="text-muted-foreground">{admin.serverSettings || "Manage server connections and content"}</p>
            </div>
          </div>
          <Button 
            onClick={() => navigate("/requests-admin")}
            variant="outline"
            className="gap-2"
          >
            <Newspaper className="h-4 w-4" />
            {admin.requests || "Requests"}
          </Button>
        </div>

        <Tabs defaultValue="health" className="w-full" orientation="vertical">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar Navigation */}
            <div className="lg:w-56 flex-shrink-0">
              <TabsList className="flex lg:flex-col h-auto w-full overflow-x-auto lg:overflow-visible gap-1 bg-secondary/30 p-2 rounded-lg">
                {adminTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger 
                      key={tab.value}
                      value={tab.value} 
                      className="w-full justify-start gap-2 px-3 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{tab.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0">
              <TabsContent value="health" className="space-y-6 mt-0">
                <AppServicesHealth />
                <HealthCheckDashboard />
              </TabsContent>

              <TabsContent value="system-status" className="space-y-6 mt-0">
                <SystemStatusDashboard />
              </TabsContent>

              <TabsContent value="media" className="space-y-6 mt-0">
                <MediaLibraryOverview />
              </TabsContent>

              <TabsContent value="radarr" className="space-y-6 mt-0">
                <RadarrDashboard />
              </TabsContent>

              <TabsContent value="sonarr" className="space-y-6 mt-0">
                <SonarrDashboard />
              </TabsContent>

              <TabsContent value="bazarr" className="space-y-6 mt-0">
                <BazarrDashboard />
              </TabsContent>

              <TabsContent value="servers" className="space-y-6 mt-0">
                <ServerSettingsSection userRole={userRole} />
              </TabsContent>

              <TabsContent value="database" className="space-y-6 mt-0">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    {admin.databaseConfiguration || "Database Configuration"}
                  </CardTitle>
                  <CardDescription>
                    {admin.databaseDescription || "View and manage database settings. These are configured during installation."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-sm text-blue-400">
                      <strong>ℹ️ {common.note || "Note"}:</strong> {language === 'no' 
                        ? 'Database-innstillinger kan ikke endres direkte i Admin-panelet. For å endre deployment-type eller database-konfigurasjon, må du kjøre setup-wizarden på nytt.'
                        : 'Database settings cannot be changed directly in the Admin panel. To change deployment type or database configuration, you must run the setup wizard again.'}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{admin.deploymentType || "Deployment Type"}</Label>
                      <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                        <p className="font-mono text-sm">
                          {deploymentType ? (
                            deploymentType === "cloud" ? (
                              <span className="text-primary">☁️ {admin.lovableCloud || "Lovable Cloud"}</span>
                            ) : (
                              <span className="text-green-400">🐳 {language === 'no' ? 'Lokal PostgreSQL (Docker)' : 'Local PostgreSQL (Docker)'}</span>
                            )
                          ) : (
                            <span className="text-muted-foreground">{language === 'no' ? 'Ikke konfigurert' : 'Not configured'}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {deploymentType === "cloud" && (
                      <>
                        <div className="space-y-2">
                          <Label>{admin.supabaseUrl || "Supabase Project URL"}</Label>
                          <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                            <p className="font-mono text-sm break-all">
                              {supabaseUrl || <span className="text-muted-foreground">{admin.notSet || "Not set"}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>{admin.supabaseProjectId || "Supabase Project ID"}</Label>
                          <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                            <p className="font-mono text-sm">
                              {supabaseProjectId || <span className="text-muted-foreground">{admin.notSet || "Not set"}</span>}
                            </p>
                          </div>
                        </div>
                      </>
                    )}

                    {deploymentType === "local" && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>{admin.dbHost || "Database Host"}</Label>
                            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                              <p className="font-mono text-sm">
                                {dbHost || <span className="text-muted-foreground">{admin.notSet || "Not set"}</span>}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>{admin.dbPort || "Port"}</Label>
                            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                              <p className="font-mono text-sm">
                                {dbPort || <span className="text-muted-foreground">{admin.notSet || "Not set"}</span>}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>{admin.dbName || "Database Name"}</Label>
                          <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                            <p className="font-mono text-sm">
                              {dbName || <span className="text-muted-foreground">{admin.notSet || "Not set"}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>{language === 'no' ? 'Brukernavn' : 'Username'}</Label>
                          <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                            <p className="font-mono text-sm">
                              {dbUser || <span className="text-muted-foreground">{admin.notSet || "Not set"}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                          <p className="text-sm text-yellow-400">
                            <strong>{admin.securityWarning || "⚠️ Security: Database password is not displayed for security reasons."}</strong>
                          </p>
                        </div>
                      </>
                    )}

                    {!deploymentType && (
                      <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg text-center">
                        <p className="text-sm text-orange-400 mb-3">
                          {admin.databaseNotConfigured || "Database is not configured via setup wizard."}
                        </p>
                        <Button 
                          onClick={() => navigate("/setup-wizard")}
                          variant="outline"
                          className="gap-2"
                        >
                          <HardDrive className="h-4 w-4" />
                          {admin.startSetupWizard || "Start setup wizard"}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-secondary/30 rounded-lg">
                    <h3 className="font-semibold mb-2 text-sm flex items-center gap-2">
                      <HardDrive className="h-4 w-4" />
                      {admin.troubleshooting || "Troubleshooting"}
                    </h3>
                    <ul className="text-xs text-muted-foreground space-y-2">
                      <li>• {language === 'no' 
                        ? 'For Supabase Cloud: Sjekk at URL og API-keys er riktige i .env filen' 
                        : 'For Supabase Cloud: Check that URL and API keys are correct in the .env file'}</li>
                      <li>• {language === 'no' 
                        ? 'For lokal PostgreSQL: Test forbindelse med:' 
                        : 'For local PostgreSQL: Test connection with:'} <code className="px-1 py-0.5 bg-secondary rounded">docker ps</code></li>
                      <li>• {language === 'no' 
                        ? 'Sjekk database-logs:' 
                        : 'Check database logs:'} <code className="px-1 py-0.5 bg-secondary rounded">docker logs jelly-stream-db</code></li>
                      <li>• {language === 'no' 
                        ? 'Se DEPLOYMENT_LOCAL.md for fullstendig feilsøkingsguide' 
                        : 'See DEPLOYMENT_LOCAL.md for complete troubleshooting guide'}</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
              </TabsContent>

              <TabsContent value="site" className="space-y-6 mt-0">
                <SiteSettingsSection />
              </TabsContent>

              <TabsContent value="monitoring" className="space-y-6 mt-0">
                <MonitoringSection userRole={userRole} />
              </TabsContent>

              <TabsContent value="sync" className="space-y-6 mt-0">
                <SyncScheduleManager />
              </TabsContent>

              <TabsContent value="qbittorrent" className="space-y-6 mt-0">
                <QBittorrentSection userRole={userRole} />
              </TabsContent>

              <TabsContent value="news" className="space-y-6 mt-0">
                <NewsManagementSection userRole={userRole} />
              </TabsContent>

              <TabsContent value="users" className="space-y-6 mt-0">
                <UserAccessManagement userRole={userRole} />
                <UserManagement />
              </TabsContent>

              <TabsContent value="compatibility" className="space-y-6 mt-0">
                <MediaCompatibilityManager />
                <TranscodeJobsDashboard />
              </TabsContent>

              <TabsContent value="duplicates" className="space-y-6 mt-0">
                <DuplicateReportsManager />
                <DownloadsPendingManager />
                <BufferingDiagnostics />
                <DuplicateMediaManager />
              </TabsContent>

              <TabsContent value="reports" className="space-y-6 mt-0">
                <MediaReportsManager />
              </TabsContent>

              <TabsContent value="logs" className="space-y-6 mt-0">
                <SystemLogs />
              </TabsContent>

              <TabsContent value="updates" className="space-y-6 mt-0">
                <UpdateManager />
              </TabsContent>

              <TabsContent value="db-setup" className="space-y-6 mt-0">
                <DatabaseSetupGuide />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
