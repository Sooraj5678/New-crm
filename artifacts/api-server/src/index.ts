import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable, runMigrations } from "@workspace/db";
import { eq } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedDemoUsers() {
  // bcrypt hash of "demo1234" (cost 12) — pre-computed so startup is fast
  const DEMO_HASH = "$2b$12$qt6JzFV986SPOHCCirwAQ.AJvnYQJmWbMHMgaxFlLNTMTVcKmcwci";

  const demos = [
    { name: "Admin User", email: "admin@demo.com", role: "admin" as const },
    { name: "Agent User", email: "agent@demo.com", role: "agent" as const },
  ];

  for (const demo of demos) {
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, demo.email));
    if (!existing) {
      await db.insert(usersTable).values({
        name: demo.name,
        email: demo.email,
        passwordHash: DEMO_HASH,
        role: demo.role,
        isBlocked: false,
      });
      logger.info({ email: demo.email }, "Demo user seeded");
    }
  }
}

async function bootstrap() {
  logger.info("Running database migrations...");
  await runMigrations();
  logger.info("Migrations complete");

  await seedDemoUsers();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
