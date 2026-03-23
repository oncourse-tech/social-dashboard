import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

// Accounts with <10% study-related content — these are lifestyle/general creators
// who happened to mention a study app once. Not useful for competitor intel.
const JUNK_ACCOUNTS = [
  "chrisp.md",         // 9% — surgery humor, korean food, lifestyle
  "dr.ems",            // 9% — Taylor Swift, marathon training
  "chanslifeintiktok", // 6% — lifestyle
  "dr.oyenation",      // 6% — lifestyle
  "roferza.med",       // 6% — Chegg promos, general med humor
  "imanetarib.md",     // 5% — ophthalmology lifestyle
  "catiemichi",        // 3% — lifestyle
  "foukardelen",       // 3% — lifestyle
  "noteasilybrokan",   // 3% — lifestyle
  "wallabyeee",        // 3% — lifestyle
  "its.dayank",        // 2% — pregnancy loss, Persian lifestyle
  "itsjessamarie",     // 2% — nursing lifestyle
  "nonitrates",        // 2% — hair, culture content
  "reginaamoyy",       // 1% — lifestyle
  "alehjasso",         // 0% — zero study content
  "bronteremsik",      // 0% — political commentary
  "coley013",          // 0% — general humor
  "karenttshernandez", // 0% — lifestyle
  "kianhabashi",       // 0% — ortho bro humor
  "mikiraiofficial",   // 0% — nurse lifestyle, cats, BTS
  "onceuponadoctor",   // 0% — hair products, general doctor vibes
  "thedoctorpeach",    // 0% — lifestyle
];

async function main() {
  console.log(`Removing ${JUNK_ACCOUNTS.length} junk accounts and their videos...\n`);

  let totalVideosDeleted = 0;
  let totalSnapshotsDeleted = 0;

  for (const username of JUNK_ACCOUNTS) {
    const account = await prisma.trackedAccount.findUnique({
      where: { username },
      include: { _count: { select: { videos: true, snapshots: true } } },
    });

    if (!account) {
      console.log(`  Skip @${username} — not found`);
      continue;
    }

    // Delete video snapshots first (FK constraint)
    const videoSnapshots = await prisma.videoSnapshot.deleteMany({
      where: { video: { accountId: account.id } },
    });

    // Delete videos
    const videos = await prisma.video.deleteMany({
      where: { accountId: account.id },
    });

    // Delete account snapshots
    const accountSnapshots = await prisma.accountSnapshot.deleteMany({
      where: { accountId: account.id },
    });

    // Delete account
    await prisma.trackedAccount.delete({
      where: { id: account.id },
    });

    totalVideosDeleted += videos.count;
    totalSnapshotsDeleted += videoSnapshots.count + accountSnapshots.count;
    console.log(`  Deleted @${username}: ${videos.count} videos, ${videoSnapshots.count + accountSnapshots.count} snapshots`);
  }

  // Final count
  const remainingAccounts = await prisma.trackedAccount.count();
  const remainingVideos = await prisma.video.count();

  console.log(`\n=== CLEANUP COMPLETE ===`);
  console.log(`Removed: ${JUNK_ACCOUNTS.length} accounts, ${totalVideosDeleted} videos, ${totalSnapshotsDeleted} snapshots`);
  console.log(`Remaining: ${remainingAccounts} accounts, ${remainingVideos} videos`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e);
  prisma.$disconnect();
  process.exit(1);
});
