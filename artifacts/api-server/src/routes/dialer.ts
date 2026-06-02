import { Router, type IRouter } from "express";
import { db, dialerSessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/dialer/sessions", requireAuth, async (req, res): Promise<void> => {
  const agentId = req.auth!.userId;
  const [session] = await db.insert(dialerSessionsTable).values({ agentId }).returning();
  res.status(201).json({
    id: session.id,
    agentId: session.agentId,
    startedAt: session.startedAt.toISOString(),
    endedAt: null,
    totalCalls: session.totalCalls,
    connectedCalls: session.connectedCalls,
    followUpsScheduled: session.followUpsScheduled,
    dealsWon: session.dealsWon,
    revenueGenerated: parseFloat(session.revenueGenerated as string),
  });
});

router.patch("/dialer/sessions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { totalCalls, connectedCalls, followUpsScheduled, dealsWon, revenueGenerated } = req.body;

  const updates: Partial<typeof dialerSessionsTable.$inferInsert> = {
    endedAt: new Date(),
  };
  if (typeof totalCalls === "number") updates.totalCalls = totalCalls;
  if (typeof connectedCalls === "number") updates.connectedCalls = connectedCalls;
  if (typeof followUpsScheduled === "number") updates.followUpsScheduled = followUpsScheduled;
  if (typeof dealsWon === "number") updates.dealsWon = dealsWon;
  if (typeof revenueGenerated === "number") updates.revenueGenerated = String(revenueGenerated);

  const [session] = await db.update(dialerSessionsTable).set(updates).where(eq(dialerSessionsTable.id, id)).returning();
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  res.json({
    id: session.id,
    agentId: session.agentId,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt ? session.endedAt.toISOString() : null,
    totalCalls: session.totalCalls,
    connectedCalls: session.connectedCalls,
    followUpsScheduled: session.followUpsScheduled,
    dealsWon: session.dealsWon,
    revenueGenerated: parseFloat(session.revenueGenerated as string),
  });
});

router.get("/dialer/sessions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [session] = await db.select().from(dialerSessionsTable).where(eq(dialerSessionsTable.id, id));
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  res.json({
    id: session.id,
    agentId: session.agentId,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt ? session.endedAt.toISOString() : null,
    totalCalls: session.totalCalls,
    connectedCalls: session.connectedCalls,
    followUpsScheduled: session.followUpsScheduled,
    dealsWon: session.dealsWon,
    revenueGenerated: parseFloat(session.revenueGenerated as string),
  });
});

export default router;
