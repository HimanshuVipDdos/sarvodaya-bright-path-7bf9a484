import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Users,
  Search,
  Loader2,
  Pencil,
  Trash2,
  BookOpen,
  Award,
  Calendar,
  Clock,
  UserPlus,
  Eye,
  Activity,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type StudentRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  created_at?: string | null;
  class_level?: string | null;
  exam_target?: string | null;
  enrollments: {
    id: string;
    batch_id: string;
    batch_title: string;
    payment_status: string;
    amount_paid_inr: number;
    enrolled_at: string;
  }[];
  tests_count: number;
  avg_score: number;
};

export const Route = createFileRoute("/_authenticated/admin/students")({
  component: StudentsAdmin,
});

function StudentsAdmin() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "enrolled" | "free" | "paid" | "none">("all");

  // Edit basic info dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  // Detailed Bio Data & Activity dialog state
  const [bioOpen, setBioOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // New batch grant state inside modal
  const [grantBatchId, setGrantBatchId] = useState("");
  const [grantAmount, setGrantAmount] = useState("0");
  const [grantStatus, setGrantStatus] = useState("free");

  // Fetch batches for options
  const { data: batches = [] } = useQuery({
    queryKey: ["admin", "batch-options-students"],
    queryFn: async () => {
      const { data } = await supabase.from("batches").select("id,title,fees_inr,exam_category").order("title");
      return data ?? [];
    },
  });

  // Fetch all students, enrollments, and test attempts
  const { data: students = [], isLoading } = useQuery({
    queryKey: ["admin", "students-full"],
    queryFn: async () => {
      const [profilesRes, enrollmentsRes, attemptsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, phone, email, created_at, class_level, exam_target")
          .order("full_name", { ascending: true }),
        supabase
          .from("enrollments")
          .select("id, user_id, batch_id, payment_status, amount_paid_inr, enrolled_at, batch:batches(title)"),
        supabase
          .from("cbt_attempts")
          .select("user_id, status, score, max_score"),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (enrollmentsRes.error) throw enrollmentsRes.error;

      // Group enrollments by user
      const byUser = new Map<string, StudentRow["enrollments"]>();
      for (const e of enrollmentsRes.data ?? []) {
        const list = byUser.get(e.user_id) ?? [];
        list.push({
          id: e.id,
          batch_id: e.batch_id,
          batch_title: (e.batch as { title: string } | null)?.title ?? "Batch",
          payment_status: e.payment_status || "pending",
          amount_paid_inr: e.amount_paid_inr || 0,
          enrolled_at: e.enrolled_at,
        });
        byUser.set(e.user_id, list);
      }

      // Group CBT test attempts by user
      const attemptsByUser = new Map<string, { count: number; totalPct: number }>();
      for (const a of attemptsRes.data ?? []) {
        if (a.status === "submitted") {
          const prev = attemptsByUser.get(a.user_id) ?? { count: 0, totalPct: 0 };
          const max = a.max_score || 100;
          const score = a.score || 0;
          const pct = max > 0 ? (score / max) * 100 : 0;
          attemptsByUser.set(a.user_id, {
            count: prev.count + 1,
            totalPct: prev.totalPct + pct,
          });
        }
      }

      return (profilesRes.data ?? []).map((p) => {
        const userEnrollments = byUser.get(p.id) ?? [];
        const testStats = attemptsByUser.get(p.id);
        const testsCount = testStats?.count ?? 0;
        const avgScore = testsCount > 0 ? Math.round(testStats!.totalPct / testsCount) : 0;

        return {
          ...p,
          enrollments: userEnrollments,
          tests_count: testsCount,
          avg_score: avgScore,
        } as StudentRow;
      });
    },
  });

  // Selected student for detailed bio data
  
  // Query to get extra student details (role and comments)
  const { data: studentDetails } = useQuery({
    queryKey: ["admin", "student-details", selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return null;
      
      const [roleRes, commentsRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", selectedStudentId).maybeSingle(),
        supabase.from("live_chat_messages").select("id, message, created_at, live_classes(title)").eq("user_id", selectedStudentId).order("created_at", { ascending: false }).limit(10)
      ]);
      
      return {
        role: roleRes.data?.role || "user",
        comments: commentsRes.data || []
      };
    },
    enabled: !!selectedStudentId
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, makeAdmin }: { userId: string, makeAdmin: boolean }) => {
      if (makeAdmin) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success("Role updated successfully!");
      qc.invalidateQueries({ queryKey: ["admin", "student-details", selectedStudentId] });
    },
    onError: (e) => toast.error(e.message)
  });

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  // Fetch detailed test attempts and lectures for selected student
  const { data: studentDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ["admin", "student-details", selectedStudentId],
    enabled: !!selectedStudentId && bioOpen,
    queryFn: async () => {
      if (!selectedStudentId) return null;

      const [attemptsRes, lecturesCountRes] = await Promise.all([
        supabase
          .from("cbt_attempts")
          .select("id, test_id, status, score, max_score, submitted_at, test:cbt_tests(title, duration_minutes)")
          .eq("user_id", selectedStudentId)
          .order("submitted_at", { ascending: false }),
        supabase
          .from("lectures")
          .select("id", { count: "exact", head: true }),
      ]);

      const attempts = (attemptsRes.data ?? []).map((a) => {
        const score = a.score ?? 0;
        const max = a.max_score ?? 100;
        const pct = max > 0 ? Math.round((score / max) * 100) : 0;
        return {
          id: a.id,
          title: (a.test as { title: string } | null)?.title ?? "CBT Mock Test",
          duration: (a.test as { duration_minutes: number } | null)?.duration_minutes ?? 0,
          status: a.status,
          score,
          max_score: max,
          percentage: pct,
          submitted_at: a.submitted_at,
        };
      });

      return {
        attempts,
        total_lectures_system: lecturesCountRes.count ?? 0,
      };
    },
  });

  // Mutation: Revoke / Remove student from batch
  const revokeMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { error } = await supabase.from("enrollments").delete().eq("id", enrollmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Student removed from batch successfully");
      qc.invalidateQueries({ queryKey: ["admin", "students-full"] });
      qc.invalidateQueries({ queryKey: ["admin", "student-details", selectedStudentId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mutation: Grant batch to student (Free, Discounted, or Paid)
  const grantMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStudentId || !grantBatchId) return;

      const { error } = await supabase.from("enrollments").upsert(
        {
          user_id: selectedStudentId,
          batch_id: grantBatchId,
          status: "active",
          payment_status: grantStatus,
          payment_provider: "admin_grant",
          amount_paid_inr: Number(grantAmount) || 0,
          enrolled_at: new Date().toISOString(),
        },
        { onConflict: "user_id,batch_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Batch access granted to student!");
      setGrantBatchId("");
      setGrantAmount("0");
      setGrantStatus("free");
      qc.invalidateQueries({ queryKey: ["admin", "students-full"] });
      qc.invalidateQueries({ queryKey: ["admin", "student-details", selectedStudentId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mutation: Save basic profile edit
  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
        })
        .eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Student profile updated");
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "students-full"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Stats calculation
  const totalStudents = students.length;
  const enrolledStudents = students.filter((s) => s.enrollments.length > 0).length;
  const freeStudents = students.filter((s) =>
    s.enrollments.some((e) => e.payment_status === "free" || e.amount_paid_inr === 0)
  ).length;
  const totalTestsAttempted = students.reduce((acc, s) => acc + s.tests_count, 0);

  // Filter students based on search and tab
  const filtered = students.filter((s) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (s.full_name ?? "").toLowerCase().includes(q) ||
      (s.phone ?? "").includes(q) ||
      (s.email ?? "").toLowerCase().includes(q) ||
      s.enrollments.some((e) => e.batch_title.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (filterTab === "enrolled") return s.enrollments.length > 0;
    if (filterTab === "free")
      return s.enrollments.some((e) => e.payment_status === "free" || e.amount_paid_inr === 0);
    if (filterTab === "paid")
      return s.enrollments.some(
        (e) => e.payment_status === "paid" || e.payment_status === "partial" || e.amount_paid_inr > 0
      );
    if (filterTab === "none") return s.enrollments.length === 0;
    return true;
  });

  return (
    <Section>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Admin Control Center</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Users className="h-8 w-8 text-primary" /> Students Directory & Activity
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Monitor student bio-data, test scores, lecture engagement, grant free/discounted batch access, and remove students from batches.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link to="/admin/enrollments">
              <UserPlus className="h-4 w-4 mr-1.5" /> Grant Batch Access
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="rounded-xl">
            <Link to="/admin">← Back to Admin</Link>
          </Button>
        </div>
      </motion.div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Registered</span>
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900">{totalStudents}</div>
          <div className="text-xs text-muted-foreground mt-1">Registered student accounts</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Enrolled in Batches</span>
            <BookOpen className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="text-3xl font-bold text-emerald-700">{enrolledStudents}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {totalStudents > 0 ? Math.round((enrolledStudents / totalStudents) * 100) : 0}% of all students
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Free / Scholarship</span>
            <Award className="h-5 w-5 text-amber-600" />
          </div>
          <div className="text-3xl font-bold text-amber-700">{freeStudents}</div>
          <div className="text-xs text-muted-foreground mt-1">Full free/scholarship grants</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">CBT Tests Taken</span>
            <Activity className="h-5 w-5 text-purple-600" />
          </div>
          <div className="text-3xl font-bold text-purple-700">{totalTestsAttempted}</div>
          <div className="text-xs text-muted-foreground mt-1">Total submitted test attempts</div>
        </div>
      </div>

      {/* Filters & Search Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, email, or batch…"
            className="pl-10 h-10 rounded-xl bg-white border-slate-200"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: `All (${totalStudents})` },
            { id: "enrolled", label: `Enrolled (${enrolledStudents})` },
            { id: "free", label: `Free Access (${freeStudents})` },
            { id: "paid", label: "Paid / Partial" },
            { id: "none", label: `No Batch (${totalStudents - enrolledStudents})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id as typeof filterTab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filterTab === tab.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Students List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <p className="text-sm text-slate-500">Loading student directory…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-500">
          <Users className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <div className="text-base font-semibold text-slate-700">No students found</div>
          <p className="text-sm mt-1">Try refining your search terms or filter selection.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
            >
              {/* Student Identity */}
              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-sm">
                  {(s.full_name || s.email || "S").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 text-[15px]">{s.full_name || "Unnamed Student"}</span>
                    {s.exam_target && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-100">
                        {s.exam_target}
                      </span>
                    )}
                    {s.class_level && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-medium">
                        {s.class_level}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {s.phone && <span>📞 {s.phone}</span>}
                    {s.email && <span>✉️ {s.email}</span>}
                    {s.created_at && (
                      <span className="text-slate-400">
                        Joined {new Date(s.created_at).toLocaleDateString("en-IN")}
                      </span>
                    )}
                  </div>

                  {/* Enrolled Batches Pills */}
                  <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
                    {s.enrollments.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">Not enrolled in any batch</span>
                    ) : (
                      s.enrollments.map((e) => (
                        <div
                          key={e.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs text-slate-800 font-medium"
                        >
                          <BookOpen className="h-3.5 w-3.5 text-slate-500" />
                          <span>{e.batch_title}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                              e.payment_status === "free"
                                ? "bg-emerald-100 text-emerald-800"
                                : e.payment_status === "paid"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {e.payment_status === "free" ? "Free" : e.payment_status === "paid" ? "Paid" : "Discount"}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Tests & Action Buttons */}
              <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                {/* Test Performance Indicator */}
                <div className="text-left md:text-right mr-2">
                  <div className="text-xs font-semibold text-slate-700">
                    {s.tests_count > 0 ? (
                      <span className="flex items-center gap-1 text-purple-700 font-bold">
                        <Award className="h-3.5 w-3.5" /> {s.tests_count} Tests ({s.avg_score}%)
                      </span>
                    ) : (
                      <span className="text-slate-400">0 Tests</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {s.tests_count > 0 ? "Avg CBT score" : "No attempts yet"}
                  </div>
                </div>

                {/* Bio Data & Activity Button */}
                <Button
                  size="sm"
                  className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl gap-1.5 font-semibold text-xs shadow-sm"
                  onClick={() => {
                    setSelectedStudentId(s.id);
                    setBioOpen(true);
                  }}
                >
                  <Eye className="h-3.5 w-3.5" /> Bio & Activity
                </Button>

                {/* Edit Profile Button */}
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs gap-1 border-slate-200"
                  onClick={() => {
                    setEditingId(s.id);
                    setFullName(s.full_name ?? "");
                    setPhone(s.phone ?? "");
                    setEditOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ================= MODAL 1: DETAILED BIO DATA & ACTIVITY DIALOG ================= */}
      <Dialog open={bioOpen} onOpenChange={setBioOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Student Bio-Data & Activity
            </DialogTitle>
          </DialogHeader>

          {selectedStudent && (
            <div className="space-y-6 pt-2">
              {/* Student Overview Header Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-slate-900 text-white font-black text-lg flex items-center justify-center shadow-sm">
                    {(selectedStudent.full_name || selectedStudent.email || "S").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {selectedStudent.full_name || "Unnamed Student"}
                    </h3>
                    <div className="text-xs text-slate-500 flex flex-wrap gap-2">
                      <span>{selectedStudent.email}</span>
                      {selectedStudent.phone && <span>• {selectedStudent.phone}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Registered Student
                  </span>
                </div>
              </div>

              {/* Tabs for Bio, Batches, Tests, and Lectures */}
              <Tabs defaultValue="batches" className="w-full">
                <TabsList className="grid grid-cols-4 rounded-xl bg-slate-100 p-1 mb-4">
                  <TabsTrigger value="batches" className="text-xs font-semibold rounded-lg">
                    Batches ({selectedStudent.enrollments.length})
                  </TabsTrigger>
                  <TabsTrigger value="tests" className="text-xs font-semibold rounded-lg">
                    Tests & Marks
                  </TabsTrigger>
                  <TabsTrigger value="profile" className="text-xs font-semibold rounded-lg">
                    Bio Data
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="text-xs font-semibold rounded-lg">
                    Class Activity
                  </TabsTrigger>
                </TabsList>

                {/* TAB 1: BATCHES & ENROLLMENT CONTROL */}
                <TabsContent value="batches" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Enrolled Batches</h4>
                      <p className="text-xs text-slate-500">
                        Remove student from batches or change discount/free access status.
                      </p>
                    </div>
                  </div>

                  {selectedStudent.enrollments.length === 0 ? (
                    <div className="bg-slate-50 rounded-2xl p-6 text-center border border-dashed border-slate-200">
                      <BookOpen className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-xs text-slate-500">This student is not enrolled in any batch currently.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                      {selectedStudent.enrollments.map((e) => (
                        <div key={e.id} className="p-3.5 flex items-center justify-between gap-4">
                          <div>
                            <div className="font-semibold text-sm text-slate-900">{e.batch_title}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>
                                Amount Paid: <strong>₹{e.amount_paid_inr}</strong>
                              </span>
                              <span>•</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  e.payment_status === "free"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : e.payment_status === "paid"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {e.payment_status}
                              </span>
                              <span>•</span>
                              <span>Enrolled on {new Date(e.enrolled_at).toLocaleDateString("en-IN")}</span>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant="destructive"
                            className="rounded-xl text-xs gap-1.5 h-8 px-3"
                            onClick={() => {
                              if (confirm(`Are you sure you want to remove ${selectedStudent.full_name || 'this student'} from ${e.batch_title}?`)) {
                                revokeMutation.mutate(e.id);
                              }
                            }}
                            disabled={revokeMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Grant New Batch Sub-form */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 mt-4">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                      <UserPlus className="h-4 w-4 text-primary" /> Grant New Batch Access (Free / Discount / Paid)
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Select Batch *</Label>
                        <Select value={grantBatchId} onValueChange={setGrantBatchId}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select batch" />
                          </SelectTrigger>
                          <SelectContent>
                            {batches.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.title} (₹{b.fees_inr})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs">Amount Charged (₹)</Label>
                        <Input
                          type="number"
                          value={grantAmount}
                          onChange={(e) => setGrantAmount(e.target.value)}
                          placeholder="0 for free"
                          className="bg-white"
                        />
                        <span className="text-[10px] text-slate-400">Set 0 for 100% Free scholarship</span>
                      </div>

                      <div>
                        <Label className="text-xs">Payment Access Type</Label>
                        <Select value={grantStatus} onValueChange={setGrantStatus}>
                          <SelectTrigger className="bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free / Complimentary</SelectItem>
                            <SelectItem value="partial">Discount / Partial</SelectItem>
                            <SelectItem value="paid">Full Paid</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <Button
                        size="sm"
                        className="bg-primary text-white rounded-xl gap-1.5 text-xs font-semibold"
                        onClick={() => grantMutation.mutate()}
                        disabled={!grantBatchId || grantMutation.isPending}
                      >
                        {grantMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Enroll in Batch
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* TAB 2: TESTS & PERFORMANCE MARKS */}
                <TabsContent value="tests" className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-center">
                      <div className="text-2xl font-black text-slate-800">
                        {studentDetails?.attempts?.length ?? selectedStudent.tests_count}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-500 uppercase">Tests Attempted</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-center">
                      <div className="text-2xl font-black text-purple-700">
                        {selectedStudent.avg_score}%
                      </div>
                      <div className="text-[11px] font-semibold text-slate-500 uppercase">Average Score</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-center">
                      <div className="text-2xl font-black text-emerald-700">
                        {studentDetails?.attempts?.length
                          ? Math.max(...studentDetails.attempts.map((a) => a.percentage), 0)
                          : 0}
                        %
                      </div>
                      <div className="text-[11px] font-semibold text-slate-500 uppercase">Highest Score</div>
                    </div>
                  </div>

                  {detailsLoading ? (
                    <div className="py-8 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </div>
                  ) : !studentDetails?.attempts?.length ? (
                    <div className="bg-slate-50 rounded-2xl p-6 text-center border border-dashed border-slate-200">
                      <Award className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-xs text-slate-500">Student has not attempted any CBT mock tests yet.</p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-semibold">
                          <tr>
                            <th className="py-2.5 px-3 text-left">Test Title</th>
                            <th className="py-2.5 px-3 text-center">Marks</th>
                            <th className="py-2.5 px-3 text-center">Percentage</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-3 text-right">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {studentDetails.attempts.map((att) => (
                            <tr key={att.id} className="hover:bg-slate-50/50">
                              <td className="py-3 px-3 font-semibold text-slate-800">{att.title}</td>
                              <td className="py-3 px-3 text-center font-bold">
                                {att.score} / {att.max_score}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                                    att.percentage >= 70
                                      ? "bg-emerald-100 text-emerald-800"
                                      : att.percentage >= 40
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-rose-100 text-rose-800"
                                  }`}
                                >
                                  {att.percentage}%
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center text-slate-500 uppercase text-[10px] font-semibold">
                                {att.status}
                              </td>
                              <td className="py-3 px-3 text-right text-slate-400">
                                {att.submitted_at
                                  ? new Date(att.submitted_at).toLocaleDateString("en-IN")
                                  : "In progress"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>

                {/* TAB 3: COMPLETE BIO DATA */}
                <TabsContent value="profile" className="space-y-3">
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block mb-0.5">Full Name</span>
                        <span className="font-semibold text-slate-800 text-sm">
                          {selectedStudent.full_name || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Phone Number</span>
                        <span className="font-semibold text-slate-800 text-sm">
                          {selectedStudent.phone || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Email Address</span>
                        <span className="font-semibold text-slate-800 text-sm">
                          {selectedStudent.email || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Registration Date</span>
                        <span className="font-semibold text-slate-800 text-sm">
                          {selectedStudent.created_at
                            ? new Date(selectedStudent.created_at).toLocaleString("en-IN")
                            : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Target Competitive Exam</span>
                        <span className="font-semibold text-slate-800 text-sm">
                          {selectedStudent.exam_target || "Not specified"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">Class / Education Level</span>
                        <span className="font-semibold text-slate-800 text-sm">
                          {selectedStudent.class_level || "Not specified"}
                        </span>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* TAB 4: CLASS & LECTURE ACTIVITY */}
                <TabsContent value="activity" className="space-y-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <h4 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
                      <Activity className="h-4 w-4 text-blue-500" /> Recent Live Comments
                    </h4>
                    {!studentDetails?.comments?.length ? (
                      <p className="text-sm text-slate-500">No recent comments found.</p>
                    ) : (
                      <div className="space-y-3">
                        {studentDetails.comments.map((c: any) => (
                          <div key={c.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold text-blue-700 text-xs">{c.live_classes?.title || "Unknown Class"}</span>
                              <span className="text-xs text-slate-400">{new Date(c.created_at).toLocaleString()}</span>
                            </div>
                            <p className="text-slate-700">{c.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setBioOpen(false)} className="rounded-xl">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL 2: BASIC INFO EDIT DIALOG ================= */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-3xl p-6 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Edit Student Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Full Name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Student's full name"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Phone Number</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit phone number"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={() => saveProfileMutation.mutate()}
              disabled={saveProfileMutation.isPending}
              className="rounded-xl"
            >
              {saveProfileMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
