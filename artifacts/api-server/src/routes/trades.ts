import { Router } from "express";
import { db } from "@workspace/db";
import { tradesTable, journalsTable } from "@workspace/db";
import { eq, and, gte, lte, like, sql } from "drizzle-orm";

const router = Router();

router.get("/trades/meta/symbols", async (_req, res) => {
  const rows = await db
    .selectDistinct({ symbol: tradesTable.symbol })
    .from(tradesTable)
    .orderBy(tradesTable.symbol);
  res.json(rows.map((r) => r.symbol));
});

router.get("/trades/meta/tags", async (_req, res) => {
  const rows = await db.select({ tags: tradesTable.tags }).from(tradesTable).where(sql`${tradesTable.tags} IS NOT NULL`);
  const tagSet = new Set<string>();
  for (const r of rows) {
    if (r.tags) {
      r.tags.split(",").map((t) => t.trim()).filter(Boolean).forEach((t) => tagSet.add(t));
    }
  }
  res.json([...tagSet].sort());
});

router.get("/trades", async (req, res) => {
  const {
    accountId,
    assetClass,
    symbol,
    direction,
    strategy,
    tag,
    dateFrom,
    dateTo,
    untaggedOnly,
    page = "1",
    pageSize = "50",
    sortBy = "entryDate",
    sortDir = "desc",
  } = req.query as Record<string, string>;

  const conds = [];
  if (accountId) conds.push(eq(tradesTable.accountId, parseInt(accountId)));
  if (assetClass) conds.push(eq(tradesTable.assetClass, assetClass));
  if (symbol) conds.push(like(tradesTable.symbol, `%${symbol}%`));
  if (direction) conds.push(eq(tradesTable.direction, direction));
  if (strategy) conds.push(like(tradesTable.setup, `%${strategy}%`));
  if (tag) conds.push(like(tradesTable.tags, `%${tag}%`));
  if (dateFrom) conds.push(gte(tradesTable.entryDate, dateFrom));
  if (dateTo) conds.push(lte(tradesTable.entryDate, dateTo));
  if (untaggedOnly === "true") conds.push(sql`(${tradesTable.tags} IS NULL OR ${tradesTable.tags} = '')`);

  const where = conds.length > 0 ? and(...conds) : undefined;

  const pg = Math.max(parseInt(page), 1);
  const ps = Math.min(Math.max(parseInt(pageSize), 1), 200);
  const offset = (pg - 1) * ps;

  const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(tradesTable).where(where);
  const total = countRow?.count ?? 0;

  const allowedSorts: Record<string, unknown> = {
    entryDate: tradesTable.entryDate,
    exitDate: tradesTable.exitDate,
    symbol: tradesTable.symbol,
    pnl: tradesTable.pnl,
    rMultiple: tradesTable.rMultiple,
    createdAt: tradesTable.createdAt,
  };

  const sortCol = allowedSorts[sortBy] ?? tradesTable.entryDate;
  const order = sortDir === "asc" ? sql`${sortCol} ASC NULLS LAST` : sql`${sortCol} DESC NULLS LAST`;

  const trades = await db.select().from(tradesTable).where(where).orderBy(order).limit(ps).offset(offset);

  res.json({ trades, total, page: pg, pageSize: ps });
});

router.get("/trades/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  const [trade] = await db.select().from(tradesTable).where(eq(tradesTable.id, id));
  if (!trade) return res.status(404).json({ error: "Not found" });
  const [journal] = await db.select().from(journalsTable).where(eq(journalsTable.tradeId, id));
  res.json({ trade, journal: journal ?? null });
});

router.patch("/trades/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  const allowed = ["setup", "tags", "notes", "stopLoss", "takeProfit", "assetClass", "symbol", "direction"];
  const update: Record<string, unknown> = {};
  const fieldMap: Record<string, string> = { stopLoss: "stop_loss", takeProfit: "take_profit", assetClass: "asset_class" };
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      const dbKey = fieldMap[key] ?? key;
      update[dbKey] = req.body[key];
    }
  }
  const [row] = await db.update(tradesTable).set(update).where(eq(tradesTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

router.delete("/trades/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  await db.delete(journalsTable).where(eq(journalsTable.tradeId, id));
  await db.delete(tradesTable).where(eq(tradesTable.id, id));
  res.status(204).send();
});

export default router;
