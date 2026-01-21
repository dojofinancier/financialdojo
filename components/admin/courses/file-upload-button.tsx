"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const COURSE_ASSETS_BUCKET = "course-assets";

interface FileUploadButtonProps {
  folder: string;
  onUploaded: (url: string, fileName: string) => void;
  accept?: string;
  label?: string;
}

export function FileUploadButton({ folder, onUploaded, accept, label = "Upload a file" }: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const supabase = createClient();
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/\s+/g, "-").toLowerCase();
      const filePath = `${folder}/${timestamp}-${sanitizedName}`;

      const { error } = await supabase.storage.from(COURSE_ASSETS_BUCKET).upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (error) {
        toast.error("Upload failed");
        return;
      }

      const { data } = supabase.storage.from(COURSE_ASSETS_BUCKET).getPublicUrl(filePath);
      onUploaded(data.publicUrl, file.name);
      toast.success("File uploaded");
    } catch (error) {
      toast.error("Error during upload");
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={handleFileChange}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
        <Upload className="h-4 w-4 mr-2" />
        {uploading ? "Uploading..." : label}
      </Button>
    </>
  );
}

