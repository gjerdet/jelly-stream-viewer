import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { useEffect } from "react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import Header from "./components/Header";
import Login from "./pages/Login";
import Setup from "./pages/Setup";
import SetupWizard from "./pages/SetupWizard";
import Browse from "./pages/Browse";
import Search from "./pages/Search";
import History from "./pages/History";
import Detail from "./pages/Detail";
import Player from "./pages/Player";
import Person from "./pages/Person";
import Admin from "./pages/Admin";
import Requests from "./pages/Requests";
import RequestsAdmin from "./pages/RequestsAdmin";
import Wishes from "./pages/Wishes";
import MyList from "./pages/MyList";
import News from "./pages/News";
import Statistics from "./pages/Statistics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const location = useLocation();
  const { siteName } = useSiteSettings();

  // Update page title dynamically
  useEffect(() => {
    document.title = siteName;
  }, [siteName]);
  
  const isLoginOrSetupPage = location.pathname === "/" || location.pathname === "/setup" || location.pathname === "/setup-wizard";
  const isPlayerPage = location.pathname.startsWith("/player/");

  // Render login/setup/player pages without the main layout
  if (isLoginOrSetupPage) {
    return (
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/setup-wizard" element={<SetupWizard />} />
      </Routes>
    );
  }

  // Render player fullscreen without header/sidebar
  if (isPlayerPage) {
    return (
      <Routes>
        <Route path="/player/:id" element={<Player />} />
      </Routes>
    );
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full overflow-hidden">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <Header />
          <div className="flex-1 overflow-auto">
            <Routes>
              <Route path="/browse" element={<Browse />} />
              <Route path="/movies" element={<Browse />} />
              <Route path="/series" element={<Browse />} />
              <Route path="/search" element={<Search />} />
              <Route path="/history" element={<History />} />
              <Route path="/requests" element={<Requests />} />
              <Route path="/requests-admin" element={<RequestsAdmin />} />
              <Route path="/wishes" element={<Wishes />} />
              <Route path="/my-list" element={<MyList />} />
              <Route path="/news" element={<News />} />
              <Route path="/detail/:id" element={<Detail />} />
              <Route path="/person/:personId" element={<Person />} />
              <Route path="/player/:id" element={<Player />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/statistics" element={<Statistics />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
