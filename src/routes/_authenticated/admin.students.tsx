import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2, Pencil, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type StudentRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  enrollments: { batch_id: string; batch_title: string }[];
};

const NO_BATCH = "__none__";

export const Route = createFileRoute("/_authenticated/admin/students")({
  component: StudentsAdmin,
});

function StudentsAdmin() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [batchId, setBatchId] = useState<string>(NO_BATCH);

  const { data: batches = [] } = useQuery({
    queryKey: ["admin", "batch-options-students"],
    queryFn: async () => {
      const { data } = await supabase.from("batches").select("id,title").order("title");
      return data ?? [];
    },
  });

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["admin", "students"],
    queryFn: async () => {
      const [profilesRes, enrollmentsRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, phone").order("full_name", { ascending: true }),
        supabase.from("enrollments").select("user_id, batch_id, batch:batches(title)"),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (enrollmentsRes.error) throw enrollmentsRes.error;

      const byUser = new Map<string, { batch_id: string; batch_title: string }[]>();
      for (const e of enrollmentsRes.data ?? []) {
        const list = byUser.get(e.user_id) ?? [];
        list.push({ batch_id: e.batch_id, batch_title: (e.batch as { title: string } | null)?.title ?? "Batch" });
        byUser.set(e.user_id, list);
      }

      return (profilesRes.data ?? []).map((p) => ({
        ...p,
        enrollments: byUser.get(p.id) ?? [],
      })) as StudentRow[];
    },
  });

  const filtered = students.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (s.full_name ?? "").toLowerCase().includes(q) || (s.phone ?? "").includes(q);
  });

  const openEdit = (s: StudentRow) => {
    setEditingId(s.id);
    setFullName(s.full_name ?? "");
    setPhone(s.phone ?? "");
    setBatchId(s.enrollments?.[0]?.batch_id ?? NO_BATCH);
    setOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) return;

      const { error: profErr } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() || null, phone: phone.trim() || null })
        .eq("id", editingId);
      if (profErr) throw profErr;

      // Replace this student's batch enrollment with the selected one (basic
      // assignment only — payment/fees are handled on the Grant Batch Access page).
      const { error: delErr } = await supabase.from("enrollments").delete().eq("user_id", editingId);
      if (delErr) throw delErr;

      if (batchId !== NO_BATCH) {
        const { error: insErr } = await supabase.from("enrollments").insert({
          user_id: editingId,
          batch_id: batchId,
          status: "active",
          payment_status: "pending",
        });
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      toast.success("Profile updated");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "students"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Section>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Admin</div>
        <h1 className="mt-2 text-3xl font-bold flex items-center gap-2">
          <Users className="h-7 w-7 text-primary" /> Students
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Edit a student's name, phone, and batch. For fees/payment status, use Grant Batch Access.
        </p>
      </motion.div>

      <div className="mb-6 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="glass-strong rounded-2xl divide-y divide-border overflow-hidden">
          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">No students found.</div>
          )}
          {filtered.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="font-medium truncate">{s.full_name || "Unnamed student"}</div>
                <div className="text-xs text-muted-foreground truncate">{s.phone || "No phone on file"}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {s.enrollments?.length ? (
                    s.enrollments.map((e) => (
                      <Badge key={e.batch_id} variant="secondary" className="text-xs">
                        {e.batch_title}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline" className="text-xs">No batch</Badge>
                  )}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                <Pencil className="h-4 w-4 mr-1.5" /> Edit
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit student</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Student's name" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit phone number" />
            </div>
            <div>
              <Label>Batch</Label>
              <Select value={batchId} onValueChange={setBatchId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BATCH}>No batch</SelectItem>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
