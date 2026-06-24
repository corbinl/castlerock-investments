import { useState } from "react";
import {
  useGetAnalyticsOverview, useGetAnalyticsBySymbol, useGetAnalyticsByStrategy,
  useGetAnalyticsByDay, useGetAnalyticsByHour, useGetStreakAnalysis, useGetEquityCurve,
  useGetAnalyticsByAssetClass, useGetInsights, useGetAnalyticsByTag,
  useGetAnalyticsByRule, useGetAnalyticsByTilt, useGetAnalyticsBySession,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, Cell, PieChart, Pie,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, Zap, Lightbulb, TrendingUp, TrendingDown } from "lucide-react";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
const fmt = (n: number, prefix = "$") => `${prefix}${Math.abs(n).toFixed(2)}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

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

export default function Analytics() {
  const [tab, setTab] = useState("overview");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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
      </Tabs>
    </div>
  );
}
