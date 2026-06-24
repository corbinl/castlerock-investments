import { Router } from "express";
import { db } from "@workspace/db";
import { coachingNotesTable, coachingThemesTable, tradesTable, journalsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

function buildCoachingPrompt(trade: Record<string, unknown>, journal: Record<string, unknown> | null): string {
  const direction = String(trade.direction ?? "unknown").toUpperCase();
  const symbol = String(trade.symbol ?? "?");
  const pnl = trade.pnl != null ? `$${Number(trade.pnl).toFixed(2)}` : "unknown";
  const rMultiple = trade.rMultiple != null ? `${Number(trade.rMultiple).toFixed(2)}R` : "unknown";

  const journalSection = journal
    ? `
Journal:
- Why entry: ${journal.whyEntry || "not filled"}
- Why exit: ${journal.whyExit || "not filled"}
- Mistakes: ${journal.mistakes || "none noted"}
- Market observation: ${journal.marketObservation || "none"}
- Confidence rating: ${journal.confidenceRating ?? "?"}/10
- Rules followed: ${journal.ruleFollowed === true ? "YES" : journal.ruleFollowed === false ? "NO" : "not recorded"}
- Mental/tilt state: ${journal.tiltState || "not recorded"}`
    : "No journal entry.";

  return `You are a direct, data-driven trading coach reviewing a completed trade. Be specific and actionable — no generic advice.

Trade: ${direction} ${symbol}
P&L: ${pnl} | R-multiple: ${rMultiple}
Entry: $${trade.entryPrice} | Exit: ${trade.exitPrice ? `$${trade.exitPrice}` : "open"}
Stop: ${trade.stopLoss ? `$${trade.stopLoss}` : "none"} | Target: ${trade.takeProfit ? `$${trade.takeProfit}` : "none"}
Setup/Strategy: ${trade.setup || "not tagged"}
${journalSection}

Give exactly 3-5 sentences of coaching feedback. Structure: 1) Name the specific behavioral pattern you see. 2) What they did well OR what went wrong, grounded in the numbers. 3) One concrete action for their next trade of this type. Be direct, not preachy.`;
}

function buildThemesPrompt(notes: string[]): string {
  const sample = notes.slice(0, 20).join("\n\n---\n\n");
  return `You are a trading performance analyst. Below are recent coaching notes for a trader. Identify exactly 3 recurring behavioral patterns or themes across these notes. Be specific and data-driven.

${sample}

Format your response as a JSON array of exactly 3 objects: [{"theme": "short title", "description": "2 sentences", "frequency": "how often it appears", "action": "one specific improvement"}]

Respond ONLY with the JSON array, no other text.`;
}

router.post("/coach/trade/:id", async (req, res) => {
  const tradeId = parseInt(req.params["id"]!);
  if (isNaN(tradeId)) return res.status(400).json({ error: "Invalid trade ID" });

  const [trade] = await db.select().from(tradesTable).where(eq(tradesTable.id, tradeId));
  if (!trade) return res.status(404).json({ error: "Trade not found" });

  if (!trade.hasJournal) {
    return res.status(422).json({ error: "Add a journal entry before requesting coaching" });
  }

  const [journal] = await db.select().from(journalsTable).where(eq(journalsTable.tradeId, tradeId));

  const existing = await db.select().from(coachingNotesTable).where(eq(coachingNotesTable.tradeId, tradeId)).limit(1);
  if (existing.length > 0 && !req.body?.regenerate) {
    return res.json({ coaching: existing[0]!.content, cached: true });
  }

  try {
    const prompt = buildCoachingPrompt(trade as Record<string, unknown>, journal as Record<string, unknown> | null);
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices[0]?.message?.content ?? "Unable to generate coaching at this time.";

    if (existing.length > 0) {
      await db.update(coachingNotesTable).set({ content, createdAt: new Date().toISOString() }).where(eq(coachingNotesTable.tradeId, tradeId));
    } else {
      await db.insert(coachingNotesTable).values({ tradeId, content });
    }

    res.json({ coaching: content, cached: false });
  } catch (err) {
    console.error("Coach error:", err);
    res.status(500).json({ error: "Failed to generate coaching" });
  }
});

router.get("/coach/trade/:id", async (req, res) => {
  const tradeId = parseInt(req.params["id"]!);
  if (isNaN(tradeId)) return res.status(400).json({ error: "Invalid trade ID" });

  const [note] = await db.select().from(coachingNotesTable).where(eq(coachingNotesTable.tradeId, tradeId)).limit(1);
  if (!note) return res.status(404).json({ error: "No coaching note found" });

  res.json({ coaching: note.content, cached: true });
});

router.post("/coach/themes", async (req, res) => {
  const recentNotes = await db
    .select({ content: coachingNotesTable.content })
    .from(coachingNotesTable)
    .orderBy(desc(coachingNotesTable.createdAt))
    .limit(20);

  if (recentNotes.length < 3) {
    return res.json({
      themes: [],
      message: "Get coaching on at least 3 trades to see behavioral themes.",
    });
  }

  const cachedTheme = await db
    .select()
    .from(coachingThemesTable)
    .orderBy(desc(coachingThemesTable.generatedAt))
    .limit(1);

  const cacheValid =
    cachedTheme.length > 0 &&
    cachedTheme[0]!.tradeCount === recentNotes.length &&
    !req.body?.regenerate;

  if (cacheValid) {
    try {
      return res.json({ themes: JSON.parse(cachedTheme[0]!.themes), cached: true });
    } catch {
    }
  }

  try {
    const notes = recentNotes.map((n) => n.content);
    const prompt = buildThemesPrompt(notes);

    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.choices[0]?.message?.content ?? "[]";
    let themes: unknown[] = [];
    try {
      themes = JSON.parse(raw);
    } catch {
      themes = [];
    }

    const serialized = JSON.stringify(themes);
    if (cachedTheme.length > 0) {
      await db.update(coachingThemesTable)
        .set({ themes: serialized, generatedAt: new Date().toISOString(), tradeCount: recentNotes.length })
        .where(eq(coachingThemesTable.id, cachedTheme[0]!.id));
    } else {
      await db.insert(coachingThemesTable).values({ themes: serialized, tradeCount: recentNotes.length });
    }

    res.json({ themes, cached: false });
  } catch (err) {
    console.error("Themes error:", err);
    res.status(500).json({ error: "Failed to generate themes" });
  }
});

router.get("/coach/themes", async (req, res) => {
  const recentNotes = await db.select({ content: coachingNotesTable.content }).from(coachingNotesTable).orderBy(desc(coachingNotesTable.createdAt)).limit(20);

  if (recentNotes.length < 3) {
    return res.json({ themes: [], message: "Get coaching on at least 3 trades to see behavioral themes." });
  }

  const [cached] = await db.select().from(coachingThemesTable).orderBy(desc(coachingThemesTable.generatedAt)).limit(1);
  if (!cached) return res.json({ themes: [], message: "No themes generated yet. Click 'Analyze Themes'." });

  try {
    return res.json({ themes: JSON.parse(cached.themes), cached: true });
  } catch {
    return res.json({ themes: [], message: "Error loading themes." });
  }
});

export default router;
