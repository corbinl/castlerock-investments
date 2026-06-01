import { Router } from "express";
import { db } from "@workspace/db";
import { sessionPlansTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/sessions", async (req, res) => {
  const { page = "1", pageSize = "20" } = req.query as Record<string, string>;
  const pg = Math.max(parseInt(page), 1);
  const ps = Math.min(parseInt(pageSize), 100);
  const rows = await db.select().from(sessionPlansTable).orderBy(sessionPlansTable.sessionDate).limit(ps).offset((pg - 1) * ps);
  res.json(rows);
});

router.post("/sessions", async (req, res) => {
  const { sessionDate, instruments, directionBias, setupsWatching, premarketNotes } = req.body;
  if (!sessionDate) return res.status(400).json({ error: "sessionDate required" });
  const [row] = await db.insert(sessionPlansTable).values({ sessionDate, instruments, directionBias, setupsWatching, premarketNotes }).returning();
  res.status(201).json(row);
});

router.get("/sessions/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  const [row] = await db.select().from(sessionPlansTable).where(eq(sessionPlansTable.id, id));
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

router.patch("/sessions/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  const { instruments, directionBias, setupsWatching, premarketNotes, postSessionNotes, planAdherenceScore } = req.body;
  const update: Record<string, unknown> = {};
  if (instruments !== undefined) update["instruments"] = instruments;
  if (directionBias !== undefined) update["directionBias"] = directionBias;
  if (setupsWatching !== undefined) update["setupsWatching"] = setupsWatching;
  if (premarketNotes !== undefined) update["premarketNotes"] = premarketNotes;
  if (postSessionNotes !== undefined) update["postSessionNotes"] = postSessionNotes;
  if (planAdherenceScore !== undefined) update["planAdherenceScore"] = planAdherenceScore;
  const [row] = await db.update(sessionPlansTable).set(update).where(eq(sessionPlansTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

export default router;
