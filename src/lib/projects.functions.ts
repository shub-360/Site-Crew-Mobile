import { supabase } from "@/integrations/supabase/client";
import { requireUserId } from "@/lib/auth";
import { STORAGE_BUCKET_NAME } from "@/lib/constants";


// ─── Project Schema (preserved from web) ────────────────────

export interface ProjectInput {
  name: string;
  client?: string | null;
  location?: string | null;
  start_date?: string | null;
  expected_end?: string | null;
  contract_value?: number;
  status?: "planning" | "active" | "on_hold" | "completed";
  progress_pct?: number;
  notes?: string | null;
}

// ─── Project Operations ─────────────────────────────────────

export async function listProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getProject(data: { id: string }) {
  const sb = supabase;
  const [pRes, aRes, uRes, qRes, lRes] = await Promise.all([
    sb.from("projects").select("*").eq("id", data.id).maybeSingle(),
    sb.from("project_workers")
      .select("worker_id, workers(id, full_name, worker_type, daily_wage, status)")
      .eq("project_id", data.id),
    sb.from("project_updates").select("*").eq("project_id", data.id).order("created_at", { ascending: false }),
    sb.from("project_quotations").select("*").eq("project_id", data.id).order("version", { ascending: false }),
    sb.from("activity_log").select("*").eq("project_id", data.id).order("created_at", { ascending: false }).limit(50),
  ]);
  if (pRes.error) throw new Error(pRes.error.message);
  if (aRes.error) throw new Error(aRes.error.message);
  if (uRes.error) throw new Error(uRes.error.message);
  if (qRes.error) throw new Error(qRes.error.message);
  if (lRes.error) throw new Error(lRes.error.message);
  if (!pRes.data) throw new Error("Project not found");
  return {
    project: pRes.data,
    assignments: aRes.data ?? [],
    updates: uRes.data ?? [],
    quotations: qRes.data ?? [],
    activity: lRes.data ?? [],
  };
}

export async function createProject(data: ProjectInput) {
  const userId = await requireUserId();
  const { data: row, error } = await supabase
    .from("projects")
    .insert({ ...data, owner_id: userId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return row;
}

export async function updateProject(data: Partial<ProjectInput> & { id: string }) {
  const { id, ...patch } = data;
  const { error } = await supabase.from("projects").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteProject(data: { id: string }) {
  const { error } = await supabase.from("projects").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function assignWorker(data: { project_id: string; worker_id: string }) {
  const userId = await requireUserId();

  const { error } = await supabase
    .from("project_workers")
    .upsert(
      {
        project_id: data.project_id,
        worker_id: data.worker_id,
        owner_id: userId,
      },
      {
        onConflict: "project_id,worker_id",
      }
    );

  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function unassignWorker(data: { project_id: string; worker_id: string }) {
  const { error } = await supabase
    .from("project_workers")
    .delete()
    .eq("project_id", data.project_id)
    .eq("worker_id", data.worker_id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function addProjectUpdate(data: {
  project_id: string;
  note: string;
  is_milestone?: boolean;
  photo_path?: string | null;
}) {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("project_updates")
    .insert({ ...data, owner_id: userId });
  if (error) throw new Error(error.message);
  await supabase.from("activity_log").insert({
    owner_id: userId,
    actor_id: userId,
    entity_type: "project_update",
    project_id: data.project_id,
    action: data.is_milestone ? "milestone_added" : "note_added",
    description: data.note.slice(0, 200),
    meta: data.photo_path ? { photo_path: data.photo_path } : null,
  });
  return { ok: true };
}

export async function getSignedFileUrl(data: { file_path: string }) {
  const { data: signed, error } = await supabase.storage
    .from(STORAGE_BUCKET_NAME)
    .createSignedUrl(data.file_path, 60 * 60);
  if (error) throw new Error(error.message);
  return { url: signed.signedUrl };
}
