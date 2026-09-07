import { useState, useRef } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Plus, Trash2, Pencil, CheckCircle2, Loader2,
  ChevronLeft, ChevronRight, Save, RotateCcw, Upload, ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AiQuestionParser } from "@/components/admin/ai-question-parser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type QuestionRow = {
  id: string; test_id: string; question_text: string;
  option_a: string; option_b: string; option_c: string; option_d: string;
  correct_option: "a" | "b" | "c" | "d"; topic: string | null;
  marks: number; sort_order: number;
};

type DraftQuestion = Omit<QuestionRow, "id" | "test_id" | "sort_order">;

const emptyDraft = (): DraftQuestion => ({
  question_text: "", option_a: "", option_b: "", option_c: "", option_d: "",
  correct_option: "a", topic: "", marks: 1,
});

export const Route = createFileRoute("/_authenticated/admin/cbt/$testId/questions")({
  component: QuestionsAdmin,
});

function QuestionsAdmin() {
  const { testId } = useParams({ from: "/_authenticated/admin/cbt/$testId/questions" });
  const qc = useQueryClient();
  const [draft, setDraft] = useState<DraftQuestion>(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingNext, setSavingNext] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const { data: test } = useQuery({
    queryKey: ["admin", "cbt_test_meta", testId],
    queryFn: async () => {
      const { data } = await supabase.from("cbt_tests").select("title,marks_per_question").eq("id", testId).maybeSingle();
      return data;
    },
  });

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["admin", "cbt_questions", testId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cbt_questions").select("*")
        .eq("test_id", testId).order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as QuestionRow[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "cbt_questions", testId] });

  const saveMutation = useMutation({
    mutationFn: async (andNext: boolean) => {
      setSavingNext(andNext);
      if (!draft.question_text.trim()) throw new Error("Question text is required");
      if (!draft.option_a.trim() || !draft.option_b.trim() || !draft.option_c.trim() || !draft.option_d.trim())
        throw new Error("All 4 options are required");

      const payload = {
        ...draft,
        test_id: testId,
        marks: Number(draft.marks) || (test?.marks_per_question ?? 1),
        topic: draft.topic?.trim() || null,
        sort_order: editingId
          ? (questions.find(q => q.id === editingId)?.sort_order ?? questions.length)
          : questions.length,
      };

      if (editingId) {
        const { error } = await supabase.from("cbt_questions").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cbt_questions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_, andNext) => {
      invalidate();
      if (editingId) {
        toast.success("Question updated!");
        setEditingId(null);
      } else {
        toast.success(`Q${questions.length + 1} saved!`);
      }
      setDraft(emptyDraft());
      if (!andNext) topRef.current?.scrollIntoView({ behavior: "smooth" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cbt_questions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  function startEdit(q: QuestionRow) {
    setEditingId(q.id);
    setDraft({
      question_text: q.question_text, option_a: q.option_a, option_b: q.option_b,
      option_c: q.option_c, option_d: q.option_d, correct_option: q.correct_option,
      topic: q.topic ?? "", marks: q.marks,
    });
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(emptyDraft());
  }

  const OPT_COLORS: Record<string, string> = {
    a: "border-blue-400 bg-blue-50 text-blue-700",
    b: "border-emerald-400 bg-emerald-50 text-emerald-700",
    c: "border-amber-400 bg-amber-50 text-amber-700",
    d: "border-red-400 bg-red-50 text-red-700",
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8" ref={topRef}>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/admin/cbt" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> All Tests
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="font-bold text-slate-900 truncate max-w-xs">{test?.title ?? "…"}</h1>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
            {questions.length} Q
          </span>
        </div>
        <AiQuestionParser testId={testId} testTitle={test?.title} onSuccess={() => { invalidate(); window.scrollTo(0, 0); }} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* ── LEFT: Question Editor ── */}
        <div className="order-2 lg:order-1">
          {/* Questions list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
              <ListChecks className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-600">No questions yet</p>
              <p className="text-xs text-slate-400 mt-1">Add your first question from the form →</p>
            </div>
          ) : (
            <div className="space-y-2">
              {questions.map((q, i) => (
                <div
                  key={q.id}
                  className={cn(
                    "group rounded-2xl border bg-white p-4 transition-all hover:shadow-sm",
                    editingId === q.id ? "border-primary ring-2 ring-primary/20" : "border-slate-200",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 leading-snug line-clamp-2">
                          {q.question_text}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5">
                          {(["a", "b", "c", "d"] as const).map((opt) => (
                            <span
                              key={opt}
                              className={cn(
                                "text-[11px] leading-relaxed",
                                q.correct_option === opt ? "font-bold text-emerald-600" : "text-slate-500",
                              )}
                            >
                              {opt.toUpperCase()}) {q[`option_${opt}`]}
                              {q.correct_option === opt && " ✓"}
                            </span>
                          ))}
                        </div>
                        {q.topic && (
                          <span className="mt-1.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                            {q.topic}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(q)}
                        className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5 text-slate-500" />
                      </button>
                      <button
                        onClick={() => { if (confirm("Delete this question?")) deleteMutation.mutate(q.id); }}
                        className="rounded-lg p-1.5 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Add / Edit Form (Mathango style) ── */}
        <div className="order-1 lg:order-2 lg:sticky lg:top-4 self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">
                {editingId ? "✏️ Edit Question" : `➕ Add Question ${questions.length > 0 ? `#${questions.length + 1}` : ""}`}
              </h2>
              {editingId && (
                <button onClick={cancelEdit} className="text-xs text-muted-foreground hover:text-slate-700 flex items-center gap-1">
                  <RotateCcw className="h-3 w-3" /> Cancel
                </button>
              )}
            </div>

            {/* Question Text */}
            <div className="mb-3">
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Question *
              </label>
              <Textarea
                value={draft.question_text}
                onChange={(e) => setDraft((d) => ({ ...d, question_text: e.target.value }))}
                placeholder="Type the question here..."
                className="min-h-[80px] text-sm resize-none rounded-xl"
                autoFocus
              />
            </div>

            {/* Options — Mathango style: click to mark correct */}
            <div className="mb-3 space-y-2">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Options — <span className="text-emerald-600 normal-case font-normal">Click an option to mark it correct ✓</span>
              </label>
              {(["a", "b", "c", "d"] as const).map((opt) => (
                <div key={opt} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, correct_option: opt }))}
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all",
                      draft.correct_option === opt
                        ? OPT_COLORS[opt] + " scale-110 shadow-sm"
                        : "border-slate-200 text-slate-400 hover:border-slate-300",
                    )}
                    title={`Mark ${opt.toUpperCase()} as correct`}
                  >
                    {draft.correct_option === opt ? <CheckCircle2 className="h-4 w-4" /> : opt.toUpperCase()}
                  </button>
                  <Input
                    value={draft[`option_${opt}`]}
                    onChange={(e) => setDraft((d) => ({ ...d, [`option_${opt}`]: e.target.value }))}
                    placeholder={`Option ${opt.toUpperCase()}`}
                    className={cn(
                      "flex-1 h-9 text-sm rounded-xl transition-all",
                      draft.correct_option === opt && "border-emerald-400 bg-emerald-50/50 font-medium",
                    )}
                  />
                </div>
              ))}
            </div>

            {/* Topic + Marks */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Topic</label>
                <Input
                  value={draft.topic ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, topic: e.target.value }))}
                  placeholder="GK, Maths, Reasoning..."
                  className="h-8 text-xs rounded-xl"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Marks</label>
                <Input
                  type="number" min={1}
                  value={draft.marks}
                  onChange={(e) => setDraft((d) => ({ ...d, marks: Number(e.target.value) }))}
                  className="h-8 text-xs rounded-xl"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {editingId ? (
                <Button
                  onClick={() => saveMutation.mutate(false)}
                  disabled={saveMutation.isPending}
                  className="flex-1 gap-2 rounded-xl"
                >
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Update Question
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => saveMutation.mutate(true)}
                    disabled={saveMutation.isPending}
                    className="flex-1 gap-1.5 rounded-xl"
                    variant="default"
                  >
                    {saveMutation.isPending && savingNext ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Save & Add Next
                  </Button>
                  <Button
                    onClick={() => saveMutation.mutate(false)}
                    disabled={saveMutation.isPending}
                    variant="outline"
                    className="rounded-xl px-3"
                    title="Save & scroll to list"
                  >
                    {saveMutation.isPending && !savingNext ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                </>
              )}
            </div>

            {/* Quick stats */}
            {questions.length > 0 && (
              <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-xs text-slate-500">Total questions</span>
                <span className="text-sm font-bold text-primary">{questions.length}</span>
              </div>
            )}
          </div>

          {/* Keyboard shortcut hint */}
          <p className="mt-2 text-center text-[10px] text-slate-400">
            Tip: Click the circle button next to an option to mark it correct
          </p>
        </div>
      </div>
    </div>
  );
}