import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { UserPlus, Loader2, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { grantBatchAccess } from "@/lib/admin-grant.functions";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/enrollments")({
  component: EnrollmentsAdmin,
});

function EnrollmentsAdmin() {
  const qc = useQueryClient();
  const grant = useServerFn(grantBatchAccess);

  const [email, setEmail] = useState("");
  const [batchId, setBatchId] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [status, setStatus] = useState("paid");
  const [search, setSearch] = useState("");

  const { data: batches = [] } = useQuery({
    queryKey: ["admin", "batch-options-enroll"],
    queryFn: async () => {
      const { data } = await supabase.from("batches").select("id,title,fees_inr").order("title");
      return data ?? [];
    },
  });

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["admin", "enrollments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("*, batch:batches(title), profile:profiles(full_name, phone)")
        .order("enrolled_at", { ascending: false });
      return data ?? [];
    },
  });

  const grantMutation = useMutation({
    mutationFn: async () => {
      const res = await grant({
        data: {
          email,
          batch_id: batchId,
          amount_paid_inr: amount === "" ? 0 : Number(amount),
          payment_status: status,
        },
      });
      return res;
    },
    onSuccess: () => {
      toast.success("Access granted");
      setEmail(""); setAmount("");
      qc.invalidateQueries({ queryKey: ["admin", "enrollments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("enrollments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Access revoked");
      qc.invalidateQueries({ queryKey: ["admin", "enrollments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = enrollments.filter((e) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    const p = (e as any).profile;
    const b = (e as any).batch;
    return (p?.full_name ?? "").toLowerCase().includes(term)
      || (p?.phone ?? "").toLowerCase().includes(term)
      || (b?.title ?? "").toLowerCase().includes(term);
  });

  const selectedBatch = batches.find((b) => b.id === batchId);

  return (
    <Section>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Admin</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Grant Batch Access</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enroll a student in any paid batch — for free, at a discount, or after offline payment.
          </p>
        </div>
        <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground">← Admin</Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="glass-strong rounded-3xl p-6"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <UserPlus className="h-4 w-4 text-primary" /> New enrollment
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Label className="text-xs">Student Email *</Label>
            <Input
              type="email"
              placeholder="student@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              The student must have signed up first.
            </p>
          </div>

          <div className="lg:col-span-2">
            <Label className="text-xs">Batch *</Label>
            <Select value={batchId} onValueChange={setBatchId}>
              <SelectTrigger><SelectValue placeholder="Select a batch" /></SelectTrigger>
              <SelectContent>
                {batches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.title} — ₹{b.fees_inr.toLocaleString("en-IN")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Amount Paid (₹)</Label>
            <Input
              type="number"
              placeholder={selectedBatch ? String(selectedBatch.fees_inr) : "0"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Set 0 for free access, or a lower value for a discount.
            </p>
          </div>

          <div>
            <Label className="text-xs">Payment Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="free">Free / Complimentary</SelectItem>
                <SelectItem value="partial">Partial / Discount</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end lg:col-span-2">
            <Button
              className="w-full gap-2"
              onClick={() => grantMutation.mutate()}
              disabled={!email || !batchId || grantMutation.isPending}
            >
              {grantMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <UserPlus className="h-4 w-4" />}
              Grant Access
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="mt-8 glass-strong rounded-3xl p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by student name, phone, or batch…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="text-xs text-muted-foreground">{filtered.length} enrolled</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Student</th>
                <th className="py-2 pr-3 font-medium">Batch</th>
                <th className="py-2 pr-3 font-medium">Amount</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Enrolled</th>
                <th className="py-2 pl-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">
                  No enrollments yet.
                </td></tr>
              )}
              {filtered.map((e) => {
                const p = (e as any).profile;
                const b = (e as any).batch;
                return (
                  <tr key={e.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                    <td className="py-3 pr-3 align-top">
                      <div className="font-medium">{p?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{p?.phone ?? ""}</div>
                    </td>
                    <td className="py-3 pr-3 align-top">{b?.title ?? "—"}</td>
                    <td className="py-3 pr-3 align-top">₹{(e.amount_paid_inr ?? 0).toLocaleString("en-IN")}</td>
                    <td className="py-3 pr-3 align-top">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        {e.payment_status}
                      </span>
                    </td>
                    <td className="py-3 pr-3 align-top text-muted-foreground">
                      {new Date(e.enrolled_at).toLocaleDateString("en-IN")}
                    </td>
                    <td className="py-3 pl-3 text-right align-top">
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => { if (confirm("Revoke access?")) revokeMutation.mutate(e.id); }}
                        aria-label="Revoke"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}
