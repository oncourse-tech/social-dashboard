const APIFY_BASE = "https://api.apify.com/v2";

function getToken() {
  const token = process.env.APIFY_API_KEY;
  if (!token) throw new Error("APIFY_API_KEY is not set");
  return token;
}

function getActorId() {
  const actorId = process.env.APIFY_ACTOR_ID;
  if (!actorId) throw new Error("APIFY_ACTOR_ID is not set");
  return actorId;
}

export async function triggerTikTokScraper(usernames: string[]) {
  const token = getToken();
  const actorId = getActorId();
  const webhookUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/sync/webhook`;

  const res = await fetch(
    `${APIFY_BASE}/acts/${actorId}/runs?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profiles: usernames,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify trigger failed (${res.status}): ${text}`);
  }

  const run = await res.json();

  // Register webhook for this run
  await fetch(`${APIFY_BASE}/webhooks?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventTypes: ["ACTOR.RUN.SUCCEEDED"],
      condition: { actorRunId: run.data.id },
      requestUrl: webhookUrl,
    }),
  });

  return { id: run.data.id, defaultDatasetId: run.data.defaultDatasetId };
}

export async function getDatasetItems(datasetId: string) {
  const token = getToken();
  const res = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&format=json`
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify dataset fetch failed (${res.status}): ${text}`);
  }

  return res.json();
}
