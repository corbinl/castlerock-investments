import { db } from "@workspace/db";
import {
  tradesTable,
  journalsTable,
} from "@workspace/db";
import { and, eq, gte, lte, isNotNull, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

export type Trade = typeof tradesTable.$inferSelect;
export type Journal = typeof journalsTable.$inferSelect;

export interface OverviewMetrics {
  totalTrades: number;
  winRate: number;
  lossRate: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  expectancyR: number;
  profitFactor: number;
  totalPnl: number;
  totalFees: number;
  maxDrawdown: number;
  avgRMultiple: number;
  castlerockScore: number;
  castlerockScoreLabel: string;
  ruleAdherenceRate: number | null;
  avgConfidence: number | null;
  avgHoldTimeHours: number | null;
  biggestWinner: number;
  biggestLoser: number;
  longWinRate: number | null;
  shortWinRate: number | null;
}

export interface SliceStats {
  label: string;
  tradeCount: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  profitFactor: number;
  expectancy: number;
  avgRMultiple: number | null;
}

function castlerockScore(metrics: {
  winRate: number;
  profitFactor: number;
  expectancyR: number;
  ruleAdherenceRate: number | null;
  maxDrawdown: number;
  totalTrades: number;
}): { score: number; label: string } {
  if (metrics.totalTrades === 0) return { score: 0, label: "No Data" };

  const wScore = Math.min(metrics.winRate * 100, 100) * 0.25;
  const pfRaw = Math.min(metrics.profitFactor / 3, 1) * 100;
  const pfScore = pfRaw * 0.25;
  const erScore = Math.min(Math.max((metrics.expectancyR + 1) / 2, 0), 1) * 100 * 0.20;
  const ruleScore = (metrics.ruleAdherenceRate ?? 0.5) * 100 * 0.15;
  const ddPenalty = Math.min(Math.abs(metrics.maxDrawdown) / 5000, 1) * 100 * 0.15;

  const score = Math.round(Math.min(wScore + pfScore + erScore + ruleScore + (15 - ddPenalty), 100));

  let label = "Developing";
  if (score >= 80) label = "Elite";
  else if (score >= 65) label = "Advanced";
  else if (score >= 50) label = "Intermediate";
  else if (score >= 35) label = "Developing";
  else label = "Struggling";

  return { score, label };
}

export function computeOverview(trades: Trade[], journals: Journal[]): OverviewMetrics {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winRate: 0,
      lossRate: 0,
      avgWin: 0,
      avgLoss: 0,
      expectancy: 0,
      expectancyR: 0,
      profitFactor: 0,
      totalPnl: 0,
      totalFees: 0,
      maxDrawdown: 0,
      avgRMultiple: 0,
      castlerockScore: 0,
      castlerockScoreLabel: "No Data",
      ruleAdherenceRate: null,
      avgConfidence: null,
      avgHoldTimeHours: null,
      biggestWinner: 0,
      biggestLoser: 0,
      longWinRate: null,
      shortWinRate: null,
    };
  }

  const closedTrades = trades.filter((t) => t.pnl != null);
  const wins = closedTrades.filter((t) => (t.pnl ?? 0) > 0);
  const losses = closedTrades.filter((t) => (t.pnl ?? 0) <= 0);

  const totalPnl = closedTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const totalFees = trades.reduce((s, t) => s + (t.fees ?? 0), 0);
  const winRate = closedTrades.length > 0 ? wins.length / closedTrades.length : 0;
  const lossRate = 1 - winRate;

  const totalWins = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const totalLosses = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));
  const avgWin = wins.length > 0 ? totalWins / wins.length : 0;
  const avgLoss = losses.length > 0 ? totalLosses / losses.length : 0;
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999 : 0;
  const expectancy = winRate * avgWin - lossRate * avgLoss;

  const rTrades = closedTrades.filter((t) => t.rMultiple != null);
  const avgRMultiple = rTrades.length > 0 ? rTrades.reduce((s, t) => s + (t.rMultiple ?? 0), 0) / rTrades.length : 0;
  const expectancyR = avgRMultiple;

  // Max drawdown from equity curve
  let peak = 0;
  let running = 0;
  let maxDrawdown = 0;
  const sorted = [...closedTrades].sort((a, b) => (a.entryDate > b.entryDate ? 1 : -1));
  for (const t of sorted) {
    running += t.pnl ?? 0;
    if (running > peak) peak = running;
    const dd = running - peak;
    if (dd < maxDrawdown) maxDrawdown = dd;
  }

  const biggestWinner = closedTrades.reduce((m, t) => Math.max(m, t.pnl ?? 0), 0);
  const biggestLoser = closedTrades.reduce((m, t) => Math.min(m, t.pnl ?? 0), 0);

  // Long/short split
  const longs = closedTrades.filter((t) => t.direction === "long");
  const shorts = closedTrades.filter((t) => t.direction === "short");
  const longWins = longs.filter((t) => (t.pnl ?? 0) > 0);
  const shortWins = shorts.filter((t) => (t.pnl ?? 0) > 0);

  const longWinRate = longs.length > 0 ? longWins.length / longs.length : null;
  const shortWinRate = shorts.length > 0 ? shortWins.length / shorts.length : null;

  // Journal-based metrics
  const jMap = new Map(journals.map((j) => [j.tradeId, j]));
  const tradeIdsWithJournal = trades.filter((t) => t.hasJournal).map((t) => t.id);
  const relevantJournals = tradeIdsWithJournal.map((id) => jMap.get(id)).filter(Boolean) as Journal[];

  const ruleJournals = relevantJournals.filter((j) => j.ruleFollowed != null);
  const ruleAdherenceRate =
    ruleJournals.length > 0 ? ruleJournals.filter((j) => j.ruleFollowed).length / ruleJournals.length : null;

  const confidenceJournals = relevantJournals.filter((j) => j.confidenceRating != null);
  const avgConfidence =
    confidenceJournals.length > 0
      ? confidenceJournals.reduce((s, j) => s + (j.confidenceRating ?? 0), 0) / confidenceJournals.length
      : null;

  // Hold time
  const holdTimes = closedTrades
    .filter((t) => t.exitDate)
    .map((t) => {
      const entry = new Date(t.entryDate).getTime();
      const exit = new Date(t.exitDate!).getTime();
      return (exit - entry) / (1000 * 60 * 60);
    })
    .filter((h) => h > 0);
  const avgHoldTimeHours = holdTimes.length > 0 ? holdTimes.reduce((s, h) => s + h, 0) / holdTimes.length : null;

  const cs = castlerockScore({ winRate, profitFactor, expectancyR, ruleAdherenceRate, maxDrawdown, totalTrades: trades.length });

  return {
    totalTrades: closedTrades.length,
    winRate,
    lossRate,
    avgWin,
    avgLoss,
    expectancy,
    expectancyR,
    profitFactor,
    totalPnl,
    totalFees,
    maxDrawdown,
    avgRMultiple,
    castlerockScore: cs.score,
    castlerockScoreLabel: cs.label,
    ruleAdherenceRate,
    avgConfidence,
    avgHoldTimeHours,
    biggestWinner,
    biggestLoser,
    longWinRate,
    shortWinRate,
  };
}

export function computeSliceStats(trades: Trade[], label: string): SliceStats {
  const closed = trades.filter((t) => t.pnl != null);
  if (closed.length === 0) {
    return { label, tradeCount: 0, winRate: 0, avgPnl: 0, totalPnl: 0, profitFactor: 0, expectancy: 0, avgRMultiple: null };
  }

  const wins = closed.filter((t) => (t.pnl ?? 0) > 0);
  const losses = closed.filter((t) => (t.pnl ?? 0) <= 0);
  const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const totalWins = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const totalLosses = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));
  const winRate = wins.length / closed.length;
  const lossRate = 1 - winRate;
  const avgWin = wins.length > 0 ? totalWins / wins.length : 0;
  const avgLoss = losses.length > 0 ? totalLosses / losses.length : 0;
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999 : 0;
  const expectancy = winRate * avgWin - lossRate * avgLoss;
  const rTrades = closed.filter((t) => t.rMultiple != null);
  const avgRMultiple = rTrades.length > 0 ? rTrades.reduce((s, t) => s + (t.rMultiple ?? 0), 0) / rTrades.length : null;

  return {
    label,
    tradeCount: closed.length,
    winRate,
    avgPnl: totalPnl / closed.length,
    totalPnl,
    profitFactor,
    expectancy,
    avgRMultiple,
  };
}

export function buildWhereClause(opts: {
  accountId?: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}): SQL[] {
  const conds: SQL[] = [];
  if (opts.accountId) conds.push(eq(tradesTable.accountId, opts.accountId));
  if (opts.dateFrom) conds.push(gte(tradesTable.entryDate, opts.dateFrom));
  if (opts.dateTo) conds.push(lte(tradesTable.entryDate, opts.dateTo));
  return conds;
}

export async function fetchTrades(opts: {
  accountId?: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}): Promise<Trade[]> {
  const conds = buildWhereClause(opts);
  return conds.length > 0 ? db.select().from(tradesTable).where(and(...conds)) : db.select().from(tradesTable);
}

export async function fetchJournals(tradeIds: number[]): Promise<Journal[]> {
  if (tradeIds.length === 0) return [];
  return db.select().from(journalsTable).where(sql`${journalsTable.tradeId} = ANY(ARRAY[${sql.raw(tradeIds.join(","))}]::int[])`);
}
