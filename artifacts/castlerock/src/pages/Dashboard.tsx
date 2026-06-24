import { useState, useRef, useEffect } from "react";
import { useGetDashboardSummary, useSaveDashboardLayout } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowUpRight, ArrowDownRight, TrendingUp, AlertTriangle, Info, CheckCircle, GripVertical, LayoutDashboard, Check, CheckSquare, Search, Sparkles } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useToast } from "@/hooks/use-toast";

const STORAGE_KEY = "cr_dashboard_order";
const DEFAULT_ORDER = ["score-metrics", "checklist-widget", "nlq-widget", "equity-calendar", "briefing-nudges-recent"];

const NLQ_HISTORY_KEY = "cr_nlq_history";
const DASHBOARD_SUGGESTED = [
  "When do I lose the most money?",
  "Which symbols are most profitable for me?",
  "How do I perform in the morning vs afternoon?",
];
function getDashboardNlqHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(NLQ_HISTORY_KEY) || "[]"); } catch { return []; }
}
function saveDashboardNlqHistory(q: string) {
  const prev = getDashboardNlqHistory().filter((h) => h !== q);
  localStorage.setItem(NLQ_HISTORY_KEY, JSON.stringify([q, ...prev].slice(0, 10)));
}

function getInitialOrder(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as string[];
      if (Array.isArray(parsed) && parsed.length === DEFAULT_ORDER.length) return parsed;
    }
  } catch {}
  return DEFAULT_ORDER;
}

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
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${circ * pct} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 50 50)" style={{ transition: "stroke-dasharray 0.6s ease" }} />
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

function SectionWrapper({
  id, editing, dragOver, onDragStart, onDragOver, onDrop, children,
}: {
  id: string; editing: boolean; dragOver: boolean;
  onDragStart: () => void; onDragOver: (e: React.DragEvent) => void; onDrop: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      draggable={editing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`transition-all ${editing ? "cursor-grab active:cursor-grabbing" : ""} ${dragOver ? "ring-2 ring-primary ring-offset-2 rounded-lg opacity-70" : ""}`}
    >
      {editing && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground select-none">Drag to reorder</span>
        </div>
      )}
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useGetDashboardSummary({});
  const saveLayout = useSaveDashboardLayout();
  const { toast } = useToast();
  const [order, setOrder] = useState<string[]>(getInitialOrder);
  const [editing, setEditing] = useState(false);
  const dragId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [checklistStatus, setChecklistStatus] = useState<{ total: number; completed: number; compliancePct: number; items: { id: number; label: string; completedToday: boolean }[] } | null>(null);
  const [checklist7d, setChecklist7d] = useState<{ date: string; pct: number }[]>([]);
  const [nlqInput, setNlqInput] = useState("");
  const [nlqLoading, setNlqLoading] = useState(false);
  const [nlqAnswer, setNlqAnswer] = useState<string | null>(null);
  const [nlqHistory, setNlqHistory] = useState<string[]>(getDashboardNlqHistory);

  const handleDashboardNlq = async (question: string) => {
    const q = question.trim();
    if (!q || nlqLoading) return;
    setNlqInput(q);
    setNlqLoading(true);
    setNlqAnswer(null);
    try {
      const res = await fetch("/api/query/natural", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (!res.ok) throw new Error("Query failed");
      const data = await res.json();
      setNlqAnswer(data.answer);
      saveDashboardNlqHistory(q);
      setNlqHistory(getDashboardNlqHistory());
    } catch {
      setNlqAnswer("Unable to answer right now — try again.");
    } finally {
      setNlqLoading(false);
    }
  };

  const fetchChecklistToday = () => {
    fetch("/api/checklist/today")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setChecklistStatus(d); })
      .catch(() => {});
  };

  useEffect(() => {
    fetchChecklistToday();
    fetch("/api/checklist/compliance?days=7")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => { if (Array.isArray(d)) setChecklist7d(d); })
      .catch(() => {});
  }, []);

  const handleChecklistToggle = async (itemId: number) => {
    try {
      await fetch(`/api/checklist/today/${itemId}/toggle`, { method: "POST" });
      fetchChecklistToday();
    } catch {}
  };

  const handleDragStart = (id: string) => { dragId.current = id; };
  const handleDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverId(id); };
  const handleDrop = (targetId: string) => {
    if (!dragId.current || dragId.current === targetId) return;
    setOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(dragId.current!);
      const to = next.indexOf(targetId);
      next.splice(from, 1);
      next.splice(to, 0, dragId.current!);
      return next;
    });
    setDragOverId(null);
    dragId.current = null;
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    saveLayout.mutate(
      { data: { name: "default", widgets: order.map((id, i) => ({ id, type: id, x: 0, y: i, w: 12, h: 4 })) } },
      { onSuccess: () => { toast({ title: "Layout saved" }); setEditing(false); } }
    );
  };

  const handleCancel = () => {
    setOrder(getInitialOrder());
    setEditing(false);
  };

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

  const sections: Record<string, React.ReactNode> = {
    "score-metrics": (
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
    ),

    "checklist-widget": (
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <CheckSquare className="w-4 h-4" />
              Pre-Trade Ritual
            </CardTitle>
            {checklistStatus && checklistStatus.total > 0 && (
              <Badge
                variant={checklistStatus.compliancePct === 100 ? "default" : "secondary"}
                className={`text-xs ${checklistStatus.compliancePct === 100 ? "bg-success/20 text-success border-success/30" : ""}`}
              >
                {checklistStatus.completed}/{checklistStatus.total}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {!checklistStatus || checklistStatus.items.length === 0 ? (
              <div className="text-sm text-muted-foreground py-2">
                <Link href="/checklist" className="underline text-primary">Set up your checklist</Link> to start tracking daily rituals.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {checklistStatus.items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 cursor-pointer group`}
                    onClick={() => handleChecklistToggle(item.id)}
                    data-testid={`dashboard-checklist-item-${item.id}`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      item.completedToday
                        ? "bg-success border-success"
                        : "border-muted-foreground/40 group-hover:border-primary"
                    }`}>
                      {item.completedToday && <Check className="w-2.5 h-2.5 text-success-foreground" />}
                    </div>
                    <span className={`text-xs ${item.completedToday ? "line-through text-muted-foreground" : ""}`}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {checklistStatus && checklistStatus.compliancePct === 100 && (
              <div className="mt-3 flex items-center gap-2 text-xs text-success">
                <Check className="w-3.5 h-3.5" /> All rituals complete — ready to trade!
              </div>
            )}
            <div className="mt-3">
              <Link href="/checklist">
                <Button size="sm" variant="ghost" className="h-6 text-xs px-0 text-muted-foreground hover:text-foreground">
                  View full checklist →
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">7-Day Compliance</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {checklist7d.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data yet</p>
            ) : (
              <div className="flex items-end gap-2 h-20">
                {checklist7d.map((d) => {
                  const h = Math.max(d.pct, 4);
                  const color =
                    d.pct === 100
                      ? "hsl(142 65% 42%)"
                      : d.pct >= 60
                      ? "hsl(45 90% 52%)"
                      : d.pct > 0
                      ? "hsl(25 90% 52%)"
                      : "hsl(0 65% 48%)";
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.pct}%`}>
                      <div className="w-full rounded-sm" style={{ height: `${h * 0.72}px`, background: color }} />
                      <span className="text-[9px] text-muted-foreground font-mono">{d.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {checklist7d.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Avg: {Math.round(checklist7d.reduce((s, d) => s + d.pct, 0) / checklist7d.length)}%
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    ),

    "nlq-widget": (
      <Card>
        <CardHeader className="pb-3 pt-4 px-5 flex flex-row items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Ask Your Journal</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                data-testid="dashboard-nlq-input"
                placeholder="Ask your journal anything…"
                value={nlqInput}
                onChange={(e) => setNlqInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleDashboardNlq(nlqInput); }}
                disabled={nlqLoading}
                className="w-full pl-9 pr-4 h-9 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
            </div>
            <button
              data-testid="dashboard-nlq-submit"
              onClick={() => handleDashboardNlq(nlqInput)}
              disabled={nlqLoading || !nlqInput.trim()}
              className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors gap-1.5 inline-flex items-center"
            >
              {nlqLoading
                ? <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />Thinking…</>
                : <><Sparkles className="w-3.5 h-3.5" />Ask</>}
            </button>
          </div>

          {/* Suggested + history chips */}
          {!nlqAnswer && !nlqLoading && (
            <div className="flex flex-wrap gap-1.5">
              {DASHBOARD_SUGGESTED.map((q) => (
                <button
                  key={q}
                  onClick={() => handleDashboardNlq(q)}
                  className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  {q}
                </button>
              ))}
              {nlqHistory.slice(0, 3).map((q) => (
                <button
                  key={q}
                  onClick={() => handleDashboardNlq(q)}
                  className="text-xs px-2.5 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors max-w-[240px] truncate"
                  title={q}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {nlqLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-primary" />
              Analyzing your trades…
            </div>
          )}

          {nlqAnswer && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
              <div className="space-y-1.5">
                <p className="text-sm leading-relaxed">{nlqAnswer}</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setNlqAnswer(null); setNlqInput(""); }}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Ask another
                  </button>
                  <a href="/analytics" className="text-xs text-primary hover:underline">Deep dive in Analytics →</a>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    ),

    "equity-calendar": (
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
    ),

    "briefing-nudges-recent": (
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
    ),
  };

  return (
    <div className="space-y-6">
      {checklistStatus && checklistStatus.total > 0 && checklistStatus.compliancePct < 100 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm">
          <CheckSquare className="w-4 h-4 shrink-0" />
          <span className="flex-1">
            Pre-trade ritual incomplete — {checklistStatus.completed}/{checklistStatus.total} items done today.
          </span>
          <Link href="/checklist">
            <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-amber-600 dark:text-amber-400 hover:text-amber-500 hover:bg-amber-500/10">
              Complete checklist →
            </Button>
          </Link>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Command Center</h1>
          {untaggedCount > 0 && (
            <Link href="/queue">
              <Badge variant="destructive" className="cursor-pointer gap-1">
                <AlertTriangle className="w-3 h-3" />{untaggedCount} untagged
              </Badge>
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button size="sm" variant="outline" onClick={handleCancel} className="h-8">Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saveLayout.isPending} className="h-8 gap-1.5" data-testid="button-save-layout">
                <Check className="w-3.5 h-3.5" />{saveLayout.isPending ? "Saving…" : "Save Layout"}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="h-8 gap-1.5" data-testid="button-edit-layout">
              <LayoutDashboard className="w-3.5 h-3.5" /> Customize
            </Button>
          )}
        </div>
      </div>

      {editing && (
        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-4 py-2.5 flex items-center gap-2">
          <GripVertical className="w-3.5 h-3.5 shrink-0" />
          Drag sections up or down to reorder your dashboard, then click Save Layout.
        </div>
      )}

      <div className="space-y-6">
        {order.map((id) => (
          <SectionWrapper
            key={id}
            id={id}
            editing={editing}
            dragOver={dragOverId === id}
            onDragStart={() => handleDragStart(id)}
            onDragOver={(e) => handleDragOver(e, id)}
            onDrop={() => handleDrop(id)}
          >
            {sections[id]}
          </SectionWrapper>
        ))}
      </div>
    </div>
  );
}
