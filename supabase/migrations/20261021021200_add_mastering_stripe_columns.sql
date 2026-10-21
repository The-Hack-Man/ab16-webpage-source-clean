-- Add columns needed for Stripe checkout integration and audio mastering
ALTER TABLE ai_mastering_jobs
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS payment_intent_id text,
  ADD COLUMN IF NOT EXISTS paid boolean not null default false,
  ADD COLUMN IF NOT EXISTS preset text check (preset in ('streaming','vinyl','cd','highres','master')),
  ADD COLUMN IF NOT EXISTS input_url text,
  ADD COLUMN IF NOT EXISTS output_url text;

-- Update existing rows to have a default preset
UPDATE ai_mastering_jobs SET preset = 'streaming' WHERE preset IS NULL;

-- Add index for stripe_session_id lookups in webhook
CREATE INDEX IF NOT EXISTS ai_mastering_jobs_stripe_session_idx ON ai_mastering_jobs (stripe_session_id);

-- Add index for payment status queries
CREATE INDEX IF NOT EXISTS ai_mastering_jobs_paid_idx ON ai_mastering_jobs (paid);

SELECT 'mastering_stripe_columns_added' AS status;
