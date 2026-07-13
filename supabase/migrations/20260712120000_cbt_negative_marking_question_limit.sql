-- ============ CBT: Negative marking + Question limit ============

-- Admin can toggle negative marking per test, and set how many marks to
-- deduct per wrong answer. Also allow capping how many questions a student
-- actually gets (randomly sampled from the full question bank for the test).
ALTER TABLE public.cbt_tests
  ADD COLUMN negative_marking BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN negative_marks NUMERIC NOT NULL DEFAULT 0.25,
  ADD COLUMN question_limit INTEGER;

ALTER TABLE public.cbt_tests
  ADD CONSTRAINT cbt_tests_question_limit_positive CHECK (question_limit IS NULL OR question_limit > 0);

-- Store which questions were actually handed to this student (only relevant
-- when question_limit is set) so the same random subset is used on resume,
-- and so grading only scores the questions the student actually saw.
ALTER TABLE public.cbt_attempts
  ADD COLUMN question_ids UUID[];
