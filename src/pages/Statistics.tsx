import { useQuery } from "@tanstack/react-query";
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
import { Clock } from "lucide-react";

type TimeFilter = '7' | '30' | '365' | 'all';

const Statistics = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: role, isLoading: isLoadingRole } = useUserRole(user?.id);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('30');

  useEffect(() => {
    const session = localStorage.getItem('jellyfin_session');
    if (!session) {
      navigate('/');
    }
  }, [navigate]);

  useEffect(() => {
    if (!isLoadingRole && role !== 'admin') {
      navigate('/browse');
    }
  }, [role, isLoadingRole, navigate]);

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
        .select('user_id, jellyfin_item_name, jellyfin_item_type, watched_at, runtime_ticks, last_position_ticks');
      
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
          episodes: 0
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
        }
      });

      return Object.entries(userMap).map(([userId, stats]: [string, any]) => ({
        userId,
        username: stats.username,
        totalHours: (stats.totalMinutes / 60).toFixed(1),
        movies: stats.movies,
        episodes: stats.episodes
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
        const type = item.jellyfin_item_type === 'Movie' ? 'Filmer' : 'Episoder';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },
    enabled: role === 'admin'
  });

  if (isLoadingRole || isLoadingMostWatched || isLoadingUserStats || isLoadingContentTypes) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold">Statistikk</h1>
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

  if (role !== 'admin') {
    return null;
  }

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))'];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Statistikk</h1>
        <Select value={timeFilter} onValueChange={(value: TimeFilter) => setTimeFilter(value)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Siste 7 dager</SelectItem>
            <SelectItem value="30">Siste 30 dager</SelectItem>
            <SelectItem value="365">Siste år</SelectItem>
            <SelectItem value="all">Alle</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">{/* User Watch Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Visningstid per Bruker
            </CardTitle>
            <CardDescription>Total sett tid i timer</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bruker</TableHead>
                  <TableHead className="text-right">Timer</TableHead>
                  <TableHead className="text-right">Filmer</TableHead>
                  <TableHead className="text-right">Episoder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userStats?.map((stat) => (
                  <TableRow key={stat.userId}>
                    <TableCell className="font-medium">{stat.username}</TableCell>
                    <TableCell className="text-right">{stat.totalHours}t</TableCell>
                    <TableCell className="text-right">{stat.movies}</TableCell>
                    <TableCell className="text-right">{stat.episodes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Content Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Innholdstype</CardTitle>
            <CardDescription>Fordeling mellom filmer og episoder</CardDescription>
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
            <CardTitle>Mest Sette Filmer & Serier</CardTitle>
            <CardDescription>Top 10 mest sette innhold</CardDescription>
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
