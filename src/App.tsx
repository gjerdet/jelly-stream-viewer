import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Browse from "./pages/Browse";
import Search from "./pages/Search";
import History from "./pages/History";
import Detail from "./pages/Detail";
import Player from "./pages/Player";
import Admin from "./pages/Admin";
import Requests from "./pages/Requests";
import Wishes from "./pages/Wishes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/movies" element={<Browse />} />
          <Route path="/series" element={<Browse />} />
          <Route path="/search" element={<Search />} />
          <Route path="/history" element={<History />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/wishes" element={<Wishes />} />
          <Route path="/detail/:id" element={<Detail />} />
          <Route path="/player/:id" element={<Player />} />
          <Route path="/admin" element={<Admin />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
