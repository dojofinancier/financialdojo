"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { logServerError } from "@/lib/utils/error-logging";

const COHORTES_BUCKET = "cohortes";
const MAX_FILE_SIZE = 32 * 1024 * 1024; // 32MB

export type CohortFileUploadResult = {
  success: boolean;
  error?: string;
  url?: string;
  fileName?: string;
};

/**
 * Upload a file to the cohortes bucket
 */
export async function uploadCohortFileAction(
  formData: FormData
): Promise<CohortFileUploadResult> {
  try {
    const user = await requireAuth();
    const file = formData.get("file") as File;

    if (!file) {
      return {
        success: false,
        error: "Aucun fichier fourni",
      };
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `Le fichier dépasse la limite de ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      };
    }

    const supabase = await createClient();

    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-").toLowerCase();
    const filePath = `${user.id}/${timestamp}-${sanitizedName}`;

    // Read file as ArrayBuffer and convert to Uint8Array for Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    // Supabase Storage accepts: Blob, ArrayBuffer, ArrayBufferView, File, FormData, or string
    const { error: uploadError } = await supabase.storage
      .from(COHORTES_BUCKET)
      .upload(filePath, fileData, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });

    if (uploadError) {
      await logServerError({
        errorMessage: `Failed to upload cohort file: ${uploadError.message}`,
        stackTrace: uploadError.stack,
        userId: user.id,
        severity: "MEDIUM",
      });

      return {
        success: false,
        error: "Error uploading the file",
      };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(COHORTES_BUCKET)
      .getPublicUrl(filePath);

    return {
      success: true,
      url: urlData.publicUrl,
      fileName: file.name,
    };
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to upload cohort file: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error uploading the file",
    };
  }
}

/**
 * Delete a file from the cohortes bucket
 */
export async function deleteCohortFileAction(
  fileUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();
    const supabase = await createClient();

    // Extract file path from URL
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split("/");
    const bucketIndex = pathParts.indexOf(COHORTES_BUCKET);
    
    if (bucketIndex === -1 || bucketIndex === pathParts.length - 1) {
      return {
        success: false,
        error: "URL de fichier invalide",
      };
    }

    const filePath = pathParts.slice(bucketIndex + 1).join("/");

    const { error } = await supabase.storage
      .from(COHORTES_BUCKET)
      .remove([filePath]);

    if (error) {
      return {
        success: false,
        error: "Error deleting the file",
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: "Error deleting the file",
    };
  }
}

