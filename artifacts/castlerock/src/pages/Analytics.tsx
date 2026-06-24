import { useState, useEffect } from "react";
import {
  useGetAnalyticsOverview, useGetAnalyticsBySymbol, useGetAnalyticsByStrategy,
  useGetAnalyticsByDay, useGetAnalyticsByHour, useGetStreakAnalysis, useGetEquityCurve,
  useGetAnalyticsByAssetClass, useGetInsights, useGetAnalyticsByTag,
  useGetAnalyticsByRule, useGetAnalyticsByTilt, useGetAnalyticsBySession,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, Cell, PieChart, Pie, LineChart, Line, ReferenceLine,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, Zap, Lightbulb, TrendingUp, TrendingDown, Brain, RefreshCw, Search, Sparkles, Clock, X } from "lucide-react";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
const fmt = (n: number, prefix = "$") => `${prefix}${Math.abs(n).toFixed(2)}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface TimeCell {
  dayOfWeek: number;
  hour: number;
  avgPnl: number;
  totalPnl: number;
  count: number;
  winRate: number;
}

function heatColor(value: number, max: number): string {
  if (max === 0 || value === 0) return "hsl(var(--muted))";
  const intensity = Math.min(Math.abs(value) / max, 1);
  if (value > 0) {
    const l = Math.round(45 - intensity * 18);
    return `hsl(142 ${Math.round(40 + intensity * 30)}% ${l}%)`;
  } else {
    const l = Math.round(45 - intensity * 18);
    return `hsl(0 ${Math.round(55 + intensity * 25)}% ${l}%)`;
  }
}

function PnlHeatmap({ cells }: { cells: TimeCell[] }) {
  const [tooltip, setTooltip] = useState<{ cell: TimeCell; x: number; y: number } | null>(null);

  const FIXED_DAYS = [0, 1, 2, 3, 4, 5, 6];
  const FIXED_HOURS = Array.from({ length: 24 }, (_, i) => i);
  const maxAbs = cells.length > 0 ? Math.max(...cells.map((c) => Math.abs(c.avgPnl))) : 0;
  const cellMap = new Map(cells.map((c) => [`${c.dayOfWeek}:${c.hour}`, c]));
  const hasAnyData = cells.length > 0;

  if (!hasAnyData) {
    return <div className="py-8 text-center text-muted-foreground text-sm">No closed trades with timestamps yet</div>;
  }

  return (
    <div className="relative overflow-x-auto">
      <div
        className="grid text-xs select-none"
        style={{ gridTemplateColumns: `3.5rem repeat(7, 1fr)` }}
      >
        <div className="px-1 py-1 text-muted-foreground text-right text-[10px]" />
        {FIXED_DAYS.map((d) => (
          <div key={d} className="px-1 py-1 text-center font-medium text-muted-foreground text-[10px] uppercase tracking-wider">
            {DOW_LABELS[d]}
          </div>
        ))}

        {FIXED_HOURS.map((h) => (
          <>
            <div key={`lbl-${h}`} className="px-1 text-muted-foreground text-right text-[10px] flex items-center justify-end" style={{ height: 20 }}>
              {h.toString().padStart(2, "0")}h
            </div>
            {FIXED_DAYS.map((d) => {
              const cell = cellMap.get(`${d}:${h}`);
              return (
                <div
                  key={`${d}:${h}`}
                  className="m-px rounded-sm cursor-default transition-opacity hover:opacity-75"
                  style={{
                    height: 20,
                    backgroundColor: cell ? heatColor(cell.avgPnl, maxAbs) : "hsl(var(--muted) / 0.3)",
                    opacity: cell ? 1 : 0.35,
                  }}
                  onMouseEnter={(e) => cell && setTooltip({ cell, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}
          </>
        ))}
      </div>

      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-xs space-y-0.5"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <p className="font-semibold">{DOW_LABELS[tooltip.cell.dayOfWeek]} {tooltip.cell.hour.toString().padStart(2, "0")}:00</p>
          <p className={tooltip.cell.avgPnl >= 0 ? "text-success" : "text-destructive"}>
            Avg P&L: {tooltip.cell.avgPnl >= 0 ? "+" : "-"}{fmt(tooltip.cell.avgPnl)}
          </p>
          <p className="text-muted-foreground">Trades: {tooltip.cell.count} · Win rate: {pct(tooltip.cell.winRate)}</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, positive, mono = true }: { label: string; value: string; sub?: string; positive?: boolean; mono?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-xl font-bold ${mono ? "font-mono tabular-nums" : ""} ${positive === true ? "text-success" : positive === false ? "text-destructive" : ""}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function SliceTable({ rows, title }: { rows: { label: string; totalPnl: number; winRate: number; tradeCount: number; avgPnl: number; expectancy: number }[]; title: string }) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-muted/30">
            {[title.split(" ").slice(-1)[0], "Trades", "Win Rate", "Total P&L", "Avg P&L", "Expectancy"].map((h) => (
              <th key={h} className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-border">
            {rows.slice(0, 15).map((r) => (
              <tr key={r.label} className="hover:bg-muted/20">
                <td className="px-4 py-2 font-medium">{r.label}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.tradeCount}</td>
                <td className="px-4 py-2 font-mono text-xs">{pct(r.winRate)}</td>
                <td className={`px-4 py-2 font-mono text-xs font-semibold ${r.totalPnl >= 0 ? "text-success" : "text-destructive"}`}>{r.totalPnl >= 0 ? "+" : "-"}{fmt(r.totalPnl)}</td>
                <td className={`px-4 py-2 font-mono text-xs ${r.avgPnl >= 0 ? "text-success" : "text-destructive"}`}>{fmt(r.avgPnl)}</td>
                <td className={`px-4 py-2 font-mono text-xs ${r.expectancy >= 0 ? "text-success" : "text-destructive"}`}>{fmt(r.expectancy)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">No data yet</td></tr>}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

const NLQ_HISTORY_KEY = "cr_nlq_history";
const SUGGESTED_QUESTIONS = [
  "When do I lose the most money?",
  "Show me all trades where I broke my rules",
  "What's my edge on Mondays?",
  "Which symbols are most profitable for me?",
  "How do I perform in the morning vs afternoon?",
  "What's my average win vs loss ratio by setup?",
];

interface NlqRow { label: string; trades: number; winRate: string; totalPnl: string; avgPnl: string }
interface NlqResult { answer: string; tableTitle: string | null; tableRows: NlqRow[]; queryType: string }

function getNlqHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(NLQ_HISTORY_KEY) || "[]"); } catch { return []; }
}
function saveNlqHistory(q: string) {
  const prev = getNlqHistory().filter((h) => h !== q);
  localStorage.setItem(NLQ_HISTORY_KEY, JSON.stringify([q, ...prev].slice(0, 10)));
}

export default function Analytics() {
  const [tab, setTab] = useState("overview");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [themes, setThemes] = useState<{ theme: string; description: string; frequency: string; action: string }[]>([]);
  const [themesMessage, setThemesMessage] = useState<string | null>(null);
  const [themesLoading, setThemesLoading] = useState(false);
  const [themesCached, setThemesCached] = useState(false);

  const [nlqInput, setNlqInput] = useState("");
  const [nlqLoading, setNlqLoading] = useState(false);
  const [nlqResult, setNlqResult] = useState<NlqResult | null>(null);
  const [nlqError, setNlqError] = useState<string | null>(null);
  const [nlqHistory, setNlqHistory] = useState<string[]>(getNlqHistory);

  const [byTime, setByTime] = useState<TimeCell[]>([]);
  const [checklistCompliance, setChecklistCompliance] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/checklist/compliance?days=30")
      .then((r) => r.ok ? r.json() : [])
      .then((data: { pct: number }[]) => {
        if (Array.isArray(data) && data.length > 0) {
          const avg = Math.round(data.reduce((s, d) => s + d.pct, 0) / data.length);
          setChecklistCompliance(avg);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (dateFrom) qs.set("dateFrom", dateFrom);
    if (dateTo) qs.set("dateTo", dateTo);
    fetch(`/api/analytics/by-time${qs.size ? "?" + qs.toString() : ""}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setByTime(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (tab === "coach") {
      fetch("/api/coach/themes")
        .then((r) => r.ok ? r.json() : null)
        .then((res) => {
          if (res?.themes?.length) { setThemes(res.themes); setThemesCached(res.cached ?? false); }
          if (res?.message) setThemesMessage(res.message);
        })
        .catch(() => {});
    }
  }, [tab]);

  const handleNlqSubmit = async (question: string) => {
    const q = question.trim();
    if (!q || nlqLoading) return;
    setNlqInput(q);
    setNlqLoading(true);
    setNlqError(null);
    setNlqResult(null);
    try {
      const res = await fetch("/api/query/natural", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Query failed");
      }
      const data = await res.json();
      setNlqResult(data);
      saveNlqHistory(q);
      setNlqHistory(getNlqHistory());
    } catch (e: unknown) {
      setNlqError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setNlqLoading(false);
    }
  };

  const handleAnalyzeThemes = async (regenerate = false) => {
    setThemesLoading(true);
    setThemesMessage(null);
    try {
      const res = await fetch("/api/coach/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.themes?.length) { setThemes(data.themes); setThemesCached(data.cached ?? false); }
        if (data.message) setThemesMessage(data.message);
      }
    } catch {
      setThemesMessage("Failed to analyze themes.");
    } finally {
      setThemesLoading(false);
    }
  };

  const params = {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const { data: ov } = useGetAnalyticsOverview(params);
  const { data: bySymbol } = useGetAnalyticsBySymbol(params);
  const { data: byStrategy } = useGetAnalyticsByStrategy(params);
  const { data: byDay } = useGetAnalyticsByDay(params);
  const { data: byHour } = useGetAnalyticsByHour(params);
  const { data: streaks } = useGetStreakAnalysis({});
  const { data: equity } = useGetEquityCurve(params);
  const { data: byAsset } = useGetAnalyticsByAssetClass({});
  const { data: insights } = useGetInsights({ limit: 20 });
  const { data: byTag } = useGetAnalyticsByTag({});
  const { data: byRule } = useGetAnalyticsByRule({});
  const { data: byTilt } = useGetAnalyticsByTilt({});
  const { data: bySession } = useGetAnalyticsBySession(params);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Performance Analytics</h1>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36 h-8 text-sm" />
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36 h-8 text-sm" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs text-muted-foreground hover:text-foreground underline">clear</button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdowns</TabsTrigger>
          <TabsTrigger value="time">Time Analysis</TabsTrigger>
          <TabsTrigger value="streaks">Streaks</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="query" data-testid="tab-query">
            <Search className="w-3.5 h-3.5 mr-1.5" />Ask Journal
          </TabsTrigger>
          <TabsTrigger value="coach" data-testid="tab-coach">
            <Brain className="w-3.5 h-3.5 mr-1.5" />Coach
          </TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-4">
          {ov && (
            <>
              <div className="grid grid-cols-4 gap-4">
                <StatCard label="Total P&L" value={`${ov.totalPnl >= 0 ? "+" : "-"}${fmt(ov.totalPnl)}`} positive={ov.totalPnl >= 0} />
                <StatCard label="Win Rate" value={pct(ov.winRate)} sub={`${ov.totalTrades} trades`} />
                <StatCard label="Profit Factor" value={ov.profitFactor === 999 ? "∞" : ov.profitFactor.toFixed(2)} positive={ov.profitFactor >= 1.5 ? true : undefined} />
                <StatCard label="Expectancy" value={fmt(ov.expectancy)} positive={ov.expectancy >= 0} />
                <StatCard label="Avg Win" value={fmt(ov.avgWin)} positive />
                <StatCard label="Avg Loss" value={fmt(ov.avgLoss)} positive={false} />
                <StatCard label="Max Drawdown" value={fmt(ov.maxDrawdown)} positive={false} />
                <StatCard label="Avg R" value={`${ov.avgRMultiple.toFixed(2)}R`} positive={ov.avgRMultiple > 0 ? true : undefined} />
                {checklistCompliance !== null && (
                  <StatCard
                    label="Ritual Compliance"
                    value={`${checklistCompliance}%`}
                    sub="30-day avg"
                    positive={checklistCompliance >= 80 ? true : checklistCompliance < 50 ? false : undefined}
                    mono
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-0 pt-4 px-5"><CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Equity Curve</CardTitle></CardHeader>
                  <CardContent className="pt-2 px-2 pb-3">
                    {(equity ?? []).length === 0 ? <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No closed trades yet</div> : (
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={equity} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                          <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} width={55} />
                          <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, "Cumulative P&L"]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} />
                          <Area type="monotone" dataKey="cumulativePnl" stroke="hsl(var(--primary))" fill="url(#ag)" strokeWidth={2} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-0 pt-4 px-5"><CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">By Asset Class</CardTitle></CardHeader>
                  <CardContent className="pt-2">
                    {(byAsset ?? []).length === 0 ? <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No data</div> : (
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={byAsset?.map((a) => ({ name: a.label, value: Math.abs(a.totalPnl) }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                            {(byAsset ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`]} contentStyle={{ fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Breakdowns ── */}
        <TabsContent value="breakdown" className="space-y-4">
          <SliceTable rows={bySymbol ?? []} title="By Symbol" />
          <SliceTable rows={byStrategy ?? []} title="By Strategy/Setup" />
          <SliceTable rows={byTag ?? []} title="By Tag" />
          <SliceTable rows={bySession ?? []} title="By Session" />

          {/* Discipline panel */}
          {byRule && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Rule Discipline</CardTitle></CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Adherence rate</p>
                    <p className="text-xl font-bold font-mono">{pct(byRule.adherenceRate ?? 0)}</p>
                    <p className="text-xs text-muted-foreground">{byRule.ruleFollowedCount} followed · {byRule.ruleBrokenCount} broken</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Win rate — followed rules</p>
                    <p className={`text-xl font-bold font-mono ${(byRule.ruleFollowedWinRate ?? 0) >= 0.5 ? "text-success" : "text-destructive"}`}>{pct(byRule.ruleFollowedWinRate ?? 0)}</p>
                    <p className="text-xs text-muted-foreground">Expectancy: {fmt(byRule.ruleFollowedExpectancy ?? 0)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Win rate — broke rules</p>
                    <p className={`text-xl font-bold font-mono ${(byRule.ruleBrokenWinRate ?? 0) >= 0.5 ? "text-success" : "text-destructive"}`}>{pct(byRule.ruleBrokenWinRate ?? 0)}</p>
                    <p className="text-xs text-muted-foreground">Expectancy: {fmt(byRule.ruleBrokenExpectancy ?? 0)}</p>
                  </div>
                </div>
                {byRule.ruleFollowedCount > 0 && byRule.ruleBrokenCount > 0 && (
                  <div className={`mt-4 p-3 rounded-lg text-sm flex items-center gap-2 ${(byRule.ruleFollowedWinRate ?? 0) > (byRule.ruleBrokenWinRate ?? 0) ? "bg-success/10 text-success" : "bg-muted"}`}>
                    {(byRule.ruleFollowedWinRate ?? 0) > (byRule.ruleBrokenWinRate ?? 0)
                      ? <><TrendingUp className="w-4 h-4 shrink-0" /> Following your rules gives you a {pct((byRule.ruleFollowedWinRate ?? 0) - (byRule.ruleBrokenWinRate ?? 0))} higher win rate.</>
                      : <><TrendingDown className="w-4 h-4 shrink-0" /> Your rules-broken win rate is higher — worth reviewing your ruleset.</>}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tilt state panel */}
          {(byTilt ?? []).length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">By Mental State</CardTitle></CardHeader>
              <CardContent className="pt-2 px-2 pb-3">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={byTilt} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} width={55} />
                    <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, "Total P&L"]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} />
                    <Bar dataKey="totalPnl" radius={[3, 3, 0, 0]}>
                      {(byTilt ?? []).map((d, i) => <Cell key={i} fill={(d.totalPnl ?? 0) >= 0 ? "hsl(var(--chart-2))" : "hsl(var(--chart-5))"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Time-of-Day P&L Heatmap */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Time-of-Day P&amp;L Heatmap
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Avg P&amp;L per entry hour × day of week · hover for details</p>
            </CardHeader>
            <CardContent className="px-4 pb-5">
              <PnlHeatmap cells={byTime} />
              <div className="flex items-center gap-3 mt-3 justify-end">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <div className="w-3 h-3 rounded" style={{ background: "hsl(0 80% 37%)" }} /> Loss
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <div className="w-3 h-3 rounded bg-muted opacity-40" /> No data
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <div className="w-3 h-3 rounded" style={{ background: "hsl(142 70% 27%)" }} /> Profit
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cumulative P&L by Hour — line chart */}
          {(byHour ?? []).some((h) => h.tradeCount > 0) && (() => {
            const sorted = [...(byHour ?? [])]
              .filter((h) => h.tradeCount > 0)
              .sort((a, b) => a.hour - b.hour);
            let running = 0;
            const cumulData = sorted.map((h) => {
              running += h.avgPnl;
              return { hour: h.hour, cumulativePnl: running };
            });
            return (
              <Card>
                <CardHeader className="pb-0 pt-4 px-5">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Cumulative P&amp;L by Hour of Day</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Running sum of avg P&amp;L across trade hours — shows where the day gains or bleeds</p>
                </CardHeader>
                <CardContent className="pt-2 px-2 pb-3">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={cumulData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}h`} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} width={60} />
                      <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
                      <Tooltip
                        formatter={(v: number) => [`${v >= 0 ? "+" : "-"}$${Math.abs(v).toFixed(2)}`, "Cumulative P&L"]}
                        labelFormatter={(l) => `Hour ${l}:00`}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="cumulativePnl"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={(props: { cx: number; cy: number; payload: { hour: number; cumulativePnl: number } }) => (
                          <circle
                            key={props.payload.hour}
                            cx={props.cx}
                            cy={props.cy}
                            r={3}
                            fill={props.payload.cumulativePnl >= 0 ? "hsl(var(--chart-2))" : "hsl(var(--chart-5))"}
                            stroke="none"
                          />
                        )}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>

        {/* ── Time Analysis ── */}
        <TabsContent value="time" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-0 pt-4 px-5"><CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">P&L by Day of Week</CardTitle></CardHeader>
              <CardContent className="pt-2 px-2 pb-3">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={byDay ?? []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(0, 3)} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} width={55} />
                    <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} />
                    <Bar dataKey="totalPnl" radius={[3, 3, 0, 0]}>
                      {(byDay ?? []).map((d, i) => <Cell key={i} fill={d.totalPnl >= 0 ? "hsl(var(--chart-2))" : "hsl(var(--chart-5))"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-0 pt-4 px-5"><CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Win Rate by Hour</CardTitle></CardHeader>
              <CardContent className="pt-2 px-2 pb-3">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={(byHour ?? []).filter((h) => h.tradeCount > 0)} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}h`} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} width={40} domain={[0, 1]} />
                    <Tooltip formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, "Win Rate"]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} />
                    <Bar dataKey="winRate" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <SliceTable rows={(byDay ?? []).map((d) => ({ ...d, label: d.label }))} title="Performance by Day" />
        </TabsContent>

        {/* ── Streaks ── */}
        <TabsContent value="streaks" className="space-y-4">
          {streaks && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <StatCard
                  label="Current Streak"
                  value={`${streaks.currentStreak} ${streaks.currentStreakType ?? ""}`}
                  positive={streaks.currentStreakType === "win" ? true : streaks.currentStreakType === "loss" ? false : undefined}
                />
                <StatCard label="Max Win Streak" value={`${streaks.maxWinStreak} wins`} positive />
                <StatCard label="Max Loss Streak" value={`${streaks.maxLossStreak} losses`} positive={false} />
              </div>

              {(streaks.winRateAfterWin != null || streaks.winRateAfterLoss != null || streaks.avgPnlAfterWinStreak3 != null) && (
                <div className="grid grid-cols-3 gap-4">
                  {streaks.winRateAfterWin != null && (
                    <StatCard
                      label="Win Rate After a Win"
                      value={pct(streaks.winRateAfterWin)}
                      sub="momentum effect?"
                      positive={streaks.winRateAfterWin > 0.5 ? true : undefined}
                    />
                  )}
                  {streaks.winRateAfterLoss != null && (
                    <StatCard
                      label="Win Rate After a Loss"
                      value={pct(streaks.winRateAfterLoss)}
                      sub="bounce-back rate"
                    />
                  )}
                  {streaks.avgPnlAfterWinStreak3 != null && (
                    <StatCard
                      label="Avg P&L After 3-Win Streak"
                      value={fmt(streaks.avgPnlAfterWinStreak3)}
                      sub="overconfidence signal?"
                      positive={streaks.avgPnlAfterWinStreak3 >= 0}
                    />
                  )}
                  {streaks.avgPnlAfterLossStreak3 != null && (
                    <StatCard
                      label="Avg P&L After 3-Loss Streak"
                      value={fmt(streaks.avgPnlAfterLossStreak3)}
                      sub="revenge trading risk?"
                      positive={streaks.avgPnlAfterLossStreak3 >= 0}
                    />
                  )}
                </div>
              )}

              {((streaks as any).streaks as { type: string; length: number }[] | undefined)?.length && (
                <Card>
                  <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recent Streak History</CardTitle></CardHeader>
                  <CardContent className="px-5 pb-5">
                    <div className="flex flex-wrap gap-2">
                      {[...((streaks as any).streaks as { type: string; length: number }[])].reverse().map((s, i: number) => (
                        <div
                          key={i}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                            s.type === "win" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                          }`}
                        >
                          {s.type === "win" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {s.length}× {s.type}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
          {(!streaks || streaks.maxWinStreak === 0) && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Import at least 10 trades to see streak analysis</CardContent></Card>
          )}
        </TabsContent>

        {/* ── Insights ── */}
        <TabsContent value="insights" className="space-y-3">
          {(insights ?? []).length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Import trades to generate pattern-based insights</CardContent></Card>
          )}
          {(insights ?? []).map((insight) => (
            <Card key={insight.id} data-testid={`insight-card-${insight.id}`}>
              <CardContent className="pt-4 pb-4 px-5 flex gap-4">
                <div className="shrink-0 mt-0.5">
                  {insight.priority <= 3 ? <Zap className="w-5 h-5 text-yellow-500" /> : <Lightbulb className="w-5 h-5 text-primary" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{insight.title}</h3>
                    <Badge variant="secondary" className="text-xs">{insight.category}</Badge>
                    {insight.isActionable && <Badge variant="outline" className="text-xs border-primary text-primary">Actionable</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{insight.body}</p>
                  {insight.sampleSize > 0 && <p className="text-xs text-muted-foreground mt-1">Based on {insight.sampleSize} trades</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Ask Journal (NLQ) ── */}
        <TabsContent value="query" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 pt-4 px-5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Ask Your Journal</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Ask anything about your trading data in plain English</p>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    data-testid="nlq-input"
                    placeholder="Ask your journal..."
                    value={nlqInput}
                    onChange={(e) => setNlqInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleNlqSubmit(nlqInput); }}
                    className="pl-9 h-10"
                    disabled={nlqLoading}
                  />
                </div>
                <Button
                  data-testid="nlq-submit"
                  onClick={() => handleNlqSubmit(nlqInput)}
                  disabled={nlqLoading || !nlqInput.trim()}
                  className="h-10 px-4 gap-1.5"
                >
                  {nlqLoading ? (
                    <><div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current" />Thinking…</>
                  ) : (
                    <><Sparkles className="w-3.5 h-3.5" />Ask</>
                  )}
                </Button>
              </div>

              {/* Suggested questions */}
              {!nlqResult && !nlqLoading && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Suggested questions</p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => handleNlqSubmit(q)}
                        className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* History chips */}
              {nlqHistory.length > 0 && !nlqResult && !nlqLoading && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5"><Clock className="w-3 h-3" />Recent questions</p>
                  <div className="flex flex-wrap gap-2">
                    {nlqHistory.map((q) => (
                      <button
                        key={q}
                        onClick={() => handleNlqSubmit(q)}
                        className="text-xs px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors max-w-xs truncate"
                        title={q}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading skeleton */}
              {nlqLoading && (
                <div className="space-y-2 animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
              )}

              {/* Error */}
              {nlqError && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2">
                  <X className="w-4 h-4 mt-0.5 shrink-0" />
                  {nlqError}
                </div>
              )}

              {/* Answer card */}
              {nlqResult && (
                <div className="space-y-3">
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <p className="text-sm leading-relaxed">{nlqResult.answer}</p>
                    </div>
                  </div>

                  {nlqResult.tableRows && nlqResult.tableRows.length > 0 && (
                    <div>
                      {nlqResult.tableTitle && (
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{nlqResult.tableTitle}</p>
                      )}
                      <div className="rounded-lg border border-border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/30 border-b border-border">
                              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Segment</th>
                              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Trades</th>
                              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Win Rate</th>
                              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Total P&L</th>
                              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Avg P&L</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {nlqResult.tableRows.map((row, i) => {
                              const pnlNum = parseFloat(row.totalPnl?.replace(/[$,]/g, "") || "0");
                              return (
                                <tr key={i} className="hover:bg-muted/20">
                                  <td className="px-3 py-2 font-medium">{row.label}</td>
                                  <td className="px-3 py-2 text-right font-mono text-xs">{row.trades}</td>
                                  <td className="px-3 py-2 text-right font-mono text-xs">{row.winRate}</td>
                                  <td className={`px-3 py-2 text-right font-mono text-xs font-semibold ${pnlNum >= 0 ? "text-success" : "text-destructive"}`}>{row.totalPnl}</td>
                                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{row.avgPnl}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => { setNlqResult(null); setNlqInput(""); }}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Ask another question
                    </button>
                    {nlqHistory.length > 0 && (
                      <span className="text-xs text-muted-foreground">·</span>
                    )}
                    {nlqHistory.slice(0, 3).filter((q) => q !== nlqInput).map((q) => (
                      <button
                        key={q}
                        onClick={() => handleNlqSubmit(q)}
                        className="text-xs text-primary hover:underline truncate max-w-[200px]"
                        title={q}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Coach ── */}
        <TabsContent value="coach" className="space-y-4">
          <Card>
            <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Behavioral Themes</CardTitle>
              </div>
              <div className="flex gap-2">
                {themes.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => handleAnalyzeThemes(true)} disabled={themesLoading} data-testid="button-themes-refresh">
                    <RefreshCw className={`w-3.5 h-3.5 ${themesLoading ? "animate-spin" : ""}`} />
                  </Button>
                )}
                <Button size="sm" onClick={() => handleAnalyzeThemes(false)} disabled={themesLoading} data-testid="button-analyze-themes">
                  {themesLoading ? "Analyzing..." : themes.length > 0 ? "Re-analyze" : "Analyze Themes"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {themesMessage && themes.length === 0 && (
                <p className="text-sm text-muted-foreground italic">{themesMessage}</p>
              )}
              {!themesMessage && themes.length === 0 && !themesLoading && (
                <p className="text-sm text-muted-foreground italic">
                  Get AI coaching on individual trades, then click "Analyze Themes" to discover recurring behavioral patterns across your journal.
                </p>
              )}
              {themesLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                  Analyzing your coaching notes for patterns...
                </div>
              )}
              {themes.length > 0 && !themesLoading && (
                <div className="space-y-4">
                  {themes.map((t, i) => (
                    <div key={i} className="border border-border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm">{t.theme}</h3>
                        <Badge variant="secondary" className="text-xs shrink-0">{t.frequency}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{t.description}</p>
                      <div className="flex items-start gap-2 pt-1 border-t border-border/50">
                        <Zap className="w-3.5 h-3.5 text-yellow-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-foreground font-medium">{t.action}</p>
                      </div>
                    </div>
                  ))}
                  {themesCached && (
                    <p className="text-xs text-muted-foreground">Cached analysis · <button className="underline cursor-pointer" onClick={() => handleAnalyzeThemes(true)}>Refresh</button></p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">How to Use AI Coaching</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">1</span>
                <p>Open any trade from the <strong className="text-foreground">Trade Log</strong>, fill out the journal, and hit "Get Coaching" for AI feedback on that specific trade.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">2</span>
                <p>After getting coaching on at least 3 trades, come back here and click <strong className="text-foreground">"Analyze Themes"</strong> to see recurring patterns across your journal.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">3</span>
                <p>Each theme includes a concrete action step. Add these to your trading rules to systematically address your behavioral edge cases.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
