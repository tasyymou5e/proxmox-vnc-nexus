import { ReactNode, useState, useMemo } from "react";
import { useNavigate, useLocation, useParams, Link } from "react-router-dom";
import { useAuth } from "@/components/auth";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Server,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  Settings,
  ChevronLeft,
  Building2,
  HardDrive,
  Shield,
  Layers,
  Database,
  FileText,
  Palette,
  Code2,
  BarChart3,
  Bell,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiTreeNav } from "@/components/proxmox/ApiTreeNav";
import { useTenant } from "@/hooks/useTenants";
import { useNodes } from "@/hooks/useProxmoxApi";

interface TenantLayoutProps {
  children: ReactNode;
  showApiTree?: boolean;
}

export function TenantLayout({ children, showApiTree = false }: TenantLayoutProps) {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantId } = useParams<{ tenantId: string }>();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: tenant } = useTenant(tenantId);
  const { data: nodesData, isLoading: isLoadingNodes } = useNodes(tenantId);
  
  const nodes = useMemo(() => {
    return nodesData?.data?.map((n: { node: string }) => n.node) || [];
  }, [nodesData]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const navItems = [
    { label: "Overview", href: `/tenants/${tenantId}`, icon: LayoutDashboard },
    { label: "Cluster", href: `/tenants/${tenantId}/cluster`, icon: Server },
    { label: "Nodes", href: `/tenants/${tenantId}/nodes`, icon: HardDrive },
    { label: "Access", href: `/tenants/${tenantId}/access`, icon: Shield },
    { label: "Pools", href: `/tenants/${tenantId}/pools`, icon: Layers },
    { label: "Storage", href: `/tenants/${tenantId}/storage`, icon: Database },
    { label: "API Playground", href: `/tenants/${tenantId}/api-playground`, icon: Code2 },
    { label: "Monitoring", href: `/tenants/${tenantId}/monitoring`, icon: BarChart3 },
    { label: "Notifications", href: `/tenants/${tenantId}/notifications`, icon: Bell },
    { label: "Servers", href: `/tenants/${tenantId}/servers`, icon: Settings },
    { label: "Users", href: `/tenants/${tenantId}/users`, icon: Building2 },
    { label: "Audit Log", href: `/tenants/${tenantId}/audit-log`, icon: FileText },
    { label: "Settings", href: `/tenants/${tenantId}/settings`, icon: Palette },
    { label: "Documentation", href: "/docs", icon: BookOpen },
  ];

  const isActive = (path: string) => {
    if (path === `/tenants/${tenantId}`) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const userInitials = user?.email
    ?.split("@")[0]
    .slice(0, 2)
    .toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/tenants')}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Building2 className="h-5 w-5 text-primary" />
          <span className="font-medium truncate max-w-[150px]">
            {tenant?.name || 'Loading...'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                {user?.email}
                {isAdmin && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Admin
                  </Badge>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profile")}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full bg-sidebar-background border-r z-50 transition-transform duration-200",
          "lg:translate-x-0",
          showApiTree ? "w-72" : "w-64",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="h-14 flex items-center gap-2 px-4 border-b shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigate('/tenants')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Building2 className="h-5 w-5 text-primary shrink-0" />
            <span className="font-semibold text-sidebar-foreground truncate">
              {tenant?.name || 'Loading...'}
            </span>
          </div>

          {showApiTree ? (
            // API Tree Navigation
            <div className="flex-1 min-h-0">
              <ApiTreeNav nodes={nodes} isLoadingNodes={isLoadingNodes} />
            </div>
          ) : (
            // Standard Navigation
            <>
              <nav className="flex-1 p-4 space-y-1 overflow-auto">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive(item.href)
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                ))}
              </nav>

              {/* Theme toggle */}
              <div className="px-4 py-2 border-t flex items-center justify-between shrink-0">
                <span className="text-sm text-muted-foreground">Theme</span>
                <ThemeToggle />
              </div>
            </>
          )}

          {/* User menu */}
          <div className="p-4 border-t shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-auto py-2"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium truncate">
                      {user?.email?.split("@")[0]}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user?.email}
                    </p>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  My Account
                  {isAdmin && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Admin
                    </Badge>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/tenants")}>
                  <Building2 className="h-4 w-4 mr-2" />
                  All Tenants
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <Settings className="h-4 w-4 mr-2" />
                  Profile Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className={cn(
        "pt-14 lg:pt-0 min-h-screen",
        showApiTree ? "lg:pl-72" : "lg:pl-64"
      )}>
        {children}
      </main>
    </div>
  );
}
