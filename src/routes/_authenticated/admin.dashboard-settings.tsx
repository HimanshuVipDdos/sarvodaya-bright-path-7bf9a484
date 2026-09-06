import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Save,
  Loader2,
  Sparkles,
  ArrowLeft,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type DashboardConfig = {
  greeting: string;
  announcement: string;
  banner_badge: string;
  banner_title_prefix: string;
  banner_title_main: string;
  banner_subtitle: string;
  banner_btn_text: string;
  banner_btn_link: string;
  recent_learning_title: string;
  recent_learning_desc: string;
  my_doubts_title: string;
  my_doubts_desc: string;
  pdf_bank_title: string;
  pdf_bank_desc: string;
  bookmarks_title: string;
  bookmarks_desc: string;
};

export const defaultDashboardConfig: DashboardConfig = {
  greeting: "Study",
  announcement: "Welcome to Sarvodaya Adhyeta! Attend daily live classes & test series.",
  banner_badge: "Enroll Now",
  banner_title_prefix: "Introducing",
  banner_title_main: "SARVODAYA PRIME",
  banner_subtitle: "TEST SERIES • DOUBTS • PREMIUM LECTURES",
  banner_btn_text: "Explore Plan",
  banner_btn_link: "/batches",
  recent_learning_title: "Recent Learning",
  recent_learning_desc: "View your past learning history",
  my_doubts_title: "My Doubts",
  my_doubts_desc: "View the list of your asked doubts in the lectures",
  pdf_bank_title: "PDF Bank",
  pdf_bank_desc: "Download your Study PDFs from one place",
  bookmarks_title: "Bookmarks",
  bookmarks_desc: "View the list of your saved questions.",
};

export const Route = createFileRoute("/_authenticated/admin/dashboard-settings")({
  component: DashboardSettingsAdmin,
});

function DashboardSettingsAdmin() {
  const qc = useQueryClient();
  const [form, setForm] = useState<DashboardConfig>(defaultDashboardConfig);

  const { data: record, isLoading } = useQuery({
    queryKey: ["admin", "dashboard_config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("category", "dashboard_config")
        .eq("title", "dashboard_settings")
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (record?.body) {
      try {
        const parsed = JSON.parse(record.body);
        setForm({ ...defaultDashboardConfig, ...parsed });
      } catch {
        // fallback
      }
    }
  }, [record]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        category: "dashboard_config",
        title: "dashboard_settings",
        body: JSON.stringify(form),
        is_active: true,
      };

      if (record?.id) {
        const { error } = await supabase
          .from("notifications")
          .update(payload)
          .eq("id", record.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notifications")
          .insert(payload);
        if (error) throw error;
      }

      // Also store in localStorage for immediate client-side instant load
      if (typeof window !== "undefined") {
        localStorage.setItem("sarvodaya_dashboard_config", JSON.stringify(form));
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "dashboard_config"] });
      qc.invalidateQueries({ queryKey: ["dashboard_config"] });
      toast.success("Main dashboard content updated successfully!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = (key: keyof DashboardConfig, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  return (
    <Section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Admin
          </Link>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
            Admin · Content Management
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Main Dashboard Editor</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Change headings, announcements, promo banners and cards on the student dashboard.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setForm(defaultDashboardConfig)}
            className="gap-1.5"
          >
            <RotateCcw className="h-4 w-4" /> Reset Defaults
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || isLoading}
            className="gap-2 bg-primary"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Section 1: Header & Announcement */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-3xl p-6 space-y-4"
        >
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
            <LayoutDashboard className="h-5 w-5 text-blue-600" /> Header & Announcement
          </h2>
          <div>
            <Label className="text-xs">Top Header Title</Label>
            <Input
              value={form.greeting}
              onChange={(e) => update("greeting", e.target.value)}
              placeholder="e.g. Study"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Dashboard Announcement Banner (Optional)</Label>
            <Textarea
              value={form.announcement}
              onChange={(e) => update("announcement", e.target.value)}
              placeholder="e.g. Special UP Police Live Crash Course starting tomorrow!"
              className="mt-1"
              rows={2}
            />
          </div>
        </motion.div>

        {/* Section 2: Promotional Prime Banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-strong rounded-3xl p-6 space-y-4"
        >
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
            <Sparkles className="h-5 w-5 text-amber-500" /> Main Promo Banner (Red Card)
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Badge Tag</Label>
              <Input
                value={form.banner_badge}
                onChange={(e) => update("banner_badge", e.target.value)}
                placeholder="e.g. Enroll Now"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Title Prefix</Label>
              <Input
                value={form.banner_title_prefix}
                onChange={(e) => update("banner_title_prefix", e.target.value)}
                placeholder="e.g. Introducing"
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Main Banner Heading</Label>
            <Input
              value={form.banner_title_main}
              onChange={(e) => update("banner_title_main", e.target.value)}
              placeholder="e.g. SARVODAYA PRIME"
              className="mt-1 font-bold"
            />
          </div>
          <div>
            <Label className="text-xs">Subtitle Features</Label>
            <Input
              value={form.banner_subtitle}
              onChange={(e) => update("banner_subtitle", e.target.value)}
              placeholder="e.g. TEST SERIES • DOUBTS • PREMIUM LECTURES"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Button Text</Label>
              <Input
                value={form.banner_btn_text}
                onChange={(e) => update("banner_btn_text", e.target.value)}
                placeholder="e.g. Explore Plan"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Button Redirect Link</Label>
              <Input
                value={form.banner_btn_link}
                onChange={(e) => update("banner_btn_link", e.target.value)}
                placeholder="e.g. /batches"
                className="mt-1"
              />
            </div>
          </div>
        </motion.div>

        {/* Section 3: Quick Links Cards */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-strong rounded-3xl p-6 space-y-4"
        >
          <h2 className="text-lg font-bold text-slate-800">Quick Links Section</h2>
          <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
            <Label className="text-xs font-bold text-slate-700">Recent Learning Card</Label>
            <Input
              value={form.recent_learning_title}
              onChange={(e) => update("recent_learning_title", e.target.value)}
              placeholder="Title"
            />
            <Input
              value={form.recent_learning_desc}
              onChange={(e) => update("recent_learning_desc", e.target.value)}
              placeholder="Description"
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
            <Label className="text-xs font-bold text-slate-700">My Doubts Card</Label>
            <Input
              value={form.my_doubts_title}
              onChange={(e) => update("my_doubts_title", e.target.value)}
              placeholder="Title"
            />
            <Input
              value={form.my_doubts_desc}
              onChange={(e) => update("my_doubts_desc", e.target.value)}
              placeholder="Description"
            />
          </div>
        </motion.div>

        {/* Section 4: Explore Cards */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-strong rounded-3xl p-6 space-y-4"
        >
          <h2 className="text-lg font-bold text-slate-800">Explore Section Cards</h2>
          <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
            <Label className="text-xs font-bold text-slate-700">PDF Bank Card</Label>
            <Input
              value={form.pdf_bank_title}
              onChange={(e) => update("pdf_bank_title", e.target.value)}
              placeholder="Title"
            />
            <Input
              value={form.pdf_bank_desc}
              onChange={(e) => update("pdf_bank_desc", e.target.value)}
              placeholder="Description"
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
            <Label className="text-xs font-bold text-slate-700">Bookmarks Card</Label>
            <Input
              value={form.bookmarks_title}
              onChange={(e) => update("bookmarks_title", e.target.value)}
              placeholder="Title"
            />
            <Input
              value={form.bookmarks_desc}
              onChange={(e) => update("bookmarks_desc", e.target.value)}
              placeholder="Description"
            />
          </div>
        </motion.div>
      </div>

      <div className="mt-8 flex justify-end">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || isLoading}
          size="lg"
          className="gap-2 bg-primary px-8"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save All Dashboard Changes
        </Button>
      </div>
    </Section>
  );
}
