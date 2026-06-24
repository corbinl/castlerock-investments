import { Router } from "express";
import { db } from "@workspace/db";
import { tradesTable, journalsTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { computeOverview, computeSliceStats, fetchTrades, fetchJournals } from "../lib/analytics";

const router = Router();

function parseQP(q: Record<string, string>) {
  return {
    accountId: q["accountId"] ? parseInt(q["accountId"]) : null,
    dateFrom: q["dateFrom"] ?? null,
    dateTo: q["dateTo"] ?? null,
  };
}

router.get("/analytics/overview", async (req, res) => {
  const opts = parseQP(req.query as Record<string, string>);
  const trades = await fetchTrades(opts);
  const journals = await fetchJournals(trades.filter((t) => t.hasJournal).map((t) => t.id));
  res.json(computeOverview(trades, journals));
});

router.get("/analytics/by-symbol", async (req, res) => {
  const opts = parseQP(req.query as Record<string, string>);
  const trades = await fetchTrades(opts);
  const bySymbol = new Map<string, typeof trades>();
  for (const t of trades) {
    if (!bySymbol.has(t.symbol)) bySymbol.set(t.symbol, []);
    bySymbol.get(t.symbol)!.push(t);
  }
  const result = [...bySymbol.entries()]
    .map(([symbol, ts]) => computeSliceStats(ts, symbol))
    .sort((a, b) => b.totalPnl - a.totalPnl);
  res.json(result);
});

router.get("/analytics/by-strategy", async (req, res) => {
  const opts = parseQP(req.query as Record<string, string>);
  const trades = await fetchTrades(opts);
  const byStrategy = new Map<string, typeof trades>();
  for (const t of trades) {
    const key = t.setup || "Untagged";
    if (!byStrategy.has(key)) byStrategy.set(key, []);
    byStrategy.get(key)!.push(t);
  }
  const result = [...byStrategy.entries()]
    .map(([s, ts]) => computeSliceStats(ts, s))
    .sort((a, b) => b.totalPnl - a.totalPnl);
  res.json(result);
});

router.get("/analytics/by-session", async (req, res) => {
  const opts = parseQP(req.query as Record<string, string>);
  const trades = await fetchTrades(opts);
  const bySession = new Map<string, typeof trades>();
  for (const t of trades) {
    const key = t.session || classifySession(t.entryDate);
    if (!bySession.has(key)) bySession.set(key, []);
    bySession.get(key)!.push(t);
  }
  const result = [...bySession.entries()].map(([s, ts]) => computeSliceStats(ts, s));
  res.json(result);
});

function classifySession(dateStr: string): string {
  const d = new Date(dateStr);
  const hour = d.getUTCHours();
  if (hour < 9) return "Pre-Market";
  if (hour < 12) return "Morning";
  if (hour < 15) return "Afternoon";
  if (hour < 17) return "Close";
  return "After-Hours";
}

router.get("/analytics/by-day", async (req, res) => {
  const opts = parseQP(req.query as Record<string, string>);
  const trades = await fetchTrades(opts);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const byDay = new Map<string, typeof trades>();
  for (const d of days) byDay.set(d, []);
  for (const t of trades) {
    const day = days[new Date(t.entryDate).getDay()];
    if (day) byDay.get(day)?.push(t);
  }
  const result = [...byDay.entries()].map(([d, ts]) => computeSliceStats(ts, d));
  res.json(result);
});

router.get("/analytics/by-hour", async (req, res) => {
  const opts = parseQP(req.query as Record<string, string>);
  const trades = await fetchTrades(opts);

  const byHour = new Map<number, typeof trades>();
  for (let h = 0; h < 24; h++) byHour.set(h, []);
  for (const t of trades) {
    const d = new Date(t.entryDate);
    const hour = d.getHours();
    byHour.get(hour)?.push(t);
  }

  const result = [...byHour.entries()].map(([hour, ts]) => {
    const closed = ts.filter((t) => t.pnl != null);
    const wins = closed.filter((t) => (t.pnl ?? 0) > 0);
    const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
    let session = "After-Hours";
    if (hour >= 4 && hour < 9) session = "Pre-Market";
    else if (hour >= 9 && hour < 12) session = "Morning";
    else if (hour >= 12 && hour < 15) session = "Afternoon";
    else if (hour >= 15 && hour < 17) session = "Close";
    return {
      hour,
      tradeCount: ts.length,
      totalPnl,
      winRate: closed.length > 0 ? wins.length / closed.length : 0,
      avgPnl: closed.length > 0 ? totalPnl / closed.length : 0,
      session,
    };
  });

  res.json(result);
});

router.get("/analytics/by-time", async (req, res) => {
  const opts = parseQP(req.query as Record<string, string>);
  const trades = await fetchTrades(opts);

  const buckets = new Map<string, number[]>();
  for (const t of trades) {
    if (t.pnl == null) continue;
    const d = new Date(t.entryDate);
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const hour = d.getHours();
    const key = `${dow}:${hour}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(t.pnl);
  }

  const result = [...buckets.entries()].map(([key, pnls]) => {
    const [dow, hour] = key.split(":").map(Number);
    const wins = pnls.filter((p) => p > 0).length;
    const totalPnl = pnls.reduce((s, p) => s + p, 0);
    return {
      dayOfWeek: dow,
      hour,
      avgPnl: totalPnl / pnls.length,
      totalPnl,
      count: pnls.length,
      winRate: pnls.length > 0 ? wins / pnls.length : 0,
    };
  });

  res.json(result.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.hour - b.hour));
});

router.get("/analytics/by-asset-class", async (req, res) => {
  const opts = parseQP(req.query as Record<string, string>);
  const trades = await fetchTrades(opts);
  const byClass = new Map<string, typeof trades>();
  for (const t of trades) {
    const key = t.assetClass;
    if (!byClass.has(key)) byClass.set(key, []);
    byClass.get(key)!.push(t);
  }
  res.json([...byClass.entries()].map(([c, ts]) => computeSliceStats(ts, c)));
});

router.get("/analytics/by-tag", async (req, res) => {
  const opts = parseQP(req.query as Record<string, string>);
  const trades = await fetchTrades(opts);
  const byTag = new Map<string, typeof trades>();
  for (const t of trades) {
    const tags = t.tags ? t.tags.split(",").map((s) => s.trim()).filter(Boolean) : ["Untagged"];
    for (const tag of tags) {
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag)!.push(t);
    }
  }
  res.json([...byTag.entries()].map(([tag, ts]) => computeSliceStats(ts, tag)).sort((a, b) => b.totalPnl - a.totalPnl));
});

router.get("/analytics/calendar", async (req, res) => {
  const { accountId, year, month } = req.query as Record<string, string>;
  const now = new Date();
  const y = year ? parseInt(year) : now.getFullYear();
  const m = month ? parseInt(month) : now.getMonth() + 1;

  const dateFrom = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const dateTo = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const trades = await fetchTrades({ accountId: accountId ? parseInt(accountId) : null, dateFrom, dateTo });

  const byDate = new Map<string, typeof trades>();
  for (const t of trades) {
    const d = t.entryDate.slice(0, 10);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(t);
  }

  const result = [];
  for (let day = 1; day <= lastDay; day++) {
    const date = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const ts = byDate.get(date) ?? [];
    const closed = ts.filter((t) => t.pnl != null);
    result.push({
      date,
      totalPnl: closed.reduce((s, t) => s + (t.pnl ?? 0), 0),
      tradeCount: ts.length,
      winCount: closed.filter((t) => (t.pnl ?? 0) > 0).length,
      lossCount: closed.filter((t) => (t.pnl ?? 0) <= 0 && t.pnl != null).length,
      economicEvents: [],
    });
  }

  res.json(result);
});

router.get("/analytics/equity-curve", async (req, res) => {
  const opts = parseQP(req.query as Record<string, string>);
  const trades = await fetchTrades(opts);
  const closed = trades.filter((t) => t.pnl != null && t.exitDate).sort((a, b) => (a.exitDate! > b.exitDate! ? 1 : -1));

  const byDate = new Map<string, { pnl: number; tradeId: number }[]>();
  for (const t of closed) {
    const d = (t.exitDate ?? t.entryDate).slice(0, 10);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push({ pnl: t.pnl!, tradeId: t.id });
  }

  let cumulative = 0;
  const result = [...byDate.entries()]
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([date, entries]) => {
      const dailyPnl = entries.reduce((s, e) => s + e.pnl, 0);
      cumulative += dailyPnl;
      return { date, cumulativePnl: Math.round(cumulative * 100) / 100, dailyPnl: Math.round(dailyPnl * 100) / 100, tradeId: entries[0]?.tradeId ?? null };
    });

  res.json(result);
});

router.get("/analytics/streaks", async (req, res) => {
  const opts = parseQP(req.query as Record<string, string>);
  const trades = await fetchTrades(opts);
  const closed = trades.filter((t) => t.pnl != null).sort((a, b) => (a.entryDate > b.entryDate ? 1 : -1));

  if (closed.length === 0) {
    return res.json({ currentStreak: 0, currentStreakType: "none", maxWinStreak: 0, maxLossStreak: 0, winRateAfterWin: null, winRateAfterLoss: null, avgPnlAfterWinStreak3: null, avgPnlAfterLossStreak3: null, lossStreakSizeIncreaseAfter3: null });
  }

  let maxWinStreak = 0, maxLossStreak = 0, curWin = 0, curLoss = 0;
  let currentStreak = 0;
  let currentStreakType = "none";

  const afterWin: number[] = [];
  const afterLoss: number[] = [];
  let winStreak3Pnls: number[] = [];
  let lossStreak3Pnls: number[] = [];
  let lossStreakSizes: number[] = [];

  for (let i = 0; i < closed.length; i++) {
    const t = closed[i]!;
    const isWin = (t.pnl ?? 0) > 0;

    if (i > 0) {
      const prev = closed[i - 1]!;
      const prevWin = (prev.pnl ?? 0) > 0;
      if (prevWin) afterWin.push(t.pnl!);
      else afterLoss.push(t.pnl!);
    }

    if (isWin) {
      curWin++;
      if (curLoss >= 3 && i > 0) lossStreakSizes.push(curLoss);
      if (curLoss > 0) curLoss = 0;
      if (curWin > maxWinStreak) maxWinStreak = curWin;
    } else {
      curLoss++;
      if (curWin >= 3 && i > 0) winStreak3Pnls.push(t.pnl!);
      if (curWin > 0) curWin = 0;
      if (curLoss > maxLossStreak) maxLossStreak = curLoss;
    }
  }

  const last = closed[closed.length - 1]!;
  if ((last.pnl ?? 0) > 0) {
    currentStreak = curWin;
    currentStreakType = "win";
  } else {
    currentStreak = curLoss;
    currentStreakType = "loss";
  }

  const winRateAfterWin = afterWin.length > 0 ? afterWin.filter((p) => p > 0).length / afterWin.length : null;
  const winRateAfterLoss = afterLoss.length > 0 ? afterLoss.filter((p) => p > 0).length / afterLoss.length : null;
  const avgPnlAfterWinStreak3 = winStreak3Pnls.length > 0 ? winStreak3Pnls.reduce((s, p) => s + p, 0) / winStreak3Pnls.length : null;
  const avgPnlAfterLossStreak3 = lossStreak3Pnls.length > 0 ? lossStreak3Pnls.reduce((s, p) => s + p, 0) / lossStreak3Pnls.length : null;

  res.json({ currentStreak, currentStreakType, maxWinStreak, maxLossStreak, winRateAfterWin, winRateAfterLoss, avgPnlAfterWinStreak3, avgPnlAfterLossStreak3, lossStreakSizeIncreaseAfter3: null });
});

router.get("/analytics/by-tilt", async (req, res) => {
  const opts = parseQP(req.query as Record<string, string>);
  const trades = await fetchTrades(opts);
  const journalRows = await fetchJournals(trades.filter((t) => t.hasJournal).map((t) => t.id));
  const jMap = new Map(journalRows.map((j) => [j.tradeId, j]));

  const byTilt = new Map<string, typeof trades>();
  for (const t of trades) {
    const j = jMap.get(t.id);
    const key = j?.tiltState || "Unknown";
    if (!byTilt.has(key)) byTilt.set(key, []);
    byTilt.get(key)!.push(t);
  }
  res.json([...byTilt.entries()].map(([k, ts]) => computeSliceStats(ts, k)));
});

router.get("/analytics/by-confidence", async (req, res) => {
  const opts = parseQP(req.query as Record<string, string>);
  const trades = await fetchTrades(opts);
  const journalRows = await fetchJournals(trades.filter((t) => t.hasJournal).map((t) => t.id));
  const jMap = new Map(journalRows.map((j) => [j.tradeId, j]));

  const byConf = new Map<string, typeof trades>();
  for (const t of trades) {
    const j = jMap.get(t.id);
    const conf = j?.confidenceRating;
    const key = conf == null ? "Unrated" : conf <= 3 ? "Low (1-3)" : conf <= 6 ? "Medium (4-6)" : "High (7-10)";
    if (!byConf.has(key)) byConf.set(key, []);
    byConf.get(key)!.push(t);
  }
  res.json([...byConf.entries()].map(([k, ts]) => computeSliceStats(ts, k)));
});

router.get("/analytics/by-rule", async (req, res) => {
  const opts = parseQP(req.query as Record<string, string>);
  const trades = await fetchTrades(opts);
  const journalRows = await fetchJournals(trades.filter((t) => t.hasJournal).map((t) => t.id));
  const jMap = new Map(journalRows.map((j) => [j.tradeId, j]));

  const followed: typeof trades = [];
  const broken: typeof trades = [];

  for (const t of trades) {
    const j = jMap.get(t.id);
    if (j?.ruleFollowed === true) followed.push(t);
    else if (j?.ruleFollowed === false) broken.push(t);
  }

  const fStats = computeSliceStats(followed, "followed");
  const bStats = computeSliceStats(broken, "broken");
  const total = followed.length + broken.length;

  res.json({
    ruleFollowedCount: followed.length,
    ruleBrokenCount: broken.length,
    ruleFollowedWinRate: fStats.winRate,
    ruleBrokenWinRate: bStats.winRate,
    ruleFollowedExpectancy: fStats.expectancy,
    ruleBrokenExpectancy: bStats.expectancy,
    ruleFollowedTotalPnl: fStats.totalPnl,
    ruleBrokenTotalPnl: bStats.totalPnl,
    adherenceRate: total > 0 ? followed.length / total : 0,
  });
});

router.get("/analytics/pivot", async (req, res) => {
  const { rowDimension, colDimension, metric, accountId } = req.query as Record<string, string>;

  const ALLOWED_DIMS = ["symbol", "direction", "setup", "assetClass", "session", "tags"];
  const ALLOWED_METRICS = ["totalPnl", "winRate", "tradeCount", "avgPnl", "rMultiple"];

  if (!ALLOWED_DIMS.includes(rowDimension) || !ALLOWED_DIMS.includes(colDimension) || !ALLOWED_METRICS.includes(metric)) {
    return res.status(400).json({ error: "Invalid dimension or metric" });
  }

  const trades = await fetchTrades({ accountId: accountId ? parseInt(accountId) : null });
  const closed = trades.filter((t) => t.pnl != null);

  const getVal = (t: (typeof trades)[0], dim: string): string[] => {
    const v = (t as Record<string, unknown>)[dim];
    if (dim === "tags") return v ? String(v).split(",").map((s) => s.trim()).filter(Boolean) : ["Untagged"];
    return [String(v ?? "Unknown")];
  };

  const rowLabels = new Set<string>();
  const colLabels = new Set<string>();
  for (const t of closed) {
    for (const r of getVal(t, rowDimension)) rowLabels.add(r);
    for (const c of getVal(t, colDimension)) colLabels.add(c);
  }

  const rl = [...rowLabels].sort();
  const cl = [...colLabels].sort();

  const cells: (number | null)[][] = rl.map(() => cl.map(() => null));
  const buckets: typeof closed[][][] = rl.map(() => cl.map(() => []));

  for (const t of closed) {
    const rows = getVal(t, rowDimension);
    const cols = getVal(t, colDimension);
    for (const r of rows) {
      const ri = rl.indexOf(r);
      for (const c of cols) {
        const ci = cl.indexOf(c);
        if (ri >= 0 && ci >= 0) buckets[ri]![ci]!.push(t);
      }
    }
  }

  for (let ri = 0; ri < rl.length; ri++) {
    for (let ci = 0; ci < cl.length; ci++) {
      const ts = buckets[ri]![ci]!;
      if (ts.length === 0) { cells[ri]![ci] = null; continue; }
      const wins = ts.filter((t) => (t.pnl ?? 0) > 0);
      const total = ts.reduce((s, t) => s + (t.pnl ?? 0), 0);
      const rms = ts.filter((t) => t.rMultiple != null);
      const avgR = rms.length > 0 ? rms.reduce((s, t) => s + (t.rMultiple ?? 0), 0) / rms.length : 0;
      const val =
        metric === "totalPnl" ? total
        : metric === "winRate" ? wins.length / ts.length
        : metric === "tradeCount" ? ts.length
        : metric === "avgPnl" ? total / ts.length
        : avgR;
      cells[ri]![ci] = Math.round(val * 100) / 100;
    }
  }

  res.json({ rowLabels: rl, colLabels: cl, cells, metric, rowDimension, colDimension });
});

router.post("/analytics/whatif", async (req, res) => {
  const { filters, label, accountId } = req.body;
  const trades = await fetchTrades({ accountId });
  const journalRows = await fetchJournals(trades.filter((t) => t.hasJournal).map((t) => t.id));

  const actual = computeOverview(trades, journalRows);

  // Apply filters to exclude certain trades
  const filtered = trades.filter((t) => {
    for (const [key, value] of Object.entries(filters ?? {})) {
      if (key === "minPnl" && (t.pnl ?? 0) < (value as number)) return false;
      if (key === "maxPnl" && (t.pnl ?? 0) > (value as number)) return false;
      if (key === "symbol" && t.symbol !== value) return false;
      if (key === "direction" && t.direction !== value) return false;
      if (key === "assetClass" && t.assetClass !== value) return false;
      if (key === "excludeSession" && t.session === value) return false;
      if (key === "includeOnly" && value === "journaled" && !t.hasJournal) return false;
      if (key === "includeOnly" && value === "rule-followed") {
        const j = journalRows.find((j) => j.tradeId === t.id);
        if (!j?.ruleFollowed) return false;
      }
    }
    return true;
  });

  const filteredJournals = journalRows.filter((j) => filtered.some((t) => t.id === j.tradeId));
  const simulated = computeOverview(filtered, filteredJournals);

  res.json({
    label,
    filteredTradeCount: filtered.length,
    actual,
    simulated,
    deltaWinRate: simulated.winRate - actual.winRate,
    deltaExpectancy: simulated.expectancy - actual.expectancy,
    deltaTotalPnl: simulated.totalPnl - actual.totalPnl,
    deltaProfitFactor: simulated.profitFactor - actual.profitFactor,
  });
});

router.get("/analytics/r-distribution", async (req, res) => {
  const opts = parseQP(req.query as Record<string, string>);
  const trades = await fetchTrades(opts);
  const rTrades = trades.filter((t) => t.rMultiple != null && t.pnl != null);

  if (rTrades.length < 2) {
    return res.json({
      bins: [],
      stats: { avgR: 0, medianR: 0, pctAbove1R: 0, breakevenWinRate: 0.5, totalWithR: rTrades.length, stdDev: 0, mean: 0 },
    });
  }

  const rValues = rTrades.map((t) => t.rMultiple!);
  const mean = rValues.reduce((s, r) => s + r, 0) / rValues.length;
  const sorted = [...rValues].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2
    : sorted[Math.floor(sorted.length / 2)]!;
  const variance = rValues.reduce((s, r) => s + (r - mean) ** 2, 0) / (rValues.length - 1);
  const stdDev = Math.sqrt(variance);
  const pctAbove1R = rValues.filter((r) => r >= 1).length / rValues.length;

  const winsR = rValues.filter((r) => r > 0);
  const lossesR = rValues.filter((r) => r <= 0).map(Math.abs);
  const avgWinR = winsR.length > 0 ? winsR.reduce((s, r) => s + r, 0) / winsR.length : 1;
  const avgLossR = lossesR.length > 0 ? lossesR.reduce((s, r) => s + r, 0) / lossesR.length : 1;
  const breakevenWinRate = avgWinR + avgLossR > 0 ? avgLossR / (avgWinR + avgLossR) : 0.5;

  const BIN = 0.5;
  let binStart = Math.max(Math.floor(Math.min(...rValues) / BIN) * BIN, -10);
  let binEnd = Math.min(Math.ceil(Math.max(...rValues) / BIN) * BIN, 20);
  binStart = Math.min(binStart, -1);
  binEnd = Math.max(binEnd, 2);

  const bins = [];
  for (let b = binStart; b < binEnd - 0.001; b = Math.round((b + BIN) * 10000) / 10000) {
    const bNext = Math.round((b + BIN) * 10000) / 10000;
    const count = rValues.filter((r) => r >= b && r < bNext).length;
    const midpoint = Math.round((b + BIN / 2) * 10000) / 10000;
    const sign = b >= 0 ? "+" : "";
    bins.push({ label: `${sign}${b.toFixed(1)}R`, binStart: b, binEnd: bNext, midpoint, count, isProfit: midpoint >= 0 });
  }

  res.json({
    bins,
    stats: {
      avgR: Math.round(mean * 1000) / 1000,
      medianR: Math.round(median * 1000) / 1000,
      pctAbove1R: Math.round(pctAbove1R * 10000) / 10000,
      breakevenWinRate: Math.round(breakevenWinRate * 10000) / 10000,
      totalWithR: rTrades.length,
      stdDev: Math.round(stdDev * 1000) / 1000,
      mean: Math.round(mean * 1000) / 1000,
    },
  });
});

export default router;
