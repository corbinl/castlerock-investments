import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const importBatchesTable = pgTable("import_batches", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  brokerFormat: text("broker_format").notNull().default("generic"),
  accountId: integer("account_id"),
  rowCount: integer("row_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertImportBatchSchema = createInsertSchema(importBatchesTable).omit({ id: true, importedAt: true });
export type InsertImportBatch = z.infer<typeof insertImportBatchSchema>;
export type ImportBatch = typeof importBatchesTable.$inferSelect;
