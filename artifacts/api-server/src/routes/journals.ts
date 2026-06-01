import { Router } from "express";
import { db } from "@workspace/db";
import { journalsTable, tradesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/trades/:id/journal", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  const [row] = await db.select().from(journalsTable).where(eq(journalsTable.tradeId, id));
  if (!row) return res.status(404).json({ error: "No journal" });
  res.json(row);
});

router.put("/trades/:id/journal", async (req, res) => {
  const tradeId = parseInt(req.params["id"]!);
  const [trade] = await db.select().from(tradesTable).where(eq(tradesTable.id, tradeId));
  if (!trade) return res.status(404).json({ error: "Trade not found" });

  const fields = {
    tradeId,
    whyEntry: req.body.whyEntry ?? null,
    whyExit: req.body.whyExit ?? null,
    whyStopLoss: req.body.whyStopLoss ?? null,
    whyTakeProfit: req.body.whyTakeProfit ?? null,
    mistakes: req.body.mistakes ?? null,
    marketObservation: req.body.marketObservation ?? null,
    confidenceRating: req.body.confidenceRating ?? null,
    ruleFollowed: req.body.ruleFollowed ?? null,
    tiltState: req.body.tiltState ?? null,
    executionQualityEntry: req.body.executionQualityEntry ?? null,
    executionQualityExit: req.body.executionQualityExit ?? null,
    executionQualityStop: req.body.executionQualityStop ?? null,
    strategyRulesChecked: req.body.strategyRulesChecked ?? null,
  };

  const [existing] = await db.select().from(journalsTable).where(eq(journalsTable.tradeId, tradeId));
  let row;
  if (existing) {
    [row] = await db.update(journalsTable).set(fields).where(eq(journalsTable.tradeId, tradeId)).returning();
  } else {
    [row] = await db.insert(journalsTable).values(fields).returning();
    await db.update(tradesTable).set({ hasJournal: true }).where(eq(tradesTable.id, tradeId));
  }

  res.json(row);
});

export default router;
