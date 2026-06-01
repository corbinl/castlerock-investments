import { useState } from "react";
import { useGetPivotTable } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const DIMS = [
  { value: "symbol", label: "Symbol" },
  { value: "direction", label: "Direction" },
  { value: "setup", label: "Setup" },
  { value: "assetClass", label: "Asset Class" },
  { value: "tags", label: "Tags" },
];

const METRICS = [
  { value: "totalPnl", label: "Total P&L", format: (v: number) => `$${v.toFixed(2)}` },
  { value: "winRate", label: "Win Rate", format: (v: number) => `${(v * 100).toFixed(1)}%` },
  { value: "tradeCount", label: "Trade Count", format: (v: number) => String(v) },
  { value: "avgPnl", label: "Avg P&L", format: (v: number) => `$${v.toFixed(2)}` },
  { value: "rMultiple", label: "Avg R", format: (v: number) => `${v.toFixed(2)}R` },
];

function heatColor(val: number | null, min: number, max: number, metric: string): string {
  if (val === null) return "hsl(var(--muted))";
  const isPositiveBetter = metric !== "rMultiple" || val >= 0;
  const range = Math.max(Math.abs(min), Math.abs(max), 0.01);
  const norm = val / range;
  if (val >= 0) return `hsla(142,70%,45%,${Math.min(0.1 + norm * 0.8, 0.9)})`;
  return `hsla(0,70%,55%,${Math.min(0.1 + Math.abs(norm) * 0.8, 0.9)})`;
}

export default function Pivot() {
  const [rowDim, setRowDim] = useState("symbol");
  const [colDim, setColDim] = useState("direction");
  const [metric, setMetric] = useState("totalPnl");

  const { data, isLoading, isError } = useGetPivotTable({ rowDimension: rowDim, colDimension: colDim, metric });

  const metricFmt = METRICS.find((m) => m.value === metric)?.format ?? ((v: number) => String(v));

  const allVals = data?.cells.flat().filter((v) => v !== null) as number[];
  const minVal = allVals ? Math.min(...allVals) : 0;
  const maxVal = allVals ? Math.max(...allVals) : 0;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Pivot Explorer</h1>
      <p className="text-sm text-muted-foreground">Cross-reference any two dimensions to find edge patterns in your trading.</p>

      <Card>
        <CardContent className="pt-4 pb-4 flex flex-wrap gap-6">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Row Dimension</Label>
            <Select value={rowDim} onValueChange={setRowDim}>
              <SelectTrigger className="w-40" data-testid="select-row-dim"><SelectValue /></SelectTrigger>
              <SelectContent>{DIMS.filter((d) => d.value !== colDim).map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Column Dimension</Label>
            <Select value={colDim} onValueChange={setColDim}>
              <SelectTrigger className="w-40" data-testid="select-col-dim"><SelectValue /></SelectTrigger>
              <SelectContent>{DIMS.filter((d) => d.value !== rowDim).map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Metric</Label>
            <Select value={metric} onValueChange={setMetric}>
              <SelectTrigger className="w-40" data-testid="select-metric"><SelectValue /></SelectTrigger>
              <SelectContent>{METRICS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-4 h-4 rounded" style={{ background: "hsla(142,70%,45%,0.6)" }} /><span>Positive</span>
              <div className="w-4 h-4 rounded ml-2" style={{ background: "hsla(0,70%,55%,0.6)" }} /><span>Negative</span>
              <div className="w-4 h-4 rounded ml-2" style={{ background: "hsl(var(--muted))" }} /><span>No data</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && <div className="h-40 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}
      {isError && <Card><CardContent className="py-8 text-center text-destructive text-sm">Failed to load pivot data. Check that the row and column dimensions are different.</CardContent></Card>}

      {data && (
        <Card>
          <CardContent className="p-0 overflow-auto">
            <table className="text-sm w-full" data-testid="pivot-table">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2.5 text-left text-xs text-muted-foreground uppercase font-medium sticky left-0 bg-card">{DIMS.find((d) => d.value === rowDim)?.label} \ {DIMS.find((d) => d.value === colDim)?.label}</th>
                  {data.colLabels.map((col) => (
                    <th key={col} className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.rowLabels.map((row, ri) => (
                  <tr key={row} className="hover:bg-muted/10">
                    <td className="px-4 py-2.5 font-medium sticky left-0 bg-card border-r border-border">{row}</td>
                    {data.colLabels.map((col, ci) => {
                      const val = data.cells[ri]?.[ci] ?? null;
                      return (
                        <td key={col} className="px-4 py-2.5 text-center font-mono text-xs font-semibold"
                          style={{ background: heatColor(val, minVal, maxVal, metric) }}
                          data-testid={`pivot-cell-${row}-${col}`}>
                          {val !== null ? metricFmt(val) : <span className="text-muted-foreground">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {data.rowLabels.length === 0 && (
                  <tr><td colSpan={data.colLabels.length + 1} className="px-4 py-12 text-center text-muted-foreground">No data — import trades to use the pivot explorer</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
