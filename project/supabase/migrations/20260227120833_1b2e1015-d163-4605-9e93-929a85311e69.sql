
-- 1. Create surveys table
CREATE TABLE public.surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled Survey',
  description text,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Migrate old survey_questions data into surveys
INSERT INTO public.surveys (event_id, title, created_by)
SELECT DISTINCT sq.event_id, 'Survey', e.created_by
FROM public.survey_questions sq
JOIN public.events e ON e.id = sq.event_id;

-- 3. Drop old survey_questions table
DROP TABLE public.survey_questions;

-- 4. Recreate survey_questions with new schema
CREATE TABLE public.survey_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  question_text text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'short_text' CHECK (type IN ('yes_no','single_choice','multi_choice','rating_stars','likert','short_text','long_text','number','date')),
  required boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Create survey_responses
CREATE TABLE public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  respondent_id uuid REFERENCES auth.users(id),
  respondent_email text,
  status text NOT NULL DEFAULT 'in_progress',
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Create survey_answers
CREATE TABLE public.survey_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES public.survey_responses(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.survey_questions(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  value_text text,
  value_number numeric,
  value_date date,
  value_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Indexes
CREATE INDEX idx_surveys_event_id ON public.surveys(event_id);
CREATE INDEX idx_survey_questions_survey_order ON public.survey_questions(survey_id, order_index);
CREATE INDEX idx_survey_responses_survey ON public.survey_responses(survey_id, status);
CREATE INDEX idx_survey_answers_response ON public.survey_answers(response_id);
CREATE INDEX idx_survey_answers_question ON public.survey_answers(question_id);

-- 8. RLS on surveys
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Event owners can manage surveys" ON public.surveys FOR ALL USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));
CREATE POLICY "Anyone can view published surveys" ON public.surveys FOR SELECT USING (status = 'published');

-- 9. RLS on survey_questions
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Event owners can manage survey_questions" ON public.survey_questions FOR ALL USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));
CREATE POLICY "Anyone can view survey_questions" ON public.survey_questions FOR SELECT USING (true);

-- 10. RLS on survey_responses
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Event owners can view responses" ON public.survey_responses FOR SELECT USING (owns_event(event_id));
CREATE POLICY "Anyone can insert responses for published surveys" ON public.survey_responses FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.status = 'published')
);

-- 11. RLS on survey_answers
ALTER TABLE public.survey_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Event owners can view answers" ON public.survey_answers FOR SELECT USING (owns_event(event_id));
CREATE POLICY "Anyone can insert answers" ON public.survey_answers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.survey_responses r WHERE r.id = response_id)
);

-- 12. Updated_at triggers
CREATE TRIGGER set_surveys_updated_at BEFORE UPDATE ON public.surveys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_survey_questions_updated_at BEFORE UPDATE ON public.survey_questions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
