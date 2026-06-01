import { Router } from "express";
import { db } from "@workspace/db";
import { tradesTable, dashboardLayoutsTable, accountsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { computeOverview, fetchTrades, fetchJournals } from "../lib/analytics";

const router = Router();

router.get("/dashboard/summary", async (req, res) => {
  const { accountId } = req.query as Record<string, string>;
  const acctId = accountId ? parseInt(accountId) : null;

  const trades = await fetchTrades({ accountId: acctId });
  const journals = await fetchJournals(trades.filter((t) => t.hasJournal).map((t) => t.id));

  const overview = computeOverview(trades, journals);

  // Recent trades (last 10)
  const recentTrades = await db
    .select()
    .from(tradesTable)
    .orderBy(sql`${tradesTable.entryDate} DESC`)
    .limit(10);

  // Equity curve (last 30 days)
  const closed = trades.filter((t) => t.pnl != null && t.exitDate).sort((a, b) => (a.exitDate! > b.exitDate! ? 1 : -1));
  const byDate = new Map<string, number>();
  for (const t of closed) {
    const d = (t.exitDate ?? t.entryDate).slice(0, 10);
    byDate.set(d, (byDate.get(d) ?? 0) + (t.pnl ?? 0));
  }
  let cumulative = 0;
  const equityCurve = [...byDate.entries()]
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([date, dailyPnl]) => {
      cumulative += dailyPnl;
      return { date, cumulativePnl: Math.round(cumulative * 100) / 100, dailyPnl: Math.round(dailyPnl * 100) / 100, tradeId: null };
    });

  // Calendar this month
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const dateFrom = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const dateTo = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const monthTrades = trades.filter((t) => t.entryDate >= dateFrom && t.entryDate <= dateTo);
  const calMap = new Map<string, typeof monthTrades>();
  for (const t of monthTrades) {
    const d = t.entryDate.slice(0, 10);
    if (!calMap.has(d)) calMap.set(d, []);
    calMap.get(d)!.push(t);
  }
  const calendarThisMonth = [];
  for (let day = 1; day <= lastDay; day++) {
    const date = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const ts = calMap.get(date) ?? [];
    const cl = ts.filter((t) => t.pnl != null);
    calendarThisMonth.push({
      date,
      totalPnl: cl.reduce((s, t) => s + (t.pnl ?? 0), 0),
      tradeCount: ts.length,
      winCount: cl.filter((t) => (t.pnl ?? 0) > 0).length,
      lossCount: cl.filter((t) => (t.pnl ?? 0) < 0).length,
      economicEvents: [],
    });
  }

  const untaggedCount = trades.filter((t) => !t.tags && !t.setup).length;
  const accounts = await db.select().from(accountsTable);

  // Simple insights
  const topInsights = [];
  if (trades.length < 5) {
    topInsights.push({ id: "onboarding", category: "onboarding", priority: 100, title: "Import trades to get started", body: "Upload a CSV from your broker to see analytics.", supportingData: {}, isActionable: true, sampleSize: 0 });
  }

  // Simple nudges
  const nudges = [];
  if (untaggedCount > 0) {
    nudges.push({ id: "untagged", type: "queue", message: `${untaggedCount} trades missing tags.`, severity: "info", actionLabel: "Review Queue", actionRoute: "/queue" });
  }

  // Weekly briefing
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const weekStart = startOfWeek.toISOString().slice(0, 10);
  const weekEnd = now.toISOString().slice(0, 10);
  const weekTrades = await fetchTrades({ accountId: acctId, dateFrom: weekStart, dateTo: weekEnd });
  const weekJournals = await fetchJournals(weekTrades.filter((t) => t.hasJournal).map((t) => t.id));
  const weekOverview = computeOverview(weekTrades, weekJournals);

  const weeklyBriefing = {
    weekStart,
    weekEnd,
    tradeCount: weekOverview.totalTrades,
    winRate: weekOverview.winRate,
    totalPnl: weekOverview.totalPnl,
    bestDay: null as string | null,
    worstDay: null as string | null,
    standoutPattern: null as string | null,
    recommendation: weekOverview.totalTrades === 0 ? "No trades this week yet." : "Keep journaling your trades.",
    ruleAdherenceRate: weekOverview.ruleAdherenceRate,
    topSymbol: null as string | null,
  };

  res.json({ overview, recentTrades, equityCurve, calendarThisMonth, topInsights, nudges, weeklyBriefing, untaggedCount, accounts });
});

router.get("/dashboard/layout", async (_req, res) => {
  let [layout] = await db.select().from(dashboardLayoutsTable).limit(1);
  if (!layout) {
    const defaultWidgets = [
      { id: "score", type: "castlerock-score", x: 0, y: 0, w: 3, h: 2, config: {} },
      { id: "equity", type: "equity-curve", x: 3, y: 0, w: 5, h: 2, config: {} },
      { id: "calendar", type: "calendar", x: 0, y: 2, w: 4, h: 3, config: {} },
      { id: "recent", type: "recent-trades", x: 4, y: 2, w: 4, h: 3, config: {} },
      { id: "insights", type: "insights", x: 0, y: 5, w: 8, h: 2, config: {} },
    ];
    [layout] = await db.insert(dashboardLayoutsTable).values({ name: "Default", widgets: JSON.stringify(defaultWidgets) }).returning();
  }
  res.json({ ...layout, widgets: JSON.parse(layout!.widgets ?? "[]") });
});

router.put("/dashboard/layout", async (req, res) => {
  const { name, widgets } = req.body;
  let [existing] = await db.select().from(dashboardLayoutsTable).limit(1);
  if (existing) {
    const [row] = await db.update(dashboardLayoutsTable).set({ name, widgets: JSON.stringify(widgets) }).where(eq(dashboardLayoutsTable.id, existing.id)).returning();
    return res.json({ ...row, widgets: JSON.parse(row!.widgets ?? "[]") });
  }
  const [row] = await db.insert(dashboardLayoutsTable).values({ name, widgets: JSON.stringify(widgets) }).returning();
  res.json({ ...row, widgets: JSON.parse(row!.widgets ?? "[]") });
});

export default router;
