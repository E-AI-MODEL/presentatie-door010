-- Allow advisors/admins to delete messages
CREATE POLICY "Advisors can delete messages"
ON public.messages
FOR DELETE
TO public
USING (has_role(auth.uid(), 'advisor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Allow advisors/admins to delete conversations
CREATE POLICY "Advisors can delete conversations"
ON public.conversations
FOR DELETE
TO public
USING (has_role(auth.uid(), 'advisor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));