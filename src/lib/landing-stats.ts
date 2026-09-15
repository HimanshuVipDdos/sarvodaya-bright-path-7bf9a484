import {
  Video,
  FileText,
  Clock,
  MapPin,
  Trophy,
  Users,
  BookOpen,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type StatMetricKey =
  | "students"
  | "tests"
  | "materials"
  | "batches"
  | "live_classes"
  | "faculty";

export type StatCardMode = "actual" | "custom" | "none";

export type LandingStatCard = {
  id: string;
  is_visible: boolean;
  mode: StatCardMode;
  db_metric?: StatMetricKey;
  custom_value: string; // e.g. "10 Million", "100", "50,000", "24 x 7"
  prefix: string; // e.g. "Top ", "AIR "
  suffix: string; // e.g. "+", "M+", "k", "%"
  title: string; // Main title / highlight (or fallback if mode === 'none')
  sub: string; // Subtitle / description
  icon: string; // Key in ICON_MAP
  color: string; // Key in COLOR_MAP
};

export type LandingStatsConfig = {
  is_enabled: boolean;
  cards: LandingStatCard[];
};

export const ICON_MAP: Record<string, LucideIcon> = {
  Video,
  FileText,
  Clock,
  MapPin,
  Trophy,
  Users,
  BookOpen,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
};

export const COLOR_MAP: Record<
  string,
  { label: string; textClass: string; bgClass: string; borderClass: string }
> = {
  red: {
    label: "Red",
    textClass: "text-red-500",
    bgClass: "bg-red-50",
    borderClass: "border-red-200",
  },
  blue: {
    label: "Blue",
    textClass: "text-blue-500",
    bgClass: "bg-blue-50",
    borderClass: "border-blue-200",
  },
  purple: {
    label: "Purple",
    textClass: "text-purple-500",
    bgClass: "bg-purple-50",
    borderClass: "border-purple-200",
  },
  yellow: {
    label: "Yellow",
    textClass: "text-yellow-500",
    bgClass: "bg-yellow-50",
    borderClass: "border-yellow-200",
  },
  emerald: {
    label: "Emerald",
    textClass: "text-emerald-500",
    bgClass: "bg-emerald-50",
    borderClass: "border-emerald-200",
  },
  indigo: {
    label: "Indigo",
    textClass: "text-indigo-500",
    bgClass: "bg-indigo-50",
    borderClass: "border-indigo-200",
  },
  amber: {
    label: "Amber",
    textClass: "text-amber-500",
    bgClass: "bg-amber-50",
    borderClass: "border-amber-200",
  },
  rose: {
    label: "Rose",
    textClass: "text-rose-500",
    bgClass: "bg-rose-50",
    borderClass: "border-rose-200",
  },
};

export const METRIC_LABELS: Record<StatMetricKey, string> = {
  students: "Enrolled / Registered Students",
  tests: "Published Mock Tests & Practice Sets",
  materials: "Study Materials & Notes (PDFs)",
  batches: "Active Exam Batches",
  live_classes: "Daily Live Classes",
  faculty: "Expert Faculty Educators",
};

export const defaultLandingStatsConfig: LandingStatsConfig = {
  is_enabled: true,
  cards: [
    {
      id: "stat-daily-live",
      is_visible: true,
      mode: "none",
      custom_value: "Daily Live",
      prefix: "",
      suffix: "",
      title: "Daily Live",
      sub: "Interactive classes",
      icon: "Video",
      color: "red",
    },
    {
      id: "stat-tests-notes",
      is_visible: true,
      mode: "custom",
      custom_value: "10 Million",
      prefix: "",
      suffix: "+",
      title: "10 Million +",
      sub: "Tests, sample papers & notes",
      icon: "FileText",
      color: "blue",
    },
    {
      id: "stat-doubt-sessions",
      is_visible: true,
      mode: "none",
      custom_value: "24 x 7",
      prefix: "",
      suffix: "",
      title: "24 x 7",
      sub: "Doubt solving sessions",
      icon: "Clock",
      color: "purple",
    },
    {
      id: "stat-offline-centres",
      is_visible: true,
      mode: "custom",
      custom_value: "100",
      prefix: "",
      suffix: "+",
      title: "100 +",
      sub: "Offline centres",
      icon: "MapPin",
      color: "yellow",
    },
  ],
};

export function formatStatDisplayValue(
  card: LandingStatCard,
  actualCounts?: Partial<Record<StatMetricKey, number>>
): string {
  if (card.mode === "none") {
    return card.title || card.custom_value || "—";
  }

  const prefix = card.prefix ? `${card.prefix} ` : "";
  const suffix = card.suffix ? ` ${card.suffix}` : "";

  if (card.mode === "actual" && card.db_metric) {
    const raw = actualCounts?.[card.db_metric] ?? 0;
    const formatted = Intl.NumberFormat("en-IN").format(raw);
    return `${prefix}${formatted}${suffix}`.trim();
  }

  // Custom mode
  const val = card.custom_value || card.title || "";
  return `${prefix}${val}${suffix}`.trim();
}
