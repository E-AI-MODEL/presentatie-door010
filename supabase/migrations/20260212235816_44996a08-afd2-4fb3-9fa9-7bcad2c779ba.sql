-- Advisors kunnen berichten inserten in alle conversations
CREATE POLICY "Advisors can insert messages"
ON public.messages FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'advisor'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Advisors kunnen conversations aanmaken voor gebruikers
CREATE POLICY "Advisors can create conversations"
ON public.conversations FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'advisor'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
);