
-- FAQ items table for RAG-based knowledge retrieval
CREATE TABLE public.faq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text NOT NULL DEFAULT 'algemeen',
  tags text[] NOT NULL DEFAULT '{}',
  peildatum text,
  source_url text,
  fts tsvector,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- GIN index for fast full-text search
CREATE INDEX idx_faq_items_fts ON public.faq_items USING GIN (fts);
CREATE INDEX idx_faq_items_category ON public.faq_items (category);

-- Trigger to update tsvector on insert/update
CREATE OR REPLACE FUNCTION public.faq_items_update_fts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.fts := 
    setweight(to_tsvector('dutch', coalesce(NEW.question, '')), 'A') ||
    setweight(to_tsvector('dutch', coalesce(NEW.answer, '')), 'B') ||
    setweight(to_tsvector('dutch', coalesce(NEW.category, '')), 'C') ||
    setweight(to_tsvector('dutch', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_faq_items_fts
  BEFORE INSERT OR UPDATE ON public.faq_items
  FOR EACH ROW
  EXECUTE FUNCTION public.faq_items_update_fts();

-- Enable RLS
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can read FAQ items"
  ON public.faq_items FOR SELECT
  USING (true);

-- Admins can manage
CREATE POLICY "Admins can manage FAQ items"
  ON public.faq_items FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE TRIGGER update_faq_items_updated_at
  BEFORE UPDATE ON public.faq_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Search function
CREATE OR REPLACE FUNCTION public.search_faqs(search_query text, max_results int DEFAULT 10)
RETURNS TABLE(id uuid, question text, answer text, category text, tags text[], peildatum text, source_url text, rank real)
LANGUAGE sql STABLE
SET search_path = 'public'
AS $$
  SELECT 
    f.id, f.question, f.answer, f.category, f.tags, f.peildatum, f.source_url,
    ts_rank(f.fts, plainto_tsquery('dutch', search_query)) AS rank
  FROM public.faq_items f
  WHERE f.fts @@ plainto_tsquery('dutch', search_query)
  ORDER BY rank DESC
  LIMIT max_results;
$$;
