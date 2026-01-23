-- Create sessions table
CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  verse_reference TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'grouping', 'studying', 'completed')),
  group_size INTEGER DEFAULT 4,
  grouping_method TEXT DEFAULT 'random' CHECK (grouping_method IN ('random', 'gender-balanced')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create users/participants table
CREATE TABLE public.participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  group_number INTEGER,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create submissions table
CREATE TABLE public.submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  group_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  bible_verse TEXT NOT NULL,
  theme TEXT,
  moving_verse TEXT,
  facts_discovered TEXT,
  traditional_exegesis TEXT,
  inspiration_from_god TEXT,
  application_in_life TEXT,
  others TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create AI reports table
CREATE TABLE public.ai_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('group', 'overall')),
  group_number INTEGER,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (for this demo app without auth)
CREATE POLICY "Allow public read on sessions" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "Allow public insert on sessions" ON public.sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on sessions" ON public.sessions FOR UPDATE USING (true);

CREATE POLICY "Allow public read on participants" ON public.participants FOR SELECT USING (true);
CREATE POLICY "Allow public insert on participants" ON public.participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on participants" ON public.participants FOR UPDATE USING (true);

CREATE POLICY "Allow public read on submissions" ON public.submissions FOR SELECT USING (true);
CREATE POLICY "Allow public insert on submissions" ON public.submissions FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read on ai_reports" ON public.ai_reports FOR SELECT USING (true);
CREATE POLICY "Allow public insert on ai_reports" ON public.ai_reports FOR INSERT WITH CHECK (true);

-- Enable realtime for participants and submissions
ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;