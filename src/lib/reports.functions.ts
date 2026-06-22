import { supabase } from "@/integrations/supabase/client";
import { wageFor, type AttendanceType } from "./wages";
import { toLocalISODate } from "./format";
import { Paths, File } from "expo-file-system";
import * as Sharing from "expo-sharing";
// @ts-ignore
import XLSX from "xlsx-js-style";

function monthBounds(year: number, month0: number) {
  const from = new Date(year, month0, 1);
  const to = new Date(year, month0 + 1, 0);
  const iso = (d: Date) => toLocalISODate(d);
  return { from: iso(from), to: iso(to), daysInMonth: to.getDate() };
}


const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const ATT_CODE: Record<string, string> = {
  full: "P", half: "H", overtime: "O", absent: "A",
};

const currencyFmt = '₹#,##0;[Red]-₹#,##0';

/* ─── COLORS ────────────────────────────────────────────────── */
const HEADER_BG = "1E3A5F";    // Navy Blue
const HEADER_FG = "FFFFFF";    // White
const SUBHEADER = "2B5D8C";    // Calendar subheader (lighter blue)
const TOTAL_BG = "F0F4F8";     // Summary background
const BORDER_CLR = "CBD5E1";   // Grid border
const BORDER_DARK = "94A3B8";  // Header/Summary border
const ZEBRA_BG = "F8FAFC";     // Zebra row tint
const WEEKEND_BG = "F1F5F9";   // Weekend column header tint

const thinBorder = {
  top: { style: "thin", color: { rgb: BORDER_CLR } },
  bottom: { style: "thin", color: { rgb: BORDER_CLR } },
  left: { style: "thin", color: { rgb: BORDER_CLR } },
  right: { style: "thin", color: { rgb: BORDER_CLR } }
};

const headerBorder = {
  top: { style: "thin", color: { rgb: BORDER_DARK } },
  bottom: { style: "thin", color: { rgb: BORDER_DARK } },
  left: { style: "thin", color: { rgb: BORDER_DARK } },
  right: { style: "thin", color: { rgb: BORDER_DARK } }
};

const ws2HeaderStyle = {
  font: { bold: true, color: { rgb: HEADER_FG }, sz: 11 },
  fill: { fgColor: { rgb: SUBHEADER } },
  alignment: { vertical: "middle", horizontal: "center", wrapText: true },
  border: headerBorder
};

const ws2HeaderStyleLeft = {
  ...ws2HeaderStyle,
  alignment: { vertical: "middle", horizontal: "left", wrapText: true }
};

const weekendHeaderStyle = {
  font: { bold: true, color: { rgb: "334155" }, sz: 11 },
  fill: { fgColor: { rgb: WEEKEND_BG } },
  alignment: { vertical: "middle", horizontal: "center", wrapText: true },
  border: headerBorder
};

const ATT_STYLES: Record<string, any> = {
  full: {
    font: { bold: true, sz: 10, color: { rgb: "276221" } },
    fill: { fgColor: { rgb: "C6EFCE" } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: thinBorder
  },
  half: {
    font: { bold: true, sz: 10, color: { rgb: "9C6500" } },
    fill: { fgColor: { rgb: "FFEB9C" } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: thinBorder
  },
  overtime: {
    font: { bold: true, sz: 10, color: { rgb: "1F4E79" } },
    fill: { fgColor: { rgb: "BDD7EE" } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: thinBorder
  },
  absent: {
    font: { bold: true, sz: 10, color: { rgb: "9C0006" } },
    fill: { fgColor: { rgb: "FFC7CE" } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: thinBorder
  }
};

function buildCell(value: any, style: any = {}, type: string = "s"): any {
  if (value === undefined || value === null) {
    return { v: "", t: "s", s: style };
  }
  let t = type;
  if (typeof value === "number") {
    t = "n";
  } else if (typeof value === "boolean") {
    t = "b";
  }
  return { v: value, t: t, s: style };
}

/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORT FUNCTION — 3 WORKSHEETS (xlsx-js-style Implementation)
   ═══════════════════════════════════════════════════════════════ */
export async function generateMonthlyReport(data: {
  year: number;
  month: number;
  project_id?: string | null;
  worker_id?: string | null;
}) {
  const { from, to, daysInMonth } = monthBounds(data.year, data.month - 1);
  const sb = supabase;
  const monthLabel = `${MONTH_NAMES[data.month - 1]} ${data.year}`;

  /* ── Fetch all data in parallel ──────────────────────────── */
  let workersQuery = sb
    .from("workers")
    .select("id, full_name, daily_wage, worker_type, status")
    .order("full_name");
  if (data.worker_id) workersQuery = workersQuery.eq("id", data.worker_id);

  const [workersRes, attRes, payRes, projRes, pwRes] = await Promise.all([
    workersQuery,
    sb.from("attendance")
      .select("worker_id, type, date, project_id")
      .gte("date", from)
      .lte("date", to),
    sb.from("payments")
      .select("worker_id, amount, paid_on, note")
      .gte("paid_on", from)
      .lte("paid_on", to),
    sb.from("projects")
      .select("id, name, location, status"),
    sb.from("project_workers")
      .select("project_id, worker_id"),
  ]);
  for (const r of [workersRes, attRes, payRes, projRes, pwRes]) {
    if ((r as any).error) throw new Error((r as any).error.message);
  }

  let workers = workersRes.data ?? [];
  const allAtt = attRes.data ?? [];
  const allPay = payRes.data ?? [];
  const projects = projRes.data ?? [];
  const projWorkers = pwRes.data ?? [];

  // If project filter, narrow workers to those assigned
  if (data.project_id) {
    const allowed = new Set(
      projWorkers
        .filter((pw: any) => pw.project_id === data.project_id)
        .map((pw: any) => pw.worker_id),
    );
    workers = workers.filter((w) => allowed.has(w.id));
  }

  // Filter attendance by project if selected
  const filteredAtt = data.project_id
    ? allAtt.filter((a) => a.project_id === data.project_id)
    : allAtt;

  // Build per-worker attendance maps
  const attByWorker = new Map<string, Map<number, string>>();
  for (const a of filteredAtt) {
    if (!attByWorker.has(a.worker_id)) attByWorker.set(a.worker_id, new Map());
    const dayNum = Number(a.date.slice(-2));
    attByWorker.get(a.worker_id)!.set(dayNum, a.type);
  }

  // Build per-worker payment maps: day → { amount, note }[]
  const payByWorker = new Map<string, Map<number, { amount: number; note: string | null }[]>>();
  for (const p of allPay) {
    if (!payByWorker.has(p.worker_id)) payByWorker.set(p.worker_id, new Map());
    const dayNum = Number(p.paid_on.slice(-2));
    const dayMap = payByWorker.get(p.worker_id)!;
    if (!dayMap.has(dayNum)) dayMap.set(dayNum, []);
    dayMap.get(dayNum)!.push({ amount: Number(p.amount), note: p.note ?? null });
  }

  // Pre-compute worker stats
  type WorkerRow = {
    id: string;
    name: string;
    type: string;
    wage: number;
    full: number;
    half: number;
    ot: number;
    absent: number;
    earnings: number;
    paid: number;
    attMap: Map<number, string>;
    payMap: Map<number, { amount: number; note: string | null }[]>;
  };

  const workerRows: WorkerRow[] = workers.map((w) => {
    const wage = Number(w.daily_wage);
    const wAtt = filteredAtt.filter((a) => a.worker_id === w.id);
    const full = wAtt.filter((a) => a.type === "full").length;
    const half = wAtt.filter((a) => a.type === "half").length;
    const ot = wAtt.filter((a) => a.type === "overtime").length;
    const absent = wAtt.filter((a) => a.type === "absent").length;
    const earnings = wAtt.reduce((s, a) => s + wageFor(a.type as AttendanceType, wage), 0);
    const paid = allPay
      .filter((p) => p.worker_id === w.id)
      .reduce((s, p) => s + Number(p.amount), 0);
    return {
      id: w.id,
      name: w.full_name,
      type: w.worker_type ?? "",
      wage,
      full,
      half,
      ot,
      absent,
      earnings: Math.round(earnings),
      paid: Math.round(paid),
      attMap: attByWorker.get(w.id) ?? new Map(),
      payMap: payByWorker.get(w.id) ?? new Map(),
    };
  });

  /* ── xlsx-js-style Workbook setup ─────────────────────────── */
  const wb = XLSX.utils.book_new();

  const selectedProjectName = data.project_id
    ? projects.find((p) => p.id === data.project_id)?.name ?? "Project"
    : "All Projects";

  /* ═══════════════════════════════════════════════════════════
     WORKSHEET 1: Workforce Summary
     ═══════════════════════════════════════════════════════════ */
  const ws1Data: any[][] = [];

  // Title block — rows 1-3
  const titleStyle = {
    font: { bold: true, sz: 16, color: { rgb: HEADER_FG } },
    fill: { fgColor: { rgb: HEADER_BG } },
    alignment: { vertical: "middle", horizontal: "left" }
  };
  ws1Data.push([
    buildCell("SiteCrew — Workforce Summary", titleStyle),
    ...Array(8).fill(buildCell("", titleStyle))
  ]);

  const periodStyle = {
    font: { bold: true, color: { rgb: "334155" }, sz: 10 },
    alignment: { vertical: "middle", horizontal: "left" }
  };
  const projectStyle = {
    font: { color: { rgb: "334155" }, sz: 10 },
    alignment: { vertical: "middle", horizontal: "left" }
  };
  ws1Data.push([
    buildCell(`Period: ${monthLabel}`, periodStyle),
    ...Array(3).fill(buildCell("", periodStyle)),
    buildCell(`Project: ${selectedProjectName}`, projectStyle),
    ...Array(4).fill(buildCell("", projectStyle))
  ]);

  const genStyle = {
    font: { italic: true, sz: 9, color: { rgb: "64748B" } },
    alignment: { vertical: "middle", horizontal: "left" }
  };
  ws1Data.push([
    buildCell(`Generated: ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`, genStyle),
    ...Array(8).fill(buildCell("", genStyle))
  ]);

  // Column headers — row 4
  const ws1Headers = [
    "Worker Name", "Worker Type", "Daily Wage",
    "Full Days", "Half Days", "OT Days",
    "Total Absent", "Total Earnings", "Amount Paid",
  ];
  const ws1HeaderStyle = {
    font: { bold: true, color: { rgb: HEADER_FG }, sz: 11 },
    fill: { fgColor: { rgb: HEADER_BG } },
    alignment: { vertical: "middle", horizontal: "center", wrapText: true },
    border: headerBorder
  };
  ws1Data.push(
    ws1Headers.map(h => buildCell(h, ws1HeaderStyle))
  );

  // Data rows — starting at row 5
  workerRows.forEach((r, idx) => {
    const isEven = idx % 2 === 1;
    const dataBg = isEven ? ZEBRA_BG : "FFFFFF";

    const textStyle = {
      font: { sz: 10 },
      fill: { fgColor: { rgb: dataBg } },
      alignment: { horizontal: "left", vertical: "middle" },
      border: thinBorder
    };

    const centerStyle = {
      font: { sz: 10 },
      fill: { fgColor: { rgb: dataBg } },
      alignment: { horizontal: "center", vertical: "middle" },
      border: thinBorder
    };

    const currencyStyle = {
      font: { sz: 10 },
      fill: { fgColor: { rgb: dataBg } },
      alignment: { horizontal: "center", vertical: "middle" },
      border: thinBorder,
      numFmt: currencyFmt
    };

    ws1Data.push([
      buildCell(r.name, textStyle),
      buildCell(r.type, centerStyle),
      buildCell(r.wage, currencyStyle),
      buildCell(r.full, centerStyle),
      buildCell(r.half, centerStyle),
      buildCell(r.ot, centerStyle),
      buildCell(r.absent, centerStyle),
      buildCell(r.earnings, currencyStyle),
      buildCell(r.paid, currencyStyle)
    ]);
  });

  // Empty row before summary
  ws1Data.push(
    Array(9).fill(buildCell("", { fill: { fgColor: { rgb: "FFFFFF" } } }))
  );

  // Summary rows
  const sumStartRowIdx = 4 + workerRows.length + 1; // 0-indexed
  const totalEarnings = workerRows.reduce((s, r) => s + r.earnings, 0);
  const totalPaid = workerRows.reduce((s, r) => s + r.paid, 0);

  const summaryItems: [string, number, string?][] = [
    ["Total Workers", workerRows.length],
    ["Total Labour Cost", totalEarnings, currencyFmt],
    ["Total Amount Paid", totalPaid, currencyFmt],
  ];

  summaryItems.forEach(([label, val, fmt]) => {
    const labelStyle = {
      font: { bold: true, sz: 11, color: { rgb: "1E3A5F" } },
      fill: { fgColor: { rgb: TOTAL_BG } },
      alignment: { horizontal: "right", vertical: "middle" },
      border: thinBorder
    };
    
    const valStyle = {
      font: { bold: true, sz: 12, color: { rgb: "1E3A5F" } },
      fill: { fgColor: { rgb: TOTAL_BG } },
      alignment: { horizontal: "center", vertical: "middle" },
      border: thinBorder,
      ...(fmt ? { numFmt: fmt } : {})
    };

    ws1Data.push([
      buildCell(label, labelStyle),
      ...Array(5).fill(buildCell("", labelStyle)),
      buildCell(val, valStyle),
      ...Array(2).fill(buildCell("", valStyle))
    ]);
  });

  const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);

  // Merges
  ws1["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    { s: { r: 1, c: 4 }, e: { r: 1, c: 8 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
    { s: { r: sumStartRowIdx, c: 0 }, e: { r: sumStartRowIdx, c: 5 } },
    { s: { r: sumStartRowIdx, c: 6 }, e: { r: sumStartRowIdx, c: 8 } },
    { s: { r: sumStartRowIdx + 1, c: 0 }, e: { r: sumStartRowIdx + 1, c: 5 } },
    { s: { r: sumStartRowIdx + 1, c: 6 }, e: { r: sumStartRowIdx + 1, c: 8 } },
    { s: { r: sumStartRowIdx + 2, c: 0 }, e: { r: sumStartRowIdx + 2, c: 5 } },
    { s: { r: sumStartRowIdx + 2, c: 6 }, e: { r: sumStartRowIdx + 2, c: 8 } },
  ];

  // Column widths
  ws1["!cols"] = [
    { wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 14 }
  ];

  // Row heights
  ws1["!rows"] = [
    { hpt: 30 },
    { hpt: 20 },
    { hpt: 18 },
    { hpt: 28 },
    ...Array(workerRows.length).fill({ hpt: 22 }),
    { hpt: 15 },
    { hpt: 24 },
    { hpt: 24 },
    { hpt: 24 }
  ];

  ws1["!views"] = [{ state: "frozen", ySplit: 4 }];

  /* ═══════════════════════════════════════════════════════════
     WORKSHEET 2: Attendance Calendar
     ═══════════════════════════════════════════════════════════ */
  const dateColStart = 4;
  const totalColStart = dateColStart + daysInMonth;
  const calColCount = totalColStart + 5;

  const ws2Data: any[][] = [];

  // Row 1: Title bar
  const calTitleStyle = {
    font: { bold: true, sz: 14, color: { rgb: HEADER_FG } },
    fill: { fgColor: { rgb: HEADER_BG } },
    alignment: { vertical: "middle", horizontal: "center" }
  };
  ws2Data.push([
    buildCell(`Attendance Register — ${monthLabel}`, calTitleStyle),
    ...Array(calColCount - 1).fill(buildCell("", calTitleStyle))
  ]);

  // Row 2: Sub-header (Project info & Legend)
  const calProjStyle = {
    font: { bold: true, sz: 10, color: { rgb: "334155" } },
    alignment: { vertical: "middle", horizontal: "left" }
  };
  const calLegendStyle = {
    font: { italic: true, sz: 9, color: { rgb: "64748B" } },
    alignment: { vertical: "middle", horizontal: "left" }
  };
  ws2Data.push([
    buildCell(`Project: ${selectedProjectName}`, calProjStyle),
    ...Array(2).fill(buildCell("", calProjStyle)),
    buildCell("P = Present  |  H = Half Day  |  O = Overtime  |  A = Absent", calLegendStyle),
    ...Array(calColCount - 4).fill(buildCell("", calLegendStyle))
  ]);

  // Row 3: Column headers
  const ws2HeaderRow: any[] = [
    buildCell("Worker Name", ws2HeaderStyleLeft),
    buildCell("Type", ws2HeaderStyle),
    buildCell("Daily Wage", ws2HeaderStyle)
  ];

  for (let d = 1; d <= daysInMonth; d++) {
    const dayOfWeek = new Date(data.year, data.month - 1, d).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const style = isWeekend ? weekendHeaderStyle : ws2HeaderStyle;
    ws2HeaderRow.push(buildCell(d, style));
  }

  ws2HeaderRow.push(
    buildCell("Total P", ws2HeaderStyle),
    buildCell("Total H", ws2HeaderStyle),
    buildCell("Total OT", ws2HeaderStyle),
    buildCell("Total A", ws2HeaderStyle),
    buildCell("Total Earnings", ws2HeaderStyle)
  );
  ws2Data.push(ws2HeaderRow);

  // Data rows — starting row 4
  workerRows.forEach((wr, idx) => {
    const isEven = idx % 2 === 1;
    const dataBg = isEven ? ZEBRA_BG : "FFFFFF";

    const nameStyle = {
      font: { bold: true, sz: 10 },
      fill: { fgColor: { rgb: dataBg } },
      alignment: { horizontal: "left", vertical: "middle" },
      border: thinBorder
    };

    const typeStyle = {
      font: { sz: 10 },
      fill: { fgColor: { rgb: dataBg } },
      alignment: { horizontal: "center", vertical: "middle" },
      border: thinBorder
    };

    const wageStyle = {
      font: { sz: 10 },
      fill: { fgColor: { rgb: dataBg } },
      alignment: { horizontal: "center", vertical: "middle" },
      border: thinBorder,
      numFmt: currencyFmt
    };

    const row: any[] = [
      buildCell(wr.name, nameStyle),
      buildCell(wr.type, typeStyle),
      buildCell(wr.wage, wageStyle)
    ];

    // Date cells
    for (let d = 1; d <= daysInMonth; d++) {
      const att = wr.attMap.get(d);
      let cellStyle: any = {
        font: { sz: 10 },
        fill: { fgColor: { rgb: dataBg } },
        alignment: { horizontal: "center", vertical: "middle" },
        border: thinBorder
      };
      
      let val = "";
      if (att && ATT_CODE[att]) {
        val = ATT_CODE[att];
        cellStyle = ATT_STYLES[att];
      }

      const cellObj = buildCell(val, cellStyle);

      // Payment comments on date cells
      const payments = wr.payMap.get(d);
      if (payments && payments.length > 0) {
        const payText = payments
          .map(
            (p) => `Payment: ₹${p.amount.toLocaleString("en-IN")}${p.note ? ` — ${p.note}` : ""}`,
          )
          .join("\n");
        cellObj.c = [{ a: "SiteCrew", t: payText }];
      }

      row.push(cellObj);
    }

    // Totals columns
    const totalPStyle = {
      font: { bold: true, sz: 10, color: { rgb: "276221" } },
      fill: { fgColor: { rgb: dataBg } },
      alignment: { horizontal: "center", vertical: "middle" },
      border: thinBorder
    };

    const totalHStyle = {
      font: { bold: true, sz: 10, color: { rgb: "9C6500" } },
      fill: { fgColor: { rgb: dataBg } },
      alignment: { horizontal: "center", vertical: "middle" },
      border: thinBorder
    };

    const totalOTStyle = {
      font: { bold: true, sz: 10, color: { rgb: "1F4E79" } },
      fill: { fgColor: { rgb: dataBg } },
      alignment: { horizontal: "center", vertical: "middle" },
      border: thinBorder
    };

    const totalAStyle = {
      font: { bold: true, sz: 10, color: { rgb: "9C0006" } },
      fill: { fgColor: { rgb: dataBg } },
      alignment: { horizontal: "center", vertical: "middle" },
      border: thinBorder
    };

    const totalEarnStyle = {
      font: { bold: true, sz: 10 },
      fill: { fgColor: { rgb: dataBg } },
      alignment: { horizontal: "center", vertical: "middle" },
      border: thinBorder,
      numFmt: currencyFmt
    };

    row.push(
      buildCell(wr.full, totalPStyle),
      buildCell(wr.half, totalHStyle),
      buildCell(wr.ot, totalOTStyle),
      buildCell(wr.absent, totalAStyle),
      buildCell(wr.earnings, totalEarnStyle)
    );

    ws2Data.push(row);
  });

  // Grand totals row
  const calSumRowIdx = 3 + workerRows.length + 1; // 0-indexed in SheetJS
  const totalsHeaderStyle = {
    font: { bold: true, sz: 11, color: { rgb: HEADER_FG } },
    fill: { fgColor: { rgb: HEADER_BG } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: headerBorder
  };

  const totalRow: any[] = [
    buildCell("TOTALS", totalsHeaderStyle),
    ...Array(2).fill(buildCell("", totalsHeaderStyle))
  ];

  for (let d = 1; d <= daysInMonth; d++) {
    const count = workerRows.filter((wr) => {
      const att = wr.attMap.get(d);
      return att && att !== "absent";
    }).length;
    
    totalRow.push(
      buildCell(count || "", {
        font: { bold: true, sz: 9, color: { rgb: "1E3A5F" } },
        fill: { fgColor: { rgb: "E2E8F0" } },
        alignment: { horizontal: "center", vertical: "middle" },
        border: thinBorder
      })
    );
  }

  const grandTotals = workerRows.reduce(
    (acc, r) => ({
      full: acc.full + r.full,
      half: acc.half + r.half,
      ot: acc.ot + r.ot,
      absent: acc.absent + r.absent,
      earnings: acc.earnings + r.earnings,
    }),
    { full: 0, half: 0, ot: 0, absent: 0, earnings: 0 },
  );

  const calSumBgStyle = {
    font: { bold: true, sz: 11, color: { rgb: HEADER_FG } },
    fill: { fgColor: { rgb: HEADER_BG } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: headerBorder
  };

  const calSumEarnStyle = {
    ...calSumBgStyle,
    numFmt: currencyFmt
  };

  totalRow.push(
    buildCell(grandTotals.full, calSumBgStyle),
    buildCell(grandTotals.half, calSumBgStyle),
    buildCell(grandTotals.ot, calSumBgStyle),
    buildCell(grandTotals.absent, calSumBgStyle),
    buildCell(grandTotals.earnings, calSumEarnStyle)
  );

  ws2Data.push(totalRow);

  const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);

  // Merges
  ws2["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: calColCount - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
    { s: { r: 1, c: 3 }, e: { r: 1, c: 3 + Math.min(daysInMonth - 1, 10) } },
    { s: { r: calSumRowIdx, c: 0 }, e: { r: calSumRowIdx, c: 2 } },
  ];

  // Column widths
  const colsWidths2 = [{ wch: 22 }, { wch: 12 }, { wch: 12 }];
  for (let d = 1; d <= daysInMonth; d++) {
    colsWidths2.push({ wch: 4.5 });
  }
  colsWidths2.push({ wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 14 });
  ws2["!cols"] = colsWidths2;

  // Row heights
  ws2["!rows"] = [
    { hpt: 28 },
    { hpt: 20 },
    { hpt: 28 },
    ...Array(workerRows.length).fill({ hpt: 22 }),
    { hpt: 28 }
  ];

  ws2["!views"] = [{ state: "frozen", xSplit: 3, ySplit: 3 }];

  /* ═══════════════════════════════════════════════════════════
     WORKSHEET 3: Labour Cost Summary
     ═══════════════════════════════════════════════════════════ */
  const ws3Data: any[][] = [];
  
  // Title block
  ws3Data.push([
    buildCell(`Labour Cost Summary — ${monthLabel}`, calTitleStyle),
    ...Array(4).fill(buildCell("", calTitleStyle))
  ]);

  // Generated date
  ws3Data.push([
    buildCell(`Generated: ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`, genStyle),
    ...Array(4).fill(buildCell("", genStyle))
  ]);
  
  // Headers — row 3
  ws3Data.push([
    buildCell("Project Name", ws2HeaderStyleLeft),
    buildCell("Site Location", ws2HeaderStyle),
    buildCell("Assigned Workers", ws2HeaderStyle),
    buildCell("Total Attendance Days", ws2HeaderStyle),
    buildCell("Monthly Labour Cost", ws2HeaderStyle)
  ]);

  // Data rows
  const pwByProject = new Map<string, Set<string>>();
  for (const pw of projWorkers) {
    if (!pwByProject.has(pw.project_id)) pwByProject.set(pw.project_id, new Set());
    pwByProject.get(pw.project_id)!.add(pw.worker_id);
  }

  const allWorkerWages = new Map(
    (workersRes.data ?? []).map((w: any) => [w.id, Number(w.daily_wage)]),
  );

  type ProjectRow = {
    name: string;
    location: string;
    assigned: number;
    attDays: number;
    cost: number;
  };

  const projectRows: ProjectRow[] = projects.map((p) => {
    const assignedSet = pwByProject.get(p.id) ?? new Set();
    const projAtt = allAtt.filter((a) => a.project_id === p.id);
    const attDays = projAtt.filter((a) => a.type !== "absent").length;
    const cost = projAtt.reduce((s, a) => {
      const w = allWorkerWages.get(a.worker_id) ?? 0;
      return s + wageFor(a.type as AttendanceType, w);
    }, 0);
    return {
      name: p.name,
      location: p.location ?? "—",
      assigned: assignedSet.size,
      attDays,
      cost: Math.round(cost),
    };
  }).filter((p) => p.assigned > 0 || p.cost > 0)
    .sort((a, b) => b.cost - a.cost);

  projectRows.forEach((pr, idx) => {
    const isEven = idx % 2 === 1;
    const dataBg = isEven ? ZEBRA_BG : "FFFFFF";

    const nameStyle = {
      font: { bold: true, sz: 10 },
      fill: { fgColor: { rgb: dataBg } },
      alignment: { horizontal: "left", vertical: "middle" },
      border: thinBorder
    };

    const textStyle = {
      font: { sz: 10 },
      fill: { fgColor: { rgb: dataBg } },
      alignment: { horizontal: "left", vertical: "middle" },
      border: thinBorder
    };

    const centerStyle = {
      font: { sz: 10 },
      fill: { fgColor: { rgb: dataBg } },
      alignment: { horizontal: "center", vertical: "middle" },
      border: thinBorder
    };

    const currencyStyle = {
      font: { sz: 10 },
      fill: { fgColor: { rgb: dataBg } },
      alignment: { horizontal: "center", vertical: "middle" },
      border: thinBorder,
      numFmt: currencyFmt
    };

    ws3Data.push([
      buildCell(pr.name, nameStyle),
      buildCell(pr.location, textStyle),
      buildCell(pr.assigned, centerStyle),
      buildCell(pr.attDays, centerStyle),
      buildCell(pr.cost, currencyStyle)
    ]);
  });

  // Grand total row
  const ws3SumRowIdx = 3 + projectRows.length; // 0-indexed
  const totalCost = projectRows.reduce((s, p) => s + p.cost, 0);

  const grandTotalCostStyle = {
    font: { bold: true, sz: 12, color: { rgb: HEADER_FG } },
    fill: { fgColor: { rgb: HEADER_BG } },
    alignment: { horizontal: "right", vertical: "middle" },
    border: headerBorder
  };

  const grandTotalValStyle = {
    font: { bold: true, sz: 12, color: { rgb: HEADER_FG } },
    fill: { fgColor: { rgb: HEADER_BG } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: headerBorder,
    numFmt: currencyFmt
  };

  ws3Data.push([
    buildCell("TOTAL LABOUR COST", grandTotalCostStyle),
    ...Array(3).fill(buildCell("", grandTotalCostStyle)),
    buildCell(totalCost, grandTotalValStyle)
  ]);

  const ws3 = XLSX.utils.aoa_to_sheet(ws3Data);

  // Merges
  ws3["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    { s: { r: ws3SumRowIdx, c: 0 }, e: { r: ws3SumRowIdx, c: 3 } },
  ];

  // Column widths
  ws3["!cols"] = [
    { wch: 28 }, { wch: 20 }, { wch: 16 }, { wch: 20 }, { wch: 20 }
  ];

  // Row heights
  ws3["!rows"] = [
    { hpt: 28 },
    { hpt: 18 },
    { hpt: 28 },
    ...Array(projectRows.length).fill({ hpt: 22 }),
    { hpt: 28 }
  ];

  ws3["!views"] = [{ state: "frozen", ySplit: 3 }];

  /* ── Append Sheets & Write ───────────────────────────────── */
  XLSX.utils.book_append_sheet(wb, ws1, "Workforce Summary");
  XLSX.utils.book_append_sheet(wb, ws2, "Attendance Calendar");
  XLSX.utils.book_append_sheet(wb, ws3, "Labour Cost Summary");

  const base64 = XLSX.write(wb, { bookType: "xlsx", type: "base64" });

  const filename = `sitecrew-report-${data.year}-${String(data.month).padStart(2, "0")}.xlsx`;
  const fileInstance = new File(Paths.cache, filename);
  fileInstance.write(base64, { encoding: "base64" });

  return {
    filename,
    fileUri: fileInstance.uri,
    rowCount: workerRows.length,
  };
}

/**
 * Share a generated report file using the native share sheet.
 */
export async function shareReport(fileUri: string) {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error("Sharing is not available on this device");
  }
  await Sharing.shareAsync(fileUri, {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    dialogTitle: "Share SiteCrew Report",
  });
}
