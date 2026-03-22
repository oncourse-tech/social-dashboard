import { PrismaClient } from "@prisma/client";
import { ApifyClient } from "apify-client";
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  // Get unsynced accounts
  const accounts = await prisma.trackedAccount.findMany({
    where: { lastSyncedAt: null },
    select: { username: true },
  });

  if (accounts.length === 0) {
    console.log("All accounts are already synced!");
    await prisma.$disconnect();
    return;
  }

  const usernames = accounts.map((a) => a.username);
  console.log(`Found ${usernames.length} unsynced accounts`);
  console.log(`Accounts: ${usernames.join(", ")}`);

  const syncLog = await prisma.syncLog.create({
    data: { status: "RUNNING" },
  });
  console.log(`SyncLog: ${syncLog.id}`);

  const token = process.env.APIFY_API_KEY;
  if (!token) throw new Error("APIFY_API_KEY not set");

  const client = new ApifyClient({ token });
  const actorId = process.env.APIFY_ACTOR_ID || "clockworks/tiktok-profile-scraper";
  const webhookUrl = `${process.env.NEXTAUTH_URL || "https://social-dashboard-oncourse.vercel.app"}/api/sync/webhook`;

  console.log(`\nStarting Apify run for ${usernames.length} profiles...`);

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

  console.log(`\nApify run started!`);
  console.log(`  Run ID: ${run.id}`);
  console.log(`  Status: ${run.status}`);
  console.log(`  Dataset ID: ${run.defaultDatasetId}`);
  console.log(`\nTo process results manually:`);
  console.log(`  npx tsx scripts/process-dataset.ts ${run.defaultDatasetId}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e.message);
  prisma.$disconnect();
  process.exit(1);
});
