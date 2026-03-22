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

export function calcEngagementRate(
  views: number,
  likes: number,
  comments: number,
  shares: number
): number {
  if (views === 0) return 0;
  return ((likes + comments + shares) / views) * 100;
}

export function formatEngagementRate(rate: number): string {
  return rate.toFixed(1) + "%";
}

export function relativeDate(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return formatDate(date);
}
