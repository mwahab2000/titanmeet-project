-- Fix: Make event_id nullable on communications_log so notification email dedupe can work
-- without requiring a real event reference
ALTER TABLE public.communications_log ALTER COLUMN event_id DROP NOT NULL;