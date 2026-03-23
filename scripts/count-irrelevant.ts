import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

const STUDY_KEYWORDS = [
  "usmle", "step 1", "step 2", "step1", "step2", "mcat", "anki", "amboss",
  "uworld", "sketchy", "pathoma", "boards and beyond", "first aid", "lecturio",
  "osmosis", "aistote", "study", "flashcard", "qbank", "med school", "medschool",
  "pharm", "anatomy", "physiology", "biochem", "micro", "pathology", "pharmacology",
  "medstudent", "medicalstudent", "doctor", "medicine", "clinical", "residency",
  "board", "exam", "premed", "nursing", "nurse", "surgery", "surgeon", "hospital",
  "diagnosis", "symptom", "treatment", "patient",
];

async function main() {
  const videos = await prisma.video.findMany({
    select: { id: true, description: true, hashtags: true, views: true },
  });

  let relevant = 0;
  let irrelevant = 0;
  const irrelevantIds: string[] = [];

  for (const v of videos) {
    const text = ((v.description || "") + " " + v.hashtags.join(" ")).toLowerCase();
    if (STUDY_KEYWORDS.some((kw) => text.includes(kw))) {
      relevant++;
    } else {
      irrelevant++;
      irrelevantIds.push(v.id);
    }
  }

  console.log("Total videos:", videos.length);
  console.log("Relevant:", relevant, `(${Math.round((relevant / videos.length) * 100)}%)`);
  console.log("Irrelevant:", irrelevant, `(${Math.round((irrelevant / videos.length) * 100)}%)`);

  if (process.argv.includes("--delete")) {
    console.log("\nDeleting irrelevant videos...");
    // Delete snapshots first
    const snapshots = await prisma.videoSnapshot.deleteMany({
      where: { videoId: { in: irrelevantIds } },
    });
    const deleted = await prisma.video.deleteMany({
      where: { id: { in: irrelevantIds } },
    });
    console.log(`Deleted ${deleted.count} videos and ${snapshots.count} snapshots`);
    const remaining = await prisma.video.count();
    console.log(`Remaining: ${remaining} videos`);
  } else {
    console.log("\nRun with --delete to remove irrelevant videos");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
