import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  mobile: text("mobile").notNull(),
  alternateMobile: text("alternate_mobile"),
  email: text("email"),
  company: text("company"),
  city: text("city"),
  state: text("state"),
  country: text("country"),
  source: text("source"),
  status: text("status").notNull().default("new"),
  priority: text("priority").notNull().default("medium"),
  followUpDate: timestamp("follow_up_date", { withTimezone: true }),
  assignedAgentId: integer("assigned_agent_id"),
  partnerId: integer("partner_id"),
  accountManagerId: integer("account_manager_id"),
  partnerName: text("partner_name"),
  accountManagerName: text("account_manager_name"),
  revenueAmount: numeric("revenue_amount", { precision: 12, scale: 2 }),
  closingRemark: text("closing_remark"),
  closingDate: timestamp("closing_date", { withTimezone: true }),
  lastCalledAt: timestamp("last_called_at", { withTimezone: true }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLeadSchema = createInsertSchema(leadsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;
