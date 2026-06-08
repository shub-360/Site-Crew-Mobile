import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { wageFor, type AttendanceType } from "./wages";

function monthBounds(year: number, month0: number) {
  const from = new Date(year, month0, 1);
  const to = new Date(year, month0 + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

export const generateMonthlyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        year: z.number().int().min(2000).max(2100),
        month: z.number().int().min(1).max(12),
        project_id: z.string().uuid().optional().nullable(),
        worker_id: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { from, to } = monthBounds(data.year, data.month - 1);
    const sb = context.supabase;

    let workersQuery = sb
      .from("workers")
      .select("id, full_name, daily_wage, worker_type, status")
      .order("full_name");
    if (data.worker_id) workersQuery = workersQuery.eq("id", data.worker_id);

    const [workersRes, attRes, payRes, assignRes] = await Promise.all([
      workersQuery,
      sb
        .from("attendance")
        .select("worker_id, type, date, project_id")
        .gte("date", from)
        .lte("date", to),
      sb.from("payments").select("worker_id, amount, paid_on").gte("paid_on", from).lte("paid_on", to),
      data.project_id
        ? sb.from("project_workers").select("worker_id").eq("project_id", data.project_id)
        : Promise.resolve({ data: null, error: null } as const),
    ]);
    for (const r of [workersRes, attRes, payRes, assignRes]) {
      if ((r as any).error) throw new Error((r as any).error.message);
    }

    let workers = workersRes.data ?? [];
    if (data.project_id && assignRes.data) {
      const allowed = new Set(assignRes.data.map((a: any) => a.worker_id));
      workers = workers.filter((w) => allowed.has(w.id));
    }

    const filteredAtt = (attRes.data ?? []).filter((a) =>
      data.project_id ? a.project_id === data.project_id : true,
    );

    const rows = workers.map((w) => {
      const wage = Number(w.daily_wage);
      const att = filteredAtt.filter((a) => a.worker_id === w.id);
      const half = att.filter((a) => a.type === "half").length;
      const full = att.filter((a) => a.type === "full").length;
      const ot = att.filter((a) => a.type === "overtime").length;
      const absent = att.filter((a) => a.type === "absent").length;
      const earnings = att.reduce(
        (s, a) => s + wageFor(a.type as AttendanceType, wage),
        0,
      );
      const paid = (payRes.data ?? [])
        .filter((p) => p.worker_id === w.id)
        .reduce((s, p) => s + Number(p.amount), 0);
      return {
        "Worker Name": w.full_name,
        "Type": w.worker_type ?? "",
        "Daily Wage": wage,
        "Present Days": half + full + ot,
        "Half Days": half,
        "Full Days": full,
        "Overtime Days": ot,
        "Absent Days": absent,
        "Total Earnings": Math.round(earnings * 100) / 100,
        "Amount Paid": Math.round(paid * 100) / 100,
        "Remaining Balance": Math.round((earnings - paid) * 100) / 100,
      };
    });

    // Generate XLSX server-side
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(rows);
    const colWidths = [
      22, 14, 12, 12, 10, 10, 14, 12, 14, 14, 16,
    ].map((w) => ({ wch: w }));
    (ws as any)["!cols"] = colWidths;
    const wb = XLSX.utils.book_new();
    const monthLabel = `${data.year}-${String(data.month).padStart(2, "0")}`;
    XLSX.utils.book_append_sheet(wb, ws, monthLabel);
    const buf = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
    return {
      filename: `workforce-report-${monthLabel}.xlsx`,
      base64: buf as string,
      rowCount: rows.length,
    };
  });
