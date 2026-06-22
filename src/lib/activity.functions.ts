import { supabase } from "@/integrations/supabase/client";
import { requireUserId } from "@/lib/auth";


// ─── Activity Log ────────────────────────────────────────────

export async function logActivity(data: {
  entity_type: string;
  entity_id?: string | null;
  project_id?: string | null;
  action: string;
  description?: string | null;
  meta?: Record<string, any> | null;
}) {
  const userId = await requireUserId();
  const { error } = await supabase.from("activity_log").insert({
    ...data,
    owner_id: userId,
    actor_id: userId,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function listActivity(data?: {
  project_id?: string | null;
  limit?: number;
}) {
  const limit = data?.limit ?? 50;
  let q = supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (data?.project_id) q = q.eq("project_id", data.project_id);
  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);
  return rows ?? [];
}
