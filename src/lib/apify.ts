import { ApifyClient } from "apify-client";

export function getApifyClient() {
  const token = process.env.APIFY_API_KEY;
  if (!token) throw new Error("APIFY_API_KEY is not set");
  return new ApifyClient({ token });
}

export async function triggerTikTokScraper(usernames: string[]) {
  const client = getApifyClient();
  const actorId = process.env.APIFY_ACTOR_ID;
  if (!actorId) throw new Error("APIFY_ACTOR_ID is not set");

  const webhookUrl = `${process.env.NEXTAUTH_URL}/api/sync/webhook`;

  const run = await client.actor(actorId).call(
    {
      profiles: usernames,
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
