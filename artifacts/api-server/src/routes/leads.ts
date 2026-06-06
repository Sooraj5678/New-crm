import { Router, type IRouter } from "express";
import { db, leadsTable, usersTable, leadNotesTable, leadCallsTable, activitiesTable, dialerSessionsTable } from "@workspace/db";
import { eq, and, ilike, or, gte, lte, sql, desc, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

function formatLead(
  lead: typeof leadsTable.$inferSelect,
  agentName?: string | null,
) {
  return {
    id: lead.id,
    name: lead.name,
    mobile: lead.mobile,
    alternateMobile: lead.alternateMobile ?? null,
    email: lead.email ?? null,
    company: lead.company ?? null,
    city: lead.city ?? null,
    state: lead.state ?? null,
    country: lead.country ?? null,
    source: lead.source ?? null,
    status: lead.status,
    priority: lead.priority,
    followUpDate: lead.followUpDate ? lead.followUpDate.toISOString() : null,
    assignedAgentId: lead.assignedAgentId ?? null,
    assignedAgentName: agentName ?? null,
    partnerName: lead.partnerName ?? null,
    accountManagerName: lead.accountManagerName ?? null,
    revenueAmount: lead.revenueAmount ? parseFloat(lead.revenueAmount) : null,
    closingRemark: lead.closingRemark ?? null,
    closingDate: lead.closingDate ? lead.closingDate.toISOString() : null,
    lastCalledAt: lead.lastCalledAt ? lead.lastCalledAt.toISOString() : null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

async function logActivity(leadId: number | null, agentId: number, type: string, description: string) {
  await db.insert(activitiesTable).values({ leadId, agentId, type, description });
}

async function buildAgentMap(leads: (typeof leadsTable.$inferSelect)[]) {
  const agentIds = [...new Set(leads.map(l => l.assignedAgentId).filter(Boolean))] as number[];
  if (agentIds.length === 0) return {};
  const users = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, agentIds));
  return Object.fromEntries(users.map(u => [u.id, u.name]));
}

router.get("/leads", requireAuth, async (req, res): Promise<void> => {
  const {
    agentId, status, priority, city, source, search,
    followUpFrom, followUpTo, partnerName, accountManagerName,
    page = "1", limit = "20",
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const conditions: ReturnType<typeof eq>[] = [];

  if (req.auth!.role === "agent") {
    conditions.push(eq(leadsTable.assignedAgentId, req.auth!.userId));
  } else if (agentId) {
    conditions.push(eq(leadsTable.assignedAgentId, parseInt(agentId, 10)));
  }

  if (status) conditions.push(eq(leadsTable.status, status));
  if (priority) conditions.push(eq(leadsTable.priority, priority));
  if (city) conditions.push(ilike(leadsTable.city, `%${city}%`));
  if (source) conditions.push(eq(leadsTable.source, source));
  if (followUpFrom) conditions.push(gte(leadsTable.followUpDate, new Date(followUpFrom)));
  if (followUpTo) conditions.push(lte(leadsTable.followUpDate, new Date(followUpTo)));
  if (partnerName) conditions.push(ilike(leadsTable.partnerName, `%${partnerName}%`));
  if (accountManagerName) conditions.push(ilike(leadsTable.accountManagerName, `%${accountManagerName}%`));

  if (search) {
    const searchCond = or(
      ilike(leadsTable.name, `%${search}%`),
      ilike(leadsTable.mobile, `%${search}%`),
      ilike(leadsTable.email, `%${search}%`),
      ilike(leadsTable.company, `%${search}%`),
    )!;
    conditions.push(searchCond as ReturnType<typeof eq>);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [leads, countResult] = await Promise.all([
    (whereClause ? db.select().from(leadsTable).where(whereClause) : db.select().from(leadsTable))
      .orderBy(desc(leadsTable.updatedAt)).limit(limitNum).offset(offset),
    (whereClause
      ? db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(whereClause)
      : db.select({ count: sql<number>`count(*)` }).from(leadsTable)),
  ]);

  const agentMap = await buildAgentMap(leads);
  const total = Number(countResult[0]?.count ?? 0);

  res.json({
    leads: leads.map(l => formatLead(l, l.assignedAgentId ? agentMap[l.assignedAgentId] : null)),
    total,
    page: pageNum,
    limit: limitNum,
  });
});

router.post("/leads", requireAuth, async (req, res): Promise<void> => {
  const { name, mobile, alternateMobile, email, company, city, state, country, source, status, priority, followUpDate, assignedAgentId, partnerName, accountManagerName } = req.body;
  if (!name || !mobile) {
    res.status(400).json({ error: "Name and mobile are required" });
    return;
  }
  if (!partnerName) { res.status(400).json({ error: "Partner Name is required" }); return; }
  if (!accountManagerName) { res.status(400).json({ error: "Account Manager Name is required" }); return; }

  const agentId = req.auth!.role === "agent" ? req.auth!.userId : (assignedAgentId ? parseInt(assignedAgentId, 10) : null);

  const [lead] = await db.insert(leadsTable).values({
    name, mobile,
    alternateMobile: alternateMobile || null,
    email: email || null,
    company: company || null,
    city: city || null,
    state: state || null,
    country: country || null,
    source: source || null,
    status: status || "new",
    priority: priority || "medium",
    followUpDate: followUpDate ? new Date(followUpDate) : null,
    assignedAgentId: agentId ?? null,
    partnerName: partnerName || null,
    accountManagerName: accountManagerName || null,
  }).returning();

  await logActivity(lead.id, req.auth!.userId, "lead_created", `Lead "${name}" was created`);

  const agentMap = await buildAgentMap([lead]);
  res.status(201).json(formatLead(lead, lead.assignedAgentId ? agentMap[lead.assignedAgentId] : null));
});

router.post("/leads/import", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { leads } = req.body;
  if (!Array.isArray(leads)) {
    res.status(400).json({ error: "leads must be an array" });
    return;
  }

  let imported = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const lead of leads) {
    try {
      if (!lead.name || !lead.mobile) {
        failed++;
        errors.push(`Missing name or mobile for lead: ${JSON.stringify(lead)}`);
        continue;
      }
      await db.insert(leadsTable).values({
        name: lead.name, mobile: lead.mobile,
        alternateMobile: lead.alternateMobile || null,
        email: lead.email || null, company: lead.company || null,
        city: lead.city || null, state: lead.state || null,
        country: lead.country || null, source: lead.source || null,
        status: lead.status || "new", priority: lead.priority || "medium",
        assignedAgentId: lead.assignedAgentId ? parseInt(lead.assignedAgentId, 10) : null,
        partnerName: lead.partnerName || null,
        accountManagerName: lead.accountManagerName || null,
      });
      imported++;
    } catch (e) {
      failed++;
      errors.push(`Error importing ${lead.name}: ${String(e)}`);
    }
  }

  if (imported > 0) {
    await logActivity(null, req.auth!.userId, "leads_imported", `Imported ${imported} leads`);
  }

  res.json({ imported, failed, errors });
});

router.get("/leads/dialer-count", requireAuth, async (req, res): Promise<void> => {
  const agentId = req.auth!.userId;
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(leadsTable)
    .where(and(
      eq(leadsTable.assignedAgentId, agentId),
      sql`${leadsTable.status} NOT IN ('closed_won', 'closed_lost', 'converted')`,
    ));
  res.json({ count: Number(countResult?.count ?? 0) });
});

router.get("/leads/next-dialer", requireAuth, async (req, res): Promise<void> => {
  const agentId = req.auth!.userId;
  const q = req.query as Record<string, string>;

  const excludeParam = q.exclude ?? "";
  const frontendExcludeIds = excludeParam
    ? [...new Set(excludeParam.split(",").map(Number).filter(n => !isNaN(n) && n > 0))]
    : [];

  const sessionIdParam = parseInt(q.sessionId ?? "", 10);
  const sessionId = !isNaN(sessionIdParam) && sessionIdParam > 0 ? sessionIdParam : null;

  const baseConditions = [
    eq(leadsTable.assignedAgentId, agentId),
    sql`${leadsTable.status} NOT IN ('closed_won', 'closed_lost', 'converted')`,
  ];

  if (frontendExcludeIds.length > 0) {
    baseConditions.push(
      sql`${leadsTable.id} NOT IN (${sql.join(frontendExcludeIds.map(id => sql`${id}`), sql`, `)})`
    );
  }

  if (sessionId) {
    baseConditions.push(
      sql`${leadsTable.id} NOT IN (
        SELECT DISTINCT lead_id FROM lead_calls WHERE session_id = ${sessionId}
      )`
    );
  }

  const nextConditions = baseConditions;

  const [lead] = await db.select().from(leadsTable)
    .where(and(...nextConditions))
    .orderBy(
      sql`${leadsTable.lastCalledAt} IS NOT NULL`,
      sql`CASE ${leadsTable.priority} WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`,
      sql`${leadsTable.followUpDate} ASC NULLS LAST`,
      desc(leadsTable.updatedAt),
    )
    .limit(1);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(leadsTable)
    .where(and(...nextConditions));

  const remainingCount = Number(countResult?.count ?? 0);

  if (!lead) {
    res.json({ exhausted: true, remainingCount: 0 });
    return;
  }

  const [notes, calls, activities] = await Promise.all([
    db.select().from(leadNotesTable).where(eq(leadNotesTable.leadId, lead.id)).orderBy(desc(leadNotesTable.createdAt)),
    db.select().from(leadCallsTable).where(eq(leadCallsTable.leadId, lead.id)).orderBy(desc(leadCallsTable.startedAt)),
    db.select().from(activitiesTable).where(eq(activitiesTable.leadId, lead.id)).orderBy(desc(activitiesTable.createdAt)),
  ]);

  const agentIds = [...new Set([lead.assignedAgentId, ...notes.map(n => n.agentId), ...calls.map(c => c.agentId), ...activities.map(a => a.agentId)].filter(Boolean))] as number[];
  const agentRows = agentIds.length > 0 ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, agentIds)) : [];
  const userMap = Object.fromEntries(agentRows.map(u => [u.id, u.name]));

  res.json({
    exhausted: false,
    remainingCount,
    lead: {
      ...formatLead(lead, lead.assignedAgentId ? userMap[lead.assignedAgentId] : null),
      notes: notes.map(n => ({
        id: n.id, leadId: n.leadId, content: n.content, callOutcome: n.callOutcome ?? null,
        followUpDate: n.followUpDate ? n.followUpDate.toISOString() : null,
        agentId: n.agentId, agentName: userMap[n.agentId] ?? "Unknown", createdAt: n.createdAt.toISOString(),
      })),
      calls: calls.map(c => ({
        id: c.id, leadId: c.leadId, agentId: c.agentId, agentName: userMap[c.agentId] ?? "Unknown",
        startedAt: c.startedAt.toISOString(), endedAt: c.endedAt ? c.endedAt.toISOString() : null,
        duration: c.duration ?? null, outcome: c.outcome ?? null,
      })),
      activities: activities.map(a => ({
        id: a.id, leadId: a.leadId ?? null, leadName: lead.name, type: a.type,
        description: a.description, agentId: a.agentId, agentName: userMap[a.agentId] ?? "Unknown",
        createdAt: a.createdAt.toISOString(),
      })),
    },
  });
});

router.get("/leads/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }
  if (req.auth!.role === "agent" && lead.assignedAgentId !== req.auth!.userId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const [notes, calls, activities] = await Promise.all([
    db.select().from(leadNotesTable).where(eq(leadNotesTable.leadId, id)).orderBy(desc(leadNotesTable.createdAt)),
    db.select().from(leadCallsTable).where(eq(leadCallsTable.leadId, id)).orderBy(desc(leadCallsTable.startedAt)),
    db.select().from(activitiesTable).where(eq(activitiesTable.leadId, id)).orderBy(desc(activitiesTable.createdAt)),
  ]);

  const agentIds = [...new Set([lead.assignedAgentId, ...notes.map(n => n.agentId), ...calls.map(c => c.agentId), ...activities.map(a => a.agentId)].filter(Boolean))] as number[];
  const agentRows = agentIds.length > 0 ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, agentIds)) : [];
  const userMap = Object.fromEntries(agentRows.map(u => [u.id, u.name]));

  res.json({
    ...formatLead(lead, lead.assignedAgentId ? userMap[lead.assignedAgentId] : null),
    notes: notes.map(n => ({
      id: n.id, leadId: n.leadId, content: n.content, callOutcome: n.callOutcome ?? null,
      followUpDate: n.followUpDate ? n.followUpDate.toISOString() : null,
      agentId: n.agentId, agentName: userMap[n.agentId] ?? "Unknown", createdAt: n.createdAt.toISOString(),
    })),
    calls: calls.map(c => ({
      id: c.id, leadId: c.leadId, agentId: c.agentId, agentName: userMap[c.agentId] ?? "Unknown",
      startedAt: c.startedAt.toISOString(), endedAt: c.endedAt ? c.endedAt.toISOString() : null,
      duration: c.duration ?? null, outcome: c.outcome ?? null,
    })),
    activities: activities.map(a => ({
      id: a.id, leadId: a.leadId ?? null, leadName: lead.name, type: a.type,
      description: a.description, agentId: a.agentId, agentName: userMap[a.agentId] ?? "Unknown",
      createdAt: a.createdAt.toISOString(),
    })),
  });
});

router.patch("/leads/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Lead not found" }); return; }
  if (req.auth!.role === "agent" && existing.assignedAgentId !== req.auth!.userId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const { name, mobile, alternateMobile, email, company, city, state, country, source, status, priority, followUpDate, assignedAgentId, partnerName, accountManagerName } = req.body;
  const updates: Partial<typeof leadsTable.$inferInsert> = {};
  if (name) updates.name = name;
  if (mobile) updates.mobile = mobile;
  if (alternateMobile !== undefined) updates.alternateMobile = alternateMobile || null;
  if (email !== undefined) updates.email = email || null;
  if (company !== undefined) updates.company = company || null;
  if (city !== undefined) updates.city = city || null;
  if (state !== undefined) updates.state = state || null;
  if (country !== undefined) updates.country = country || null;
  if (source !== undefined) updates.source = source || null;
  if (status) updates.status = status;
  if (priority) updates.priority = priority;
  if (followUpDate !== undefined) updates.followUpDate = followUpDate ? new Date(followUpDate) : null;
  if (assignedAgentId !== undefined && req.auth!.role === "admin") updates.assignedAgentId = assignedAgentId ? parseInt(assignedAgentId, 10) : null;
  if (partnerName !== undefined) updates.partnerName = partnerName || null;
  if (accountManagerName !== undefined) updates.accountManagerName = accountManagerName || null;

  const [lead] = await db.update(leadsTable).set(updates).where(eq(leadsTable.id, id)).returning();

  if (status && status !== existing.status) {
    await logActivity(id, req.auth!.userId, "status_changed", `Status changed from "${existing.status}" to "${status}"`);
  }
  if (updates.assignedAgentId !== undefined && updates.assignedAgentId !== existing.assignedAgentId) {
    await logActivity(id, req.auth!.userId, "lead_reassigned", `Lead reassigned to agent ID ${updates.assignedAgentId}`);
  }

  const agentMap = await buildAgentMap([lead]);
  res.json(formatLead(lead, lead.assignedAgentId ? agentMap[lead.assignedAgentId] : null));
});

router.post("/leads/bulk-assign", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { leadIds, agentId } = req.body;

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    res.status(400).json({ error: "leadIds must be a non-empty array" }); return;
  }
  if (agentId === undefined || agentId === null || agentId === "") {
    res.status(400).json({ error: "agentId is required" }); return;
  }

  const parsedAgentId = parseInt(String(agentId), 10);
  if (isNaN(parsedAgentId) || parsedAgentId <= 0) {
    res.status(400).json({ error: "agentId must be a positive integer" }); return;
  }

  const [agent] = await db
    .select({ id: usersTable.id, name: usersTable.name, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, parsedAgentId));
  if (!agent) { res.status(404).json({ error: `Agent with id ${parsedAgentId} not found` }); return; }

  const validIds = Array.from(new Set(leadIds.map(Number).filter(n => !isNaN(n) && n > 0)));
  if (validIds.length === 0) {
    res.status(400).json({ error: "No valid lead IDs provided" }); return;
  }

  await db.transaction(async (tx) => {
    await tx.update(leadsTable)
      .set({ assignedAgentId: parsedAgentId })
      .where(inArray(leadsTable.id, validIds));
    await tx.insert(activitiesTable).values({
      leadId: null,
      agentId: req.auth!.userId,
      type: "leads_bulk_assigned",
      description: `Bulk assigned ${validIds.length} lead${validIds.length !== 1 ? "s" : ""} to agent "${agent.name}"`,
    });
  });

  res.json({
    success: true,
    updated: validIds.length,
    agentId: parsedAgentId,
    agentName: agent.name,
    message: `${validIds.length} lead${validIds.length !== 1 ? "s" : ""} assigned to ${agent.name} successfully`,
  });
});

router.post("/leads/bulk-delete", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { leadIds } = req.body;

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    res.status(400).json({ error: "leadIds must be a non-empty array" }); return;
  }

  const validIds = Array.from(new Set(leadIds.map(Number).filter(n => !isNaN(n) && n > 0)));
  if (validIds.length === 0) {
    res.status(400).json({ error: "No valid lead IDs provided" }); return;
  }

  await db.transaction(async (tx) => {
    await tx.delete(leadsTable).where(inArray(leadsTable.id, validIds));
    await tx.insert(activitiesTable).values({
      leadId: null,
      agentId: req.auth!.userId,
      type: "leads_bulk_deleted",
      description: `Bulk deleted ${validIds.length} lead${validIds.length !== 1 ? "s" : ""}`,
    });
  });

  res.json({
    success: true,
    deleted: validIds.length,
    message: `${validIds.length} lead${validIds.length !== 1 ? "s" : ""} deleted successfully`,
  });
});

router.delete("/leads/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [lead] = await db.delete(leadsTable).where(eq(leadsTable.id, id)).returning();
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }
  res.json({ success: true, message: "Lead deleted" });
});

router.patch("/leads/:id/assign", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { agentId } = req.body;
  const [lead] = await db.update(leadsTable).set({ assignedAgentId: parseInt(agentId, 10) }).where(eq(leadsTable.id, id)).returning();
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }
  await logActivity(id, req.auth!.userId, "lead_assigned", `Lead assigned to agent ID ${agentId}`);
  const agentMap = await buildAgentMap([lead]);
  res.json(formatLead(lead, lead.assignedAgentId ? agentMap[lead.assignedAgentId] : null));
});

router.patch("/leads/:id/close", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Lead not found" }); return; }
  if (req.auth!.role === "agent" && existing.assignedAgentId !== req.auth!.userId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const { revenueAmount, closingRemark, status } = req.body;
  if (!revenueAmount || !closingRemark) {
    res.status(400).json({ error: "Revenue amount and closing remark are required" }); return;
  }

  const [lead] = await db.update(leadsTable).set({
    status: status || "closed_won",
    revenueAmount: String(revenueAmount),
    closingRemark,
    closingDate: new Date(),
  }).where(eq(leadsTable.id, id)).returning();

  await logActivity(id, req.auth!.userId, "deal_closed", `Deal closed: $${revenueAmount} - ${closingRemark}`);
  const agentMap = await buildAgentMap([lead]);
  res.json(formatLead(lead, lead.assignedAgentId ? agentMap[lead.assignedAgentId] : null));
});

router.get("/leads/:id/notes", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const notes = await db.select().from(leadNotesTable).where(eq(leadNotesTable.leadId, id)).orderBy(desc(leadNotesTable.createdAt));
  const agents = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable);
  const agentMap = Object.fromEntries(agents.map(a => [a.id, a.name]));
  res.json(notes.map(n => ({
    id: n.id, leadId: n.leadId, content: n.content, callOutcome: n.callOutcome ?? null,
    followUpDate: n.followUpDate ? n.followUpDate.toISOString() : null,
    agentId: n.agentId, agentName: agentMap[n.agentId] ?? "Unknown", createdAt: n.createdAt.toISOString(),
  })));
});

router.post("/leads/:id/notes", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { content, callOutcome, followUpDate } = req.body;
  if (!content) { res.status(400).json({ error: "Content is required" }); return; }

  const [note] = await db.insert(leadNotesTable).values({
    leadId: id, agentId: req.auth!.userId, content,
    callOutcome: callOutcome || null,
    followUpDate: followUpDate ? new Date(followUpDate) : null,
  }).returning();

  if (followUpDate) {
    await db.update(leadsTable).set({ followUpDate: new Date(followUpDate) }).where(eq(leadsTable.id, id));
  }

  await logActivity(id, req.auth!.userId, "note_added", `Note added: "${content.substring(0, 60)}"`);
  const [agent] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, req.auth!.userId));
  res.status(201).json({
    id: note.id, leadId: note.leadId, content: note.content, callOutcome: note.callOutcome ?? null,
    followUpDate: note.followUpDate ? note.followUpDate.toISOString() : null,
    agentId: note.agentId, agentName: agent?.name ?? "Unknown", createdAt: note.createdAt.toISOString(),
  });
});

router.get("/leads/:id/calls", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const calls = await db.select().from(leadCallsTable).where(eq(leadCallsTable.leadId, id)).orderBy(desc(leadCallsTable.startedAt));
  const agents = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable);
  const agentMap = Object.fromEntries(agents.map(a => [a.id, a.name]));
  res.json(calls.map(c => ({
    id: c.id, leadId: c.leadId, agentId: c.agentId, agentName: agentMap[c.agentId] ?? "Unknown",
    startedAt: c.startedAt.toISOString(), endedAt: c.endedAt ? c.endedAt.toISOString() : null,
    duration: c.duration ?? null, outcome: c.outcome ?? null,
  })));
});

router.post("/leads/:id/calls", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { startedAt, endedAt, duration, outcome, notes, sessionId } = req.body;
  if (!startedAt) { res.status(400).json({ error: "startedAt is required" }); return; }

  const [call] = await db.insert(leadCallsTable).values({
    leadId: id, agentId: req.auth!.userId,
    startedAt: new Date(startedAt),
    endedAt: endedAt ? new Date(endedAt) : null,
    duration: duration ? parseInt(duration, 10) : null,
    outcome: outcome || null,
    notes: notes || null,
    sessionId: sessionId ? parseInt(sessionId, 10) : null,
  }).returning();

  await db.update(leadsTable).set({ lastCalledAt: new Date() }).where(eq(leadsTable.id, id));
  await logActivity(id, req.auth!.userId, "call_logged", `Call logged${outcome ? `: ${outcome}` : ""}`);
  const [agent] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, req.auth!.userId));
  res.status(201).json({
    id: call.id, leadId: call.leadId, agentId: call.agentId, agentName: agent?.name ?? "Unknown",
    startedAt: call.startedAt.toISOString(), endedAt: call.endedAt ? call.endedAt.toISOString() : null,
    duration: call.duration ?? null, outcome: call.outcome ?? null,
    notes: call.notes ?? null, sessionId: call.sessionId ?? null,
  });
});

router.get("/leads/:id/activities", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [lead] = await db.select({ name: leadsTable.name }).from(leadsTable).where(eq(leadsTable.id, id));
  const activities = await db.select().from(activitiesTable).where(eq(activitiesTable.leadId, id)).orderBy(desc(activitiesTable.createdAt));
  const agents = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable);
  const agentMap = Object.fromEntries(agents.map(a => [a.id, a.name]));
  res.json(activities.map(a => ({
    id: a.id, leadId: a.leadId ?? null, leadName: lead?.name ?? null, type: a.type,
    description: a.description, agentId: a.agentId, agentName: agentMap[a.agentId] ?? "Unknown",
    createdAt: a.createdAt.toISOString(),
  })));
});

export default router;
