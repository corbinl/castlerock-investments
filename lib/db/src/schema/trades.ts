import { pgTable, serial, text, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tradesTable = pgTable("trades", {
  id: serial("id").primaryKey(),
  importBatchId: integer("import_batch_id"),
  accountId: integer("account_id"),
  importSource: text("import_source"),
  assetClass: text("asset_class").notNull().default("equity"),
  symbol: text("symbol").notNull(),
  instrumentDescription: text("instrument_description"),
  direction: text("direction").notNull().default("long"),
  entryDate: text("entry_date").notNull(),
  exitDate: text("exit_date"),
  entryPrice: real("entry_price").notNull(),
  exitPrice: real("exit_price"),
  quantity: real("quantity").notNull(),
  pnl: real("pnl"),
  fees: real("fees"),
  stopLoss: real("stop_loss"),
  takeProfit: real("take_profit"),
  rMultiple: real("r_multiple"),
  tags: text("tags"),
  setup: text("setup"),
  notes: text("notes"),
  session: text("session"),
  economicEventNearby: boolean("economic_event_nearby"),
  hasJournal: boolean("has_journal").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTradeSchema = createInsertSchema(tradesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof tradesTable.$inferSelect;
