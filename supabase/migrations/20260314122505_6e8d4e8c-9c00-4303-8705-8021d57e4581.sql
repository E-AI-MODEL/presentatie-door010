-- Tabel: llm_prompt_configs
CREATE TABLE IF NOT EXISTS public.llm_prompt_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  prompt_override TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Tabel: chatbot_pipeline_events
CREATE TABLE IF NOT EXISTS public.chatbot_pipeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_key TEXT NOT NULL,
  stage TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info','warning','error')),
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- RLS
ALTER TABLE public.llm_prompt_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_pipeline_events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage llm prompt configs"
  ON public.llm_prompt_configs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read pipeline events"
  ON public.chatbot_pipeline_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert pipeline events"
  ON public.chatbot_pipeline_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE TRIGGER update_llm_prompt_configs_updated_at
  BEFORE UPDATE ON public.llm_prompt_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed
INSERT INTO public.llm_prompt_configs (chatbot_key, title, prompt_override, active) VALUES
  ('doorai-chat', 'DoorAI Authenticated Chat (doorai-chat)', NULL, true),
  ('homepage-coach', 'DoorAI Public Widget (homepage-coach)', NULL, true)
ON CONFLICT (chatbot_key) DO NOTHING;