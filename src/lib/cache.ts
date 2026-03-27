import { revalidateTag } from "next/cache";

export const CACHE_TAGS = {
  settings: "settings",
  appOptions: "app-options",
  appSummaries: "app-summaries",
  accountSummaries: "account-summaries",
  researchProfiles: "research-profiles",
  videos: "videos",
  sync: "sync",
} as const;

export async function revalidateCacheTags(tags: string[]) {
  await Promise.all([...new Set(tags)].map((tag) => revalidateTag(tag)));
}
