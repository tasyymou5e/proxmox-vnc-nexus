import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useLogoUpload(tenantId: string | undefined) {
  const [isUploading, setIsUploading] = useState(false);

  const uploadLogo = async (file: File): Promise<string | null> => {
    if (!tenantId) throw new Error("Tenant ID required");
    
    // Validate file type
    // SVG excluded to prevent XSS via embedded JavaScript in SVG files
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Invalid file type. Allowed: JPEG, PNG, WebP");
    }
    
    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      throw new Error("File too large. Maximum size: 2MB");
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `${tenantId}/logo.${fileExt}`;
      
      // Delete existing logo files first
      const { data: existingFiles } = await supabase.storage
        .from('tenant-logos')
        .list(tenantId);
      
      if (existingFiles?.length) {
        await supabase.storage
          .from('tenant-logos')
          .remove(existingFiles.map(f => `${tenantId}/${f.name}`));
      }
      
      const { data, error } = await supabase.storage
        .from('tenant-logos')
        .upload(fileName, file, { 
          upsert: true,
          contentType: file.type,
          cacheControl: '3600',
        });
      
      if (error) throw error;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('tenant-logos')
        .getPublicUrl(data.path);
      
      // Add cache-busting query param
      return `${publicUrl}?v=${Date.now()}`;
    } finally {
      setIsUploading(false);
    }
  };

  const deleteLogo = async () => {
    if (!tenantId) throw new Error("Tenant ID required");
    
    setIsUploading(true);
    try {
      // List files in tenant folder
      const { data: files } = await supabase.storage
        .from('tenant-logos')
        .list(tenantId);
      
      if (files?.length) {
        const { error } = await supabase.storage
          .from('tenant-logos')
          .remove(files.map(f => `${tenantId}/${f.name}`));
        
        if (error) throw error;
      }
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadLogo, deleteLogo, isUploading };
}
