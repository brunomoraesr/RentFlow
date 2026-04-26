-- Fix: substitui índice parcial por constraint completa
-- O upsert com onConflict requer constraint, não índice parcial

DROP INDEX IF EXISTS bookings_ical_uid_prop_idx;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_ical_uid_prop_uniq
  UNIQUE (property_id, ical_uid);
-- Nota: NULL != NULL no PostgreSQL, então bookings sem ical_uid
-- (reservas normais) nunca conflitam entre si — é seguro.
