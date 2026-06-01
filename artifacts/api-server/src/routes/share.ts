import { Router } from "express";
import { db } from "@workspace/db";
import { shareLinksTable, tradesTable, journalsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const router = Router();

router.post("/share/trades/:id", async (req, res) => {
  const tradeId = parseInt(req.params["id"]!);
  const [trade] = await db.select().from(tradesTable).where(eq(tradesTable.id, tradeId));
  if (!trade) return res.status(404).json({ error: "Trade not found" });

  const token = uuidv4().replace(/-/g, "").slice(0, 16);
  await db.insert(shareLinksTable).values({ token, tradeId }).onConflictDoNothing();

  res.json({ token, url: `/share/view/${token}`, expiresAt: null });
});

router.get("/share/view/:token", async (req, res) => {
  const token = req.params["token"]!;
  const [link] = await db.select().from(shareLinksTable).where(eq(shareLinksTable.token, token));
  if (!link) return res.status(404).json({ error: "Share link not found" });

  const [trade] = await db.select().from(tradesTable).where(eq(tradesTable.id, link.tradeId));
  if (!trade) return res.status(404).json({ error: "Trade not found" });

  const [journal] = await db.select().from(journalsTable).where(eq(journalsTable.tradeId, link.tradeId));
  res.json({ trade, journal: journal ?? null });
});

export default router;
