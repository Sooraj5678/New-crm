import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const uploadBatchesTable = pgTable("upload_batches", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  uploadedBy: integer("uploaded_by").notNull(),
  partnerId: integer("partner_id"),
  accountManagerId: integer("account_manager_id"),
  totalRecords: integer("total_records").notNull().default(0),
  importedRecords: integer("imported_records").notNull().default(0),
  failedRecords: integer("failed_records").notNull().default(0),
  duplicateRecords: integer("duplicate_records").notNull().default(0),
  status: text("status").notNull().default("completed"),
  errorReport: jsonb("error_report"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type UploadBatch = typeof uploadBatchesTable.$inferSelect;
