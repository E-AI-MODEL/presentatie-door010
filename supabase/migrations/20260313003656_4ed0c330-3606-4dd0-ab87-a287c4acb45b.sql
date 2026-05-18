
CREATE TABLE public.trusted_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  label text NOT NULL,
  category text NOT NULL DEFAULT 'algemeen',
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.trusted_sources ENABLE ROW LEVEL SECURITY;

-- Advisors/admins can manage
CREATE POLICY "Advisors can manage trusted sources"
ON public.trusted_sources
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'advisor') OR has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'advisor') OR has_role(auth.uid(), 'admin'));

-- Anyone can read (needed by edge functions via service role, and candidates)
CREATE POLICY "Anyone can read trusted sources"
ON public.trusted_sources
FOR SELECT
TO public
USING (true);

-- Updated_at trigger
CREATE TRIGGER update_trusted_sources_updated_at
  BEFORE UPDATE ON public.trusted_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
