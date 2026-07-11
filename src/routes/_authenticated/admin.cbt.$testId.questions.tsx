import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceManager, type Column, type Field } from "@/components/admin/resource-manager";

type QuestionRow = {
  id: string; test_id: string; question_text: string;
  option_a: string; option_b: string; option_c: string; option_d: string;
  correct_option: "a" | "b" | "c" | "d"; topic: string | null; marks: number; sort_order: number;
};

const columns: Column<QuestionRow>[] = [
  { key: "question_text", label: "Question", render: (r) => <span className="font-medium line-clamp-2 max-w-md">{r.question_text}</span> },
  { key: "topic", label: "Topic", render: (r) => r.topic || "—" },
  { key: "correct_option", label: "Answer", render: (r) => <span className="uppercase font-semibold">{r.correct_option}</span> },
  { key: "marks", label: "Marks" },
];

const fields: Field[] = [
  { name: "question_text", label: "Question", type: "textarea", required: true },
  { name: "option_a", label: "Option A", type: "text", required: true },
  { name: "option_b", label: "Option B", type: "text", required: true },
  { name: "option_c", label: "Option C", type: "text", required: true },
  { name: "option_d", label: "Option D", type: "text", required: true },
  {
    name: "correct_option", label: "Correct Option", type: "select", required: true,
    options: [
      { value: "a", label: "Option A" }, { value: "b", label: "Option B" },
      { value: "c", label: "Option C" }, { value: "d", label: "Option D" },
    ],
  },
  { name: "topic", label: "Topic / Subject", type: "text", placeholder: "e.g. Reasoning, GK, Maths — used for weak-topic analysis" },
  { name: "marks", label: "Marks", type: "number" },
  { name: "sort_order", label: "Sort Order", type: "number", helper: "Lower numbers appear first" },
];

export const Route = createFileRoute("/_authenticated/admin/cbt/$testId/questions")({
  component: QuestionsAdmin,
});

function QuestionsAdmin() {
  const { testId } = useParams({ from: "/_authenticated/admin/cbt/$testId/questions" });

  const { data: test } = useQuery({
    queryKey: ["admin", "cbt_test_meta", testId],
    queryFn: async () => {
      const { data } = await supabase.from("cbt_tests").select("title").eq("id", testId).maybeSingle();
      return data;
    },
  });

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        <Link to="/admin/cbt" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All Tests
        </Link>
      </div>
      <ResourceManager<QuestionRow>
        table="cbt_questions"
        eyebrow="Admin · CBT"
        title={`Questions — ${test?.title ?? "…"}`}
        description="Add MCQs for this test. Students never see the correct answer until after they submit."
        columns={columns}
        fields={fields}
        defaults={{ marks: 1, sort_order: 0, correct_option: "a" }}
        searchKeys={["question_text", "topic"]}
        orderBy={{ column: "sort_order", ascending: true }}
        presetFilter={{ column: "test_id", value: testId }}
      />
    </>
  );
}
