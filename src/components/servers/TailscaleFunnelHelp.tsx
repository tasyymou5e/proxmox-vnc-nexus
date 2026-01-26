import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, HelpCircle, Shield, Zap, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function TailscaleFunnelHelp() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed border-primary/30 bg-primary/5">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-4 h-auto hover:bg-transparent"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <HelpCircle className="h-4 w-4" />
              Tailscale Funnel Guide
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Tailscale Funnel allows you to expose your Proxmox server securely to the 
              internet without opening firewall ports or configuring port forwarding.
            </p>

            <div className="space-y-3">
              <h4 className="text-sm font-medium">Setup Steps:</h4>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Install Tailscale on your Proxmox server</li>
                <li>
                  Enable Funnel:{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                    tailscale funnel 8006
                  </code>
                </li>
                <li>Note the public URL (e.g., pve.tail1234.ts.net)</li>
                <li>Enter the Funnel URL as the Tailscale hostname above</li>
              </ol>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="flex flex-col items-center text-center p-2 rounded-lg bg-background">
                <Shield className="h-5 w-5 text-success mb-1" />
                <span className="text-xs font-medium">No Port Forwarding</span>
              </div>
              <div className="flex flex-col items-center text-center p-2 rounded-lg bg-background">
                <Zap className="h-5 w-5 text-primary mb-1" />
                <span className="text-xs font-medium">Auto TLS</span>
              </div>
              <div className="flex flex-col items-center text-center p-2 rounded-lg bg-background">
                <Globe className="h-5 w-5 text-warning mb-1" />
                <span className="text-xs font-medium">Public Access</span>
              </div>
            </div>

            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
              <p className="text-xs text-warning-foreground">
                <strong>Note:</strong> Funnel URLs are publicly accessible. Ensure your 
                Proxmox server has proper authentication configured.
              </p>
            </div>

            <Button variant="outline" size="sm" className="w-full" asChild>
              <a
                href="https://tailscale.com/kb/1223/funnel"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Read Tailscale Funnel Docs
              </a>
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
