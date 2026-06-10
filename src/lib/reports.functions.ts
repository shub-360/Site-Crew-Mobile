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

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const TYPE_TAG: Record<AttendanceType, string> = {
  full: "F",
  half: "H",
  overtime: "OT",
  absent: "A",
};

function formatAttendance(att: { date: string; type: string }[]): string {
  return att
    .filter((a) => a.type !== "absent")
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((a) => {
      const d = new Date(a.date + "T00:00:00");
      const label = `${String(d.getDate()).padStart(2, "0")}-${MONTH_SHORT[d.getMonth()]}`;
      return `${label} (${TYPE_TAG[a.type as AttendanceType] ?? a.type})`;
    })
    .join(", ");
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

    const [workersRes, attRes, payRes, assignRes, projRes] = await Promise.all([
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
      data.project_id
        ? sb.from("projects").select("name").eq("id", data.project_id).maybeSingle()
        : Promise.resolve({ data: null, error: null } as const),
    ]);
    for (const r of [workersRes, attRes, payRes, assignRes, projRes]) {
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

    type Row = {
      name: string;
      type: string;
      wage: number;
      attendance: string;
      earnings: number;
      paid: number;
      balance: number;
      full: number;
      half: number;
      ot: number;
    };

    const rows: Row[] = workers.map((w) => {
      const wage = Number(w.daily_wage);
      const att = filteredAtt.filter((a) => a.worker_id === w.id);
      const full = att.filter((a) => a.type === "full").length;
      const half = att.filter((a) => a.type === "half").length;
      const ot = att.filter((a) => a.type === "overtime").length;
      const earnings = att.reduce(
        (s, a) => s + wageFor(a.type as AttendanceType, wage),
        0,
      );
      const paid = (payRes.data ?? [])
        .filter((p) => p.worker_id === w.id)
        .reduce((s, p) => s + Number(p.amount), 0);
      return {
        name: w.full_name,
        type: w.worker_type ?? "",
        wage,
        attendance: formatAttendance(att),
        earnings: Math.round(earnings * 100) / 100,
        paid: Math.round(paid * 100) / 100,
        balance: Math.round((earnings - paid) * 100) / 100,
        full, half, ot,
      };
    });

    const totals = rows.reduce(
      (s, r) => ({
        earnings: s.earnings + r.earnings,
        paid: s.paid + r.paid,
        balance: s.balance + r.balance,
        full: s.full + r.full,
        half: s.half + r.half,
        ot: s.ot + r.ot,
      }),
      { earnings: 0, paid: 0, balance: 0, full: 0, half: 0, ot: 0 },
    );

    const ExcelJS = (await import("exceljs")).default ?? (await import("exceljs"));
    const wb = new (ExcelJS as any).Workbook();
    wb.creator = "SiteCrew";
    wb.created = new Date();
    const monthLabel = `${MONTH_NAMES[data.month - 1]} ${data.year}`;
    const ws = wb.addWorksheet(`${MONTH_SHORT[data.month - 1]} ${data.year}`, {
      views: [{ state: "frozen", ySplit: 9 }],
    });

    const projectName = (projRes.data as any)?.name ?? null;
    const currencyFmt = '"₹"#,##0.00;[Red]"-₹"#,##0.00';
    const COLS = 7;

    const headerLines: [string, string][] = [
      ["SiteCrew Workforce Report", ""],
      ["Period", monthLabel],
      ["Generated", new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })],
      ["Project", projectName ?? "All Projects"],
      ["Total Workers", String(rows.length)],
      ["Total Labour Cost", ""], // value set below with currency format
    ];

    headerLines.forEach((line, i) => {
      const row = ws.getRow(i + 1);
      ws.mergeCells(i + 1, 1, i + 1, 2);
      row.getCell(1).value = line[0];
      ws.mergeCells(i + 1, 3, i + 1, COLS);
      const valCell = row.getCell(3);
      if (i === 0) {
        row.getCell(1).font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
        row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
        row.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
        valCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
        row.height = 26;
      } else {
        row.getCell(1).font = { bold: true, color: { argb: "FF334155" } };
        valCell.font = { color: { argb: "FF0F172A" } };
        if (i === 5) {
          valCell.value = totals.earnings;
          valCell.numFmt = currencyFmt;
        } else {
          valCell.value = line[1];
        }
      }
    });

    // Empty separator row 7
    ws.getRow(7).height = 6;

    // Column titles on row 8
    const headers = [
      "Worker Name",
      "Worker Type",
      "Daily Wage",
      "Attendance Details",
      "Total Earnings",
      "Amount Paid",
      "Remaining Balance",
    ];
    const headerRow = ws.getRow(8);
    headers.forEach((h, i) => {
      const c = headerRow.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
      c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      c.border = {
        top: { style: "thin", color: { argb: "FF334155" } },
        left: { style: "thin", color: { argb: "FF334155" } },
        bottom: { style: "thin", color: { argb: "FF334155" } },
        right: { style: "thin", color: { argb: "FF334155" } },
      };
    });
    headerRow.height = 28;

    // Data rows
    rows.forEach((r, idx) => {
      const row = ws.getRow(9 + idx);
      row.getCell(1).value = r.name;
      row.getCell(2).value = r.type;
      row.getCell(3).value = r.wage;
      row.getCell(3).numFmt = currencyFmt;
      row.getCell(4).value = r.attendance;
      row.getCell(4).alignment = { wrapText: true, vertical: "top" };
      row.getCell(5).value = r.earnings;
      row.getCell(5).numFmt = currencyFmt;
      row.getCell(6).value = r.paid;
      row.getCell(6).numFmt = currencyFmt;
      row.getCell(7).value = r.balance;
      row.getCell(7).numFmt = currencyFmt;
      const zebra = idx % 2 === 1;
      for (let i = 1; i <= COLS; i++) {
        const c = row.getCell(i);
        c.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
        if (zebra) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
        }
      }
    });

    // Summary
    const summaryStart = 9 + rows.length + 2;
    const summary: [string, string | number, string?][] = [
      ["Total Workers", rows.length],
      ["Total Full Days", totals.full],
      ["Total Half Days", totals.half],
      ["Total Overtime Days", totals.ot],
      ["Total Labour Cost", totals.earnings, currencyFmt],
      ["Total Amount Paid", totals.paid, currencyFmt],
      ["Total Remaining Balance", totals.balance, currencyFmt],
    ];
    const sumHeader = ws.getRow(summaryStart);
    ws.mergeCells(summaryStart, 1, summaryStart, COLS);
    sumHeader.getCell(1).value = "Summary";
    sumHeader.getCell(1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
    sumHeader.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    sumHeader.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
    sumHeader.height = 22;

    summary.forEach((s, i) => {
      const row = ws.getRow(summaryStart + 1 + i);
      ws.mergeCells(summaryStart + 1 + i, 1, summaryStart + 1 + i, 4);
      ws.mergeCells(summaryStart + 1 + i, 5, summaryStart + 1 + i, COLS);
      const labelC = row.getCell(1);
      const valC = row.getCell(5);
      labelC.value = s[0];
      labelC.font = { bold: true, color: { argb: "FF334155" } };
      valC.value = s[1];
      if (s[2]) valC.numFmt = s[2];
      valC.font = { bold: true, color: { argb: "FF0F172A" } };
      valC.alignment = { horizontal: "right" };
      [labelC, valC].forEach((c) => {
        c.border = {
          top: { style: "thin", color: { argb: "FFCBD5E1" } },
          left: { style: "thin", color: { argb: "FFCBD5E1" } },
          bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
          right: { style: "thin", color: { argb: "FFCBD5E1" } },
        };
      });
    });

    // Auto column widths
    const widths = [24, 16, 14, 60, 16, 16, 18];
    widths.forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });

    const buffer = await wb.xlsx.writeBuffer();
    const u8 = new Uint8Array(buffer as ArrayBuffer);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < u8.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + chunk)) as any);
    }
    const base64 = btoa(binary);

    return {
      filename: `sitecrew-workforce-${data.year}-${String(data.month).padStart(2, "0")}.xlsx`,
      base64,
      rowCount: rows.length,
    };
  });
