export type AppWithStats = {
  id: string;
  name: string;
  color: string;
  url: string | null;
  accountCount: number;
  totalFollowers: number;
  totalLikes: number;
  totalVideos: number;
  videos7d: number;
  viral5k: number;
  viral50k: number;
};

export type AccountWithStats = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  followers: number;
  totalLikes: number;
  totalVideos: number;
  lastPostedAt: Date | null;
  lastSyncedAt: Date | null;
  trackingSince: Date;
  app: { id: string; name: string; color: string };
  videos7d: number;
  viral5k: number;
  viral10k: number;
  viral50k: number;
};
