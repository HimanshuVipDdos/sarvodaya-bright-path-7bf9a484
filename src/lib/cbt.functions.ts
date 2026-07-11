import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Start (or resume) an attempt ----------
export const startCbtAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { test_id: string }) => {
    if (!input?.test_id) throw new Error("test_id is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Confirm the test is published & the user is eligible (re-checked here
    // even though RLS also checks this, since we use the admin client below).
    const { data: test, error: testErr } = await context.supabase
      .from("cbt_tests")
      .select("id,title,description,duration_minutes,marks_per_question,is_published,access_mode,batch_id")
      .eq("id", data.test_id)
      .maybeSingle();
    if (testErr) throw new Error(testErr.message);
    if (!test || !test.is_published) throw new Error("This test is not available.");

    // Resume an existing attempt if one is already in progress or submitted.
    const { data: existing } = await supabaseAdmin
      .from("cbt_attempts")
      .select("id,status")
      .eq("test_id", data.test_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing && existing.status === "submitted") {
      throw new Error("You have already submitted this test.");
    }

    let attemptId = existing?.id as string | undefined;
    if (!attemptId) {
      const { data: created, error: insErr } = await supabaseAdmin
        .from("cbt_attempts")
        .insert({ test_id: data.test_id, user_id: userId, status: "in_progress" })
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      attemptId = created.id;
    }

    const { data: questions, error: qErr } = await supabaseAdmin
      .from("cbt_questions")
      .select("id,question_text,option_a,option_b,option_c,option_d,marks,sort_order")
      .eq("test_id", data.test_id)
      .order("sort_order", { ascending: true });
    if (qErr) throw new Error(qErr.message);

    return {
      attempt_id: attemptId,
      test: {
        id: test.id,
        title: test.title,
        description: test.description,
        duration_minutes: test.duration_minutes,
      },
      questions: questions ?? [],
    };
  });

// ---------- Submit & grade an attempt (server-side only) ----------
type SubmitAnswer = { question_id: string; selected_option: "a" | "b" | "c" | "d" | null };

export const submitCbtAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { attempt_id: string; answers: SubmitAnswer[] }) => {
    if (!input?.attempt_id) throw new Error("attempt_id is required");
    if (!Array.isArray(input.answers)) throw new Error("answers must be an array");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: attempt, error: attErr } = await supabaseAdmin
      .from("cbt_attempts")
      .select("id,test_id,user_id,status")
      .eq("id", data.attempt_id)
      .maybeSingle();
    if (attErr) throw new Error(attErr.message);
    if (!attempt || attempt.user_id !== userId) throw new Error("Attempt not found.");
    if (attempt.status === "submitted") throw new Error("This test was already submitted.");

    const { data: questions, error: qErr } = await supabaseAdmin
      .from("cbt_questions")
      .select("id,correct_option,marks,topic")
      .eq("test_id", attempt.test_id);
    if (qErr) throw new Error(qErr.message);

    const answerMap = new Map(data.answers.map((a) => [a.question_id, a.selected_option]));
    const topicBreakdown: Record<string, { correct: number; wrong: number; unanswered: number }> = {};

    let correctCount = 0, wrongCount = 0, unansweredCount = 0, score = 0, maxScore = 0;
    const answerRows: { attempt_id: string; question_id: string; selected_option: string | null; is_correct: boolean }[] = [];

    for (const q of questions ?? []) {
      const topic = q.topic || "General";
      topicBreakdown[topic] ??= { correct: 0, wrong: 0, unanswered: 0 };
      maxScore += Number(q.marks ?? 1);

      const selected = answerMap.get(q.id) ?? null;
      const isCorrect = selected != null && selected === q.correct_option;

      if (selected == null) {
        unansweredCount += 1;
        topicBreakdown[topic].unanswered += 1;
      } else if (isCorrect) {
        correctCount += 1;
        score += Number(q.marks ?? 1);
        topicBreakdown[topic].correct += 1;
      } else {
        wrongCount += 1; // no negative marking
        topicBreakdown[topic].wrong += 1;
      }

      answerRows.push({
        attempt_id: attempt.id,
        question_id: q.id,
        selected_option: selected,
        is_correct: isCorrect,
      });
    }

    if (answerRows.length > 0) {
      const { error: ansErr } = await supabaseAdmin.from("cbt_answers").upsert(answerRows, { onConflict: "attempt_id,question_id" });
      if (ansErr) throw new Error(ansErr.message);
    }

    const { error: updErr } = await supabaseAdmin
      .from("cbt_attempts")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        total_questions: questions?.length ?? 0,
        correct_count: correctCount,
        wrong_count: wrongCount,
        unanswered_count: unansweredCount,
        score,
        max_score: maxScore,
        topic_breakdown: topicBreakdown,
      })
      .eq("id", attempt.id);
    if (updErr) throw new Error(updErr.message);

    return { attempt_id: attempt.id };
  });

// ---------- Fetch a full result (report card + rank + mistakes) ----------
export const getCbtAttemptResult = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { attempt_id: string }) => {
    if (!input?.attempt_id) throw new Error("attempt_id is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: attempt, error } = await supabaseAdmin
      .from("cbt_attempts")
      .select("*, test:cbt_tests(id,title,marks_per_question)")
      .eq("id", data.attempt_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!attempt || attempt.user_id !== userId) throw new Error("Result not found.");
    if (attempt.status !== "submitted") throw new Error("Test not submitted yet.");

    const { data: profile } = await supabaseAdmin.from("profiles").select("full_name").eq("id", userId).maybeSingle();

    const { count: totalParticipants } = await supabaseAdmin
      .from("cbt_attempts")
      .select("id", { count: "exact", head: true })
      .eq("test_id", attempt.test_id)
      .eq("status", "submitted");

    const { count: higherScores } = await supabaseAdmin
      .from("cbt_attempts")
      .select("id", { count: "exact", head: true })
      .eq("test_id", attempt.test_id)
      .eq("status", "submitted")
      .gt("score", attempt.score);

    const rank = (higherScores ?? 0) + 1;

    // Mistake review: wrongly-answered + unanswered questions with correct answers revealed
    const { data: answers } = await supabaseAdmin
      .from("cbt_answers")
      .select("selected_option,is_correct,question:cbt_questions(id,question_text,option_a,option_b,option_c,option_d,correct_option,topic)")
      .eq("attempt_id", attempt.id);

    const mistakes = (answers ?? [])
      .filter((a) => !a.is_correct)
      .map((a) => ({
        question_text: (a.question as any)?.question_text,
        option_a: (a.question as any)?.option_a,
        option_b: (a.question as any)?.option_b,
        option_c: (a.question as any)?.option_c,
        option_d: (a.question as any)?.option_d,
        correct_option: (a.question as any)?.correct_option,
        selected_option: a.selected_option,
        topic: (a.question as any)?.topic || "General",
      }));

    return {
      attempt,
      student_name: profile?.full_name ?? "Student",
      rank,
      total_participants: totalParticipants ?? 0,
      mistakes,
    };
  });

// ---------- Admin: leaderboard for a test ----------
export const getCbtLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { test_id: string }) => {
    if (!input?.test_id) throw new Error("test_id is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: test } = await supabaseAdmin.from("cbt_tests").select("title,max_score:marks_per_question").eq("id", data.test_id).maybeSingle();

    const { data: attempts, error } = await supabaseAdmin
      .from("cbt_attempts")
      .select("id,user_id,score,max_score,correct_count,wrong_count,unanswered_count,submitted_at,profile:profiles(full_name,phone)")
      .eq("test_id", data.test_id)
      .eq("status", "submitted")
      .order("score", { ascending: false })
      .order("submitted_at", { ascending: true });
    if (error) throw new Error(error.message);

    return { test_title: test?.title ?? "Test", attempts: attempts ?? [] };
  });

