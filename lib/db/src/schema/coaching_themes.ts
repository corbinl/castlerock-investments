import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const coachingThemesTable = pgTable("coaching_themes", {
  id: serial("id").primaryKey(),
  themes: text("themes").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  tradeCount: integer("trade_count").notNull().default(0),
});

export type CoachingTheme = typeof coachingThemesTable.$inferSelect;
