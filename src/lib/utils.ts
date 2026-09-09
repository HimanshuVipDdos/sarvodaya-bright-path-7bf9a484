import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Safely display a score even if an old row still has floating-point
// drift (e.g. 1.3399999999999999). Rounds to 2 decimals, drops trailing ".00".
export function formatScore(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return "0";
  const rounded = Math.round(score * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

// Convert a raw storage path into a full public URL if it isn't already one.
export function getStorageUrl(path: string | null | undefined, defaultBucket: string = "batch-thumbnails"): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) return path;
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://uivnjfxyoacrmjocxryd.supabase.co";
  const cleanPath = path.replace(/^\/+/, "");
  
  const knownBuckets = [
    "batch-thumbnails", "batch-covers", "covers", "study-materials",
    "public", "avatars", "lectures", "cbt-images", "images", "photos",
    "hero-slides", "gallery-photos", "faculty-photos", "materials"
  ];
  const firstSegment = cleanPath.split("/")[0];
  
  if (knownBuckets.includes(firstSegment)) {
    return `${supabaseUrl}/storage/v1/object/public/${cleanPath}`;
  }
  
  return `${supabaseUrl}/storage/v1/object/public/${defaultBucket}/${cleanPath}`;
}

/**
 * Determine logically if a live class is currently active/running.
 * Checks explicit is_live flag, scheduled timeframe window (scheduled_at to end_at / duration),
 * and ensures it hasn't ended or been archived to recorded lectures.
 */
export function isClassLiveNow(
  cl: {
    is_live?: boolean | null;
    status?: string | null;
    scheduled_at?: string | null;
    end_at?: string | null;
    duration_minutes?: number | null;
    recorded_lecture_id?: string | null;
  } | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!cl) return false;
  // If already recorded/archived, it is not live anymore
  if (cl.recorded_lecture_id || cl.status === "ended") return false;
  // If explicit is_live boolean flag is true, or status is explicitly 'live'
  if (cl.is_live === true || cl.status === "live") return true;
  // If scheduled time exists, check if currently inside the live broadcast window
  if (!cl.scheduled_at) return false;
  const startMs = new Date(cl.scheduled_at).getTime();
  if (isNaN(startMs)) return false;
  const endMs = cl.end_at
    ? new Date(cl.end_at).getTime()
    : cl.duration_minutes && cl.duration_minutes > 0
    ? startMs + cl.duration_minutes * 60000
    : startMs + 90 * 60000;
  return nowMs >= startMs && nowMs <= endMs;
}

