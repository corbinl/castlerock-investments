import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { tradesTable } from "./trades";

export const coachingNotesTable = pgTable("coaching_notes", {
  id: serial("id").primaryKey(),
  tradeId: integer("trade_id").notNull().references(() => tradesTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CoachingNote = typeof coachingNotesTable.$inferSelect;
export type NewCoachingNote = typeof coachingNotesTable.$inferInsert;
