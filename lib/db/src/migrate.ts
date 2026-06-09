import pg from "pg";

const { Pool } = pg;

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "role" text DEFAULT 'agent' NOT NULL,
  "phone" text,
  "is_blocked" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "leads" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "mobile" text NOT NULL,
  "alternate_mobile" text,
  "email" text,
  "company" text,
  "city" text,
  "state" text,
  "country" text,
  "source" text,
  "status" text DEFAULT 'new' NOT NULL,
  "priority" text DEFAULT 'medium' NOT NULL,
  "follow_up_date" timestamp with time zone,
  "assigned_agent_id" integer,
  "partner_id" integer,
  "account_manager_id" integer,
  "partner_name" text,
  "account_manager_name" text,
  "revenue_amount" numeric(12, 2),
  "closing_remark" text,
  "closing_date" timestamp with time zone,
  "last_called_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "lead_notes" (
  "id" serial PRIMARY KEY NOT NULL,
  "lead_id" integer NOT NULL,
  "agent_id" integer NOT NULL,
  "content" text NOT NULL,
  "call_outcome" text,
  "follow_up_date" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "lead_calls" (
  "id" serial PRIMARY KEY NOT NULL,
  "lead_id" integer NOT NULL,
  "agent_id" integer NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "ended_at" timestamp with time zone,
  "duration" integer,
  "outcome" text,
  "notes" text,
  "session_id" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "activities" (
  "id" serial PRIMARY KEY NOT NULL,
  "lead_id" integer,
  "agent_id" integer NOT NULL,
  "type" text NOT NULL,
  "description" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "changes" jsonb;

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "assigned_at" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "dialer_sessions" (
  "id" serial PRIMARY KEY NOT NULL,
  "agent_id" integer NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ended_at" timestamp with time zone,
  "total_calls" integer DEFAULT 0 NOT NULL,
  "connected_calls" integer DEFAULT 0 NOT NULL,
  "follow_ups_scheduled" integer DEFAULT 0 NOT NULL,
  "deals_won" integer DEFAULT 0 NOT NULL,
  "revenue_generated" numeric(14, 2) DEFAULT '0' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "partners" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "code" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "partners_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "upload_batches" (
  "id" serial PRIMARY KEY NOT NULL,
  "file_name" text NOT NULL,
  "uploaded_by" integer NOT NULL,
  "partner_id" integer,
  "account_manager_id" integer,
  "total_records" integer DEFAULT 0 NOT NULL,
  "imported_records" integer DEFAULT 0 NOT NULL,
  "failed_records" integer DEFAULT 0 NOT NULL,
  "duplicate_records" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'completed' NOT NULL,
  "error_report" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);
`;

export async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

  try {
    await pool.query(MIGRATION_SQL);
  } finally {
    await pool.end();
  }
}
