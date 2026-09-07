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

