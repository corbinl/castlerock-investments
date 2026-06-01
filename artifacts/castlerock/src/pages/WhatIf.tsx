import { useState } from "react";
import { useRunWhatIf, useGetAnalyticsOverview } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight, FlaskConical, Plus, X, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const FILTER_TYPES = [
  { value: "symbol", label: "Symbol (exact)", inputType: "text" },
  { value: "direction", label: "Direction", inputType: "select", options: ["long", "short"] },
  { value: "assetClass", label: "Asset Class", inputType: "text" },
  { value: "excludeSession", label: "Exclude Session", inputType: "select", options: ["Pre-Market", "Morning", "Afternoon", "Close", "After-Hours"] },
  { value: "includeOnly", label: "Include Only", inputType: "select", options: ["journaled", "rule-followed"] },
  { value: "minPnl", label: "Min P&L ($)", inputType: "number" },
  { value: "maxPnl", label: "Max P&L ($)", inputType: "number" },
];

type Filter = { key: string; value: string };
type WhatIfResult = {
  label: string;
  filteredTradeCount: number;
  actual: { totalPnl: number; winRate: number; profitFactor: number; expectancy: number; totalTrades: number };
  simulated: { totalPnl: number; winRate: number; profitFactor: number; expectancy: number; totalTrades: number };
  deltaWinRate: number; deltaExpectancy: number; deltaTotalPnl: number; deltaProfitFactor: number;
};

function DeltaBadge({ val, prefix = "$", suffix = "" }: { val: number; prefix?: string; suffix?: string }) {
  const pos = val >= 0;
  return (
    <Badge className={`${pos ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"} gap-1 font-mono`}>
      {pos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {pos ? "+" : "-"}{prefix}{Math.abs(val).toFixed(2)}{suffix}
    </Badge>
  );
}

export default function WhatIf() {
  const [filters, setFilters] = useState<Filter[]>([]);
  const [newKey, setNewKey] = useState(FILTER_TYPES[0]?.value ?? "symbol");
  const [newVal, setNewVal] = useState("");
  const [label, setLabel] = useState("Simulation 1");
  const [results, setResults] = useState<WhatIfResult[]>([]);

  const { data: actual } = useGetAnalyticsOverview({});
  const runWhatIf = useRunWhatIf();
  const { toast } = useToast();

  const addFilter = () => {
    if (!newVal.trim()) { toast({ title: "Enter a filter value" }); return; }
    setFilters(f => [...f, { key: newKey, value: newVal.trim() }]);
    setNewVal("");
  };

  const removeFilter = (i: number) => setFilters(f => f.filter((_, idx) => idx !== i));

  const run = () => {
    const filterObj: Record<string, string | number> = {};
    for (const f of filters) {
      filterObj[f.key] = isNaN(Number(f.value)) ? f.value : Number(f.value);
    }
    runWhatIf.mutate(
      { data: { filters: filterObj, label } },
      {
        onSuccess: (res) => setResults(r => [...r, res]),
        onError: () => toast({ title: "Simulation failed", variant: "destructive" }),
      }
    );
  };

  const filterDef = FILTER_TYPES.find((f) => f.value === newKey);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <FlaskConical className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">What-If Simulator</h1>
      </div>
      <p className="text-sm text-muted-foreground">Remove trade types from your history and see how your statistics would change — find your best edge.</p>

      <div className="grid grid-cols-3 gap-4">
        {/* Config panel */}
        <div className="col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Scenario</CardTitle></CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Label</Label>
                <Input data-testid="input-scenario-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Simulation name" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Filters (trade must match ALL)</Label>
                {filters.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-muted rounded px-2 py-1">
                    <Badge variant="secondary" className="text-xs">{FILTER_TYPES.find((ft) => ft.value === f.key)?.label ?? f.key}</Badge>
                    <span className="font-mono flex-1">{f.value}</span>
                    <button onClick={() => removeFilter(i)} data-testid={`remove-filter-${i}`} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}

                <div className="flex flex-col gap-2 pt-1">
                  <Select value={newKey} onValueChange={(v) => { setNewKey(v); setNewVal(""); }}>
                    <SelectTrigger data-testid="select-filter-type"><SelectValue /></SelectTrigger>
                    <SelectContent>{FILTER_TYPES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                  </Select>

                  {filterDef?.inputType === "select" ? (
                    <Select value={newVal} onValueChange={setNewVal}>
                      <SelectTrigger data-testid="select-filter-value"><SelectValue placeholder="Select value" /></SelectTrigger>
                      <SelectContent>{filterDef.options?.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <Input data-testid="input-filter-value" value={newVal} onChange={(e) => setNewVal(e.target.value)} type={filterDef?.inputType ?? "text"} placeholder="Value" onKeyDown={(e) => e.key === "Enter" && addFilter()} />
                  )}
                  <Button variant="outline" size="sm" onClick={addFilter} data-testid="button-add-filter" className="gap-1"><Plus className="w-3.5 h-3.5" />Add filter</Button>
                </div>
              </div>

              <Button onClick={run} disabled={runWhatIf.isPending} data-testid="button-run-simulation" className="w-full gap-1">
                <Play className="w-3.5 h-3.5" />{runWhatIf.isPending ? "Running..." : "Run Simulation"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="col-span-2 space-y-4">
          {actual && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Actual Performance</CardTitle></CardHeader>
              <CardContent className="px-5 pb-4 grid grid-cols-4 gap-3 text-sm">
                {[["Total P&L", `$${actual.totalPnl.toFixed(2)}`], ["Win Rate", `${(actual.winRate * 100).toFixed(1)}%`], ["Profit Factor", actual.profitFactor === 999 ? "∞" : actual.profitFactor.toFixed(2)], ["Expectancy", `$${actual.expectancy.toFixed(2)}`]].map(([l, v]) => (
                  <div key={l}><p className="text-xs text-muted-foreground mb-0.5">{l}</p><p className="font-mono font-semibold">{v}</p></div>
                ))}
              </CardContent>
            </Card>
          )}

          {results.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center">
                <FlaskConical className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Configure filters and run a simulation to see the impact</p>
                <p className="text-xs text-muted-foreground mt-1">Example: "What if I never traded short?" or "What if I only traded journaled trades?"</p>
              </CardContent>
            </Card>
          )}

          {results.map((r, i) => (
            <Card key={i} data-testid={`result-card-${i}`}>
              <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">{r.label}</CardTitle>
                <Badge variant="secondary" className="text-xs">{r.filteredTradeCount} trades after filter</Badge>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-3">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  {[
                    { l: "Total P&L", actual: r.actual.totalPnl, sim: r.simulated.totalPnl, delta: r.deltaTotalPnl },
                    { l: "Win Rate", actual: (r.actual.winRate * 100).toFixed(1) + "%", sim: (r.simulated.winRate * 100).toFixed(1) + "%", delta: r.deltaWinRate * 100, prefix: "", suffix: "%" },
                    { l: "Profit Factor", actual: r.actual.profitFactor === 999 ? "∞" : r.actual.profitFactor.toFixed(2), sim: r.simulated.profitFactor === 999 ? "∞" : r.simulated.profitFactor.toFixed(2), delta: r.deltaProfitFactor, prefix: "" },
                    { l: "Expectancy", actual: r.actual.expectancy, sim: r.simulated.expectancy, delta: r.deltaExpectancy },
                  ].map(({ l, actual, sim, delta, prefix = "$", suffix = "" }) => (
                    <div key={l}>
                      <p className="text-xs text-muted-foreground mb-1">{l}</p>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Before: <span className="font-mono">{typeof actual === "number" ? `$${actual.toFixed(2)}` : actual}</span></span>
                        <span className="text-xs">After: <span className="font-mono font-semibold">{typeof sim === "number" ? `$${sim.toFixed(2)}` : sim}</span></span>
                        {typeof delta === "number" && <DeltaBadge val={delta} prefix={prefix} suffix={suffix} />}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
