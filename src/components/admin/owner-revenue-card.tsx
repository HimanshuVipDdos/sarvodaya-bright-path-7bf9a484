import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  IndianRupee,
  Calendar,
  Eye,
  EyeOff,
  ShieldCheck,
  Award,
  Users,
  UserPlus,
  Loader2,
  Trash2,
  Lock,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type DailyRevenuePoint = {
  date: string;
  revenue: number;
  orders: number;
  label: string;
};

export type RevenueStats = {
  totalLifetime: number;
  monthly: number;
  weekly: number;
  today: number;
  totalPaidStudents: number;
  averageOrderValue: number;
  chartData30Days: DailyRevenuePoint[];
  chartData7Days: DailyRevenuePoint[];
};

interface OwnerRevenueCardProps {
  stats: RevenueStats;
  currentUserId?: string;
}

export function OwnerRevenueCard({ stats, currentUserId }: OwnerRevenueCardProps) {
  const [timeframe, setTimeframe] = useState<"30d" | "7d">("30d");
  const [showNumbers, setShowNumbers] = useState(true);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [adminsList, setAdminsList] = useState<{ id: string; user_id: string; email?: string; created_at: string }[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  const activeChartData = timeframe === "30d" ? stats.chartData30Days : stats.chartData7Days;

  const formatCurrency = (val: number) => {
    if (!showNumbers) return "₹••••••";
    return `₹${val.toLocaleString("en-IN")}`;
  };

  const loadAdminTeam = async () => {
    setLoadingAdmins(true);
    try {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("id, user_id, created_at")
        .eq("role", "admin")
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch profiles or emails for these admin user IDs
      const userIds = (roles || []).map((r) => r.user_id);
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, phone")
          .in("id", userIds);

        const map = new Map(profiles?.map((p) => [p.id, p]) ?? []);
        const enriched = (roles || []).map((r) => ({
          ...r,
          email: map.get(r.user_id)?.full_name || map.get(r.user_id)?.phone || `Admin (${r.user_id.slice(0, 8)}...)`,
        }));
        setAdminsList(enriched);
      } else {
        setAdminsList([]);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load admins");
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleOpenAdminModal = () => {
    setAdminModalOpen(true);
    loadAdminTeam();
  };

  const handlePromoteAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) {
      toast.error("Please enter a student/user email or ID");
      return;
    }

    setAdminActionLoading(true);
    try {
      // Find profile by email, phone, or direct ID
      const queryVal = newAdminEmail.trim();
      let targetUserId: string | null = null;

      // Check if it's a UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(queryVal);
      if (isUUID) {
        targetUserId = queryVal;
      } else {
        // Query profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .or(`phone.eq.${queryVal}`)
          .limit(1)
          .maybeSingle();

        if (profile) {
          targetUserId = profile.id;
        } else {
          // Attempt finding by auth email via rpc or notify
          throw new Error(`Could not find a registered user matching "${queryVal}". Please check phone number or User ID.`);
        }
      }

      if (!targetUserId) throw new Error("User ID not resolved");

      // Insert role
      const { error: insertErr } = await supabase.from("user_roles").insert({
        user_id: targetUserId,
        role: "admin",
      });

      if (insertErr) throw insertErr;

      toast.success("New admin successfully appointed!");
      setNewAdminEmail("");
      loadAdminTeam();
    } catch (err: any) {
      toast.error(err.message || "Failed to appoint admin");
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleRevokeAdmin = async (roleId: string, adminUserId: string) => {
    if (adminUserId === currentUserId) {
      toast.error("You cannot revoke your own owner/admin role!");
      return;
    }
    if (!confirm("Are you sure you want to revoke admin privileges from this user?")) return;

    try {
      const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
      if (error) throw error;
      toast.success("Admin role removed");
      loadAdminTeam();
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke admin role");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-10 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-[#1e1b4b] text-white p-6 sm:p-8 shadow-2xl border border-indigo-900/50 relative overflow-hidden"
    >
      {/* Background glowing orbs */}
      <div className="absolute -right-16 -top-16 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-16 w-80 h-80 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              Owner & Founder Confidential
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-medium border border-purple-500/30">
              <Lock className="w-3 h-3" />
              Only Visible to You
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2 flex items-center gap-2.5">
            Total Revenue & Financial Analytics
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time verified earnings, paid student enrollments, and growth metrics across all batches.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowNumbers(!showNumbers)}
            className="rounded-xl bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs h-9"
          >
            {showNumbers ? <EyeOff className="w-4 h-4 mr-1.5 text-slate-300" /> : <Eye className="w-4 h-4 mr-1.5 text-emerald-400" />}
            {showNumbers ? "Hide Figures" : "Show Figures"}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleOpenAdminModal}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md text-xs h-9"
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            Manage Admin Team
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 relative z-10">
        {/* Total Lifetime */}
        <div className="bg-white/5 border border-white/10 hover:border-emerald-500/40 transition-all rounded-2xl p-4 sm:p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Earnings</span>
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <IndianRupee className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">
            {formatCurrency(stats.totalLifetime)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Lifetime collection</span>
          </div>
        </div>

        {/* Monthly Earnings */}
        <div className="bg-white/5 border border-white/10 hover:border-sky-500/40 transition-all rounded-2xl p-4 sm:p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Monthly (Last 30d)</span>
            <span className="p-2 rounded-xl bg-sky-500/20 text-sky-400">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-sky-400 tracking-tight">
            {formatCurrency(stats.monthly)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Past 30 days revenue
          </div>
        </div>

        {/* Weekly Earnings */}
        <div className="bg-white/5 border border-white/10 hover:border-purple-500/40 transition-all rounded-2xl p-4 sm:p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Weekly (Last 7d)</span>
            <span className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-purple-300 tracking-tight">
            {formatCurrency(stats.weekly)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Past 7 days revenue
          </div>
        </div>

        {/* Paid Students & Average Value */}
        <div className="bg-white/5 border border-white/10 hover:border-amber-500/40 transition-all rounded-2xl p-4 sm:p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Paid Students</span>
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-amber-300 tracking-tight">
            {stats.totalPaidStudents}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Avg order: {formatCurrency(stats.averageOrderValue)}
          </div>
        </div>
      </div>

      {/* Accurate Earning Graph */}
      <div className="mt-8 bg-black/30 border border-white/10 rounded-2xl p-5 sm:p-6 relative z-10 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Day-by-Day Accurate Revenue Growth
            </h3>
            <p className="text-xs text-slate-400">
              Calculated dynamically from confirmed student batch transactions
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setTimeframe("30d")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                timeframe === "30d"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => setTimeframe("7d")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                timeframe === "7d"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Last 7 Days
            </button>
          </div>
        </div>

        {/* Chart Rendering */}
        <div className="w-full h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activeChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ownerRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "#334155" }}
              />
              <YAxis
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (showNumbers ? `₹${v}` : "•")}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as DailyRevenuePoint;
                    return (
                      <div className="bg-slate-900 border border-slate-700 shadow-xl rounded-xl p-3 text-xs text-white">
                        <div className="font-bold text-slate-300 mb-1">{data.label}</div>
                        <div className="text-emerald-400 font-extrabold text-sm">
                          Revenue: {formatCurrency(data.revenue)}
                        </div>
                        <div className="text-slate-400 text-[11px] mt-0.5">
                          {data.orders} student{data.orders === 1 ? "" : "s"} enrolled
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10B981"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#ownerRevenueGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Admin Team Management Modal */}
      <Dialog open={adminModalOpen} onOpenChange={setAdminModalOpen}>
        <DialogContent className="rounded-3xl p-6 max-w-lg bg-slate-900 text-white border border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              Manage Administrative Privileges
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-slate-400 -mt-2">
            As the Primary Owner, only you can designate new administrators or revoke existing administrator roles.
          </p>

          <form onSubmit={handlePromoteAdmin} className="mt-4 space-y-3 bg-white/5 p-4 rounded-2xl border border-white/10">
            <Label className="text-xs font-semibold text-slate-200">
              Appoint New Admin (User ID or Student Phone)
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter Student Phone or User ID"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 text-xs rounded-xl"
              />
              <Button
                type="submit"
                disabled={adminActionLoading}
                className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs px-4"
              >
                {adminActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Appoint"}
              </Button>
            </div>
          </form>

          <div className="mt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Current Administrators ({adminsList.length})
            </h4>

            {loadingAdmins ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {adminsList.map((adm, idx) => (
                  <div
                    key={adm.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                        {adm.email}
                        {idx === 0 && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.2 rounded-full border border-amber-500/30">
                            Founder
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        User ID: {adm.user_id}
                      </div>
                    </div>

                    {adm.user_id !== currentUserId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeAdmin(adm.id, adm.user_id)}
                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 h-7 w-7 p-0 rounded-lg"
                        title="Revoke Admin Access"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setAdminModalOpen(false)}
              className="rounded-xl border-slate-700 bg-slate-800 text-white hover:bg-slate-700 text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
