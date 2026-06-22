import { supabase } from "@/integrations/supabase/client";
import { requireUserId } from "@/lib/auth";


// ─── Payment Operations ─────────────────────────────────────

export async function listPayments(data: { worker_id: string }) {
  const { data: rows, error } = await supabase
    .from("payments")
    .select("*")
    .eq("worker_id", data.worker_id)
    .order("paid_on", { ascending: false });
  if (error) throw new Error(error.message);
  return rows ?? [];
}

export async function recordPayment(data: {
  worker_id: string;
  amount: number;
  paid_on: string;
  note?: string | null;
}) {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("payments")
    .insert({ ...data, owner_id: userId });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deletePayment(data: { id: string }) {
  const { error } = await supabase.from("payments").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}
