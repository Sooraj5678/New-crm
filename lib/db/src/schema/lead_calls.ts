import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leadCallsTable = pgTable("lead_calls", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  agentId: integer("agent_id").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  duration: integer("duration"),
  outcome: text("outcome"),
  notes: text("notes"),
  sessionId: integer("session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLeadCallSchema = createInsertSchema(leadCallsTable).omit({ id: true, createdAt: true });
export type InsertLeadCall = z.infer<typeof insertLeadCallSchema>;
export type LeadCall = typeof leadCallsTable.$inferSelect;
