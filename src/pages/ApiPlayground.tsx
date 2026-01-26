import { useState } from "react";
import { useParams } from "react-router-dom";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Play, 
  Copy, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Code2,
  FileJson,
  History,
  Trash2,
  BookOpen
} from "lucide-react";
import { PROXMOX_API_TREE, NODE_ENDPOINTS } from "@/config/proxmoxApiTree";

interface RequestHistoryItem {
  id: string;
  method: string;
  path: string;
  status: number;
  duration: number;
  timestamp: Date;
  response?: unknown;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE"] as const;
type HttpMethod = typeof HTTP_METHODS[number];

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  POST: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  PUT: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  DELETE: "bg-red-500/10 text-red-500 border-red-500/20",
};

// Common API endpoints for quick access
const COMMON_ENDPOINTS = [
  { path: "/version", method: "GET", description: "API Version" },
  { path: "/cluster/status", method: "GET", description: "Cluster Status" },
  { path: "/cluster/resources", method: "GET", description: "All Resources" },
  { path: "/nodes", method: "GET", description: "List Nodes" },
  { path: "/access/users", method: "GET", description: "List Users" },
  { path: "/storage", method: "GET", description: "Storage List" },
  { path: "/pools", method: "GET", description: "Resource Pools" },
];

export default function ApiPlayground() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { toast } = useToast();
  
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [path, setPath] = useState("/version");
  const [requestBody, setRequestBody] = useState("");
  const [response, setResponse] = useState<unknown>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseDuration, setResponseDuration] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<RequestHistoryItem[]>([]);

  const executeRequest = async () => {
    setIsLoading(true);
    setResponse(null);
    setResponseStatus(null);
    setResponseDuration(null);

    const startTime = performance.now();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      let body: Record<string, unknown> | undefined;
      if (requestBody.trim() && method !== "GET") {
        try {
          body = JSON.parse(requestBody);
        } catch {
          throw new Error("Invalid JSON in request body");
        }
      }

      const result = await supabase.functions.invoke("proxmox-api", {
        body: {
          path,
          method,
          body,
          tenantId,
        },
      });

      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      if (result.error) {
        throw result.error;
      }

      const status = result.data?.errors ? 400 : 200;
      setResponse(result.data);
      setResponseStatus(status);
      setResponseDuration(duration);

      // Add to history
      const historyItem: RequestHistoryItem = {
        id: crypto.randomUUID(),
        method,
        path,
        status,
        duration,
        timestamp: new Date(),
        response: result.data,
      };
      setHistory(prev => [historyItem, ...prev.slice(0, 49)]);

      toast({
        title: "Request completed",
        description: `${method} ${path} - ${duration}ms`,
      });
    } catch (error) {
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setResponse({ error: errorMessage });
      setResponseStatus(500);
      setResponseDuration(duration);

      toast({
        title: "Request failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyResponse = () => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response, null, 2));
      toast({ title: "Copied to clipboard" });
    }
  };

  const loadFromHistory = (item: RequestHistoryItem) => {
    setMethod(item.method as HttpMethod);
    setPath(item.path);
    setResponse(item.response);
    setResponseStatus(item.status);
    setResponseDuration(item.duration);
  };

  const clearHistory = () => {
    setHistory([]);
    toast({ title: "History cleared" });
  };

  const loadEndpoint = (endpoint: { path: string; method: string }) => {
    setPath(endpoint.path);
    setMethod(endpoint.method as HttpMethod);
    setRequestBody("");
  };

  // Flatten API tree for autocomplete
  const flattenEndpoints = (endpoints: typeof PROXMOX_API_TREE, prefix = ""): string[] => {
    const result: string[] = [];
    for (const ep of endpoints) {
      result.push(ep.path);
      if (ep.children) {
        result.push(...flattenEndpoints(ep.children));
      }
    }
    return result;
  };

  const allEndpoints = [
    ...flattenEndpoints(PROXMOX_API_TREE),
    ...NODE_ENDPOINTS.map(ep => `/nodes/{node}${ep.path}`),
  ];

  return (
    <TenantLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Code2 className="h-6 w-6" />
              API Playground
            </h1>
            <p className="text-muted-foreground">
              Test Proxmox API endpoints directly from your browser
            </p>
          </div>
          <Button variant="outline" asChild>
            <a 
              href="https://pve.proxmox.com/pve-docs/api-viewer/index.html" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <BookOpen className="h-4 w-4" />
              API Docs
            </a>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Request Panel */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Request</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Method & Path */}
                <div className="flex gap-2">
                  <Select value={method} onValueChange={(v) => setMethod(v as HttpMethod)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border border-border">
                      {HTTP_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          <span className={`font-mono font-semibold ${METHOD_COLORS[m].split(' ')[1]}`}>
                            {m}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex-1 relative">
                    <Input
                      value={path}
                      onChange={(e) => setPath(e.target.value)}
                      placeholder="/api/endpoint"
                      className="font-mono"
                      list="endpoint-suggestions"
                    />
                    <datalist id="endpoint-suggestions">
                      {allEndpoints.map((ep) => (
                        <option key={ep} value={ep} />
                      ))}
                    </datalist>
                  </div>
                  <Button 
                    onClick={executeRequest} 
                    disabled={isLoading || !path}
                    className="min-w-[100px]"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Send
                      </>
                    )}
                  </Button>
                </div>

                {/* Quick Endpoints */}
                <div className="flex flex-wrap gap-2">
                  {COMMON_ENDPOINTS.map((ep) => (
                    <Button
                      key={ep.path}
                      variant="outline"
                      size="sm"
                      onClick={() => loadEndpoint(ep)}
                      className="text-xs"
                    >
                      <Badge 
                        variant="outline" 
                        className={`mr-2 ${METHOD_COLORS[ep.method as HttpMethod]}`}
                      >
                        {ep.method}
                      </Badge>
                      {ep.description}
                    </Button>
                  ))}
                </div>

                {/* Request Body */}
                {method !== "GET" && (
                  <div className="space-y-2">
                    <Label>Request Body (JSON)</Label>
                    <Textarea
                      value={requestBody}
                      onChange={(e) => setRequestBody(e.target.value)}
                      placeholder='{"key": "value"}'
                      className="font-mono min-h-[120px]"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Response Panel */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileJson className="h-5 w-5" />
                    Response
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    {responseStatus !== null && (
                      <Badge 
                        variant="outline"
                        className={responseStatus < 400 
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                          : "bg-red-500/10 text-red-500 border-red-500/20"
                        }
                      >
                        {responseStatus < 400 ? (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        ) : (
                          <XCircle className="h-3 w-3 mr-1" />
                        )}
                        {responseStatus}
                      </Badge>
                    )}
                    {responseDuration !== null && (
                      <Badge variant="secondary" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {responseDuration}ms
                      </Badge>
                    )}
                    {response && (
                      <Button variant="ghost" size="sm" onClick={copyResponse}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] rounded-md border bg-muted/30">
                  <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words">
                    {response 
                      ? JSON.stringify(response, null, 2) 
                      : <span className="text-muted-foreground">Response will appear here...</span>
                    }
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* History */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="h-5 w-5" />
                    History
                  </CardTitle>
                  {history.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearHistory}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <CardDescription>Recent requests</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No requests yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {history.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => loadFromHistory(item)}
                          className="w-full p-2 text-left rounded-md hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${METHOD_COLORS[item.method as HttpMethod]}`}
                            >
                              {item.method}
                            </Badge>
                            <span className="font-mono text-xs truncate flex-1">
                              {item.path}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span className={item.status < 400 ? "text-emerald-500" : "text-red-500"}>
                              {item.status}
                            </span>
                            <span>•</span>
                            <span>{item.duration}ms</span>
                            <span>•</span>
                            <span>{item.timestamp.toLocaleTimeString()}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* API Reference */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">API Reference</CardTitle>
                <CardDescription>Browse available endpoints</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="cluster" className="w-full">
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="cluster">Cluster</TabsTrigger>
                    <TabsTrigger value="nodes">Nodes</TabsTrigger>
                    <TabsTrigger value="access">Access</TabsTrigger>
                  </TabsList>
                  <TabsContent value="cluster" className="mt-2">
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-1">
                        {PROXMOX_API_TREE.find(e => e.path === '/cluster')?.children?.map((ep) => (
                          <button
                            key={ep.path}
                            onClick={() => loadEndpoint({ path: ep.path, method: ep.methods[0] })}
                            className="w-full p-2 text-left rounded-md hover:bg-muted transition-colors text-sm"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs">{ep.path}</span>
                              <div className="flex gap-1">
                                {ep.methods.map((m) => (
                                  <Badge 
                                    key={m} 
                                    variant="outline" 
                                    className={`text-[10px] px-1 ${METHOD_COLORS[m as HttpMethod]}`}
                                  >
                                    {m}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value="nodes" className="mt-2">
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-1">
                        {NODE_ENDPOINTS.slice(0, 10).map((ep) => (
                          <button
                            key={ep.path}
                            onClick={() => loadEndpoint({ path: `/nodes/{node}${ep.path}`, method: ep.methods[0] })}
                            className="w-full p-2 text-left rounded-md hover:bg-muted transition-colors text-sm"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs">/nodes/&#123;node&#125;{ep.path}</span>
                              <div className="flex gap-1">
                                {ep.methods.map((m) => (
                                  <Badge 
                                    key={m} 
                                    variant="outline" 
                                    className={`text-[10px] px-1 ${METHOD_COLORS[m as HttpMethod]}`}
                                  >
                                    {m}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value="access" className="mt-2">
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-1">
                        {PROXMOX_API_TREE.find(e => e.path === '/access')?.children?.map((ep) => (
                          <button
                            key={ep.path}
                            onClick={() => loadEndpoint({ path: ep.path, method: ep.methods[0] })}
                            className="w-full p-2 text-left rounded-md hover:bg-muted transition-colors text-sm"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs">{ep.path}</span>
                              <div className="flex gap-1">
                                {ep.methods.map((m) => (
                                  <Badge 
                                    key={m} 
                                    variant="outline" 
                                    className={`text-[10px] px-1 ${METHOD_COLORS[m as HttpMethod]}`}
                                  >
                                    {m}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TenantLayout>
  );
}
