import { useGetDashboardSummary, useGetBehavioralNudges } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ArrowUpRight, ArrowDownRight, TrendingUp, AlertTriangle, Info, CheckCircle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, parseISO } from "date-fns";

function MetricCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-2xl font-bold font-mono tabular-nums ${positive === true ? "text-success" : positive === false ? "text-destructive" : ""}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score / 100, 1);
  const color = score >= 65 ? "hsl(142,70%,45%)" : score >= 40 ? "hsl(45,90%,55%)" : "hsl(0,70%,55%)";
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${circ * pct} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
        <text x="50" y="46" textAnchor="middle" fontSize="20" fontWeight="700" fill={color} fontFamily="monospace">{score}</text>
        <text x="50" y="60" textAnchor="middle" fontSize="8" fill="hsl(var(--muted-foreground))">/100</text>
      </svg>
      <Badge variant="outline" className="text-xs">{label}</Badge>
    </div>
  );
}

function CalendarHeatmap({ data }: { data: { date: string; totalPnl: number; tradeCount: number }[] }) {
  const max = Math.max(...data.map((d) => Math.abs(d.totalPnl)), 1);
  return (
    <div className="grid grid-cols-7 gap-1">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
        <div key={d} className="text-center text-xs text-muted-foreground pb-1">{d}</div>
      ))}
      {data.map((day) => {
        const pnl = day.totalPnl;
        const intensity = Math.min(Math.abs(pnl) / max, 1);
        const bg =
          day.tradeCount === 0 ? "hsl(var(--muted))"
          : pnl > 0 ? `hsla(142,70%,45%,${0.15 + intensity * 0.8})`
          : `hsla(0,70%,55%,${0.15 + intensity * 0.8})`;
        return (
          <div key={day.date} title={`${day.date}: $${pnl.toFixed(2)} (${day.tradeCount} trades)`}
            className="aspect-square rounded-sm cursor-default" style={{ background: bg }} />
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useGetDashboardSummary({});

  if (isLoading) return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-muted animate-pulse rounded" />
      <div className="grid grid-cols-4 gap-4">{[...Array(8)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}</div>
    </div>
  );

  if (!data) return null;

  const { overview, recentTrades, equityCurve, calendarThisMonth, nudges, weeklyBriefing, untaggedCount } = data;

  const pnl = overview.totalPnl;
  const winRateFormatted = `${(overview.winRate * 100).toFixed(1)}%`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Command Center</h1>
        {untaggedCount > 0 && (
          <Link href="/queue">
            <Badge variant="destructive" className="cursor-pointer gap-1">
              <AlertTriangle className="w-3 h-3" />{untaggedCount} untagged
            </Badge>
          </Link>
        )}
      </div>

      {/* Top row: Score + key metrics */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="col-span-1 flex items-center justify-center py-4">
          <div className="text-center">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">CastleRock Score</p>
            <ScoreRing score={overview.castlerockScore} label={overview.castlerockScoreLabel} />
          </div>
        </Card>
        <div className="col-span-4 grid grid-cols-4 gap-4">
          <MetricCard label="Total P&L" value={`$${pnl.toFixed(2)}`} positive={pnl > 0 ? true : pnl < 0 ? false : undefined} />
          <MetricCard label="Win Rate" value={winRateFormatted} sub={`${overview.totalTrades} trades`} />
          <MetricCard label="Profit Factor" value={overview.profitFactor === 999 ? "∞" : overview.profitFactor.toFixed(2)} positive={overview.profitFactor >= 1.5 ? true : undefined} />
          <MetricCard label="Expectancy" value={`$${overview.expectancy.toFixed(2)}`} positive={overview.expectancy > 0 ? true : overview.expectancy < 0 ? false : undefined} />
          <MetricCard label="Avg Win" value={`$${overview.avgWin.toFixed(2)}`} positive />
          <MetricCard label="Avg Loss" value={`$${overview.avgLoss.toFixed(2)}`} positive={false} />
          <MetricCard label="Max Drawdown" value={`$${overview.maxDrawdown.toFixed(2)}`} positive={false} />
          <MetricCard label="Avg R" value={overview.avgRMultiple.toFixed(2)} positive={overview.avgRMultiple > 0 ? true : undefined} />
        </div>
      </div>

      {/* Equity curve + Calendar */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <CardHeader className="pb-0 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Equity Curve</CardTitle>
          </CardHeader>
          <CardContent className="pt-2 px-2 pb-3">
            {equityCurve.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No closed trades yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={equityCurve} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} width={60} />
                  <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, "Cumulative P&L"]} labelFormatter={(l) => `Date: ${l}`}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} />
                  <Area type="monotone" dataKey="cumulativePnl" stroke="hsl(var(--primary))" fill="url(#curveGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">This Month</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <CalendarHeatmap data={calendarThisMonth} />
          </CardContent>
        </Card>
      </div>

      {/* Weekly briefing + Recent trades */}
      <div className="grid grid-cols-3 gap-4">
        {weeklyBriefing && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Weekly Briefing</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">This week P&L</span>
                <span className={`font-mono font-semibold ${weeklyBriefing.totalPnl >= 0 ? "text-success" : "text-destructive"}`}>${weeklyBriefing.totalPnl.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Win rate</span>
                <span className="font-mono">{(weeklyBriefing.winRate * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Trades</span>
                <span className="font-mono">{weeklyBriefing.tradeCount}</span>
              </div>
              {weeklyBriefing.topSymbol && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Top symbol</span>
                  <Badge variant="secondary" className="text-xs">{weeklyBriefing.topSymbol}</Badge>
                </div>
              )}
              <div className="border-t border-border pt-2 mt-2">
                <p className="text-xs text-muted-foreground leading-relaxed">{weeklyBriefing.recommendation}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Nudges */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Alerts</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-2">
            {nudges.length === 0 ? (
              <div className="flex items-center gap-2 text-success text-sm"><CheckCircle className="w-4 h-4" /> All clear</div>
            ) : nudges.map((n) => (
              <div key={n.id} className={`flex items-start gap-2 text-sm p-2 rounded ${n.severity === "danger" ? "bg-destructive/10 text-destructive" : n.severity === "warning" ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" : "bg-muted text-muted-foreground"}`}>
                {n.severity === "danger" ? <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                <span>{n.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent trades */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recent Trades</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="space-y-1.5">
              {recentTrades.slice(0, 6).map((t) => (
                <Link key={t.id} href={`/trades/${t.id}`}>
                  <div data-testid={`trade-row-${t.id}`} className="flex items-center justify-between py-1 hover:bg-muted/50 px-1 rounded cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs px-1.5 ${t.direction === "long" ? "border-success text-success" : "border-destructive text-destructive"}`}>{t.direction === "long" ? "L" : "S"}</Badge>
                      <span className="text-sm font-medium">{t.symbol}</span>
                      <span className="text-xs text-muted-foreground">{t.entryDate.slice(5)}</span>
                    </div>
                    {t.pnl != null ? (
                      <div className={`flex items-center gap-0.5 text-sm font-mono font-semibold ${t.pnl >= 0 ? "text-success" : "text-destructive"}`}>
                        {t.pnl >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}${Math.abs(t.pnl).toFixed(2)}
                      </div>
                    ) : <span className="text-xs text-muted-foreground">Open</span>}
                  </div>
                </Link>
              ))}
              {recentTrades.length === 0 && <p className="text-sm text-muted-foreground">No trades yet. Import a CSV to get started.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
