-- ============================================================
-- Mastering Credits and Payment Records
-- ============================================================

-- ============================================================
-- mastering_credits
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mastering_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  credits integer NOT NULL DEFAULT 0,
  total_purchased integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.mastering_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_credits" ON public.mastering_credits;
CREATE POLICY "select_own_credits" ON public.mastering_credits FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- No insert/update/delete policies for users — managed server-side

-- ============================================================
-- payment_records
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_session_id text UNIQUE,
  stripe_payment_intent_id text,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'gbp',
  credits_purchased integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_payments" ON public.payment_records;
CREATE POLICY "select_own_payments" ON public.payment_records FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_payments" ON public.payment_records;
CREATE POLICY "insert_own_payments" ON public.payment_records FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_payments" ON public.payment_records;
CREATE POLICY "update_own_payments" ON public.payment_records FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_mastering_credits_user_id ON public.mastering_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_user_id ON public.payment_records(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_status ON public.payment_records(status);
CREATE INDEX IF NOT EXISTS idx_payment_records_stripe_session ON public.payment_records(stripe_session_id);

SELECT 'mastering_payments_schema_complete' AS status;
