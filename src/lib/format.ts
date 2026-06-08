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
