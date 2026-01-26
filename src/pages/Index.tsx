import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/components/auth";
import { Loader2, Server, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (user) {
        navigate("/dashboard");
      } else {
        navigate("/login");
      }
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-primary/10 rounded-full">
            <Server className="h-12 w-12 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-2 text-foreground">Proxmox VNC Nexus</h1>
        <p className="text-muted-foreground mb-6">Virtual Machine Connection Broker</p>
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary mb-6" />
        <Button variant="ghost" size="sm" asChild>
          <Link to="/docs" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Documentation
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default Index;
