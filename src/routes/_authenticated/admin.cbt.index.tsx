import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Loader2, Pencil, Trash2, ListChecks, Trophy, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type TestRow = {
  id: string; title: string; description: string | null; batch_id: string | null;
  access_mode: "free" | "paid" | "batch"; duration_minutes: number; marks_per_question: number;
  is_published: boolean; batch?: { title: string } | null;
};

const emptyForm = {
  id: "", title: "", description: "", access_mode: "free" as "free" | "paid" | "batch",
  batch_id: "", duration_minutes: 30, marks_per_question: 1, is_published: false,
};

export const Route = createFileRoute("/_authenticated/admin/cbt/")({
  component: CbtAdmin,
});

function CbtAdmin() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: batches = [] } = useQuery({
    queryKey: ["admin", "batch-options-cbt"],
    queryFn: async () => {
      const { data } = await supabase.from("batches").select("id,title").order("title");
      return data ?? [];
    },
  });

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ["admin", "cbt_tests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cbt_tests")
        .select("*, batch:batches(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TestRow[];
    },
  });

  const { data: questionCounts = {} } = useQuery({
    queryKey: ["admin", "cbt_question_counts"],
    queryFn: async () => {
      const { data } = await supabase.from("cbt_questions").select("test_id");
      const counts: Record<string, number> = {};
      for (const q of data ?? []) counts[q.test_id] = (counts[q.test_id] ?? 0) + 1;
      return counts;
    },
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(t: TestRow) {
    setEditingId(t.id);
    setForm({
      id: t.id, title: t.title, description: t.description ?? "", access_mode: t.access_mode,
      batch_id: t.batch_id ?? "", duration_minutes: t.duration_minutes, marks_per_question: t.marks_per_question,
      is_published: t.is_published,
    });
    setOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        description: form.description || null,
        access_mode: form.access_mode,
        batch_id: form.access_mode === "batch" ? form.batch_id || null : null,
        duration_minutes: Number(form.duration_minutes) || 30,
        marks_per_question: Number(form.marks_per_question) || 1,
        is_published: form.is_published,
      };
      if (form.access_mode === "batch" && !payload.batch_id) throw new Error("Select a batch for a batch-restricted test.");
      if (editingId) {
        const { error } = await supabase.from("cbt_tests").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cbt_tests").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Test updated" : "Test created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "cbt_tests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cbt_tests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Test deleted");
      qc.invalidateQueries({ queryKey: ["admin", "cbt_tests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Admin</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">CBT Tests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create tests, choose free / paid / batch access, manage questions, and view rankings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground">← Admin</Link>
          <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> New Test</Button>
        </div>
      </div>

      <div className="glass-strong rounded-3xl p-4 sm:p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Test</th>
                <th className="py-2 pr-3 font-medium">Access</th>
                <th className="py-2 pr-3 font-medium">Questions</th>
                <th className="py-2 pr-3 font-medium">Duration</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pl-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
              )}
              {!isLoading && tests.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">No tests yet. Create one to get started.</td></tr>
              )}
              {tests.map((t) => (
                <motion.tr key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                  <td className="py-3 pr-3 align-top">
                    <div className="font-medium">{t.title}</div>
                    {t.access_mode === "batch" && <div className="text-xs text-muted-foreground">{t.batch?.title}</div>}
                  </td>
                  <td className="py-3 pr-3 align-top">
                    <Badge variant={t.access_mode === "free" ? "secondary" : "outline"} className="capitalize">
                      {t.access_mode}
                    </Badge>
                  </td>
                  <td className="py-3 pr-3 align-top">{questionCounts[t.id] ?? 0}</td>
                  <td className="py-3 pr-3 align-top">{t.duration_minutes} min</td>
                  <td className="py-3 pr-3 align-top">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${t.is_published ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {t.is_published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="py-3 pl-3 align-top">
                    <div className="flex justify-end gap-1">
                      <Link to="/admin/cbt/$testId/questions" params={{ testId: t.id }}>
                        <Button size="sm" variant="ghost" title="Manage questions"><ListChecks className="h-4 w-4" /></Button>
                      </Link>
                      <Link to="/admin/cbt/$testId/leaderboard" params={{ testId: t.id }}>
                        <Button size="sm" variant="ghost" title="Leaderboard"><Trophy className="h-4 w-4" /></Button>
                      </Link>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(t)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => { if (confirm(`Delete "${t.title}"? This removes all its questions & attempts.`)) deleteMutation.mutate(t.id); }}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ClipboardList className="h-4 w-4" /> {editingId ? "Edit Test" : "New CBT Test"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label className="text-xs">Title *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. UP Police Mock Test 1" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional instructions shown before the test starts" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Duration (minutes)</Label>
                <Input type="number" value={form.duration_minutes} onChange={(e) => setForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="text-xs">Marks per question</Label>
                <Input type="number" value={form.marks_per_question} onChange={(e) => setForm((f) => ({ ...f, marks_per_question: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Access</Label>
              <Select value={form.access_mode} onValueChange={(v) => setForm((f) => ({ ...f, access_mode: v as typeof f.access_mode }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free — any logged-in student</SelectItem>
                  <SelectItem value="paid">Paid — students with any active paid enrollment</SelectItem>
                  <SelectItem value="batch">Specific batch only</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {form.access_mode === "free" && "Visible to every logged-in student, free of cost."}
                {form.access_mode === "paid" && "Only students who have paid for at least one batch can take this."}
                {form.access_mode === "batch" && "Only students enrolled in the batch selected below can take this."}
              </p>
            </div>
            {form.access_mode === "batch" && (
              <div>
                <Label className="text-xs">Batch *</Label>
                <Select value={form.batch_id} onValueChange={(v) => setForm((f) => ({ ...f, batch_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select a batch" /></SelectTrigger>
                  <SelectContent>
                    {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
              <div>
                <Label className="text-xs">Published</Label>
                <p className="text-[11px] text-muted-foreground">Students can only see & take published tests.</p>
              </div>
              <Switch checked={form.is_published} onCheckedChange={(v) => setForm((f) => ({ ...f, is_published: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.title || saveMutation.isPending} className="gap-2">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
