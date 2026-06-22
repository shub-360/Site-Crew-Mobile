import { supabase } from "@/integrations/supabase/client";
import { requireUserId } from "@/lib/auth";


// ─── Worker Schema (preserved from web) ─────────────────────

export interface WorkerInput {
  full_name: string;
  mobile?: string | null;
  address?: string | null;
  worker_type?: string | null;
  joining_date: string;
  daily_wage: number;
  status?: "active" | "inactive";
}

// ─── Worker Operations ──────────────────────────────────────

export async function listWorkers() {
  const { data, error } = await supabase
    .from("workers")
    .select("*")
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getWorker(data: { id: string }) {
  const { data: worker, error } = await supabase
    .from("workers")
    .select("*")
    .eq("id", data.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!worker) throw new Error("Worker not found");
  return worker;
}

export async function createWorker(data: WorkerInput) {
  const userId = await requireUserId();
  const { data: row, error } = await supabase
    .from("workers")
    .insert({ ...data, owner_id: userId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  await supabase.from("activity_log").insert({
    owner_id: userId,
    actor_id: userId,
    entity_type: "worker",
    entity_id: row.id,
    action: "worker_added",
    description: `Added worker ${row.full_name}`,
  });
  return row;
}

export async function updateWorker(data: Partial<WorkerInput> & { id: string }) {
  const userId = await requireUserId();
  const { id, ...patch } = data;
  const { data: row, error } = await supabase
    .from("workers")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  await supabase.from("activity_log").insert({
    owner_id: userId,
    actor_id: userId,
    entity_type: "worker",
    entity_id: id,
    action: "worker_updated",
    description: `Updated worker ${row.full_name}`,
    meta: patch as any,
  });
  return row;
}

export async function deleteWorker(data: { id: string }) {
  const userId = await requireUserId();
  const { data: w } = await supabase
    .from("workers").select("full_name").eq("id", data.id).maybeSingle();
  const { error } = await supabase.from("workers").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  await supabase.from("activity_log").insert({
    owner_id: userId,
    actor_id: userId,
    entity_type: "worker",
    entity_id: data.id,
    action: "worker_deleted",
    description: `Deleted worker ${w?.full_name ?? ""}`.trim(),
  });
  return { ok: true };
}
