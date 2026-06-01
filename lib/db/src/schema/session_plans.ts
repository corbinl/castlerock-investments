import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sessionPlansTable = pgTable("session_plans", {
  id: serial("id").primaryKey(),
  sessionDate: text("session_date").notNull(),
  instruments: text("instruments"),
  directionBias: text("direction_bias"),
  setupsWatching: text("setups_watching"),
  premarketNotes: text("premarket_notes"),
  postSessionNotes: text("post_session_notes"),
  planAdherenceScore: integer("plan_adherence_score"),
  actualTradeCount: integer("actual_trade_count"),
  actualPnl: real("actual_pnl"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSessionPlanSchema = createInsertSchema(sessionPlansTable).omit({ id: true, createdAt: true });
export type InsertSessionPlan = z.infer<typeof insertSessionPlanSchema>;
export type SessionPlan = typeof sessionPlansTable.$inferSelect;
