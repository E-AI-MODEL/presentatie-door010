
-- Advisors can update profiles (for phase changes)
CREATE POLICY "Advisors can update profiles"
ON public.profiles FOR UPDATE
USING (has_role(auth.uid(), 'advisor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Internal advisor notes table
CREATE TABLE public.advisor_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_user_id uuid NOT NULL,
  candidate_user_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.advisor_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can manage advisor notes"
ON public.advisor_notes FOR ALL
USING (has_role(auth.uid(), 'advisor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at on advisor_notes
CREATE TRIGGER update_advisor_notes_updated_at
BEFORE UPDATE ON public.advisor_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
