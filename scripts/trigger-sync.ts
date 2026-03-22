import { PrismaClient } from "@prisma/client";
import { ApifyClient } from "apify-client";
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.trackedAccount.findMany({
    select: { username: true },
  });
  console.log(`Found ${accounts.length} accounts to sync`);

  const usernames = accounts.map((a) => a.username);
  console.log(`First 10: ${usernames.slice(0, 10).join(", ")}...`);

  // Create sync log
  const syncLog = await prisma.syncLog.create({
    data: { status: "RUNNING" },
  });
  console.log(`SyncLog created: ${syncLog.id}`);

  // Trigger Apify
  const token = process.env.APIFY_API_KEY;
  if (!token) throw new Error("APIFY_API_KEY not set");

  const client = new ApifyClient({ token });
  const actorId = process.env.APIFY_ACTOR_ID || "clockworks/tiktok-profile-scraper";
  const webhookUrl = `${process.env.NEXTAUTH_URL || "https://social-dashboard-oncourse.vercel.app"}/api/sync/webhook`;

  console.log(`Actor: ${actorId}`);
  console.log(`Webhook: ${webhookUrl}`);
  console.log(`Profiles: ${usernames.length}`);
  console.log("Starting Apify run...");

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

  console.log(`Apify run started!`);
  console.log(`  Run ID: ${run.id}`);
  console.log(`  Status: ${run.status}`);
  console.log(`  Dataset ID: ${run.defaultDatasetId}`);
  console.log(`\nThe webhook will process results when the run completes.`);
  console.log(`Monitor at: https://console.apify.com/actors/runs/${run.id}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e.message);
  prisma.$disconnect();
  process.exit(1);
});
