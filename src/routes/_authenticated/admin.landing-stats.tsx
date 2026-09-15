import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  Eye,
  EyeOff,
  MoveUp,
  MoveDown,
  Database,
  PenTool,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LandingStatCard,
  LandingStatsConfig,
  StatMetricKey,
  StatCardMode,
  defaultLandingStatsConfig,
  ICON_MAP,
  COLOR_MAP,
  METRIC_LABELS,
  formatStatDisplayValue,
} from "@/lib/landing-stats";
import { cn } from "@/lib/utils";

export const Route = createFileRoute(
  "/_authenticated/admin/landing-stats"
)({
  component: AdminLandingStatsPage,
});

function AdminLandingStatsPage() {
  const qc = useQueryClient();
  const [config, setConfig] = useState<LandingStatsConfig>(defaultLandingStatsConfig);

  // 1. Fetch live system counts from database
  const { data: dbCounts } = useQuery({
    queryKey: ["admin", "system_metric_counts"],
    queryFn: async () => {
      const [students, tests, materials, batches, liveClasses, faculty] =
        await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("cbt_tests").select("id", { count: "exact", head: true }),
          supabase.from("study_materials").select("id", { count: "exact", head: true }),
          supabase.from("batches").select("id", { count: "exact", head: true }),
          supabase.from("live_classes").select("id", { count: "exact", head: true }),
          supabase.from("faculty").select("id", { count: "exact", head: true }),
        ]);

      return {
        students: students.count ?? 0,
        tests: tests.count ?? 0,
        materials: materials.count ?? 0,
        batches: batches.count ?? 0,
        live_classes: liveClasses.count ?? 0,
        faculty: faculty.count ?? 0,
      } as Record<StatMetricKey, number>;
    },
    staleTime: 60000,
  });

  // 2. Fetch saved landing stats configuration
  const { data: record, isLoading } = useQuery({
    queryKey: ["admin", "landing_stats_config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("category", "landing_stats_config")
        .eq("title", "landing_stats")
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (record?.body) {
      try {
        const parsed = JSON.parse(record.body) as LandingStatsConfig;
        if (parsed && Array.isArray(parsed.cards)) {
          setConfig({
            is_enabled: parsed.is_enabled ?? true,
            cards: parsed.cards,
          });
        }
      } catch (err) {
        console.warn("Failed to parse saved landing stats config:", err);
      }
    }
  }, [record]);

  // 3. Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        category: "landing_stats_config",
        title: "landing_stats",
        body: JSON.stringify(config),
        is_active: true,
      };

      if (record?.id) {
        const { error } = await supabase
          .from("notifications")
          .update(payload)
          .eq("id", record.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("notifications").insert(payload);
        if (error) throw error;
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("sarvodaya_landing_stats_config", JSON.stringify(config));
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "landing_stats_config"] });
      qc.invalidateQueries({ queryKey: ["landing_stats_config"] });
      toast.success("Homepage stats & counters updated successfully!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Card list operations
  const updateCard = (id: string, updates: Partial<LandingStatCard>) => {
    setConfig((prev) => ({
      ...prev,
      cards: prev.cards.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
  };

  const removeCard = (id: string) => {
    if (config.cards.length <= 1) {
      toast.warning("At least 1 card should remain in the configuration.");
      return;
    }
    setConfig((prev) => ({
      ...prev,
      cards: prev.cards.filter((c) => c.id !== id),
    }));
  };

  const moveCard = (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= config.cards.length) return;
    const newCards = [...config.cards];
    const temp = newCards[index];
    newCards[index] = newCards[targetIdx];
    newCards[targetIdx] = temp;
    setConfig((prev) => ({ ...prev, cards: newCards }));
  };

  const addCard = () => {
    const newCard: LandingStatCard = {
      id: `stat-${Date.now()}`,
      is_visible: true,
      mode: "custom",
      custom_value: "50,000",
      prefix: "",
      suffix: "+",
      title: "50,000 +",
      sub: "Active Learners",
      icon: "Users",
      color: "emerald",
    };
    setConfig((prev) => ({ ...prev, cards: [...prev.cards, newCard] }));
  };

  const resetToDefault = () => {
    if (confirm("Reset to default PhysicsWallah style cards?")) {
      setConfig(defaultLandingStatsConfig);
      toast.info("Reset to default configuration. Click 'Save Changes' to apply.");
    }
  };

  const visibleCards = config.cards.filter((c) => c.is_visible);

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
            Admin · Homepage Customizer
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Homepage Trust Stats & Counters
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the counter badges shown directly below the main hero section on the homepage
            (PhysicsWallah style: Real DB counts, custom marketing milestones, or hide them).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetToDefault}
            className="gap-1.5 text-xs rounded-xl"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset Default
          </Button>

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || isLoading}
            className="gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md shadow-primary/20"
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

      {/* Master Section Toggle */}
      <div className="glass-strong rounded-3xl p-5 mb-6 flex flex-wrap items-center justify-between gap-4 border border-border">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base text-foreground">
              Display Stats Section on Homepage
            </span>
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                config.is_enabled
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-slate-100 text-slate-500 border-slate-200"
              )}
            >
              {config.is_enabled ? "Active on Website" : "Hidden from Website"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Turn this OFF if you wish to temporarily hide the entire 4-column trust counter banner
            from the landing page.
          </p>
        </div>
        <Switch
          checked={config.is_enabled}
          onCheckedChange={(val) => setConfig((prev) => ({ ...prev, is_enabled: val }))}
        />
      </div>

      {/* Live System Data Badge Readout */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 mb-8 border border-slate-800 shadow-md">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
            <Database className="h-4 w-4" />
            <span>Live System Metrics (Real Database Count)</span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            Auto-calculated from your platform
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {(
            [
              ["students", "Students"],
              ["tests", "Mock Tests"],
              ["materials", "PDFs & Notes"],
              ["batches", "Batches"],
              ["live_classes", "Live Classes"],
              ["faculty", "Faculty"],
            ] as const
          ).map(([key, label]) => (
            <div
              key={key}
              className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center text-center"
            >
              <span className="text-lg font-black text-white">
                {dbCounts ? Intl.NumberFormat("en-IN").format(dbCounts[key]) : "--"}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Live Visual Preview */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h3 className="font-bold text-sm text-foreground">
              Live Homepage Preview ({visibleCards.length} visible cards)
            </h3>
          </div>
          {!config.is_enabled && (
            <span className="text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
              ⚠️ Section is currently disabled
            </span>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs overflow-hidden">
          {config.is_enabled ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 divide-x divide-slate-100">
              {visibleCards.length === 0 ? (
                <div className="col-span-full py-8 text-center text-slate-400 text-xs font-semibold">
                  No cards are currently set to visible. Toggle at least one card below.
                </div>
              ) : (
                visibleCards.map((c) => {
                  const IconComp = ICON_MAP[c.icon] || Sparkles;
                  const colorObj = COLOR_MAP[c.color] || COLOR_MAP.blue;
                  const displayValue = formatStatDisplayValue(c, dbCounts);

                  return (
                    <div
                      key={c.id}
                      className="flex flex-col items-center text-center px-4"
                    >
                      <IconComp className={`w-8 h-8 ${colorObj.textClass} mb-2`} />
                      <div className="font-bold text-slate-900 text-sm">{displayValue}</div>
                      <div className="text-xs text-slate-500 mt-1">{c.sub}</div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="py-6 text-center text-slate-400 text-xs italic">
              Stats banner is disabled and will not appear on the landing page.
            </div>
          )}
        </div>
      </div>

      {/* Cards Editor List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-lg text-foreground">Stat Cards Management</h3>
          <Button onClick={addCard} size="sm" className="gap-1.5 rounded-xl">
            <Plus className="h-4 w-4" /> Add Stat Card
          </Button>
        </div>

        {config.cards.map((card, idx) => {
          const colorObj = COLOR_MAP[card.color] || COLOR_MAP.blue;
          const IconComp = ICON_MAP[card.icon] || Sparkles;
          const displayValue = formatStatDisplayValue(card, dbCounts);

          return (
            <div
              key={card.id}
              className={cn(
                "glass-strong rounded-3xl p-5 border transition-all duration-200",
                card.is_visible
                  ? "border-border shadow-xs"
                  : "border-dashed border-slate-300 opacity-60 bg-slate-50/50"
              )}
            >
              {/* Card Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border/60 mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center border",
                      colorObj.bgClass,
                      colorObj.borderClass
                    )}
                  >
                    <IconComp className={`w-5 h-5 ${colorObj.textClass}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">
                        Card #{idx + 1}: {card.title || "Untitled Card"}
                      </span>
                      {card.is_visible ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Visible
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                          Hidden
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Preview: <span className="font-semibold text-foreground">{displayValue}</span> — {card.sub || "No subtitle"}
                    </div>
                  </div>
                </div>

                {/* Card Controls */}
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={idx === 0}
                    onClick={() => moveCard(idx, "up")}
                    className="h-8 w-8 rounded-lg"
                    title="Move Up"
                  >
                    <MoveUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={idx === config.cards.length - 1}
                    onClick={() => moveCard(idx, "down")}
                    className="h-8 w-8 rounded-lg"
                    title="Move Down"
                  >
                    <MoveDown className="h-4 w-4" />
                  </Button>

                  <Button
                    variant={card.is_visible ? "outline" : "secondary"}
                    size="sm"
                    onClick={() => updateCard(card.id, { is_visible: !card.is_visible })}
                    className="gap-1.5 text-xs rounded-xl ml-1"
                  >
                    {card.is_visible ? (
                      <>
                        <Eye className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Visible</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5 text-slate-400" />
                        <span>Hidden</span>
                      </>
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCard(card.id)}
                    className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg ml-1"
                    title="Delete Card"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Form Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Value Mode */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Value / Display Mode</Label>
                  <Select
                    value={card.mode}
                    onValueChange={(val: StatCardMode) => updateCard(card.id, { mode: val })}
                  >
                    <SelectTrigger className="rounded-xl text-xs">
                      <SelectValue placeholder="Choose mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="actual">
                        📊 Actual Database Count (Real-Time)
                      </SelectItem>
                      <SelectItem value="custom">
                        ✍️ Custom Marketing Value (e.g. 10M+)
                      </SelectItem>
                      <SelectItem value="none">
                        🚫 Title Only / Feature Badge (e.g. Daily Live)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 2. Metric selection or Custom Value */}
                {card.mode === "actual" ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Database Metric</Label>
                    <Select
                      value={card.db_metric || "students"}
                      onValueChange={(val: StatMetricKey) =>
                        updateCard(card.id, { db_metric: val })
                      }
                    >
                      <SelectTrigger className="rounded-xl text-xs">
                        <SelectValue placeholder="Select Metric" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(METRIC_LABELS).map(([k, lbl]) => (
                          <SelectItem key={k} value={k}>
                            {lbl} (Live: {dbCounts ? dbCounts[k as StatMetricKey] : "--"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : card.mode === "custom" ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Custom Number / Text</Label>
                    <Input
                      value={card.custom_value}
                      onChange={(e) => updateCard(card.id, { custom_value: e.target.value })}
                      placeholder="e.g. 10 Million or 100 or 50,000"
                      className="rounded-xl text-xs"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Highlight Text</Label>
                    <Input
                      value={card.title}
                      onChange={(e) => updateCard(card.id, { title: e.target.value })}
                      placeholder="e.g. Daily Live or 24 x 7"
                      className="rounded-xl text-xs"
                    />
                  </div>
                )}

                {/* 3. Prefix & Suffix (Only for actual or custom) */}
                {card.mode !== "none" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Prefix</Label>
                      <Input
                        value={card.prefix}
                        onChange={(e) => updateCard(card.id, { prefix: e.target.value })}
                        placeholder="e.g. AIR "
                        className="rounded-xl text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Suffix</Label>
                      <Input
                        value={card.suffix}
                        onChange={(e) => updateCard(card.id, { suffix: e.target.value })}
                        placeholder="e.g. + or M+"
                        className="rounded-xl text-xs"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Icon</Label>
                    <Select
                      value={card.icon}
                      onValueChange={(val) => updateCard(card.id, { icon: val })}
                    >
                      <SelectTrigger className="rounded-xl text-xs">
                        <SelectValue placeholder="Icon" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(ICON_MAP).map((k) => (
                          <SelectItem key={k} value={k}>
                            {k}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Row 2: Title, Subtitle, Icon & Color */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                {card.mode !== "none" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Card Title / Label</Label>
                    <Input
                      value={card.title}
                      onChange={(e) => updateCard(card.id, { title: e.target.value })}
                      placeholder="e.g. 10 Million + or Selections"
                      className="rounded-xl text-xs"
                    />
                  </div>
                )}

                <div
                  className={cn(
                    "space-y-1.5",
                    card.mode === "none" ? "sm:col-span-2" : "sm:col-span-1"
                  )}
                >
                  <Label className="text-xs font-semibold">Subtitle / Description</Label>
                  <Input
                    value={card.sub}
                    onChange={(e) => updateCard(card.id, { sub: e.target.value })}
                    placeholder="e.g. Interactive classes or Practice questions"
                    className="rounded-xl text-xs"
                  />
                </div>

                {card.mode !== "none" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Icon</Label>
                    <Select
                      value={card.icon}
                      onValueChange={(val) => updateCard(card.id, { icon: val })}
                    >
                      <SelectTrigger className="rounded-xl text-xs">
                        <SelectValue placeholder="Icon" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(ICON_MAP).map((k) => (
                          <SelectItem key={k} value={k}>
                            {k}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Accent Color</Label>
                  <Select
                    value={card.color}
                    onValueChange={(val) => updateCard(card.id, { color: val })}
                  >
                    <SelectTrigger className="rounded-xl text-xs">
                      <SelectValue placeholder="Color" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(COLOR_MAP).map(([k, c]) => (
                        <SelectItem key={k} value={k}>
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${c.textClass.replace(
                                "text-",
                                "bg-"
                              )}`}
                            />
                            <span>{c.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
