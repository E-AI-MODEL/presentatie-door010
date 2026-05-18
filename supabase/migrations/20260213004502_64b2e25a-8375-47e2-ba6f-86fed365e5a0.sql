-- Allow advisors/admins to view saved events of all users
CREATE POLICY "Advisors can view all saved events"
ON public.saved_events
FOR SELECT
USING (has_role(auth.uid(), 'advisor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));