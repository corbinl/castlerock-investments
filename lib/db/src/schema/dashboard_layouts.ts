import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dashboardLayoutsTable = pgTable("dashboard_layouts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default("Default"),
  widgets: text("widgets").notNull().default("[]"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDashboardLayoutSchema = createInsertSchema(dashboardLayoutsTable).omit({ id: true, updatedAt: true });
export type InsertDashboardLayout = z.infer<typeof insertDashboardLayoutSchema>;
export type DashboardLayout = typeof dashboardLayoutsTable.$inferSelect;
