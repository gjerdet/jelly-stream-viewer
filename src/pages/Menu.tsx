import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Gift, Newspaper, History } from "lucide-react";

const Menu = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const menuItems = [
    {
      title: "Min liste",
      description: "Dine favoritter",
      path: "/my-list",
      icon: Heart,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    {
      title: "Ønsker",
      description: "Forespørsler og ønsker",
      path: "/wishes",
      icon: Gift,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Info & Nyheter",
      description: "Siste oppdateringer",
      path: "/news",
      icon: Newspaper,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Historikk",
      description: "Sett nylig",
      path: "/history",
      icon: History,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12">
          <p className="text-center text-muted-foreground">Laster...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Min side</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Card
                  key={item.path}
                  className="border-border/50 hover:border-primary/50 smooth-transition cursor-pointer group"
                  onClick={() => navigate(item.path)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${item.bgColor} group-hover:scale-110 smooth-transition`}>
                        <Icon className={`h-6 w-6 ${item.color}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold mb-1 group-hover:text-primary smooth-transition">
                          {item.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Menu;
