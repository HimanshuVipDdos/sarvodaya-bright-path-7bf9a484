-- ============ CBT (Computer Based Test) SYSTEM ============
-- Tests can be: free (anyone logged in), paid (any active paid enrollment),
-- or batch (restricted to students enrolled in a specific batch).

CREATE TABLE public.cbt_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  batch_id UUID REFERENCES public.batches(id) ON DELETE CASCADE,
  access_mode TEXT NOT NULL DEFAULT 'free' CHECK (access_mode IN ('free', 'paid', 'batch')),
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  marks_per_question NUMERIC NOT NULL DEFAULT 1,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cbt_tests_batch_required CHECK (access_mode <> 'batch' OR batch_id IS NOT NULL)
);
GRANT SELECT ON public.cbt_tests TO authenticated;
GRANT ALL ON public.cbt_tests TO service_role;
ALTER TABLE public.cbt_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students view eligible published tests" ON public.cbt_tests FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    is_published = true AND (
      access_mode = 'free'
      OR (access_mode = 'paid' AND EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.user_id = auth.uid() AND e.payment_status = 'paid' AND e.status = 'active'
      ))
      OR (access_mode = 'batch' AND EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.user_id = auth.uid() AND e.batch_id = cbt_tests.batch_id AND e.status = 'active'
      ))
    )
  )
);
CREATE POLICY "Admins manage tests" ON public.cbt_tests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER cbt_tests_touch BEFORE UPDATE ON public.cbt_tests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ CBT QUESTIONS ============
-- Intentionally has NO student-facing SELECT policy. Students never receive
-- correct_option directly from the DB — questions are served (without the
-- answer) and graded (server-side) exclusively via server functions using
-- the service-role client. This prevents answer leakage / client tampering.
CREATE TABLE public.cbt_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.cbt_tests(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option TEXT NOT NULL CHECK (correct_option IN ('a', 'b', 'c', 'd')),
  topic TEXT,
  marks NUMERIC NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.cbt_questions TO service_role;
ALTER TABLE public.cbt_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage questions" ON public.cbt_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ CBT ATTEMPTS ============
-- Students only get a SELECT policy (to view their own report card). All
-- writes (start / grade / submit) go through server functions with the
-- service-role client so scores can't be tampered with from the client.
CREATE TABLE public.cbt_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.cbt_tests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  total_questions INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  unanswered_count INTEGER NOT NULL DEFAULT 0,
  score NUMERIC NOT NULL DEFAULT 0,
  max_score NUMERIC NOT NULL DEFAULT 0,
  topic_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (test_id, user_id)
);
GRANT ALL ON public.cbt_attempts TO service_role;
ALTER TABLE public.cbt_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own attempts" ON public.cbt_attempts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage attempts" ON public.cbt_attempts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ CBT ANSWERS ============
CREATE TABLE public.cbt_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.cbt_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.cbt_questions(id) ON DELETE CASCADE,
  selected_option TEXT CHECK (selected_option IN ('a', 'b', 'c', 'd')),
  is_correct BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (attempt_id, question_id)
);
GRANT ALL ON public.cbt_answers TO service_role;
ALTER TABLE public.cbt_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own answers" ON public.cbt_answers FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.cbt_attempts a WHERE a.id = cbt_answers.attempt_id AND a.user_id = auth.uid())
);
CREATE POLICY "Admins manage answers" ON public.cbt_answers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_cbt_questions_test ON public.cbt_questions(test_id);
CREATE INDEX idx_cbt_attempts_test ON public.cbt_attempts(test_id);
CREATE INDEX idx_cbt_answers_attempt ON public.cbt_answers(attempt_id);
