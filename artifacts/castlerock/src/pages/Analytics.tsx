import { useState } from "react";
import { useGetAnalyticsOverview, useGetAnalyticsBySymbol, useGetAnalyticsByStrategy, useGetAnalyticsByDay, useGetAnalyticsByHour, useGetStreakAnalysis, useGetEquityCurve, useGetAnalyticsByAssetClass, useGetInsights } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, LineChart, Line, Cell, PieChart, Pie, Legend
} from "recharts";
import { ArrowUpRight, ArrowDownRight, TrendingUp, Zap, Lightbulb } from "lucide-react";

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
            {[title.split(" ")[0], "Trades", "Win Rate", "Total P&L", "Avg P&L", "Expectancy"].map((h) => (
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
  const { data: ov } = useGetAnalyticsOverview({});
  const { data: bySymbol } = useGetAnalyticsBySymbol({});
  const { data: byStrategy } = useGetAnalyticsByStrategy({});
  const { data: byDay } = useGetAnalyticsByDay({});
  const { data: byHour } = useGetAnalyticsByHour({});
  const { data: streaks } = useGetStreakAnalysis({});
  const { data: equity } = useGetEquityCurve({});
  const { data: byAsset } = useGetAnalyticsByAssetClass({});
  const { data: insights } = useGetInsights({ limit: 5 });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Performance Analytics</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdowns</TabsTrigger>
          <TabsTrigger value="time">Time Analysis</TabsTrigger>
          <TabsTrigger value="streaks">Streaks</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

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

        <TabsContent value="breakdown" className="space-y-4">
          <SliceTable rows={bySymbol ?? []} title="By Symbol" />
          <SliceTable rows={byStrategy ?? []} title="By Strategy/Setup" />
        </TabsContent>

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

        <TabsContent value="streaks" className="space-y-4">
          {streaks && (
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Current Streak" value={`${streaks.currentStreak} ${streaks.currentStreakType}`}
                positive={streaks.currentStreakType === "win" ? true : streaks.currentStreakType === "loss" ? false : undefined} mono />
              <StatCard label="Max Win Streak" value={`${streaks.maxWinStreak} wins`} positive />
              <StatCard label="Max Loss Streak" value={`${streaks.maxLossStreak} losses`} positive={false} />
              {streaks.winRateAfterWin != null && <StatCard label="Win Rate After Win" value={pct(streaks.winRateAfterWin)} sub="momentum?" positive={streaks.winRateAfterWin > 0.5 ? true : undefined} />}
              {streaks.winRateAfterLoss != null && <StatCard label="Win Rate After Loss" value={pct(streaks.winRateAfterLoss)} sub="bounce-back?" />}
              {streaks.avgPnlAfterWinStreak3 != null && <StatCard label="Avg P&L After 3-Win Streak" value={fmt(streaks.avgPnlAfterWinStreak3)} positive={streaks.avgPnlAfterWinStreak3 >= 0} />}
            </div>
          )}
          {!streaks || streaks.maxWinStreak === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Import at least 10 trades to see streak analysis</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-3">
          {(insights ?? []).length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Import trades to generate pattern-based insights</CardContent></Card>
          )}
          {(insights ?? []).map((insight) => (
            <Card key={insight.id} data-testid={`insight-card-${insight.id}`}>
              <CardContent className="pt-4 pb-4 px-5 flex gap-4">
                <div className="shrink-0 mt-0.5">
                  {insight.priority >= 80 ? <Zap className="w-5 h-5 text-yellow-500" /> : <Lightbulb className="w-5 h-5 text-primary" />}
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
