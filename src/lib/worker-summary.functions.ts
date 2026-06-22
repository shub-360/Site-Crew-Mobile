import { supabase } from "@/integrations/supabase/client";
import { wageFor, type AttendanceType } from "./wages";
import { toLocalISODate } from "./format";

// ─── Helpers ─────────────────────────────────────────────────

function monthBounds(d = new Date()) {
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const iso = (x: Date) => toLocalISODate(x);
  return { from: iso(from), to: iso(to) };
}

function boundsFor(year: number, month1: number) {
  const from = new Date(year, month1 - 1, 1);
  const to = new Date(year, month1, 0);
  const iso = (x: Date) => toLocalISODate(x);
  return { from: iso(from), to: iso(to) };
}

// ─── Worker Summary ─────────────────────────────────────────

export async function getWorkerSummary(data: { worker_id: string }) {
  const sb = supabase;
  const now = new Date();
  const monthStart = toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = toLocalISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));


  const [worker, attMonth, attAll, payments] = await Promise.all([
    sb.from("workers").select("*").eq("id", data.worker_id).maybeSingle(),
    sb
      .from("attendance")
      .select("type, date")
      .eq("worker_id", data.worker_id)
      .gte("date", monthStart)
      .lte("date", monthEnd),
    sb.from("attendance").select("type").eq("worker_id", data.worker_id),
    sb
      .from("payments")
      .select("amount")
      .eq("worker_id", data.worker_id),
  ]);
  for (const r of [worker, attMonth, attAll, payments]) {
    if ((r as any).error) throw new Error((r as any).error.message);
  }
  if (!worker.data) throw new Error("Worker not found");

  const wage = Number(worker.data.daily_wage);
  const monthEarnings = (attMonth.data ?? []).reduce(
    (s, a) => s + wageFor(a.type as AttendanceType, wage),
    0,
  );
  const lifetimeEarnings = (attAll.data ?? []).reduce(
    (s, a) => s + wageFor(a.type as AttendanceType, wage),
    0,
  );
  const totalPaid = (payments.data ?? []).reduce((s, p) => s + Number(p.amount), 0);

  const present = (attMonth.data ?? []).filter((a) => a.type !== "absent").length;
  const overtime = (attMonth.data ?? []).filter((a) => a.type === "overtime").length;

  return {
    worker: worker.data,
    monthPresent: present,
    monthOvertime: overtime,
    monthEarnings: Math.round(monthEarnings * 100) / 100,
    lifetimeEarnings: Math.round(lifetimeEarnings * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    balance: Math.round((lifetimeEarnings - totalPaid) * 100) / 100,
  };
}
