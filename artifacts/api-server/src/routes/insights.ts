import { Router } from "express";
import { computeOverview, computeSliceStats, fetchTrades, fetchJournals } from "../lib/analytics";

const router = Router();

function parseQP(q: Record<string, string>) {
  return { accountId: q["accountId"] ? parseInt(q["accountId"]) : null };
}

async function generateInsights(accountId: number | null) {
  const trades = await fetchTrades({ accountId });
  const journals = await fetchJournals(trades.filter((t) => t.hasJournal).map((t) => t.id));
  const jMap = new Map(journals.map((j) => [j.tradeId, j]));
  const closed = trades.filter((t) => t.pnl != null);
  const overview = computeOverview(trades, journals);

  const insights: {
    id: string;
    category: string;
    priority: number;
    title: string;
    body: string;
    supportingData: Record<string, unknown>;
    isActionable: boolean;
    sampleSize: number;
  }[] = [];

  if (closed.length < 5) {
    insights.push({
      id: "insufficient-data",
      category: "onboarding",
      priority: 100,
      title: "Import your trades to unlock insights",
      body: "Add at least 10 trades to see pattern-based insights about your trading.",
      supportingData: {},
      isActionable: true,
      sampleSize: closed.length,
    });
    return insights;
  }

  // Best time-of-day insight
  const byHour = new Map<number, typeof closed>();
  for (const t of closed) {
    const h = new Date(t.entryDate).getHours();
    if (!byHour.has(h)) byHour.set(h, []);
    byHour.get(h)!.push(t);
  }
  const bestHour = [...byHour.entries()]
    .filter(([, ts]) => ts.length >= 3)
    .map(([h, ts]) => ({ h, winRate: ts.filter((t) => (t.pnl ?? 0) > 0).length / ts.length, count: ts.length }))
    .sort((a, b) => b.winRate - a.winRate)[0];
  if (bestHour && bestHour.winRate > 0.6) {
    insights.push({
      id: "best-hour",
      category: "time",
      priority: 80,
      title: `Your best trading hour is ${bestHour.h}:00`,
      body: `You win ${Math.round(bestHour.winRate * 100)}% of trades entered at ${bestHour.h}:00. Consider focusing your activity around this window.`,
      supportingData: { hour: bestHour.h, winRate: bestHour.winRate, tradeCount: bestHour.count },
      isActionable: true,
      sampleSize: bestHour.count,
    });
  }

  // Worst time-of-day insight
  const worstHour = [...byHour.entries()]
    .filter(([, ts]) => ts.length >= 3)
    .map(([h, ts]) => ({ h, winRate: ts.filter((t) => (t.pnl ?? 0) > 0).length / ts.length, count: ts.length }))
    .sort((a, b) => a.winRate - b.winRate)[0];
  if (worstHour && worstHour.winRate < 0.4) {
    insights.push({
      id: "worst-hour",
      category: "time",
      priority: 75,
      title: `You struggle at ${worstHour.h}:00`,
      body: `Only ${Math.round(worstHour.winRate * 100)}% win rate at ${worstHour.h}:00. Consider avoiding trades at this time.`,
      supportingData: { hour: worstHour.h, winRate: worstHour.winRate, tradeCount: worstHour.count },
      isActionable: true,
      sampleSize: worstHour.count,
    });
  }

  // Rule adherence insight
  if (overview.ruleAdherenceRate != null) {
    const ruleFollowedTrades = trades.filter((t) => jMap.get(t.id)?.ruleFollowed === true);
    const ruleBrokenTrades = trades.filter((t) => jMap.get(t.id)?.ruleFollowed === false);
    const fStats = computeSliceStats(ruleFollowedTrades, "followed");
    const bStats = computeSliceStats(ruleBrokenTrades, "broken");
    if (ruleBrokenTrades.length >= 3 && fStats.winRate > bStats.winRate + 0.1) {
      insights.push({
        id: "rule-adherence",
        category: "discipline",
        priority: 90,
        title: "Following your rules pays off",
        body: `When you follow your rules, win rate is ${Math.round(fStats.winRate * 100)}% vs ${Math.round(bStats.winRate * 100)}% when you break them. Your rules work — trust them.`,
        supportingData: { ruleFollowedWinRate: fStats.winRate, ruleBrokenWinRate: bStats.winRate },
        isActionable: false,
        sampleSize: ruleFollowedTrades.length + ruleBrokenTrades.length,
      });
    }
  }

  // Best symbol insight
  const bySymbol = new Map<string, typeof closed>();
  for (const t of closed) {
    if (!bySymbol.has(t.symbol)) bySymbol.set(t.symbol, []);
    bySymbol.get(t.symbol)!.push(t);
  }
  const bestSymbol = [...bySymbol.entries()]
    .filter(([, ts]) => ts.length >= 5)
    .map(([s, ts]) => ({ s, stats: computeSliceStats(ts, s) }))
    .sort((a, b) => b.stats.totalPnl - a.stats.totalPnl)[0];
  if (bestSymbol) {
    insights.push({
      id: "best-symbol",
      category: "instrument",
      priority: 70,
      title: `${bestSymbol.s} is your strongest instrument`,
      body: `${Math.round(bestSymbol.stats.winRate * 100)}% win rate and $${Math.round(bestSymbol.stats.totalPnl)} total P&L on ${bestSymbol.stats.tradeCount} trades.`,
      supportingData: bestSymbol.stats,
      isActionable: false,
      sampleSize: bestSymbol.stats.tradeCount,
    });
  }

  // Tilt insight
  const tiltTrades = trades.filter((t) => {
    const j = jMap.get(t.id);
    return j?.tiltState && j.tiltState !== "normal" && j.tiltState !== "calm";
  });
  if (tiltTrades.length >= 3) {
    const tiltClosed = tiltTrades.filter((t) => t.pnl != null);
    const tiltLosses = tiltClosed.filter((t) => (t.pnl ?? 0) < 0).length;
    if (tiltClosed.length > 0 && tiltLosses / tiltClosed.length > 0.6) {
      insights.push({
        id: "tilt-pattern",
        category: "psychology",
        priority: 85,
        title: "Trades taken while tilted lose more often",
        body: `${Math.round((tiltLosses / tiltClosed.length) * 100)}% of your tilted trades are losers. When you feel off, stepping away is the highest-EV decision.`,
        supportingData: { tiltTradeCount: tiltClosed.length, lossRate: tiltLosses / tiltClosed.length },
        isActionable: true,
        sampleSize: tiltClosed.length,
      });
    }
  }

  // Overtrading insight — most trades in a day vs best per-day expectancy
  const byDate = new Map<string, typeof closed>();
  for (const t of closed) {
    const d = t.entryDate.slice(0, 10);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(t);
  }
  const heavyDays = [...byDate.values()].filter((ts) => ts.length >= 5);
  if (heavyDays.length >= 3) {
    const heavyStats = computeSliceStats(heavyDays.flat(), "heavy");
    const lightDays = [...byDate.values()].filter((ts) => ts.length <= 3);
    if (lightDays.length >= 3) {
      const lightStats = computeSliceStats(lightDays.flat(), "light");
      if (lightStats.winRate > heavyStats.winRate + 0.1) {
        insights.push({
          id: "overtrading",
          category: "discipline",
          priority: 78,
          title: "Quality over quantity pays",
          body: `On low-volume days (&le;3 trades) you win ${Math.round(lightStats.winRate * 100)}% vs ${Math.round(heavyStats.winRate * 100)}% on high-volume days. Less can be more.`,
          supportingData: { lightDayWinRate: lightStats.winRate, heavyDayWinRate: heavyStats.winRate },
          isActionable: true,
          sampleSize: heavyDays.flat().length + lightDays.flat().length,
        });
      }
    }
  }

  return insights.sort((a, b) => b.priority - a.priority);
}

router.get("/insights", async (req, res) => {
  const { accountId, limit = "10" } = req.query as Record<string, string>;
  const insights = await generateInsights(accountId ? parseInt(accountId) : null);
  res.json(insights.slice(0, parseInt(limit)));
});

router.get("/insights/today", async (req, res) => {
  const { accountId } = req.query as Record<string, string>;
  const insights = await generateInsights(accountId ? parseInt(accountId) : null);
  res.json(insights[0] ?? null);
});

router.get("/insights/weekly-briefing", async (req, res) => {
  const { accountId } = req.query as Record<string, string>;
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const weekStart = startOfWeek.toISOString().slice(0, 10);
  const weekEnd = now.toISOString().slice(0, 10);

  const trades = await fetchTrades({ accountId: accountId ? parseInt(accountId) : null, dateFrom: weekStart, dateTo: weekEnd });
  const journals = await fetchJournals(trades.filter((t) => t.hasJournal).map((t) => t.id));
  const overview = computeOverview(trades, journals);
  const closed = trades.filter((t) => t.pnl != null);

  const byDate = new Map<string, number>();
  for (const t of closed) {
    const d = t.entryDate.slice(0, 10);
    byDate.set(d, (byDate.get(d) ?? 0) + (t.pnl ?? 0));
  }
  const sortedDays = [...byDate.entries()].sort(([, a], [, b]) => b - a);
  const bestDay = sortedDays[0]?.[0] ?? null;
  const worstDay = sortedDays[sortedDays.length - 1]?.[0] ?? null;

  const bySymbol = new Map<string, number>();
  for (const t of closed) {
    bySymbol.set(t.symbol, (bySymbol.get(t.symbol) ?? 0) + (t.pnl ?? 0));
  }
  const topSymbol = [...bySymbol.entries()].sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

  let recommendation = "Keep journaling your trades to uncover patterns.";
  if (overview.totalTrades === 0) {
    recommendation = "No trades this week. Set a session plan for next week.";
  } else if (overview.winRate > 0.6 && overview.totalPnl > 0) {
    recommendation = "Strong week. Identify what worked and aim to replicate those conditions.";
  } else if (overview.winRate < 0.4) {
    recommendation = "Tough week. Review your rule adherence — are you taking setups that fit your strategy?";
  } else if (overview.totalPnl < 0 && overview.winRate > 0.5) {
    recommendation = "You're winning more than you're losing, but losers are too large. Revisit your stop placement.";
  }

  res.json({
    weekStart,
    weekEnd,
    tradeCount: overview.totalTrades,
    winRate: overview.winRate,
    totalPnl: overview.totalPnl,
    bestDay,
    worstDay,
    standoutPattern: topSymbol ? `${topSymbol} was your top instrument` : null,
    recommendation,
    ruleAdherenceRate: overview.ruleAdherenceRate,
    topSymbol,
  });
});

router.get("/insights/nudges", async (req, res) => {
  const { accountId } = req.query as Record<string, string>;
  const trades = await fetchTrades({ accountId: accountId ? parseInt(accountId) : null });
  const nudges: { id: string; type: string; message: string; severity: string; actionLabel: string | null; actionRoute: string | null }[] = [];

  const untagged = trades.filter((t) => !t.tags && !t.setup).length;
  if (untagged > 0) {
    nudges.push({
      id: "untagged",
      type: "queue",
      message: `${untagged} trade${untagged === 1 ? "" : "s"} missing tags or setup. Tag them to unlock deeper analytics.`,
      severity: untagged > 10 ? "warning" : "info",
      actionLabel: "Review Queue",
      actionRoute: "/queue",
    });
  }

  const unjournaled = trades.filter((t) => !t.hasJournal).length;
  if (unjournaled > 5) {
    nudges.push({
      id: "unjournaled",
      type: "journal",
      message: `${unjournaled} trades without a journal entry. Journaling improves performance.`,
      severity: "info",
      actionLabel: "Start Journaling",
      actionRoute: "/trades",
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayTrades = trades.filter((t) => t.entryDate.slice(0, 10) === today);
  if (todayTrades.length >= 8) {
    nudges.push({
      id: "overtrading-today",
      type: "discipline",
      message: `You've taken ${todayTrades.length} trades today. Are they all A-grade setups?`,
      severity: "warning",
      actionLabel: null,
      actionRoute: null,
    });
  }

  const recentClosed = trades.filter((t) => t.pnl != null).slice(-5);
  const recentLosses = recentClosed.filter((t) => (t.pnl ?? 0) < 0).length;
  if (recentLosses >= 4 && recentClosed.length >= 4) {
    nudges.push({
      id: "loss-streak",
      type: "psychology",
      message: "4 of your last 5 trades are losses. Consider taking a break before your next entry.",
      severity: "danger",
      actionLabel: null,
      actionRoute: null,
    });
  }

  res.json(nudges);
});

export default router;
