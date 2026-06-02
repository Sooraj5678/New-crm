import { Router, type IRouter } from "express";
import { db, leadsTable, usersTable, uploadBatchesTable, activitiesTable } from "@workspace/db";
import { eq, or, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

interface RowData {
  name?: string;
  mobile?: string;
  phone?: string;
  alternateMobile?: string;
  email?: string;
  company?: string;
  city?: string;
  state?: string;
  country?: string;
  source?: string;
  notes?: string;
  partnerName?: string;
  accountManagerName?: string;
  [key: string]: string | undefined;
}

interface MappedRow {
  rowIndex: number;
  data: RowData;
  errors: string[];
  isDuplicate: boolean;
}

async function checkDuplicate(email: string | null, mobile: string | null): Promise<boolean> {
  if (!email && !mobile) return false;
  const conditions = [];
  if (email) conditions.push(eq(leadsTable.email, email));
  if (mobile) conditions.push(eq(leadsTable.mobile, mobile));
  const [existing] = await db.select({ id: leadsTable.id }).from(leadsTable).where(or(...conditions)).limit(1);
  return !!existing;
}

router.post("/bulk-upload/validate", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { rows, fileName } = req.body as {
    rows: RowData[];
    fileName: string;
  };

  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "No rows provided" });
    return;
  }

  const results: MappedRow[] = [];
  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const errors: string[] = [];

    const name = (row.name ?? "").trim();
    const mobile = (row.mobile ?? row.phone ?? "").trim();
    const email = (row.email ?? "").trim();
    const partnerName = (row.partnerName ?? "").trim();
    const accountManagerName = (row.accountManagerName ?? "").trim();

    if (!name) errors.push("Lead Name is required");
    if (!mobile && !email) errors.push("At least one of Email or Phone Number is required");
    if (!partnerName) errors.push("Partner Name is required");
    if (!accountManagerName) errors.push("Account Manager Name is required");

    let isDuplicate = false;
    if (errors.length === 0) {
      isDuplicate = await checkDuplicate(email || null, mobile || null);
      if (isDuplicate) duplicateCount++;
    }

    if (errors.length > 0) {
      invalidCount++;
    } else if (!isDuplicate) {
      validCount++;
    }

    results.push({ rowIndex: i + 2, data: row, errors, isDuplicate });
  }

  res.json({
    totalRecords: rows.length,
    validRecords: validCount,
    invalidRecords: invalidCount,
    duplicateRecords: duplicateCount,
    rows: results,
    fileName,
  });
});

router.post("/bulk-upload/import", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { rows, fileName } = req.body as {
    rows: RowData[];
    fileName: string;
  };

  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "No rows provided" });
    return;
  }

  let imported = 0;
  let failed = 0;
  const failedRows: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = (row.name ?? "").trim();
    const mobile = (row.mobile ?? row.phone ?? "").trim();
    const email = (row.email ?? "").trim();
    const partnerName = (row.partnerName ?? "").trim();
    const accountManagerName = (row.accountManagerName ?? "").trim();

    if (!name) { failed++; failedRows.push({ row: i + 2, reason: "Lead Name is required" }); continue; }
    if (!mobile && !email) { failed++; failedRows.push({ row: i + 2, reason: "Email or Phone required" }); continue; }
    if (!partnerName) { failed++; failedRows.push({ row: i + 2, reason: "Partner Name is required" }); continue; }
    if (!accountManagerName) { failed++; failedRows.push({ row: i + 2, reason: "Account Manager Name is required" }); continue; }

    const isDuplicate = await checkDuplicate(email || null, mobile || null);
    if (isDuplicate) { failed++; failedRows.push({ row: i + 2, reason: "Duplicate lead (email/phone already exists)" }); continue; }

    try {
      await db.insert(leadsTable).values({
        name,
        mobile: mobile || "N/A",
        email: email || null,
        company: (row.company ?? "").trim() || null,
        city: (row.city ?? "").trim() || null,
        state: (row.state ?? "").trim() || null,
        country: (row.country ?? "").trim() || null,
        source: (row.source ?? "").trim() || null,
        status: "new",
        priority: "medium",
        partnerName: partnerName || null,
        accountManagerName: accountManagerName || null,
      });
      imported++;
    } catch (e) {
      failed++;
      failedRows.push({ row: i + 2, reason: `DB error: ${String(e).substring(0, 80)}` });
    }
  }

  const [batch] = await db.insert(uploadBatchesTable).values({
    fileName,
    uploadedBy: req.auth!.userId,
    totalRecords: rows.length,
    importedRecords: imported,
    failedRecords: failed,
    duplicateRecords: failedRows.filter(r => r.reason.includes("Duplicate")).length,
    status: "completed",
    errorReport: failedRows,
    completedAt: new Date(),
  }).returning();

  if (imported > 0) {
    await db.insert(activitiesTable).values({
      leadId: null,
      agentId: req.auth!.userId,
      type: "leads_imported",
      description: `Bulk imported ${imported} leads from "${fileName}"`,
    });
  }

  res.json({ batchId: batch.id, imported, failed, failedRows, total: rows.length });
});

router.get("/bulk-upload/history", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const batches = await db.select().from(uploadBatchesTable).orderBy(desc(uploadBatchesTable.createdAt)).limit(50);

  const userIds = [...new Set(batches.map(b => b.uploadedBy).filter(Boolean) as number[])];
  const users = userIds.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable)
    : [];
  const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));

  res.json(batches.map(b => ({
    id: b.id,
    fileName: b.fileName,
    uploadedBy: b.uploadedBy,
    uploadedByName: userMap[b.uploadedBy] ?? "Unknown",
    totalRecords: b.totalRecords,
    importedRecords: b.importedRecords,
    failedRecords: b.failedRecords,
    duplicateRecords: b.duplicateRecords,
    status: b.status,
    createdAt: b.createdAt.toISOString(),
    completedAt: b.completedAt ? b.completedAt.toISOString() : null,
  })));
});

router.get("/bulk-upload/history/:id/error-report", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [batch] = await db.select().from(uploadBatchesTable).where(eq(uploadBatchesTable.id, id));
  if (!batch) { res.status(404).json({ error: "Batch not found" }); return; }
  res.json({ id: batch.id, fileName: batch.fileName, errorReport: batch.errorReport ?? [] });
});

export default router;
