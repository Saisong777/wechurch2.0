-- Allow session owners to delete their sessions
CREATE POLICY "Owners can delete their sessions" 
ON public.sessions 
FOR DELETE 
USING (auth.uid() = owner_id);

-- Allow cascade delete of participants when session is deleted
CREATE POLICY "Allow delete participants for session owners" 
ON public.participants 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.sessions 
    WHERE sessions.id = participants.session_id 
    AND sessions.owner_id = auth.uid()
  )
);

-- Allow cascade delete of submissions when session is deleted
CREATE POLICY "Allow delete submissions for session owners" 
ON public.submissions 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.sessions 
    WHERE sessions.id = submissions.session_id 
    AND sessions.owner_id = auth.uid()
  )
);

-- Allow cascade delete of ai_reports when session is deleted
CREATE POLICY "Allow delete ai_reports for session owners" 
ON public.ai_reports 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.sessions 
    WHERE sessions.id = ai_reports.session_id 
    AND sessions.owner_id = auth.uid()
  )
);