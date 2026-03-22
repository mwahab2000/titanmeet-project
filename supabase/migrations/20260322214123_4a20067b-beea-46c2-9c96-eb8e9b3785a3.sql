-- Add new limit columns to subscription_plans
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS max_attendees_per_event integer DEFAULT 300,
  ADD COLUMN IF NOT EXISTS max_admin_users integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_brand_kits integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_ai_images integer DEFAULT 20,
  ADD COLUMN IF NOT EXISTS has_segmentation boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_workspace_analytics boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_live_dashboard boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_ai_concierge text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS campaign_tier text DEFAULT 'basic';

-- Update Starter plan
UPDATE public.subscription_plans SET
  monthly_price_cents = 7900,
  max_clients = 3,
  max_active_events = 3,
  max_attendees = 999999,
  max_attendees_per_event = 300,
  max_admin_users = 1,
  max_emails = 2000,
  max_whatsapp_sends = 500,
  max_ai_requests = 500,
  max_ai_heavy = 500,
  max_ai_images = 20,
  max_brand_kits = 0,
  max_storage_gb = 5,
  max_maps_searches = 50,
  max_maps_photos = 100,
  has_segmentation = false,
  has_workspace_analytics = false,
  has_live_dashboard = false,
  has_ai_concierge = 'none',
  campaign_tier = 'basic',
  support_tier = 'standard',
  burst_per_minute = 15
WHERE id = 'starter';

-- Update Professional plan
UPDATE public.subscription_plans SET
  monthly_price_cents = 19900,
  max_clients = 15,
  max_active_events = 15,
  max_attendees = 999999,
  max_attendees_per_event = 2000,
  max_admin_users = 3,
  max_emails = 15000,
  max_whatsapp_sends = 5000,
  max_ai_requests = 3000,
  max_ai_heavy = 3000,
  max_ai_images = 150,
  max_brand_kits = 10,
  max_storage_gb = 25,
  max_maps_searches = 200,
  max_maps_photos = 500,
  has_segmentation = true,
  has_workspace_analytics = true,
  has_live_dashboard = true,
  has_ai_concierge = 'basic',
  campaign_tier = 'advanced',
  support_tier = 'priority',
  burst_per_minute = 30
WHERE id = 'professional';

-- Update Enterprise plan
UPDATE public.subscription_plans SET
  monthly_price_cents = 49900,
  max_clients = 999999,
  max_active_events = 50,
  max_attendees = 999999,
  max_attendees_per_event = 5000,
  max_admin_users = 10,
  max_emails = 50000,
  max_whatsapp_sends = 15000,
  max_ai_requests = 10000,
  max_ai_heavy = 10000,
  max_ai_images = 500,
  max_brand_kits = 999999,
  max_storage_gb = 100,
  max_maps_searches = 500,
  max_maps_photos = 1000,
  has_segmentation = true,
  has_workspace_analytics = true,
  has_live_dashboard = true,
  has_ai_concierge = 'advanced',
  campaign_tier = 'advanced',
  support_tier = 'premium',
  burst_per_minute = 60
WHERE id = 'enterprise';

-- Grant select to authenticated
GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT SELECT ON public.plan_limit_overrides TO authenticated;
