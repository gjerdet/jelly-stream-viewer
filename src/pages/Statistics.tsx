import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Statistics = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const session = localStorage.getItem('jellyfin_session');
    if (!session) {
      navigate('/');
    }
  }, [navigate]);

  // Fetch most watched items
  const { data: mostWatched, isLoading: isLoadingMostWatched } = useQuery({
    queryKey: ['most-watched'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('watch_history')
        .select('jellyfin_item_id, jellyfin_item_name, jellyfin_item_type, image_url')
        .order('watched_at', { ascending: false });

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
    }
  });

  // Fetch user watch stats
  const { data: userStats, isLoading: isLoadingUserStats } = useQuery({
    queryKey: ['user-watch-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('watch_history')
        .select('user_id, jellyfin_item_name, watched_at')
        .order('watched_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get user profiles
      const userIds = [...new Set(data.map(item => item.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, jellyfin_username')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Map user_id to username
      const userMap = profiles.reduce((acc: any, profile) => {
        acc[profile.id] = profile.jellyfin_username || 'Unknown';
        return acc;
      }, {});

      return data.map(item => ({
        ...item,
        username: userMap[item.user_id] || 'Unknown'
      }));
    }
  });

  if (isLoadingMostWatched || isLoadingUserStats) {
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Statistikk</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
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

        {/* Recent User Activity */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Nylig Aktivitet</CardTitle>
            <CardDescription>Siste 50 visninger</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bruker</TableHead>
                  <TableHead>Tittel</TableHead>
                  <TableHead>Tidspunkt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userStats?.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.username}</TableCell>
                    <TableCell>{item.jellyfin_item_name}</TableCell>
                    <TableCell>{new Date(item.watched_at).toLocaleString('nb-NO')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Statistics;
