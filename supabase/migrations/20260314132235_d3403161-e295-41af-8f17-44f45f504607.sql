CREATE POLICY "Admins can update pipeline events"
ON public.chatbot_pipeline_events
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete pipeline events"
ON public.chatbot_pipeline_events
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));