import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Sparkles,
  Save,
  Loader2,
  ArrowLeft,
  RotateCcw,
  Eye,
  Megaphone,
  Layers,
  Trophy,
  GraduationCap,
  MapPin,
  PhoneCall,
  Plus,
  Trash2,
  Check,
  Flame,
  LayoutDashboard,
  ExternalLink,
} from "lucide-react";
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
  LandingPageConfig,
  defaultLandingPageConfig,
  parseLandingPageConfig,
  OfflineCentre,
} from "@/lib/landing-config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute(
  "/_authenticated/admin/landing-settings"
)({
  component: AdminLandingSettingsPage,
});

function AdminLandingSettingsPage() {
  const qc = useQueryClient();
  const [config, setConfig] = useState<LandingPageConfig>(defaultLandingPageConfig);
  const [activeTab, setActiveTab] = useState<
    "hero" | "announcement" | "batches" | "toppers" | "faculty" | "centres" | "inquiry"
  >("hero");

  // New category chip input state
  const [newCategory, setNewCategory] = useState("");

  // 1. Fetch saved landing settings from Supabase
  const { data: record, isLoading } = useQuery({
    queryKey: ["admin", "landing_page_config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("category", "landing_page_config")
        .eq("title", "landing_settings")
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (record?.body) {
      try {
        const parsed = parseLandingPageConfig(record.body);
        setConfig(parsed);
      } catch {}
    } else if (typeof window !== "undefined") {
      try {
        const local = localStorage.getItem("sarvodaya_landing_page_config");
        if (local) {
          setConfig(parseLandingPageConfig(local));
        }
      } catch {}
    }
  }, [record]);

  // 2. Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        category: "landing_page_config",
        title: "landing_settings",
        body: JSON.stringify(config),
        is_active: true,
      };

      if (record?.id) {
        const { error } = await supabase
          .from("notifications")
          .update({
            body: payload.body,
            updated_at: new Date().toISOString(),
          })
          .eq("id", record.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notifications")
          .insert(payload);
        if (error) throw error;
      }

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("sarvodaya_landing_page_config", JSON.stringify(config));
        } catch {}
      }
    },
    onSuccess: () => {
      toast.success("Homepage settings saved successfully! Changes are live.");
      qc.invalidateQueries({ queryKey: ["admin", "landing_page_config"] });
      qc.invalidateQueries({ queryKey: ["landing-data"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save homepage settings.");
    },
  });

  function handleResetDefaults() {
    if (window.confirm("Are you sure you want to reset all homepage texts to factory defaults?")) {
      setConfig(defaultLandingPageConfig);
      toast.info("Settings reset to defaults. Click 'Save Changes' to publish.");
    }
  }

  // Categories helper
  function addCategory() {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (config.batches_categories.includes(trimmed)) {
      toast.error("Category already exists.");
      return;
    }
    setConfig((prev) => ({
      ...prev,
      batches_categories: [...prev.batches_categories, trimmed],
    }));
    setNewCategory("");
  }

  function removeCategory(cat: string) {
    if (config.batches_categories.length <= 1) {
      toast.error("At least one category is required.");
      return;
    }
    setConfig((prev) => ({
      ...prev,
      batches_categories: prev.batches_categories.filter((c) => c !== cat),
    }));
  }

  // Centres helper
  function addCentre() {
    const newCentre: OfflineCentre = {
      id: Date.now().toString(),
      city: "New City Centre",
      tag: "Coming Soon",
      icon: "🏙️",
      is_active: true,
    };
    setConfig((prev) => ({
      ...prev,
      centres_list: [...prev.centres_list, newCentre],
    }));
  }

  function updateCentre(id: string, updates: Partial<OfflineCentre>) {
    setConfig((prev) => ({
      ...prev,
      centres_list: prev.centres_list.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
  }

  function removeCentre(id: string) {
    setConfig((prev) => ({
      ...prev,
      centres_list: prev.centres_list.filter((c) => c.id !== id),
    }));
  }

  const tabs = [
    { id: "hero", label: "🚀 Hero Section", desc: "Headlines, Buttons & 3D Model" },
    { id: "announcement", label: "📢 Notice Banner", desc: "Top Announcement Bar" },
    { id: "batches", label: "📚 Batches Showcase", desc: "Targeted Exam Categories" },
    { id: "toppers", label: "🏆 Hall of Fame", desc: "Toppers & Selections" },
    { id: "faculty", label: "🎓 Star Faculty", desc: "Teachers Section" },
    { id: "centres", label: "📍 Offline Centres", desc: "Campuses & Smart Labs" },
    { id: "inquiry", label: "📞 Counseling Call", desc: "Admission Inquiry Form" },
  ] as const;

  return (
    <Section>
      <div className="max-w-6xl mx-auto space-y-6 pb-20">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition bg-muted/60 px-3 py-1.5 rounded-xl border border-border/60"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Admin Hub
              </Link>
              <Badge variant="outline" className="text-xs font-semibold border-amber-300 text-amber-800 bg-amber-50">
                Live CMS
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
              <Sparkles className="w-7 h-7 text-amber-500" /> Homepage Master CMS Editor
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Main landing page ke har ek text, title, button, category, aur section ko yahan se live customize karein.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetDefaults}
              className="rounded-xl text-xs gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Defaults
            </Button>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-xl text-xs gap-1.5 border-border/80"
            >
              <Link to="/" target="_blank">
                <Eye className="w-3.5 h-3.5 text-emerald-500" /> Live Preview
              </Link>
            </Button>

            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || isLoading}
              className="rounded-xl text-xs font-bold gap-1.5 bg-red-600 hover:bg-red-500 text-white shadow-md cursor-pointer"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" /> Save Changes
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Quick Launch Companion Links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            to="/admin/hero-slides"
            className="flex items-center justify-between p-3.5 rounded-2xl border border-border/60 bg-muted/30 hover:bg-muted/60 transition group text-xs"
          >
            <div>
              <div className="font-bold text-foreground group-hover:text-red-500 transition">
                🖼️ Homepage Slider Banners
              </div>
              <div className="text-[11px] text-muted-foreground">
                Upload promotional banners & redirect links
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-red-500 transition" />
          </Link>

          <Link
            to="/admin/landing-stats"
            className="flex items-center justify-between p-3.5 rounded-2xl border border-border/60 bg-muted/30 hover:bg-muted/60 transition group text-xs"
          >
            <div>
              <div className="font-bold text-foreground group-hover:text-red-500 transition">
                📊 Live Stats Counter Strip
              </div>
              <div className="text-[11px] text-muted-foreground">
                Auto DB counts vs Custom marketing numbers
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-red-500 transition" />
          </Link>

          <Link
            to="/admin/batches"
            className="flex items-center justify-between p-3.5 rounded-2xl border border-border/60 bg-muted/30 hover:bg-muted/60 transition group text-xs"
          >
            <div>
              <div className="font-bold text-foreground group-hover:text-red-500 transition">
                📚 Manage Batches & Courses
              </div>
              <div className="text-[11px] text-muted-foreground">
                Pricing, cover photos, faculties & dates
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-red-500 transition" />
          </Link>
        </div>

        {/* Section Tabs Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-border/60">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0 border",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-transparent"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: HERO SECTION */}
        {activeTab === "hero" && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-6">
              <div className="border-b border-border/60 pb-3">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Flame className="w-4 h-4 text-red-500" /> Hero Headlines & Badges
                </h3>
                <p className="text-xs text-muted-foreground">
                  The primary visual title and hook students see when opening your website.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-bold">Trust Badge Pill (Top Little Tag)</Label>
                  <Input
                    value={config.hero_badge_text}
                    onChange={(e) => setConfig({ ...config, hero_badge_text: e.target.value })}
                    placeholder="e.g. Bharat's #1 Dedicated Competitive Exam Institute"
                    className="text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Headline Line 1 (Prefix)</Label>
                  <Input
                    value={config.hero_headline_line1}
                    onChange={(e) => setConfig({ ...config, hero_headline_line1: e.target.value })}
                    placeholder="e.g. Apka Selection,"
                    className="text-xs rounded-xl font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Headline Highlight (Gradient Text)</Label>
                  <Input
                    value={config.hero_headline_highlight}
                    onChange={(e) => setConfig({ ...config, hero_headline_highlight: e.target.value })}
                    placeholder="e.g. Hamara Sankalp."
                    className="text-xs rounded-xl font-bold text-red-600"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-bold">Hero Subtitle Paragraph</Label>
                  <Textarea
                    rows={3}
                    value={config.hero_subtitle}
                    onChange={(e) => setConfig({ ...config, hero_subtitle: e.target.value })}
                    placeholder="Short description highlighting Kota faculty, live classes, and DPPs"
                    className="text-xs rounded-xl resize-none"
                  />
                </div>
              </div>

              <div className="border-t border-border/60 pt-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-3">
                  Trust Counter Badges (Below Subtitle)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Badge 1 (Rating)</Label>
                    <Input
                      value={config.hero_trust_rating}
                      onChange={(e) => setConfig({ ...config, hero_trust_rating: e.target.value })}
                      placeholder="4.9/5 Rating"
                      className="text-xs rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Badge 2 (Students)</Label>
                    <Input
                      value={config.hero_trust_students}
                      onChange={(e) => setConfig({ ...config, hero_trust_students: e.target.value })}
                      placeholder="50,000+ Students"
                      className="text-xs rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Badge 3 (Selections)</Label>
                    <Input
                      value={config.hero_trust_selections}
                      onChange={(e) => setConfig({ ...config, hero_trust_selections: e.target.value })}
                      placeholder="1,200+ Selections"
                      className="text-xs rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-border/60 pt-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-3">
                  Hero Action Buttons (CTAs) & 3D Interactive Model
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 p-3.5 rounded-2xl bg-muted/30 border border-border/60">
                    <span className="text-xs font-bold text-red-600">Primary Button (Red Gradient)</span>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium">Button Text</Label>
                      <Input
                        value={config.hero_primary_btn_text}
                        onChange={(e) => setConfig({ ...config, hero_primary_btn_text: e.target.value })}
                        placeholder="Explore Batches"
                        className="text-xs rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium">Button Destination URL</Label>
                      <Input
                        value={config.hero_primary_btn_link}
                        onChange={(e) => setConfig({ ...config, hero_primary_btn_link: e.target.value })}
                        placeholder="/batches"
                        className="text-xs rounded-xl font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 p-3.5 rounded-2xl bg-muted/30 border border-border/60">
                    <span className="text-xs font-bold text-foreground">Secondary Button (Dark Outline)</span>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium">Button Text</Label>
                      <Input
                        value={config.hero_secondary_btn_text}
                        onChange={(e) => setConfig({ ...config, hero_secondary_btn_text: e.target.value })}
                        placeholder="Take Free Mock Test"
                        className="text-xs rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium">Button Destination URL</Label>
                      <Input
                        value={config.hero_secondary_btn_link}
                        onChange={(e) => setConfig({ ...config, hero_secondary_btn_link: e.target.value })}
                        placeholder="/mock-tests"
                        className="text-xs rounded-xl font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between p-3.5 rounded-2xl bg-muted/20 border border-border/60">
                  <div>
                    <div className="font-bold text-xs text-foreground">Enable 3D Hero Particle Graphic</div>
                    <div className="text-[11px] text-muted-foreground">
                      Shows the dynamic interactive Canvas 3D model on desktop screens.
                    </div>
                  </div>
                  <Switch
                    checked={config.hero_show_3d_model}
                    onCheckedChange={(val) => setConfig({ ...config, hero_show_3d_model: val })}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ANNOUNCEMENT BAR */}
        {activeTab === "announcement" && (
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-amber-500" /> Top Announcement Ticker Banner
                </h3>
                <p className="text-xs text-muted-foreground">
                  A high-priority notification strip rendered at the very top of the homepage for urgent news, exam dates, or admissions.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">Banner Visible:</span>
                <Switch
                  checked={config.announcement_bar_enabled}
                  onCheckedChange={(val) => setConfig({ ...config, announcement_bar_enabled: val })}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Badge Tag Text</Label>
                <Input
                  value={config.announcement_bar_badge}
                  onChange={(e) => setConfig({ ...config, announcement_bar_badge: e.target.value })}
                  placeholder="NEW BATCH / ADMISSIONS OPEN"
                  className="text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Announcement Message / Text</Label>
                <Textarea
                  rows={2}
                  value={config.announcement_bar_text}
                  onChange={(e) => setConfig({ ...config, announcement_bar_text: e.target.value })}
                  placeholder="📢 New Offline & Online Batches Starting This Monday! Limited Seats Available."
                  className="text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Click Action Link (Optional)</Label>
                <Input
                  value={config.announcement_bar_link}
                  onChange={(e) => setConfig({ ...config, announcement_bar_link: e.target.value })}
                  placeholder="/batches or https://wa.me/..."
                  className="text-xs rounded-xl font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BATCHES SHOWCASE */}
        {activeTab === "batches" && (
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" /> Popular Targeted Batches Section
                </h3>
                <p className="text-xs text-muted-foreground">
                  The primary course catalog on the homepage with interactive exam category filter pills.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">Show Section:</span>
                <Switch
                  checked={config.batches_section_enabled}
                  onCheckedChange={(val) => setConfig({ ...config, batches_section_enabled: val })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-bold">Section Heading</Label>
                <Input
                  value={config.batches_title}
                  onChange={(e) => setConfig({ ...config, batches_title: e.target.value })}
                  placeholder="Popular Targeted Batches"
                  className="text-xs rounded-xl font-bold"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-bold">Section Subtitle</Label>
                <Textarea
                  rows={2}
                  value={config.batches_subtitle}
                  onChange={(e) => setConfig({ ...config, batches_subtitle: e.target.value })}
                  placeholder="Choose your targeted competitive exam to view tailored, structured curriculum led by expert educators."
                  className="text-xs rounded-xl resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">"View All" Button Label</Label>
                <Input
                  value={config.batches_view_all_btn_text}
                  onChange={(e) => setConfig({ ...config, batches_view_all_btn_text: e.target.value })}
                  placeholder="View All Batches"
                  className="text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Button Link</Label>
                <Input
                  value={config.batches_view_all_btn_link}
                  onChange={(e) => setConfig({ ...config, batches_view_all_btn_link: e.target.value })}
                  placeholder="/batches"
                  className="text-xs rounded-xl font-mono"
                />
              </div>
            </div>

            {/* Category Filter Pills Editor */}
            <div className="border-t border-border/60 pt-4 space-y-3">
              <div>
                <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                  Exam Filter Categories (Filter Pills)
                </Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Students can click these pills on the homepage to filter batches.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {config.batches_categories.map((cat) => (
                  <div
                    key={cat}
                    className="flex items-center gap-1.5 bg-muted/70 border border-border/60 px-3 py-1 rounded-xl text-xs font-bold text-foreground"
                  >
                    <span>{cat}</span>
                    {cat !== "All" && (
                      <button
                        type="button"
                        onClick={() => removeCategory(cat)}
                        className="text-muted-foreground hover:text-red-500 transition cursor-pointer"
                        title="Remove Category"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 max-w-sm pt-1">
                <Input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCategory();
                    }
                  }}
                  placeholder="Add exam (e.g. CDS, RO/ARO, SSC GD)"
                  className="text-xs rounded-xl"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addCategory}
                  className="rounded-xl text-xs font-bold gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TOPPERS & SELECTIONS */}
        {activeTab === "toppers" && (
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" /> Hall of Fame & Selections
                </h3>
                <p className="text-xs text-muted-foreground">
                  Showcase your institute's toppers, AIR ranks, and successful candidates.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">Show Section:</span>
                <Switch
                  checked={config.toppers_section_enabled}
                  onCheckedChange={(val) => setConfig({ ...config, toppers_section_enabled: val })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Section Badge (Gold Tag)</Label>
                <Input
                  value={config.toppers_badge}
                  onChange={(e) => setConfig({ ...config, toppers_badge: e.target.value })}
                  placeholder="ACADEMIC EXCELLENCE"
                  className="text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Big Background Watermark Text</Label>
                <Input
                  value={config.toppers_bg_watermark}
                  onChange={(e) => setConfig({ ...config, toppers_bg_watermark: e.target.value })}
                  placeholder="TOPPERS"
                  className="text-xs rounded-xl font-mono uppercase"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-bold">Section Heading</Label>
                <Input
                  value={config.toppers_title}
                  onChange={(e) => setConfig({ ...config, toppers_title: e.target.value })}
                  placeholder="Hall of Fame & Selections"
                  className="text-xs rounded-xl font-bold"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-bold">Section Subtitle</Label>
                <Textarea
                  rows={2}
                  value={config.toppers_subtitle}
                  onChange={(e) => setConfig({ ...config, toppers_subtitle: e.target.value })}
                  placeholder="Honoring the dedication, discipline, and outstanding ranks of our brilliant achievers."
                  className="text-xs rounded-xl resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Button Text</Label>
                <Input
                  value={config.toppers_btn_text}
                  onChange={(e) => setConfig({ ...config, toppers_btn_text: e.target.value })}
                  placeholder="Explore All Selections"
                  className="text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Button Link</Label>
                <Input
                  value={config.toppers_btn_link}
                  onChange={(e) => setConfig({ ...config, toppers_btn_link: e.target.value })}
                  placeholder="/results"
                  className="text-xs rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-300 flex items-center justify-between">
              <span>Toppers ke photos, ranks, aur exam details manage karne ke liye:</span>
              <Button asChild size="sm" variant="outline" className="rounded-xl text-xs h-7">
                <Link to="/admin/results">Open Results Manager</Link>
              </Button>
            </div>
          </div>
        )}

        {/* TAB 5: STAR FACULTY */}
        {activeTab === "faculty" && (
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-emerald-500" /> Star Faculty Showcase
                </h3>
                <p className="text-xs text-muted-foreground">
                  Highlight your mentors, subject matter experts, and teaching staff.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">Show Section:</span>
                <Switch
                  checked={config.faculty_section_enabled}
                  onCheckedChange={(val) => setConfig({ ...config, faculty_section_enabled: val })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Section Badge (Pill Tag)</Label>
                <Input
                  value={config.faculty_badge}
                  onChange={(e) => setConfig({ ...config, faculty_badge: e.target.value })}
                  placeholder="LEARN FROM THE BEST"
                  className="text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Section Heading</Label>
                <Input
                  value={config.faculty_title}
                  onChange={(e) => setConfig({ ...config, faculty_title: e.target.value })}
                  placeholder="Meet Our Star Faculty"
                  className="text-xs rounded-xl font-bold"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-bold">Section Subtitle</Label>
                <Textarea
                  rows={2}
                  value={config.faculty_subtitle}
                  onChange={(e) => setConfig({ ...config, faculty_subtitle: e.target.value })}
                  placeholder="Passionate subject matter experts with 10+ years of proven track record mentoring thousands of successful candidates."
                  className="text-xs rounded-xl resize-none"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-900 dark:text-emerald-300 flex items-center justify-between">
              <span>Faculty members ke photo, experience, subject aur bio edit karne ke liye:</span>
              <Button asChild size="sm" variant="outline" className="rounded-xl text-xs h-7">
                <Link to="/admin/faculty">Open Faculty Manager</Link>
              </Button>
            </div>
          </div>
        )}

        {/* TAB 6: OFFLINE CENTRES */}
        {activeTab === "centres" && (
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-red-500" /> Tech-Enabled Offline Centres
                </h3>
                <p className="text-xs text-muted-foreground">
                  Showcase your offline classroom campuses, hybrid centres, and upcoming branches.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">Show Section:</span>
                <Switch
                  checked={config.centres_section_enabled}
                  onCheckedChange={(val) => setConfig({ ...config, centres_section_enabled: val })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Section Heading</Label>
                <Input
                  value={config.centres_title}
                  onChange={(e) => setConfig({ ...config, centres_title: e.target.value })}
                  placeholder="Explore Tech-Enabled Offline Centres"
                  className="text-xs rounded-xl font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Inner Card Title</Label>
                <Input
                  value={config.centres_card_title}
                  onChange={(e) => setConfig({ ...config, centres_card_title: e.target.value })}
                  placeholder="Find Centre in your city"
                  className="text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-bold">Section Subtitle</Label>
                <Textarea
                  rows={2}
                  value={config.centres_subtitle}
                  onChange={(e) => setConfig({ ...config, centres_subtitle: e.target.value })}
                  placeholder="Creating new benchmarks in classroom & hybrid learning experiences with modern smart labs."
                  className="text-xs rounded-xl resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Action Button Text</Label>
                <Input
                  value={config.centres_btn_text}
                  onChange={(e) => setConfig({ ...config, centres_btn_text: e.target.value })}
                  placeholder="Visit Offline Centre"
                  className="text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Action Button Link</Label>
                <Input
                  value={config.centres_btn_link}
                  onChange={(e) => setConfig({ ...config, centres_btn_link: e.target.value })}
                  placeholder="/contact"
                  className="text-xs rounded-xl font-mono"
                />
              </div>
            </div>

            {/* City Centres Dynamic List */}
            <div className="border-t border-border/60 pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                    City Branches & Campuses List
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Active centres appear highlighted; inactive ones appear as 'Coming Soon'.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addCentre}
                  className="rounded-xl text-xs font-bold gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Campus
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {config.centres_list.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-2xl border border-border/80 bg-card space-y-3 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={c.icon}
                          onChange={(e) => updateCentre(c.id, { icon: e.target.value })}
                          className="w-12 text-center text-base p-1 rounded-xl"
                          title="Emoji Icon"
                        />
                        <Input
                          value={c.city}
                          onChange={(e) => updateCentre(c.id, { city: e.target.value })}
                          placeholder="e.g. Kasganj (Main)"
                          className="text-xs font-bold rounded-xl"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCentre(c.id)}
                        className="text-muted-foreground hover:text-red-500 p-1 transition cursor-pointer"
                        title="Delete Campus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <Input
                        value={c.tag}
                        onChange={(e) => updateCentre(c.id, { tag: e.target.value })}
                        placeholder="Tag (e.g. Active Flagship / Coming Soon)"
                        className="text-[11px] rounded-xl"
                      />
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-bold text-muted-foreground">Active:</span>
                        <Switch
                          checked={c.is_active}
                          onCheckedChange={(val) => updateCentre(c.id, { is_active: val })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: INQUIRY & COUNSELING */}
        {activeTab === "inquiry" && (
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-primary" /> Career Counseling & Admissions Form
                </h3>
                <p className="text-xs text-muted-foreground">
                  The lead capture inquiry card at the bottom of the homepage.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">Show Section:</span>
                <Switch
                  checked={config.inquiry_section_enabled}
                  onCheckedChange={(val) => setConfig({ ...config, inquiry_section_enabled: val })}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Section Heading</Label>
                <Input
                  value={config.inquiry_title}
                  onChange={(e) => setConfig({ ...config, inquiry_title: e.target.value })}
                  placeholder="Request a Free Career Counseling Call"
                  className="text-xs rounded-xl font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Section Subtitle</Label>
                <Textarea
                  rows={2}
                  value={config.inquiry_subtitle}
                  onChange={(e) => setConfig({ ...config, inquiry_subtitle: e.target.value })}
                  placeholder="Have questions about which batch or exam path to choose? Our senior mentors will guide you."
                  className="text-xs rounded-xl resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Floating Save Toolbar at Bottom */}
        <div className="sticky bottom-4 z-40 bg-card/95 backdrop-blur-md border border-border/80 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Har ek change instantly save ho kar website ke main page par live dikhega.</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetDefaults}
              className="rounded-xl text-xs cursor-pointer"
            >
              Reset All
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="rounded-xl text-xs font-bold gap-1.5 bg-red-600 hover:bg-red-500 text-white shadow-md cursor-pointer"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" /> Save All Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
