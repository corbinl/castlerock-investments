export function formatCurrency(value: number | undefined | null) {
  if (value === undefined || value === null) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function formatPercent(value: number | undefined | null) {
  if (value === undefined || value === null) return "0%";
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number | undefined | null) {
  if (value === undefined || value === null) return "0";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

export function cnPnl(pnl: number | undefined | null) {
  if (!pnl) return "text-muted-foreground";
  return pnl > 0 ? "text-success" : pnl < 0 ? "text-destructive" : "text-muted-foreground";
}
