-- Add status to discount_code_redemptions for pending/applied/failed tracking
ALTER TABLE public.discount_code_redemptions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- Add index for efficient status-based queries
CREATE INDEX IF NOT EXISTS idx_discount_redemptions_status
  ON public.discount_code_redemptions (discount_code_id, status);

-- Add unique constraint to prevent duplicate applied redemptions per transaction
CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_redemptions_unique_transaction
  ON public.discount_code_redemptions (discount_code_id, paddle_transaction_id)
  WHERE paddle_transaction_id IS NOT NULL;