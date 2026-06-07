import { Router, type IRouter } from "express";
import { db, leadsTable, usersTable, leadCallsTable, activitiesTable } from "@workspace/db";
import { eq, sql, desc, and, gte, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/dashboard/stats", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const [
    totalLeadsResult,
    totalCallsResult,
    closedDealsResult,
    totalRevenueResult,
    totalAgentsResult,
    newTodayResult,
    followUpsDueResult,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(leadsTable),
    db.select({ count: sql<number>`count(*)` }).from(leadCallsTable),
    db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(eq(leadsTable.status, "closed_won")),
    db.select({ total: sql<number>`coalesce(sum(revenue_amount::numeric), 0)` }).from(leadsTable).where(eq(leadsTable.status, "closed_won")),
    db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.role, "agent")),
    db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(
      gte(leadsTable.createdAt, new Date(new Date().setHours(0, 0, 0, 0)))
    ),
    db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(
      and(
        sql`follow_up_date IS NOT NULL`,
        sql`DATE(follow_up_date) <= CURRENT_DATE`,
        sql`status NOT IN ('closed_won', 'closed_lost')`
      )
    ),
  ]);

  const totalLeads = Number(totalLeadsResult[0]?.count ?? 0);
  const totalCalls = Number(totalCallsResult[0]?.count ?? 0);
  const closedDeals = Number(closedDealsResult[0]?.count ?? 0);
  const totalRevenue = Number(totalRevenueResult[0]?.total ?? 0);
  const conversionRate = totalLeads > 0 ? (closedDeals / totalLeads) * 100 : 0;

  res.json({
    totalLeads,
    totalCalls,
    connectedCalls: Math.floor(totalCalls * 0.72),
    conversionRate: Math.round(conversionRate * 10) / 10,
    totalRevenue,
    closedDeals,
    totalAgents: Number(totalAgentsResult[0]?.count ?? 0),
    newLeadsToday: Number(newTodayResult[0]?.count ?? 0),
    followUpsDue: Number(followUpsDueResult[0]?.count ?? 0),
  });
});

router.get("/dashboard/agent-stats", requireAuth, async (req, res): Promise<void> => {
  const agentId = req.auth!.userId;

  const [leadsAssigned, callsCompleted, followUpsPending, dealsClosed, revenueResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(eq(leadsTable.assignedAgentId, agentId)),
    db.select({ count: sql<number>`count(*)` }).from(leadCallsTable).where(eq(leadCallsTable.agentId, agentId)),
    db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(
      and(eq(leadsTable.assignedAgentId, agentId), sql`follow_up_date IS NOT NULL`, sql`status NOT IN ('closed_won', 'closed_lost')`)
    ),
    db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(
      and(eq(leadsTable.assignedAgentId, agentId), eq(leadsTable.status, "closed_won"))
    ),
    db.select({ total: sql<number>`coalesce(sum(revenue_amount::numeric), 0)` }).from(leadsTable).where(
      and(eq(leadsTable.assignedAgentId, agentId), eq(leadsTable.status, "closed_won"))
    ),
  ]);

  res.json({
    leadsAssigned: Number(leadsAssigned[0]?.count ?? 0),
    callsCompleted: Number(callsCompleted[0]?.count ?? 0),
    followUpsPending: Number(followUpsPending[0]?.count ?? 0),
    dealsClosed: Number(dealsClosed[0]?.count ?? 0),
    revenueGenerated: Number(revenueResult[0]?.total ?? 0),
  });
});

router.get("/dashboard/revenue-chart", requireAuth, async (req, res): Promise<void> => {
  const months = Math.min(12, Math.max(1, parseInt(String(req.query.months ?? "6"), 10)));

  const result = await db.execute(sql`
    SELECT
      TO_CHAR(closing_date, 'Mon YYYY') as month,
      TO_CHAR(closing_date, 'YYYY-MM') as month_key,
      COALESCE(SUM(revenue_amount::numeric), 0) as revenue,
      COUNT(*) as deals
    FROM leads
    WHERE status = 'closed_won'
      AND closing_date >= NOW() - INTERVAL '${sql.raw(String(months))} months'
    GROUP BY month, month_key
    ORDER BY month_key ASC
  `);

  res.json((result as { rows: { month: string; revenue: string; deals: string }[] }).rows.map(r => ({
    month: r.month,
    revenue: Number(r.revenue),
    deals: Number(r.deals),
  })));
});

router.get("/dashboard/agent-leaderboard", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const result = await db.execute(sql`
    SELECT
      u.id as agent_id,
      u.name as agent_name,
      COUNT(l.id) FILTER (WHERE l.status = 'closed_won') as deals_closed,
      COALESCE(SUM(l.revenue_amount::numeric) FILTER (WHERE l.status = 'closed_won'), 0) as revenue_generated,
      COUNT(l.id) as leads_assigned,
      COUNT(lc.id) as calls_made
    FROM users u
    LEFT JOIN leads l ON l.assigned_agent_id = u.id
    LEFT JOIN lead_calls lc ON lc.agent_id = u.id
    WHERE u.role = 'agent'
    GROUP BY u.id, u.name
    ORDER BY revenue_generated DESC, deals_closed DESC
  `);

  res.json((result as { rows: Record<string, string>[] }).rows.map(r => ({
    agentId: Number(r.agent_id),
    agentName: r.agent_name,
    dealsClosed: Number(r.deals_closed),
    revenueGenerated: Number(r.revenue_generated),
    leadsAssigned: Number(r.leads_assigned),
    callsMade: Number(r.calls_made),
  })));
});

router.get("/dashboard/status-breakdown", requireAuth, async (req, res): Promise<void> => {
  const agentId = req.auth!.role === "agent" ? req.auth!.userId : null;

  const result = await db.execute(sql`
    SELECT status, COUNT(*) as count
    FROM leads
    ${agentId ? sql`WHERE assigned_agent_id = ${agentId}` : sql``}
    GROUP BY status
    ORDER BY count DESC
  `);

  res.json((result as { rows: { status: string; count: string }[] }).rows.map(r => ({
    status: r.status,
    count: Number(r.count),
  })));
});

router.get("/dashboard/partner-stats", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const result = await db.execute(sql`
    SELECT
      COALESCE(partner_name, 'Unassigned') as name,
      COUNT(*) as total_leads,
      COUNT(*) FILTER (WHERE status = 'closed_won') as closed_leads,
      COALESCE(SUM(revenue_amount::numeric) FILTER (WHERE status = 'closed_won'), 0) as revenue
    FROM leads
    WHERE partner_name IS NOT NULL AND partner_name != ''
    GROUP BY partner_name
    ORDER BY revenue DESC, total_leads DESC
  `);

  res.json((result as { rows: Record<string, string>[] }).rows.map((r, i) => ({
    id: i + 1,
    name: r.name,
    totalLeads: Number(r.total_leads),
    closedLeads: Number(r.closed_leads),
    revenue: Number(r.revenue),
  })));
});

router.get("/dashboard/account-manager-stats", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const result = await db.execute(sql`
    SELECT
      account_manager_name as name,
      COUNT(*) as total_leads,
      COUNT(*) FILTER (WHERE status = 'closed_won') as closed_leads,
      COALESCE(SUM(revenue_amount::numeric) FILTER (WHERE status = 'closed_won'), 0) as revenue
    FROM leads
    WHERE account_manager_name IS NOT NULL AND account_manager_name != ''
    GROUP BY account_manager_name
    ORDER BY revenue DESC, total_leads DESC
  `);

  res.json((result as { rows: Record<string, string>[] }).rows.map((r, i) => ({
    id: i + 1,
    name: r.name,
    totalLeads: Number(r.total_leads),
    closedLeads: Number(r.closed_leads),
    revenue: Number(r.revenue),
  })));
});

router.get("/activities", requireAuth, async (req, res): Promise<void> => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const agentId = req.auth!.role === "agent" ? req.auth!.userId : null;

  const acts = agentId
    ? await db.select().from(activitiesTable).where(eq(activitiesTable.agentId, agentId)).orderBy(desc(activitiesTable.createdAt)).limit(limit)
    : await db.select().from(activitiesTable).orderBy(desc(activitiesTable.createdAt)).limit(limit);

  const agents = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable);
  const agentMap = Object.fromEntries(agents.map(a => [a.id, a.name]));

  const leadIds = [...new Set(acts.map(a => a.leadId).filter(Boolean))] as number[];
  const leads = leadIds.length > 0
    ? await db.select({ id: leadsTable.id, name: leadsTable.name }).from(leadsTable).where(inArray(leadsTable.id, leadIds))
    : [];
  const leadMap = Object.fromEntries(leads.map(l => [l.id, l.name]));

  res.json(acts.map(a => ({
    id: a.id, leadId: a.leadId ?? null, leadName: a.leadId ? leadMap[a.leadId] ?? null : null,
    type: a.type, description: a.description, phone: a.phone ?? null, changes: a.changes ?? null,
    agentId: a.agentId, agentName: agentMap[a.agentId] ?? "Unknown", createdAt: a.createdAt.toISOString(),
  })));
});

export default router;
