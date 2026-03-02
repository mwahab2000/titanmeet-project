

## Problem

All tables in the `public` schema lack GRANT permissions for the `authenticated` and `anon` database roles. This means Supabase API calls (which use these roles) get "permission denied" errors regardless of RLS policies. This happened because the tables were created during the Lovable Cloud migration without the standard Supabase GRANT statements.

## Solution

Run a single migration that grants the necessary privileges on **all public tables** to both `authenticated` and `anon` roles, plus sets default privileges for any future tables.

### Migration SQL

```sql
-- Grant usage on public schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant all DML privileges on all existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Grant usage on all sequences (needed for serial/default columns)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO anon;
```

### What this does
- `authenticated` role gets SELECT, INSERT, UPDATE, DELETE on all tables (RLS still controls row-level access)
- `anon` role gets SELECT only (for public-facing pages like event pages)
- Default privileges ensure any new tables automatically get the same grants
- No code changes needed — this is purely a database-level fix

### Security note
This does **not** weaken security. RLS policies remain in effect and control which rows each user can access. GRANTs only allow the role to attempt operations; RLS decides if they succeed.

