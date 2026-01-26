import { useState } from "react";
import { RefreshCw, Save, X, Eye, Code, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import type { ApiEndpoint } from "@/lib/types";

interface ApiContentPanelProps {
  endpoint: ApiEndpoint | null;
  data: unknown;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  onRefresh: () => void;
  onSave?: (data: Record<string, unknown>) => void;
  isSaving?: boolean;
}

export function ApiContentPanel({
  endpoint,
  data,
  isLoading,
  isError,
  error,
  onRefresh,
  onSave,
  isSaving,
}: ApiContentPanelProps) {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, unknown>>({});

  if (!endpoint) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center text-muted-foreground">
          <p>Select an endpoint from the tree menu</p>
        </CardContent>
      </Card>
    );
  }

  const handleStartEdit = () => {
    setEditData(typeof data === 'object' && data !== null ? { ...data as object } : {});
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditData({});
  };

  const handleSave = () => {
    if (onSave) {
      onSave(editData);
      setIsEditing(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${endpoint.path.replace(/\//g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Data exported successfully" });
  };

  const renderTableView = (tableData: unknown) => {
    if (!tableData) return null;

    // Handle array data
    if (Array.isArray(tableData)) {
      if (tableData.length === 0) {
        return <p className="text-muted-foreground">No data available</p>;
      }

      const columns = Object.keys(tableData[0] || {});
      
      return (
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(col => (
                <TableHead key={col} className="capitalize">
                  {col.replace(/_/g, ' ')}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableData.map((row, idx) => (
              <TableRow key={idx}>
                {columns.map(col => (
                  <TableCell key={col}>
                    {typeof row[col] === 'object' 
                      ? JSON.stringify(row[col]) 
                      : String(row[col] ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    // Handle object data
    if (typeof tableData === 'object' && tableData !== null) {
      const entries = Object.entries(tableData);
      
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Property</TableHead>
              <TableHead>Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(([key, value]) => (
              <TableRow key={key}>
                <TableCell className="font-medium capitalize">
                  {key.replace(/_/g, ' ')}
                </TableCell>
                <TableCell>
                  {typeof value === 'object' 
                    ? JSON.stringify(value, null, 2) 
                    : String(value ?? '')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    return <p>{String(tableData)}</p>;
  };

  const renderEditForm = () => {
    if (!data || typeof data !== 'object') return null;

    const fields = Object.entries(data as Record<string, unknown>);

    return (
      <div className="space-y-4">
        {fields.map(([key, value]) => (
          <div key={key} className="space-y-2">
            <Label htmlFor={key} className="capitalize">
              {key.replace(/_/g, ' ')}
            </Label>
            
            {typeof value === 'boolean' ? (
              <Switch
                id={key}
                checked={editData[key] as boolean ?? value}
                onCheckedChange={(checked) => 
                  setEditData(prev => ({ ...prev, [key]: checked }))
                }
              />
            ) : typeof value === 'number' ? (
              <Input
                id={key}
                type="number"
                value={editData[key] as number ?? value}
                onChange={(e) => 
                  setEditData(prev => ({ ...prev, [key]: Number(e.target.value) }))
                }
              />
            ) : typeof value === 'object' ? (
              <Textarea
                id={key}
                value={JSON.stringify(editData[key] ?? value, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setEditData(prev => ({ ...prev, [key]: parsed }));
                  } catch {
                    // Invalid JSON, keep as string
                  }
                }}
                rows={4}
              />
            ) : (
              <Input
                id={key}
                value={String(editData[key] ?? value ?? '')}
                onChange={(e) => 
                  setEditData(prev => ({ ...prev, [key]: e.target.value }))
                }
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  // Extract actual data from Proxmox response
  const responseData = (data as { data?: unknown })?.data ?? data;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {endpoint.label}
              <Badge variant={endpoint.isConfig ? "default" : "secondary"}>
                {endpoint.isConfig ? "Configurable" : "Read-only"}
              </Badge>
            </CardTitle>
            <CardDescription className="mt-1">
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                {endpoint.path}
              </code>
              {endpoint.description && (
                <span className="ml-2">{endpoint.description}</span>
              )}
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            {!isEditing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={!data}
                >
                  <Download className="h-4 w-4" />
                </Button>
                
                {endpoint.isConfig && endpoint.methods.some(m => m !== 'GET') && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleStartEdit}
                    disabled={!data}
                  >
                    Edit
                  </Button>
                )}
              </>
            )}
            
            {isEditing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEdit}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save
                </Button>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 mt-2">
          {endpoint.methods.map(method => (
            <Badge
              key={method}
              variant="outline"
              className={
                method === 'GET' ? 'border-green-500 text-green-600' :
                method === 'POST' ? 'border-blue-500 text-blue-600' :
                method === 'PUT' ? 'border-yellow-500 text-yellow-600' :
                'border-red-500 text-red-600'
              }
            >
              {method}
            </Badge>
          ))}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 min-h-0">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        
        {isError && (
          <div className="text-center text-destructive py-8">
            <p>Error loading data</p>
            <p className="text-sm text-muted-foreground mt-1">
              {error?.message}
            </p>
          </div>
        )}
        
        {!isLoading && !isError && (
          isEditing ? (
            <ScrollArea className="h-full">
              {renderEditForm()}
            </ScrollArea>
          ) : (
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'table' | 'json')}>
              <TabsList className="mb-4">
                <TabsTrigger value="table">
                  <Eye className="h-4 w-4 mr-1" />
                  Table
                </TabsTrigger>
                <TabsTrigger value="json">
                  <Code className="h-4 w-4 mr-1" />
                  JSON
                </TabsTrigger>
              </TabsList>
              
              <ScrollArea className="h-[calc(100%-60px)]">
                <TabsContent value="table" className="mt-0">
                  {renderTableView(responseData)}
                </TabsContent>
                
                <TabsContent value="json" className="mt-0">
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto">
                    {JSON.stringify(responseData, null, 2)}
                  </pre>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          )
        )}
      </CardContent>
    </Card>
  );
}
