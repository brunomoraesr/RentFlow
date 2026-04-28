-- Criação da tabela de eventos e concursos
-- Execute este arquivo no SQL Editor do Supabase Dashboard

CREATE TABLE IF NOT EXISTS public.events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,
  description text,
  date_start  date        NOT NULL,
  date_end    date,
  location    text        NOT NULL,
  category    text        NOT NULL DEFAULT 'event' CHECK (category IN ('event', 'contest')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Habilita Row Level Security
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ler os eventos
CREATE POLICY "events_select"
  ON public.events FOR SELECT
  TO authenticated
  USING (true);

-- Apenas administradores podem inserir eventos
CREATE POLICY "events_insert"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Apenas administradores podem atualizar eventos
CREATE POLICY "events_update"
  ON public.events FOR UPDATE
  TO authenticated
  USING  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Apenas administradores podem excluir eventos
CREATE POLICY "events_delete"
  ON public.events FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Índice para buscas por localização (usada pelo ILIKE na home)
CREATE INDEX IF NOT EXISTS events_location_idx ON public.events (location);

-- Índice para ordenar por data
CREATE INDEX IF NOT EXISTS events_date_idx ON public.events (date_start);
