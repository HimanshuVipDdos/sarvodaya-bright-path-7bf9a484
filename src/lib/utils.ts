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
export function getStorageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  
  // Replace with actual Supabase project URL dynamically from env
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://uivnjfxyoacrmjocxryd.supabase.co";
  
  // Clean up leading slashes in path
  const cleanPath = path.replace(/^\/+/, "");
  
  return `${supabaseUrl}/storage/v1/object/public/public/${cleanPath}`;
}

