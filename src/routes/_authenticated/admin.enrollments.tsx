import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  UserPlus, Loader2, Trash2, Search, Trophy, Crown, TrendingUp, Users, BarChart3,
  Calendar, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
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

type StatRow = {
  enrolled_by: string;
  admin_name: string;
  paid_count: number;
  free_count: number;
  partial_count: number;
  total_count: number;
  total_revenue: number;
  last_enrollment_at: string;
};

type GraphRow = { bucket: string; paid_count: number; total_count: number; revenue: number };

const RANGE_OPTIONS = [
  { label: "Weekly",  value: "week",  bucket: "week",  days: 7 },
  { label: "Monthly", value: "month", bucket: "month", days: 30 },
  { label: "3 Months",value: "3m",   bucket: "month", days: 90 },
  { label: "6 Months",value: "6m",   bucket: "month", days: 180 },
  { label: "9 Months",value: "9m",   bucket: "month", days: 270 },
  { label: "Yearly",  value: "year", bucket: "month", days: 365 },
];

function EnrollmentsAdmin() {
  const qc = useQueryClient();
  const grant = useServerFn(grantBatchAccess);

  const [email, setEmail] = useState("");
  const [batchId, setBatchId] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [status, setStatus] = useState("paid");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("month");
  const [selectedAdmin, setSelectedAdmin] = useState<string | null>(null);

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
      const { data } = await (supabase as any)
        .from("enrollments")
        .select("*, batch:batches(title), profile:profiles(full_name, phone)")
        .order("enrolled_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: adminStats = [] } = useQuery<StatRow[]>({
    queryKey: ["admin", "enrollment-stats"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("admin_enrollment_stats").select("*");
      return (data ?? []) as StatRow[];
    },
  });

  const rangeOption = RANGE_OPTIONS.find((r) => r.value === range) ?? RANGE_OPTIONS[1];

  const { data: graphData = [] } = useQuery<GraphRow[]>({
    queryKey: ["admin", "enrollment-graph", range, selectedAdmin],
    queryFn: async () => {
      const from = new Date(Date.now() - rangeOption.days * 86400000).toISOString();
      const { data } = await supabase.rpc("admin_enrollment_graph", {
        p_admin_id: selectedAdmin ?? null,
        p_from: from,
        p_to: new Date().toISOString(),
        p_bucket: rangeOption.bucket,
      });
      return (data ?? []) as GraphRow[];
    },
  });

  const grantMutation = useMutation({
    mutationFn: async () => {
      const res = await grant({
        data: {
          email,
          batch_id: batchId,
          amount_paid_inr: amount === "" ? 0 : Number(amount),
          payment_status: status as any,
        },
      });
      return res;
    },
    onSuccess: () => {
      toast.success("Access granted");
      setEmail(""); setAmount("");
      qc.invalidateQueries({ queryKey: ["admin", "enrollments"] });
      qc.invalidateQueries({ queryKey: ["admin", "enrollment-stats"] });
      qc.invalidateQueries({ queryKey: ["admin", "enrollment-graph"] });
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
      qc.invalidateQueries({ queryKey: ["admin", "enrollment-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = enrollments.filter((e: any) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    const p = e.profile;
    const b = e.batch;
    return (p?.full_name ?? "").toLowerCase().includes(term)
      || (p?.phone ?? "").toLowerCase().includes(term)
      || (b?.title ?? "").toLowerCase().includes(term)
      || (e.enrolled_by_name ?? "").toLowerCase().includes(term);
  });

  const selectedBatch = batches.find((b: any) => b.id === batchId);
  const topAdmin = adminStats[0];

  const graphFormatted = useMemo(() =>
    graphData.map((row) => ({
      ...row,
      label: new Date(row.bucket).toLocaleDateString("en-IN", {
        month: "short",
        ...(rangeOption.bucket === "week" ? { day: "numeric" } : { year: rangeOption.days > 180 ? "2-digit" : undefined }),
      }),
    })), [graphData, rangeOption]);

  return (
    <Section>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Admin</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Grant Batch Access</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enroll a student in any paid batch — every action is tracked per admin.
          </p>
        </div>
        <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground">← Admin</Link>
      </div>

      {/* ── Admin Leaderboard ───────────────────────────────────────────────── */}
      {adminStats.length > 0 && (
        <div className="mb-8 space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Trophy className="h-5 w-5 text-yellow-500" /> Admin Enrollment Leaderboard
          </h2>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {adminStats.map((row, i) => (
              <button
                key={row.enrolled_by}
                onClick={() => setSelectedAdmin(selectedAdmin === row.enrolled_by ? null : row.enrolled_by)}
                className={`relative overflow-hidden rounded-2xl border p-4 text-left transition-all ${
                  selectedAdmin === row.enrolled_by
                    ? "border-primary bg-primary/8 ring-2 ring-primary/20"
                    : "border-border/60 bg-white dark:bg-slate-900 hover:border-primary/40 hover:shadow-md"
                }`}
              >
                {/* Rank badge */}
                <div className={`absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                  i === 0 ? "bg-yellow-400 text-yellow-900" :
                  i === 1 ? "bg-slate-300 text-slate-700" :
                  i === 2 ? "bg-amber-600 text-white" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {i === 0 ? <Crown className="h-3.5 w-3.5" /> : `#${i + 1}`}
                </div>

                <div className="pr-10">
                  <div className="font-bold text-foreground truncate">{row.admin_name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Last: {new Date(row.last_enrollment_at).toLocaleDateString("en-IN")}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1.5 text-center">
                    <div className="text-lg font-black text-emerald-700 dark:text-emerald-400">{row.paid_count}</div>
                    <div className="text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-500">Paid</div>
                  </div>
                  <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 px-2 py-1.5 text-center">
                    <div className="text-lg font-black text-blue-700 dark:text-blue-400">{row.free_count}</div>
                    <div className="text-[9px] font-bold uppercase text-blue-600 dark:text-blue-500">Free</div>
                  </div>
                  <div className="rounded-xl bg-primary/8 px-2 py-1.5 text-center">
                    <div className="text-lg font-black text-primary">{row.total_count}</div>
                    <div className="text-[9px] font-bold uppercase text-primary/70">Total</div>
                  </div>
                </div>

                {row.total_revenue > 0 && (
                  <div className="mt-2 text-[11px] font-semibold text-muted-foreground">
                    💰 ₹{row.total_revenue.toLocaleString("en-IN")} collected
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* ── Enrollment Graph ─────────────────────────────────────────────── */}
          <div className="glass-strong rounded-3xl p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 font-bold">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Enrollment Graph
                  {selectedAdmin && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      {adminStats.find((a) => a.enrolled_by === selectedAdmin)?.admin_name}
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {selectedAdmin ? "Tap a card again to show all admins" : "Tap an admin card to filter"}
                </p>
              </div>

              {/* Range selector */}
              <div className="flex gap-1 flex-wrap">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setRange(opt.value)}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                      range === opt.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {graphFormatted.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                No enrollment data for this period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={graphFormatted} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-xl border border-border bg-background p-3 shadow-lg text-xs">
                          <div className="font-bold mb-1">{label}</div>
                          <div className="text-emerald-600">✅ Paid: {payload[0]?.value}</div>
                          <div className="text-muted-foreground">📋 Total: {payload[1]?.value}</div>
                          <div className="text-primary">💰 ₹{Number(payload[2]?.value ?? 0).toLocaleString("en-IN")}</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="paid_count" name="Paid" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total_count" name="Total" fill="#6366f1" opacity={0.35} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="revenue" name="Revenue" fill="#f59e0b" opacity={0} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ── Grant Access Form ──────────────────────────────────────────────── */}
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
                {batches.map((b: any) => (
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
              placeholder={selectedBatch ? String((selectedBatch as any).fees_inr) : "0"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              0 = free, lower = discount
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

      {/* ── Enrollments Table ─────────────────────────────────────────────── */}
      <div className="mt-8 glass-strong rounded-3xl p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by student, phone, batch, or admin…"
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
                <th className="py-2 pr-3 font-medium">Granted By</th>
                <th className="py-2 pr-3 font-medium">Enrolled</th>
                <th className="py-2 pl-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">
                  No enrollments yet.
                </td></tr>
              )}
              {filtered.map((e: any) => {
                const p = e.profile;
                const b = e.batch;
                const isAdminGrant = e.payment_provider === "admin_grant";
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
                    <td className="py-3 pr-3 align-top">
                      {isAdminGrant && e.enrolled_by_name ? (
                        <div className="flex items-center gap-1.5">
                          <span className="flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                            🛡️ {e.enrolled_by_name}
                          </span>
                        </div>
                      ) : isAdminGrant ? (
                        <span className="text-[11px] text-muted-foreground italic">Admin</span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Self</span>
                      )}
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
