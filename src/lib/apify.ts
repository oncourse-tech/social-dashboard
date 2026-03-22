import { ApifyClient } from "apify-client";

export function getApifyClient() {
  const token = process.env.APIFY_API_KEY;
  if (!token) throw new Error("APIFY_API_KEY is not set");
  return new ApifyClient({ token });
}

export async function triggerTikTokScraper(usernames: string[]) {
  const client = getApifyClient();
  // Use the profile scraper actor (or custom actor ID from env)
  const actorId =
    process.env.APIFY_ACTOR_ID || "clockworks/tiktok-profile-scraper";

  const webhookUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/sync/webhook`;

  const run = await client.actor(actorId).call(
    {
      profiles: usernames,
      resultsPerPage: 100,
    },
    {
      webhooks: [
        {
          eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED"],
          requestUrl: webhookUrl,
        },
      ],
    }
  );

  return run;
}

export async function getDatasetItems(datasetId: string) {
  const client = getApifyClient();
  const { items } = await client.dataset(datasetId).listItems();
  return items;
}
