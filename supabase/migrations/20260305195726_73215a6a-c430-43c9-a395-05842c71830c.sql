
-- Step 1: Only add the enum value. Nothing else.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';
