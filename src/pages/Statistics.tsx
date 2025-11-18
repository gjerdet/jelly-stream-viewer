import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Clock, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

type TimeFilter = '7' | '30' | '365' | 'all';

const Statistics = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: role, isLoading: isLoadingRole } = useUserRole(user?.id);
  const { t } = useLanguage();
  const statistics = t.statistics as any;
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('30');
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  const syncHistory = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-jellyfin-history');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(statistics.synced.replace('{count}', data.totalSynced));
      queryClient.invalidateQueries({ queryKey: ['most-watched'] });
      queryClient.invalidateQueries({ queryKey: ['user-watch-stats'] });
      queryClient.invalidateQueries({ queryKey: ['content-types'] });
    },
    onError: (error) => {
      console.error('Sync error:', error);
      toast.error(statistics.couldNotSync);
    }
  });

  useEffect(() => {
    const session = localStorage.getItem('jellyfin_session');
    if (!session) {
      navigate('/');
      return;
    }

    // Only redirect if role is loaded AND user is not admin
    if (!isLoadingRole && role && role !== 'admin') {
      navigate('/browse');
    }
  }, [navigate, role, isLoadingRole]);

  const getDateFilter = (filter: TimeFilter) => {
    if (filter === 'all') return null;
    const date = new Date();
    date.setDate(date.getDate() - parseInt(filter));
    return date.toISOString();
  };

  // Fetch most watched items
  const { data: mostWatched, isLoading: isLoadingMostWatched } = useQuery({
    queryKey: ['most-watched', timeFilter],
    queryFn: async () => {
      const dateFilter = getDateFilter(timeFilter);
      let query = supabase
        .from('watch_history')
        .select('jellyfin_item_id, jellyfin_item_name, jellyfin_item_type, image_url');
      
      if (dateFilter) {
        query = query.gte('watched_at', dateFilter);
      }
      
      const { data, error } = await query.order('watched_at', { ascending: false });

      if (error) throw error;

      // Count occurrences of each item
      const itemCounts = data.reduce((acc: any, item) => {
        const key = item.jellyfin_item_id;
        if (!acc[key]) {
          acc[key] = {
            id: item.jellyfin_item_id,
            name: item.jellyfin_item_name,
            type: item.jellyfin_item_type,
            image_url: item.image_url,
            count: 0
          };
        }
        acc[key].count++;
        return acc;
      }, {});

      return Object.values(itemCounts)
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 10);
    },
    enabled: role === 'admin'
  });

  // Fetch user watch stats with watch time
  const { data: userStats, isLoading: isLoadingUserStats } = useQuery({
    queryKey: ['user-watch-stats', timeFilter],
    queryFn: async () => {
      const dateFilter = getDateFilter(timeFilter);
      let query = supabase
        .from('watch_history')
        .select('user_id, jellyfin_item_name, jellyfin_item_type, jellyfin_item_id, watched_at, runtime_ticks, last_position_ticks, jellyfin_series_name');
      
      if (dateFilter) {
        query = query.gte('watched_at', dateFilter);
      }
      
      const { data, error } = await query.order('watched_at', { ascending: false });

      if (error) throw error;

      // Get user profiles
      const userIds = [...new Set(data.map(item => item.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, jellyfin_username')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Map user_id to username and calculate watch time per user
      const userMap = profiles.reduce((acc: any, profile) => {
        acc[profile.id] = {
          username: profile.jellyfin_username || 'Unknown',
          totalMinutes: 0,
          movies: 0,
          episodes: 0,
          watchHistory: []
        };
        return acc;
      }, {});

      data.forEach(item => {
        if (userMap[item.user_id]) {
          // Calculate watch time in minutes (ticks are in 100-nanosecond intervals)
          const watchedTicks = item.last_position_ticks || item.runtime_ticks || 0;
          const minutes = watchedTicks / 600000000; // Convert ticks to minutes
          userMap[item.user_id].totalMinutes += minutes;
          
          if (item.jellyfin_item_type === 'Movie') {
            userMap[item.user_id].movies++;
          } else if (item.jellyfin_item_type === 'Episode') {
            userMap[item.user_id].episodes++;
          }

          // Add to watch history
          userMap[item.user_id].watchHistory.push({
            itemId: item.jellyfin_item_id,
            itemName: item.jellyfin_item_name,
            itemType: item.jellyfin_item_type,
            seriesName: item.jellyfin_series_name,
            watchedAt: item.watched_at
          });
        }
      });

      return Object.entries(userMap).map(([userId, stats]: [string, any]) => ({
        userId,
        username: stats.username,
        totalHours: (stats.totalMinutes / 60).toFixed(1),
        movies: stats.movies,
        episodes: stats.episodes,
        watchHistory: stats.watchHistory
      })).sort((a, b) => parseFloat(b.totalHours) - parseFloat(a.totalHours));
    },
    enabled: role === 'admin'
  });

  // Fetch content type distribution
  const { data: contentTypes, isLoading: isLoadingContentTypes } = useQuery({
    queryKey: ['content-types', timeFilter],
    queryFn: async () => {
      const dateFilter = getDateFilter(timeFilter);
      let query = supabase
        .from('watch_history')
        .select('jellyfin_item_type');
      
      if (dateFilter) {
        query = query.gte('watched_at', dateFilter);
      }
      
      const { data, error } = await query;

      if (error) throw error;

      const counts = data.reduce((acc: any, item) => {
        const type = item.jellyfin_item_type === 'Movie' ? statistics.movies : statistics.episodes;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },
    enabled: role === 'admin'
  });

  // Show loading only if we're still checking role or loading data
  if (isLoadingRole) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold">{statistics.title}</h1>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // If not admin, return null (redirect happens in useEffect)
  if (role !== 'admin') {
    return null;
  }

  // If admin but data is loading, show loading state
  if (isLoadingMostWatched || isLoadingUserStats || isLoadingContentTypes) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold">{statistics.title}</h1>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))'];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{statistics.title}</h1>
        <div className="flex gap-2">
          <Button
            onClick={() => syncHistory.mutate()}
            disabled={syncHistory.isPending}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncHistory.isPending ? 'animate-spin' : ''}`} />
            {statistics.syncFromJellyfin}
          </Button>
          <Select value={timeFilter} onValueChange={(value: TimeFilter) => setTimeFilter(value)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{statistics.last7Days}</SelectItem>
              <SelectItem value="30">{statistics.last30Days}</SelectItem>
              <SelectItem value="365">{statistics.lastYear}</SelectItem>
              <SelectItem value="all">{statistics.all}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* User Watch Time with Details */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {statistics.watchTimePerUser}
            </CardTitle>
            <CardDescription>{statistics.watchTimeDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {userStats?.map((stat) => (
                <Collapsible 
                  key={stat.userId}
                  open={expandedUsers.has(stat.userId)}
                  onOpenChange={(open) => {
                    const newExpanded = new Set(expandedUsers);
                    if (open) {
                      newExpanded.add(stat.userId);
                    } else {
                      newExpanded.delete(stat.userId);
                    }
                    setExpandedUsers(newExpanded);
                  }}
                >
                  <div className="border rounded-lg">
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between p-4 hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex items-center gap-2">
                            {expandedUsers.has(stat.userId) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <span className="font-medium">{stat.username}</span>
                          </div>
                          <div className="flex gap-6 text-sm text-muted-foreground">
                            <span>{stat.totalHours}{statistics.hours}</span>
                            <span>{stat.movies} {statistics.movies}</span>
                            <span>{stat.episodes} {statistics.episodes}</span>
                          </div>
                        </div>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 pt-2 border-t">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{statistics.type}</TableHead>
                              <TableHead>{statistics.itemTitle}</TableHead>
                              <TableHead>{statistics.watched}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(stat.watchHistory || []).map((item: any, idx: number) => (
                              <TableRow key={`${item.itemId}-${idx}`}>
                                <TableCell className="font-medium">
                                  {item.itemType === 'Movie' ? '🎬' : '📺'}
                                </TableCell>
                                <TableCell>
                                  {item.itemType === 'Episode' && item.seriesName ? (
                                    <div>
                                      <div className="font-medium">{item.seriesName}</div>
                                      <div className="text-sm text-muted-foreground">{item.itemName}</div>
                                    </div>
                                  ) : (
                                    item.itemName
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {new Date(item.watchedAt).toLocaleString('nb-NO', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Content Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>{statistics.contentType}</CardTitle>
            <CardDescription>{statistics.contentTypeDesc}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={contentTypes}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="hsl(var(--primary))"
                  dataKey="value"
                >
                  {contentTypes?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Most Watched Chart */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{statistics.mostWatched}</CardTitle>
            <CardDescription>{statistics.mostWatchedDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mostWatched}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={120}
                  tick={{ fontSize: 12 }}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Statistics;
