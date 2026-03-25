import { VideoFormat } from "@prisma/client";

export const FORMAT_LABELS: Record<VideoFormat, string> = {
  UGC_REACTION: "UGC Reaction",
  UGC_VOICEOVER: "UGC Voiceover",
  CAROUSEL_SLIDESHOW: "Carousel / Slideshow",
  OTHER: "Other",
};

export const FORMAT_COLORS: Record<VideoFormat, string> = {
  UGC_REACTION: "#ef4444",
  UGC_VOICEOVER: "#f97316",
  CAROUSEL_SLIDESHOW: "#22c55e",
  OTHER: "#6b7280",
};

export const DEFAULT_VIRAL_THRESHOLD_1 = 5000;
export const DEFAULT_VIRAL_THRESHOLD_2 = 50000;

export const NAV_ITEMS = [
  {
    section: "COMPETITOR INTEL",
    items: [
      { label: "Apps", href: "/apps", icon: "LayoutGrid" },
      { label: "Accounts", href: "/accounts", icon: "Users" },
      { label: "Account Research", href: "/research", icon: "Search" },
      { label: "Posting Activity", href: "/activity", icon: "Activity" },
      { label: "Viral Videos", href: "/viral", icon: "Flame" },
      { label: "All Videos", href: "/videos", icon: "Film" },
      { label: "Bulk Import", href: "/import", icon: "Upload" },
    ],
  },
  {
    section: "CREATE",
    items: [
      { label: "Studio", href: "/studio", icon: "Clapperboard" },
    ],
  },
  {
    section: "SYSTEM",
    items: [
      { label: "Settings", href: "/settings", icon: "Settings" },
      { label: "Sync Status", href: "/sync", icon: "RefreshCw" },
    ],
  },
] as const;
