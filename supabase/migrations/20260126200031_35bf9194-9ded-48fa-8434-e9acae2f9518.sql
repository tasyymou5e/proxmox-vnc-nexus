-- Create the tenant-logos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-logos',
  'tenant-logos',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
);

-- RLS Policy: Users can view logos for their tenants (public bucket allows viewing)
CREATE POLICY "Users can view tenant logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'tenant-logos');

-- RLS Policy: Tenant admins can upload logos
CREATE POLICY "Tenant admins can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'tenant-logos' AND
  auth.uid() IS NOT NULL AND
  (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_tenant_role(auth.uid(), (storage.foldername(name))[1]::uuid, ARRAY['admin']::tenant_role[])
  )
);

-- RLS Policy: Tenant admins can update logos
CREATE POLICY "Tenant admins can update logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'tenant-logos' AND
  auth.uid() IS NOT NULL AND
  (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_tenant_role(auth.uid(), (storage.foldername(name))[1]::uuid, ARRAY['admin']::tenant_role[])
  )
);

-- RLS Policy: Tenant admins can delete logos
CREATE POLICY "Tenant admins can delete logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tenant-logos' AND
  auth.uid() IS NOT NULL AND
  (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_tenant_role(auth.uid(), (storage.foldername(name))[1]::uuid, ARRAY['admin']::tenant_role[])
  )
);