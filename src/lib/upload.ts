import { supabase } from "@/integrations/supabase/client";
import { File } from "expo-file-system";
import { decode } from "base64-arraybuffer";
import { requireUserId } from "@/lib/auth";
import { STORAGE_BUCKET_NAME } from "@/lib/constants";

/**
 * Upload a file from a local URI to Supabase Storage.
 * Replaces the web's browser File API with Expo FileSystem.
 * Preserves the same bucket, folder structure, and naming convention.
 */
export async function uploadProjectFile(
  uri: string,
  fileName: string,
  contentType: string,
  kind: "quotations" | "photos",
  projectId: string,
): Promise<{ path: string; name: string; type: string; size: number }> {
  // Validate extension
  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  const allowedExtensions = {
    photos: ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"],
    quotations: ["pdf", "doc", "docx", "xls", "xlsx", "txt", "rtf"],
  };

  if (kind === "photos" && !allowedExtensions.photos.includes(extension)) {
    throw new Error("Invalid image format. Supported formats: " + allowedExtensions.photos.join(", "));
  }
  if (kind === "quotations" && !allowedExtensions.quotations.includes(extension)) {
    throw new Error("Invalid document format. Supported formats: " + allowedExtensions.quotations.join(", "));
  }

  const userId = await requireUserId();
  const safe = fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = `${userId}/${kind}/${projectId}/${Date.now()}-${safe}`;

  // Read file as base64 and convert to ArrayBuffer for Supabase upload
  const file = new File(uri);
  const base64 = await file.base64();

  // Approximate file size from base64 length
  const size = Math.round((base64.length * 3) / 4);

  // Validate file size limits
  if (kind === "photos" && size > 5 * 1024 * 1024) {
    throw new Error("Image size exceeds the 5MB limit.");
  }
  if (kind === "quotations" && size > 10 * 1024 * 1024) {
    throw new Error("Document size exceeds the 10MB limit.");
  }

  const arrayBuffer = decode(base64);

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET_NAME)
    .upload(path, arrayBuffer, {
      upsert: false,
      contentType: contentType || undefined,
    });
  if (error) throw new Error(error.message);

  return { path, name: fileName, type: contentType, size };
}
