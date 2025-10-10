import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import Login from "./pages/Login";
import Browse from "./pages/Browse";
import Search from "./pages/Search";
import History from "./pages/History";
import Detail from "./pages/Detail";
import Player from "./pages/Player";
import Person from "./pages/Person";
import Admin from "./pages/Admin";
import Requests from "./pages/Requests";
import Wishes from "./pages/Wishes";
import MyList from "./pages/MyList";
import News from "./pages/News";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const location = useLocation();
  const isLoginPage = location.pathname === "/";

  if (isLoginPage) {
    return (
      <Routes>
        <Route path="/" element={<Login />} />
      </Routes>
    );
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1">
          <Routes>
            <Route path="/browse" element={<Browse />} />
            <Route path="/movies" element={<Browse />} />
            <Route path="/series" element={<Browse />} />
            <Route path="/search" element={<Search />} />
            <Route path="/history" element={<History />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/wishes" element={<Wishes />} />
            <Route path="/my-list" element={<MyList />} />
            <Route path="/news" element={<News />} />
            <Route path="/detail/:id" element={<Detail />} />
            <Route path="/person/:personId" element={<Person />} />
            <Route path="/player/:id" element={<Player />} />
            <Route path="/admin" element={<Admin />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </SidebarProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
