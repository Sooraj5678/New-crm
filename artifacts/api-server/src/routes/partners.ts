import { Router, type IRouter } from "express";
import { db, partnersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/partners", requireAuth, async (_req, res): Promise<void> => {
  const partners = await db.select().from(partnersTable).orderBy(partnersTable.name);
  res.json(partners.map(p => ({
    id: p.id,
    name: p.name,
    code: p.code ?? null,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
  })));
});

router.post("/partners", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { name, code } = req.body;
  if (!name) { res.status(400).json({ error: "Name is required" }); return; }

  const [partner] = await db.insert(partnersTable).values({
    name,
    code: code || null,
  }).returning();

  res.status(201).json({
    id: partner.id,
    name: partner.name,
    code: partner.code ?? null,
    isActive: partner.isActive,
    createdAt: partner.createdAt.toISOString(),
  });
});

router.patch("/partners/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, code, isActive } = req.body;
  const updates: Partial<typeof partnersTable.$inferInsert> = {};
  if (name) updates.name = name;
  if (code !== undefined) updates.code = code || null;
  if (typeof isActive === "boolean") updates.isActive = isActive;

  const [partner] = await db.update(partnersTable).set(updates).where(eq(partnersTable.id, id)).returning();
  if (!partner) { res.status(404).json({ error: "Partner not found" }); return; }

  res.json({ id: partner.id, name: partner.name, code: partner.code ?? null, isActive: partner.isActive, createdAt: partner.createdAt.toISOString() });
});

router.delete("/partners/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [partner] = await db.delete(partnersTable).where(eq(partnersTable.id, id)).returning();
  if (!partner) { res.status(404).json({ error: "Partner not found" }); return; }
  res.json({ success: true });
});

export default router;
