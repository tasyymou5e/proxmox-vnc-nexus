import { useParams } from "react-router-dom";
import { TenantLayout } from "@/components/layout/TenantLayout";
import ProxmoxServers from "@/pages/ProxmoxServers";

// This is a wrapper to provide tenant context to the ProxmoxServers page
export default function TenantServers() {
  const { tenantId } = useParams<{ tenantId: string }>();
  
  return (
    <TenantLayout>
      <ProxmoxServers tenantId={tenantId} hideLayout />
    </TenantLayout>
  );
}
