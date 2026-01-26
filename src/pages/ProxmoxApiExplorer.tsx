import { useParams, useLocation } from "react-router-dom";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { ApiContentPanel } from "@/components/proxmox/ApiContentPanel";
import { useProxmoxApiQuery, useProxmoxApiMutation } from "@/hooks/useProxmoxApi";
import { findEndpointByPath, getBreadcrumbsForPath } from "@/config/proxmoxApiTree";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Fragment } from "react";

interface ProxmoxApiExplorerProps {
  section: 'cluster' | 'nodes' | 'access' | 'pools' | 'storage';
}

export default function ProxmoxApiExplorer({ section }: ProxmoxApiExplorerProps) {
  const { tenantId, "*": pathRest } = useParams<{ tenantId: string; "*": string }>();
  const location = useLocation();
  
  // Build the API path from the URL
  const apiPath = `/${section}${pathRest ? `/${pathRest}` : ''}`;
  
  // Find the endpoint configuration
  const endpoint = findEndpointByPath(apiPath);
  const breadcrumbs = getBreadcrumbsForPath(apiPath);
  
  // Fetch data for this endpoint
  const { 
    data, 
    isLoading, 
    isError, 
    error, 
    refetch 
  } = useProxmoxApiQuery(apiPath, {
    tenantId,
    enabled: !!endpoint,
  });
  
  const mutation = useProxmoxApiMutation();
  
  const handleSave = (saveData: Record<string, unknown>) => {
    if (!endpoint) return;
    
    const method = endpoint.methods.includes('PUT') ? 'PUT' : 'POST';
    
    mutation.mutate({
      tenantId,
      path: apiPath,
      method,
      body: saveData,
    }, {
      onSuccess: () => refetch(),
    });
  };

  return (
    <TenantLayout showApiTree>
      <div className="p-6 h-[calc(100vh-3.5rem)] lg:h-screen flex flex-col">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href={`/tenants/${tenantId}`}>
                Dashboard
              </BreadcrumbLink>
            </BreadcrumbItem>
            {breadcrumbs.map((crumb, idx) => (
              <Fragment key={crumb.path}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {idx === breadcrumbs.length - 1 ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={`/tenants/${tenantId}${crumb.path}`}>
                      {crumb.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        
        {/* Content Panel */}
        <div className="flex-1 min-h-0">
          <ApiContentPanel
            endpoint={endpoint}
            data={data}
            isLoading={isLoading}
            isError={isError}
            error={error as Error | null}
            onRefresh={() => refetch()}
            onSave={endpoint?.isConfig ? handleSave : undefined}
            isSaving={mutation.isPending}
          />
        </div>
      </div>
    </TenantLayout>
  );
}
