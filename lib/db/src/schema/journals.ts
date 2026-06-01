import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const journalsTable = pgTable("journals", {
  id: serial("id").primaryKey(),
  tradeId: integer("trade_id").notNull().unique(),
  whyEntry: text("why_entry"),
  whyExit: text("why_exit"),
  whyStopLoss: text("why_stop_loss"),
  whyTakeProfit: text("why_take_profit"),
  mistakes: text("mistakes"),
  marketObservation: text("market_observation"),
  confidenceRating: integer("confidence_rating"),
  ruleFollowed: boolean("rule_followed"),
  tiltState: text("tilt_state"),
  executionQualityEntry: integer("execution_quality_entry"),
  executionQualityExit: integer("execution_quality_exit"),
  executionQualityStop: integer("execution_quality_stop"),
  strategyRulesChecked: text("strategy_rules_checked"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertJournalSchema = createInsertSchema(journalsTable).omit({ id: true, updatedAt: true });
export type InsertJournal = z.infer<typeof insertJournalSchema>;
export type Journal = typeof journalsTable.$inferSelect;
