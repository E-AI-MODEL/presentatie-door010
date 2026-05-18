
-- User notes / dagboek
CREATE TABLE public.user_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notes" ON public.user_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own notes" ON public.user_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON public.user_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON public.user_notes FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Advisors can view all notes" ON public.user_notes FOR SELECT USING (has_role(auth.uid(), 'advisor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_user_notes_updated_at BEFORE UPDATE ON public.user_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Saved/favoriete vacatures
CREATE TABLE public.saved_vacancies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  organization TEXT,
  url TEXT,
  sector TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_vacancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved vacancies" ON public.saved_vacancies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own saved vacancies" ON public.saved_vacancies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved vacancies" ON public.saved_vacancies FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Advisors can view all saved vacancies" ON public.saved_vacancies FOR SELECT USING (has_role(auth.uid(), 'advisor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Appointments / contact met backoffice
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  message TEXT,
  preferred_date DATE,
  preferred_time TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  advisor_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own appointments" ON public.appointments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own appointments" ON public.appointments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Advisors can view all appointments" ON public.appointments FOR SELECT USING (has_role(auth.uid(), 'advisor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Advisors can update all appointments" ON public.appointments FOR UPDATE USING (has_role(auth.uid(), 'advisor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Saved events (bookmarked events from the agenda)
CREATE TABLE public.saved_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_title TEXT NOT NULL,
  event_date TEXT,
  event_url TEXT,
  event_source TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved events" ON public.saved_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own saved events" ON public.saved_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved events" ON public.saved_events FOR DELETE USING (auth.uid() = user_id);
