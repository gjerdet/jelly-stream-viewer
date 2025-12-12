import { Heart, Gift, Newspaper, History, MessageSquare, BarChart3 } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user } = useAuth();
  const { data: role } = useUserRole(user?.id);
  const { t } = useLanguage();
  const sidebar = t.sidebar as any;

  const items = [
    { title: sidebar.myList || "My List", url: "/my-list", icon: Heart },
    { title: sidebar.wishes || "Wishes", url: "/wishes", icon: Gift },
    { title: sidebar.info || "Info", url: "/news", icon: Newspaper },
    { title: sidebar.history || "History", url: "/history", icon: History },
  ];

  // Fetch pending requests count for admins
  const { data: pendingCount } = useQuery({
    queryKey: ['pending-requests-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('jellyseerr_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      return count || 0;
    },
    enabled: !!user && role === 'admin',
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { setOpen } = useSidebar();

  const handleNavClick = () => {
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 768) {
      setOpen(false);
    }
  };

  return (
    <Sidebar 
      collapsible="icon" 
      className="border-r border-border/50 group/sidebar md:hover:w-64 transition-all duration-300"
    >
      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={collapsed ? item.title : undefined}>
                      <NavLink
                        to={item.url}
                        onClick={handleNavClick}
                        className={({ isActive }) =>
                          `flex items-center gap-3 min-h-[44px] ${
                            isActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "hover:bg-accent"
                          }`
                        }
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        <span className="opacity-100 md:opacity-0 md:group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap text-sm">
                          {item.title}
                        </span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {role === 'admin' && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip={collapsed ? (sidebar.requests || "Requests") : undefined}>
                      <NavLink
                        to="/requests-admin"
                        onClick={handleNavClick}
                        className={({ isActive }) =>
                          `flex items-center gap-3 min-h-[44px] ${
                            isActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "hover:bg-accent"
                          }`
                        }
                      >
                        <MessageSquare className="h-5 w-5 flex-shrink-0" />
                        <span className="opacity-100 md:opacity-0 md:group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap flex items-center gap-2 text-sm">
                          {sidebar.requests || "Requests"}
                          {pendingCount && pendingCount > 0 && (
                            <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs">
                              {pendingCount}
                            </Badge>
                          )}
                        </span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip={collapsed ? (sidebar.statistics || "Statistics") : undefined}>
                      <NavLink
                        to="/statistics"
                        onClick={handleNavClick}
                        className={({ isActive }) =>
                          `flex items-center gap-3 min-h-[44px] ${
                            isActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "hover:bg-accent"
                          }`
                        }
                      >
                        <BarChart3 className="h-5 w-5 flex-shrink-0" />
                        <span className="opacity-100 md:opacity-0 md:group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap text-sm">
                          {sidebar.statistics || "Statistics"}
                        </span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
