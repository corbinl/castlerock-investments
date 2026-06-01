import { Router } from "express";
import { db } from "@workspace/db";
import { accountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/accounts", async (_req, res) => {
  const rows = await db.select().from(accountsTable).orderBy(accountsTable.id);
  res.json(rows);
});

router.post("/accounts", async (req, res) => {
  const { name, currency = "USD", description } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const [row] = await db.insert(accountsTable).values({ name, currency, description }).returning();
  res.status(201).json(row);
});

router.get("/accounts/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  const [row] = await db.select().from(accountsTable).where(eq(accountsTable.id, id));
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

router.patch("/accounts/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  const { name, currency, description } = req.body;
  const update: Record<string, unknown> = {};
  if (name != null) update["name"] = name;
  if (currency != null) update["currency"] = currency;
  if (description !== undefined) update["description"] = description;
  const [row] = await db.update(accountsTable).set(update).where(eq(accountsTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

router.delete("/accounts/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  await db.delete(accountsTable).where(eq(accountsTable.id, id));
  res.status(204).send();
});

export default router;
