import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function getViralTier(
  views: number,
  threshold1: number = 5000,
  threshold2: number = 50000
): string | null {
  if (views >= threshold2) return "50K+";
  if (views >= 10000) return "10K+";
  if (views >= threshold1) return "5K+";
  return null;
}
