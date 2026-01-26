import { useState, useMemo } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { ChevronRight, ChevronDown, Wrench, Eye, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PROXMOX_API_TREE, NODE_ENDPOINTS } from "@/config/proxmoxApiTree";
import type { ApiEndpoint } from "@/lib/types";

interface ApiTreeNavProps {
  nodes?: string[];
  isLoadingNodes?: boolean;
}

interface TreeItemProps {
  endpoint: ApiEndpoint;
  level: number;
  basePath: string;
  nodes?: string[];
}

function TreeItem({ endpoint, level, basePath, nodes }: TreeItemProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  
  const fullPath = `${basePath}${endpoint.path}`;
  const isActive = location.pathname === fullPath || location.pathname.startsWith(fullPath + '/');
  
  // For /nodes, dynamically create children from actual nodes
  const children = useMemo(() => {
    if (endpoint.path === '/nodes' && nodes && nodes.length > 0) {
      return nodes.map(nodeName => ({
        path: `/nodes/${nodeName}`,
        label: nodeName,
        methods: ['GET'] as const,
        isConfig: false,
        children: NODE_ENDPOINTS.map(e => ({
          ...e,
          path: `/nodes/${nodeName}${e.path}`,
        })),
      }));
    }
    return endpoint.children;
  }, [endpoint, nodes]);
  
  const hasChildren = children && children.length > 0;
  
  const handleClick = () => {
    if (hasChildren) {
      setIsOpen(!isOpen);
    }
    navigate(fullPath);
  };
  
  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors",
          "hover:bg-sidebar-accent/50",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
          !isActive && "text-sidebar-foreground"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {hasChildren ? (
          isOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )
        ) : (
          <span className="w-4" />
        )}
        
        {endpoint.isConfig ? (
          <Wrench className="h-3.5 w-3.5 shrink-0 text-primary" />
        ) : (
          <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        
        <span className="truncate">{endpoint.label}</span>
      </button>
      
      {hasChildren && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleContent>
            {children!.map((child) => (
              <TreeItem
                key={child.path}
                endpoint={child}
                level={level + 1}
                basePath={basePath}
                nodes={nodes}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export function ApiTreeNav({ nodes, isLoadingNodes }: ApiTreeNavProps) {
  const { tenantId } = useParams();
  const [searchQuery, setSearchQuery] = useState("");
  
  const basePath = `/tenants/${tenantId}`;
  
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return PROXMOX_API_TREE;
    
    const query = searchQuery.toLowerCase();
    
    function filterEndpoints(endpoints: ApiEndpoint[]): ApiEndpoint[] {
      return endpoints.reduce<ApiEndpoint[]>((acc, endpoint) => {
        const matchesLabel = endpoint.label.toLowerCase().includes(query);
        const matchesPath = endpoint.path.toLowerCase().includes(query);
        const filteredChildren = endpoint.children 
          ? filterEndpoints(endpoint.children) 
          : undefined;
        
        if (matchesLabel || matchesPath || (filteredChildren && filteredChildren.length > 0)) {
          acc.push({
            ...endpoint,
            children: filteredChildren,
          });
        }
        
        return acc;
      }, []);
    }
    
    return filterEndpoints(PROXMOX_API_TREE);
  }, [searchQuery]);
  
  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search API..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {isLoadingNodes && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          
          {filteredTree.map((endpoint) => (
            <TreeItem
              key={endpoint.path}
              endpoint={endpoint}
              level={0}
              basePath={basePath}
              nodes={nodes}
            />
          ))}
          
          {filteredTree.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No endpoints found
            </p>
          )}
        </div>
      </ScrollArea>
      
      <div className="p-2 border-t text-xs text-muted-foreground">
        <div className="flex items-center gap-2 mb-1">
          <Wrench className="h-3 w-3 text-primary" />
          <span>Configurable</span>
        </div>
        <div className="flex items-center gap-2">
          <Eye className="h-3 w-3" />
          <span>View only</span>
        </div>
      </div>
    </div>
  );
}
