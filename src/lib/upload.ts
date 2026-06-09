import { supabase } from "@/integrations/supabase/client";

export async function uploadProjectFile(
  file: File,
  kind: "quotations" | "photos",
  projectId: string,
): Promise<{ path: string; name: string; type: string; size: number }> {
  const { data: userRes, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userRes.user) throw new Error("Not signed in");
  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = `${userRes.user.id}/${kind}/${projectId}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage
    .from("project-files")
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw new Error(error.message);
  return { path, name: file.name, type: file.type, size: file.size };
}
