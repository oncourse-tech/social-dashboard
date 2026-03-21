import { VideoFormat } from "@prisma/client";

export const FORMAT_LABELS: Record<VideoFormat, string> = {
  UGC_REACTION: "UGC Reaction",
  UGC_VOICEOVER: "UGC Voiceover",
  TALKING_HEAD: "Talking Head",
  CAROUSEL_SLIDESHOW: "Carousel / Slideshow",
  SCREEN_RECORDING: "Screen Recording",
  SKIT_COMEDY: "Skit / Comedy",
  GREEN_SCREEN: "Green Screen",
  TEXT_ON_SCREEN: "Text on Screen",
  INTERVIEW_PODCAST: "Interview / Podcast",
  WHITEBOARD: "Whiteboard",
  BEFORE_AFTER: "Before / After",
  ASMR_AESTHETIC: "ASMR / Aesthetic",
  OTHER: "Other",
};

export const FORMAT_COLORS: Record<VideoFormat, string> = {
  UGC_REACTION: "#ef4444",
  UGC_VOICEOVER: "#f97316",
  TALKING_HEAD: "#eab308",
  CAROUSEL_SLIDESHOW: "#22c55e",
  SCREEN_RECORDING: "#06b6d4",
  SKIT_COMEDY: "#8b5cf6",
  GREEN_SCREEN: "#10b981",
  TEXT_ON_SCREEN: "#6366f1",
  INTERVIEW_PODCAST: "#ec4899",
  WHITEBOARD: "#14b8a6",
  BEFORE_AFTER: "#f59e0b",
  ASMR_AESTHETIC: "#a855f7",
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
    section: "SYSTEM",
    items: [
      { label: "Settings", href: "/settings", icon: "Settings" },
      { label: "Sync Status", href: "/sync", icon: "RefreshCw" },
    ],
  },
] as const;
