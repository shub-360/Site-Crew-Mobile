export function formatCurrency(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);
}

export function formatNumber(n: number | string | null | undefined): string {
  return new Intl.NumberFormat().format(Number(n ?? 0));
}

/**
 * Formats a Date object as a local ISO string (YYYY-MM-DD)
 * without UTC/timezone offset rollover side-effects.
 */
export function toLocalISODate(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

