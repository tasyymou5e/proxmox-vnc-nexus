import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Upload, 
  Download, 
  FileSpreadsheet, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  XCircle 
} from "lucide-react";
import type { ProxmoxServerInput, BulkImportResult } from "@/lib/types";

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (servers: ProxmoxServerInput[]) => Promise<BulkImportResult>;
  remainingSlots: number;
}

interface ParsedServer extends ProxmoxServerInput {
  isValid: boolean;
  errors: string[];
  use_tailscale?: boolean;
  tailscale_hostname?: string;
  tailscale_port?: number;
  connection_timeout?: number;
}

export function CSVImportDialog({ 
  open, 
  onOpenChange, 
  onImport, 
  remainingSlots 
}: CSVImportDialogProps) {
  const [parsedServers, setParsedServers] = useState<ParsedServer[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setParsedServers([]);
    setFileName("");
    setImportResult(null);
    setParseError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const downloadTemplate = () => {
    const template = `name,host,port,api_token,verify_ssl,use_tailscale,tailscale_hostname,tailscale_port,connection_timeout
Production Cluster,pve1.company.com,8006,user@realm!tokenid=uuid-here,true,false,,,10
Development Server,192.168.1.100,8006,dev@pam!devtoken=uuid-here,false,true,pve.tailnet.ts.net,8006,30`;
    
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "proxmox-servers-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const validateServer = (server: Partial<ProxmoxServerInput>): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!server.name?.trim()) {
      errors.push("Name is required");
    }
    if (!server.host?.trim()) {
      errors.push("Host is required");
    }
    if (!server.api_token?.trim()) {
      errors.push("API token is required");
    } else {
      const tokenRegex = /^[\w.-]+@[\w.-]+![\w.-]+=[\w-]+$/;
      if (!tokenRegex.test(server.api_token)) {
        errors.push("Invalid token format");
      }
    }
    
    return { isValid: errors.length === 0, errors };
  };

  const parseCSV = (content: string): ParsedServer[] => {
    const lines = content.split(/\r?\n/).filter((line) => line.trim());
    
    if (lines.length < 2) {
      throw new Error("CSV must have a header row and at least one data row");
    }

    const headerLine = lines[0].toLowerCase();
    const headers = headerLine.split(",").map((h) => h.trim());
    
    // Check for required columns
    const requiredColumns = ["name", "host", "api_token"];
    const missingColumns = requiredColumns.filter((col) => !headers.includes(col));
    
    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(", ")}`);
    }

    const servers: ParsedServer[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      
      if (values.length !== headers.length) {
        continue; // Skip malformed lines
      }

      const server: Partial<ParsedServer> = {};
      
      headers.forEach((header, index) => {
        const value = values[index]?.trim();
        switch (header) {
          case "name":
            server.name = value;
            break;
          case "host":
            server.host = value;
            break;
          case "port":
            server.port = parseInt(value) || 8006;
            break;
          case "api_token":
            server.api_token = value;
            break;
          case "verify_ssl":
            server.verify_ssl = value.toLowerCase() !== "false";
            break;
          case "use_tailscale":
            server.use_tailscale = value.toLowerCase() === "true";
            break;
          case "tailscale_hostname":
            server.tailscale_hostname = value || undefined;
            break;
          case "tailscale_port":
            server.tailscale_port = parseInt(value) || 8006;
            break;
          case "connection_timeout":
            server.connection_timeout = parseInt(value) || undefined;
            break;
        }
      });

      const { isValid, errors } = validateServer(server);
      
      servers.push({
        name: server.name || "",
        host: server.host || "",
        port: server.port || 8006,
        api_token: server.api_token || "",
        verify_ssl: server.verify_ssl !== false,
        use_tailscale: server.use_tailscale || false,
        tailscale_hostname: server.tailscale_hostname,
        tailscale_port: server.tailscale_port || 8006,
        connection_timeout: server.connection_timeout,
        isValid,
        errors,
      });
    }

    return servers;
  };

  // Simple CSV line parser that handles quoted values
  const parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current);
    
    return values;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const servers = parseCSV(content);
        
        if (servers.length === 0) {
          setParseError("No valid servers found in CSV");
          setParsedServers([]);
          return;
        }

        if (servers.length > remainingSlots) {
          setParseError(`CSV contains ${servers.length} servers but only ${remainingSlots} slots remaining`);
        }

        setParsedServers(servers);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : "Failed to parse CSV");
        setParsedServers([]);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const validServers = parsedServers.filter((s) => s.isValid);
    
    if (validServers.length === 0) {
      setParseError("No valid servers to import");
      return;
    }

    setImporting(true);
    try {
      const result = await onImport(
        validServers.map(({ isValid, errors, ...server }) => ({
          name: server.name,
          host: server.host,
          port: server.port,
          api_token: server.api_token,
          verify_ssl: server.verify_ssl,
          use_tailscale: server.use_tailscale,
          tailscale_hostname: server.tailscale_hostname,
          tailscale_port: server.tailscale_port,
          connection_timeout: server.connection_timeout,
        }))
      );
      setImportResult(result);
      
      if (result.success > 0 && result.failed.length === 0) {
        // All successful - close dialog after short delay
        setTimeout(handleClose, 1500);
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const validCount = parsedServers.filter((s) => s.isValid).length;
  const invalidCount = parsedServers.length - validCount;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Proxmox Servers from CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file with your server details. Required columns: name, host, api_token.
            Optional: port, verify_ssl, use_tailscale, tailscale_hostname, tailscale_port, connection_timeout (in seconds).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File upload */}
          <div className="space-y-2">
            <Label htmlFor="csv-file">CSV File</Label>
            <div className="flex gap-2">
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="flex-1"
              />
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Template
              </Button>
            </div>
            {fileName && (
              <p className="text-sm text-muted-foreground">
                Selected: {fileName}
              </p>
            )}
          </div>

          {/* Parse error */}
          {parseError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}

          {/* Import result */}
          {importResult && (
            <Alert variant={importResult.failed.length > 0 ? "default" : "default"}>
              {importResult.failed.length > 0 ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
              <AlertDescription>
                {importResult.message}
                {importResult.failed.length > 0 && (
                  <ul className="mt-2 text-sm">
                    {importResult.failed.map((f, i) => (
                      <li key={i} className="text-destructive">
                        • {f.name}: {f.error}
                      </li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Preview table */}
          {parsedServers.length > 0 && !importResult && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Preview ({parsedServers.length} servers)</p>
                <div className="flex gap-2">
                  {validCount > 0 && (
                    <Badge variant="outline" className="text-success border-success">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {validCount} valid
                    </Badge>
                  )}
                  {invalidCount > 0 && (
                    <Badge variant="outline" className="text-destructive border-destructive">
                      <XCircle className="h-3 w-3 mr-1" />
                      {invalidCount} invalid
                    </Badge>
                  )}
                </div>
              </div>
              <ScrollArea className="h-[200px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Status</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Host</TableHead>
                      <TableHead>Port</TableHead>
                      <TableHead>Tailscale</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedServers.map((server, i) => (
                      <TableRow 
                        key={i} 
                        className={!server.isValid ? "bg-destructive/5" : ""}
                      >
                        <TableCell>
                          {server.isValid ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <span title={server.errors.join(", ")}>
                              <XCircle className="h-4 w-4 text-destructive" />
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{server.name || "-"}</TableCell>
                        <TableCell>{server.host || "-"}</TableCell>
                        <TableCell>{server.port}</TableCell>
                        <TableCell>
                          {server.use_tailscale ? (
                            <span className="text-primary text-xs">{server.tailscale_hostname || "Yes"}</span>
                          ) : (
                            <span className="text-muted-foreground">No</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}

          {/* Slot info */}
          <p className="text-xs text-muted-foreground text-center">
            {remainingSlots} server slots remaining
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={validCount === 0 || importing || !!importResult}
          >
            {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Upload className="h-4 w-4 mr-2" />
            Import {validCount > 0 ? `${validCount} Server${validCount > 1 ? "s" : ""}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}