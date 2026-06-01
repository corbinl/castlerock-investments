import { Router } from "express";
import { db } from "@workspace/db";
import { strategiesTable, tradesTable } from "@workspace/db";
import { eq, like } from "drizzle-orm";
import { computeSliceStats, fetchTrades, fetchJournals, computeOverview } from "../lib/analytics";

const router = Router();

router.get("/strategies", async (_req, res) => {
  const rows = await db.select().from(strategiesTable).orderBy(strategiesTable.name);
  res.json(rows.map((r) => ({ ...r, rules: JSON.parse(r.rules ?? "[]") })));
});

router.post("/strategies", async (req, res) => {
  const { name, description, rules = [], assetClass } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const [row] = await db.insert(strategiesTable).values({ name, description, rules: JSON.stringify(rules), assetClass }).returning();
  res.status(201).json({ ...row, rules: JSON.parse(row.rules ?? "[]") });
});

router.get("/strategies/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  const [strategy] = await db.select().from(strategiesTable).where(eq(strategiesTable.id, id));
  if (!strategy) return res.status(404).json({ error: "Not found" });

  const trades = await db.select().from(tradesTable).where(like(tradesTable.setup, strategy.name));
  const stats = computeSliceStats(trades, strategy.name);
  const topSymbols = [...new Set(trades.map((t) => t.symbol))].slice(0, 5);

  res.json({
    strategy: { ...strategy, rules: JSON.parse(strategy.rules ?? "[]") },
    stats,
    tradeCount: trades.length,
    topSymbols,
  });
});

router.patch("/strategies/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  const { name, description, rules } = req.body;
  const update: Record<string, unknown> = {};
  if (name != null) update["name"] = name;
  if (description !== undefined) update["description"] = description;
  if (rules != null) update["rules"] = JSON.stringify(rules);
  const [row] = await db.update(strategiesTable).set(update).where(eq(strategiesTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json({ ...row, rules: JSON.parse(row.rules ?? "[]") });
});

router.delete("/strategies/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  await db.delete(strategiesTable).where(eq(strategiesTable.id, id));
  res.status(204).send();
});

router.get("/strategies/:id/playbook", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  const [strategy] = await db.select().from(strategiesTable).where(eq(strategiesTable.id, id));
  if (!strategy) return res.status(404).json({ error: "Not found" });

  const trades = await fetchTrades({});
  const strategyTrades = trades.filter((t) => t.setup === strategy.name);
  const journals = await fetchJournals(strategyTrades.filter((t) => t.hasJournal).map((t) => t.id));
  const stats = computeOverview(strategyTrades, journals);

  const topTrades = strategyTrades
    .filter((t) => t.pnl != null)
    .sort((a, b) => (b.pnl ?? 0) - (a.pnl ?? 0))
    .slice(0, 5);

  res.json({
    strategy: { ...strategy, rules: JSON.parse(strategy.rules ?? "[]") },
    stats,
    topTrades,
    generatedAt: new Date().toISOString(),
  });
});

export default router;
