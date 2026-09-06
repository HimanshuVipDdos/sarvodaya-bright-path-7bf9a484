import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, ListChecks, Trophy, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/batches/$batchId")({
  component: BatchManage,
});

function BatchManage() {
  const { batchId } = useParams({ from: "/_authenticated/admin/batches/$batchId" });

  const { data: batch } = useQuery({
    queryKey: ["admin", "batch", batchId],
    queryFn: async () => {
      const { data } = await supabase.from("batches").select("*").eq("id", batchId).maybeSingle();
      return data;
    },
  });

  const { data: tests = [] } = useQuery({
    queryKey: ["admin", "batch-cbt-tests", batchId],
    queryFn: async () => {
      const { data } = await supabase
        .from("cbt_tests")
        .select("id,title,is_published,duration_minutes")
        .eq("batch_id", batchId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: enrollCount } = useQuery({
    queryKey: ["admin", "batch-enroll-count", batchId],
    queryFn: async () => {
      const { count } = await supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("batch_id", batchId);
      return count ?? 0;
    },
  });

  return (
    <Section>
      <Link to="/admin/batches" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All Batches
      </Link>

      <div className="mt-4 mb-8">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Admin · Manage Batch</div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{batch?.title ?? "…"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{batch?.exam_category}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass-strong rounded-2xl p-5">
          <Users className="h-5 w-5 text-primary" />
          <div className="mt-2 text-2xl font-bold">{enrollCount ?? "—"}</div>
          <div className="text-xs text-muted-foreground">Enrolled students</div>
          <Link to="/admin/enrollments" className="mt-3 inline-block text-xs font-medium text-primary">Manage enrollments →</Link>
        </div>
        <div className="glass-strong rounded-2xl p-5">
          <ListChecks className="h-5 w-5 text-primary" />
          <div className="mt-2 text-2xl font-bold">{tests.length}</div>
          <div className="text-xs text-muted-foreground">CBT tests for this batch</div>
        </div>
        <div className="glass-strong rounded-2xl p-5">
          <div className="text-sm text-muted-foreground">Fees</div>
          <div className="mt-2 text-2xl font-bold">₹{(batch?.fees_inr ?? 0).toLocaleString("en-IN")}</div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold">CBT Tests in this batch</h2>
        <Link to="/admin/cbt">
          <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Create / Manage Tests</Button>
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">
        Create a new test from the CBT Tests page and set Access to "Specific batch only → {batch?.title ?? "this batch"}".
      </p>

      <div className="mt-4 glass-strong rounded-3xl p-4 sm:p-6">
        {tests.length === 0 && <div className="py-6 text-center text-muted-foreground text-sm">No batch-restricted tests yet.</div>}
        {tests.map((t) => (
          <div key={t.id} className="flex items-center justify-between border-b border-border/40 py-3 last:border-0">
            <div>
              <div className="font-medium">{t.title}</div>
              <div className="text-xs text-muted-foreground">{t.duration_minutes} min</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={t.is_published ? "default" : "outline"}>{t.is_published ? "Published" : "Draft"}</Badge>
              <Link to="/admin/cbt/$testId/leaderboard" params={{ testId: t.id }}>
                <Button size="sm" variant="ghost" title="Ranking"><Trophy className="h-4 w-4" /></Button>
              </Link>
              <Link to="/admin/cbt/$testId/questions" params={{ testId: t.id }}>
                <Button size="sm" variant="ghost" title="Questions"><ListChecks className="h-4 w-4" /></Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
