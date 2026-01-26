import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Simple XOR-based decryption for API tokens
export function decryptToken(encryptedToken: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = Uint8Array.from(atob(encryptedToken), c => c.charCodeAt(0));
  const decrypted = new Uint8Array(encrypted.length);
  
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return new TextDecoder().decode(decrypted);
}

export interface ProxmoxCredentials {
  host: string;
  port: string;
  token: string;
}

export async function getProxmoxCredentials(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  serverId?: string
): Promise<ProxmoxCredentials> {
  const encryptionKey = Deno.env.get("PROXMOX_ENCRYPTION_KEY");
  
  // If serverId is provided, get credentials from database
  if (serverId && encryptionKey) {
    const { data: server, error } = await supabase
      .from("proxmox_servers")
      .select("host, port, api_token_encrypted, is_active")
      .eq("id", serverId)
      .eq("user_id", userId)
      .single();
    
    if (error || !server) {
      throw new Error("Server not found or access denied");
    }
    
    if (!server.is_active) {
      throw new Error("Server is disabled");
    }
    
    return {
      host: server.host,
      port: String(server.port),
      token: decryptToken(server.api_token_encrypted, encryptionKey),
    };
  }
  
  // Fall back to environment variables
  const host = Deno.env.get("PROXMOX_HOST");
  const port = Deno.env.get("PROXMOX_PORT") || "8006";
  const token = Deno.env.get("PROXMOX_API_TOKEN");
  
  if (!host || !token) {
    throw new Error("Proxmox configuration missing");
  }
  
  return { host, port, token };
}
