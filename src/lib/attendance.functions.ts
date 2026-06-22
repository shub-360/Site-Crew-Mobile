import { supabase } from "@/integrations/supabase/client";
import { requireUserId } from "@/lib/auth";

type AttendanceType = "absent" | "half" | "full" | "overtime";


// ─── Attendance Operations ───────────────────────────────────

export async function getAttendanceForDay(data: { date: string }) {
  const { data: rows, error } = await supabase
    .from("attendance")
    .select("id, worker_id, type, project_id")
    .eq("date", data.date);
  if (error) throw new Error(error.message);
  return rows ?? [];
}

export async function upsertAttendance(data: {
  worker_id: string;
  date: string;
  type: AttendanceType;
  project_id?: string | null;
}) {
  const userId = await requireUserId();

  const { error } = await supabase
    .from("attendance")
    .upsert(
      {
        worker_id: data.worker_id,
        date: data.date,
        type: data.type,
        project_id: data.project_id ?? null,
        owner_id: userId,
      },
      {
        onConflict: "worker_id,date",
      }
    );

  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function bulkUpsertAttendance(data: {
  date: string;
  project_id: string;
  workers: { worker_id: string; type: AttendanceType }[];
}) {
  const userId = await requireUserId();

  const upsertRows = data.workers.map((w) => ({
    worker_id: w.worker_id,
    date: data.date,
    type: w.type,
    project_id: data.project_id,
    owner_id: userId,
  }));

  const { error } = await supabase
    .from("attendance")
    .upsert(upsertRows, {
      onConflict: "worker_id,date",
    });

  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function clearAttendance(data: {
  worker_id: string;
  date: string;
}) {
  const { error } = await supabase
    .from("attendance")
    .delete()
    .eq("worker_id", data.worker_id)
    .eq("date", data.date);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getWorkerAttendance(data: {
  worker_id: string;
  from: string;
  to: string;
}) {
  const { data: rows, error } = await supabase
    .from("attendance")
    .select("date, type, project_id")
    .eq("worker_id", data.worker_id)
    .gte("date", data.from)
    .lte("date", data.to)
    .order("date", { ascending: false });
  if (error) throw new Error(error.message);
  return rows ?? [];
}
