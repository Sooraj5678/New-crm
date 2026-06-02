import { pgTable, serial, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dialerSessionsTable = pgTable("dialer_sessions", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  totalCalls: integer("total_calls").notNull().default(0),
  connectedCalls: integer("connected_calls").notNull().default(0),
  followUpsScheduled: integer("follow_ups_scheduled").notNull().default(0),
  dealsWon: integer("deals_won").notNull().default(0),
  revenueGenerated: numeric("revenue_generated", { precision: 14, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDialerSessionSchema = createInsertSchema(dialerSessionsTable).omit({ id: true, createdAt: true });
export type InsertDialerSession = z.infer<typeof insertDialerSessionSchema>;
export type DialerSession = typeof dialerSessionsTable.$inferSelect;
