import { supabase } from "@/integrations/supabase/client";
import { API_CONFIG } from "./constants";
import type { VM, VNCConnection } from "./types";

// Error types
export interface APIError {
  error: string;
  code?: string;
  status: number;
  details?: unknown;
}

export class APIException extends Error {
  code?: string;
  status: number;
  details?: unknown;

  constructor(apiError: APIError) {
    super(apiError.error);
    this.name = "APIException";
    this.code = apiError.code;
    this.status = apiError.status;
    this.details = apiError.details;
  }
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new APIException({
      error: "Not authenticated",
      status: 401,
    });
  }
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new APIException({
      error: errorBody.error || `Request failed with status ${response.status}`,
      code: errorBody.code,
      status: response.status,
      details: errorBody.details,
    });
  }
  return response.json();
}

export async function listVMs(serverId?: string): Promise<{ 
  vms: VM[]; 
  isAdmin: boolean;
  servers: { id: string; name: string }[];
}> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_CONFIG.SUPABASE_URL}${API_CONFIG.FUNCTIONS_PATH}/list-vms`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ serverId }),
    }
  );

  return handleResponse(response);
}

export async function getVMConsole(
  node: string,
  vmid: number,
  vmType: "qemu" | "lxc" = "qemu"
): Promise<VNCConnection> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_CONFIG.SUPABASE_URL}${API_CONFIG.FUNCTIONS_PATH}/vm-console`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ node, vmid, vmType }),
    }
  );

  const data = await handleResponse<VNCConnection>(response);

  // Build relay URL without JWT (JWT passed via WebSocket sub-protocol for security)
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const jwt = session?.access_token;

  const relayUrl = `wss://${API_CONFIG.SUPABASE_URL.replace("https://", "")}${API_CONFIG.FUNCTIONS_PATH}/vnc-relay?node=${node}&vmid=${vmid}&type=${vmType}`;

  return {
    ...data,
    relayUrl,
    wsAuthToken: jwt || undefined,
  };
}

export async function performVMAction(
  node: string,
  vmid: number,
  action: "start" | "stop" | "shutdown" | "reset" | "suspend" | "resume",
  vmType: "qemu" | "lxc" = "qemu"
): Promise<{ success: boolean; message: string; upid?: string }> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_CONFIG.SUPABASE_URL}${API_CONFIG.FUNCTIONS_PATH}/vm-actions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ node, vmid, action, vmType }),
    }
  );

  return handleResponse(response);
}

export async function proxmoxApiCall<T>(
  path: string,
  method: string = "GET",
  body?: Record<string, unknown>
): Promise<T> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_CONFIG.SUPABASE_URL}${API_CONFIG.FUNCTIONS_PATH}/proxmox-api`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ path, method, body }),
    }
  );

  return handleResponse(response);
}
