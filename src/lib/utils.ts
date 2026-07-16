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
