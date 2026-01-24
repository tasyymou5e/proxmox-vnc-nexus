import { supabase } from "@/integrations/supabase/client";
import type { VM, VNCConnection } from "./types";

const SUPABASE_URL = "https://lbfabewnshfjdjfosqxl.supabase.co";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

export async function listVMs(): Promise<{ vms: VM[]; isAdmin: boolean }> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/list-vms`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch VMs");
  }

  return response.json();
}

export async function getVMConsole(
  node: string,
  vmid: number,
  vmType: "qemu" | "lxc" = "qemu"
): Promise<VNCConnection> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/vm-console`, {
    method: "POST",
    headers,
    body: JSON.stringify({ node, vmid, vmType }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get console access");
  }

  return response.json();
}

export async function performVMAction(
  node: string,
  vmid: number,
  action: "start" | "stop" | "shutdown" | "reset" | "suspend" | "resume",
  vmType: "qemu" | "lxc" = "qemu"
): Promise<{ success: boolean; message: string; upid?: string }> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/vm-actions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ node, vmid, action, vmType }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Failed to ${action} VM`);
  }

  return response.json();
}

export async function proxmoxApiCall<T>(
  path: string,
  method: string = "GET",
  body?: Record<string, unknown>
): Promise<T> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/proxmox-api`, {
    method: "POST",
    headers,
    body: JSON.stringify({ path, method, body }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Proxmox API call failed");
  }

  return response.json();
}
