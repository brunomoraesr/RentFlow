-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 004 — Políticas RLS: dados globais visíveis apenas para admins
--
-- Regra geral:
--   SELECT → próprios dados  OU  role = 'admin'
--   INSERT / UPDATE / DELETE → apenas o próprio usuário
--
-- O app_metadata.role só pode ser escrito pelo service_role (SQL ou Admin API),
-- nunca pelo próprio usuário — portanto não é manipulável via client.
--
-- As Edge Functions usam SUPABASE_SERVICE_ROLE_KEY, que ignora RLS por
-- completo, então o painel admin continua funcionando normalmente.
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper reutilizável (inline) para checar role admin no JWT:
--   (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'

-- ── bookings ──────────────────────────────────────────────────────────────────

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own bookings"     ON public.bookings;
DROP POLICY IF EXISTS "Users insert own bookings"  ON public.bookings;
DROP POLICY IF EXISTS "Users update own bookings"  ON public.bookings;
DROP POLICY IF EXISTS "Users delete own bookings"  ON public.bookings;

CREATE POLICY "Users see own bookings"
  ON public.bookings FOR SELECT
  USING (
    auth.uid() = user_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Users insert own bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own bookings"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own bookings"
  ON public.bookings FOR DELETE
  USING (auth.uid() = user_id);

-- ── properties ────────────────────────────────────────────────────────────────

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own properties"    ON public.properties;
DROP POLICY IF EXISTS "Users insert own properties" ON public.properties;
DROP POLICY IF EXISTS "Users update own properties" ON public.properties;
DROP POLICY IF EXISTS "Users delete own properties" ON public.properties;

CREATE POLICY "Users see own properties"
  ON public.properties FOR SELECT
  USING (
    auth.uid() = user_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Users insert own properties"
  ON public.properties FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own properties"
  ON public.properties FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own properties"
  ON public.properties FOR DELETE
  USING (auth.uid() = user_id);

-- ── error_logs ────────────────────────────────────────────────────────────────

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own errors"      ON public.error_logs;
DROP POLICY IF EXISTS "Admins can read all error logs"   ON public.error_logs;

CREATE POLICY "Users can insert own errors"
  ON public.error_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Apenas admins leem os logs (usuários comuns não têm acesso de leitura)
CREATE POLICY "Admins can read all error logs"
  ON public.error_logs FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ── ical_feeds ────────────────────────────────────────────────────────────────

ALTER TABLE public.ical_feeds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own feeds"    ON public.ical_feeds;
DROP POLICY IF EXISTS "Users insert own feeds" ON public.ical_feeds;
DROP POLICY IF EXISTS "Users update own feeds" ON public.ical_feeds;
DROP POLICY IF EXISTS "Users delete own feeds" ON public.ical_feeds;

CREATE POLICY "Users see own feeds"
  ON public.ical_feeds FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own feeds"
  ON public.ical_feeds FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own feeds"
  ON public.ical_feeds FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own feeds"
  ON public.ical_feeds FOR DELETE
  USING (auth.uid() = user_id);

-- ── ical_tokens ───────────────────────────────────────────────────────────────

ALTER TABLE public.ical_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own tokens"    ON public.ical_tokens;
DROP POLICY IF EXISTS "Users insert own tokens" ON public.ical_tokens;
DROP POLICY IF EXISTS "Users update own tokens" ON public.ical_tokens;

CREATE POLICY "Users see own tokens"
  ON public.ical_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own tokens"
  ON public.ical_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own tokens"
  ON public.ical_tokens FOR UPDATE
  USING (auth.uid() = user_id);
