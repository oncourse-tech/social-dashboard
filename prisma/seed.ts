import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// USMLE competitor apps with brand colors
const APPS = [
  { name: "Aistote", color: "#3b82f6", url: "https://aistote.com" },
  { name: "AMBOSS", color: "#10b981", url: "https://amboss.com" },
  { name: "UWorld", color: "#f59e0b", url: "https://uworld.com" },
  { name: "Lecturio", color: "#8b5cf6", url: "https://lecturio.com" },
  { name: "Osmosis", color: "#06b6d4", url: "https://osmosis.org" },
  { name: "Sketchy", color: "#ef4444", url: "https://sketchy.com" },
  { name: "Anki", color: "#ec4899", url: "https://apps.ankiweb.net" },
  { name: "Pathoma", color: "#f97316", url: "https://pathoma.com" },
  { name: "Boards & Beyond", color: "#14b8a6", url: "https://boardsbeyond.com" },
  { name: "First Aid USMLE", color: "#6366f1", url: "https://firstaidteam.com" },
  { name: "Clerk App", color: "#a855f7", url: "https://clerk.app" },
  { name: "General USMLE", color: "#78716c", url: null },
] as const;

// Accounts grouped by app — deduplicated across searches
// Each account only appears once under its primary app affiliation
const ACCOUNTS: Record<string, string[]> = {
  "Aistote": [
    "studywithadele7",
    "niacanstudy",
    "brain_hack1ng",
    "aceofstudies",
    "studywithlucyy3",
    "ai.ismyfavthing",
    "bmh_ugc",
    "missfamous123",
    "whynot6121",
  ],
  "AMBOSS": [
    "curlygirlmed",      // #ambosspartner — official partner
    "doctordaanish",     // self-described AMBOSS user since 2020
    "usmletrainings_",   // USMLE coaching, 5 AMBOSS videos
    "carlysnytte",       // AMBOSS Study Plans feature
    "jbrennerfisics",    // multiple AMBOSS-tagged Step 1/2 videos
    "usmleremedy",       // USMLE-focused, reviewing AMBOSS
    "bykalijean",        // med school life, AMBOSS in tech stack
    "samicek_4",         // Step 2 content, 24K plays
    "therealndmd",       // med student, AMBOSS practice tests
  ],
  "UWorld": [
    "natatis098",        // 68.5K plays, 4K likes
    "omar.baabbad",      // IMG sharing USMLE Step 1 blueprint
    "theorganizedmedic", // 28K plays — appears in UWorld/Lecturio/FA
    "sabineobagi",       // 1.5K likes
    "_layson",           // 1.4K likes
    "lainieem_",         // UWorld + Pathoma mentions
    "brownbeautymd",     // UWorld + Pathoma mentions
    "brookepantaleo",
    "alimentaryschool",
    "guia.usmle",
    "medx.drsamuel",
    "medstudentsuccess",
    "kaiya.nicole_",
    "img_to_residency",
    "simplyyynancy",
    "idaleng",
    "awoman.in.stem",
  ],
  "Lecturio": [
    "lecturio_medical_videos", // official account
    "lecturio_nursing",        // official nursing account
    "usmle.step.12ck3",
    "mariareyna.med",          // 48K plays
    "jose.rivera.m.d",
    "dr.vinti",
    "pavel.pichardo.md",
  ],
  "Osmosis": [
    "learnbyosmosis",          // official account
    "jodietam",                // study with me using Osmosis AI
    "latina_rn_in_training",   // nursing student, Osmosis case studies
    "sincerelykimanna",        // Osmosis is underrated
  ],
  "Sketchy": [
    "sketchylearning",         // official Sketchy account
    "michaelcogbonna",
    "heyyush",
    "lorieinscrubs",
    "lifewithminah",
    "bineapple_jen",
    "studytokdr.v",
  ],
  "Anki": [
    "ankingmed",               // The AnKing — most popular Anki med deck
    "drumear3180",
    "doseofscott",
    "usmle.pulse",
    "dr.tabathapaulet",
    "lalueur1",
    "generations.md",
    "studentdoctordami",
    "usmle.study.buddy",
  ],
  "Pathoma": [
    "medicine.and.miles",      // 7.3K likes
    "medschoolbro",
    "dr.yahya.hassan",
    "hyguruprepusmle",
    "suturinginseattle",
    "kgoswami14",              // also appears in AMBOSS results
    "graham.lail5",
    "themedstudentnextdoor",
    "doctor_aqibzaman",
    "docforbabies",
    "medbutnobread",
  ],
  "Boards & Beyond": [
    "boardsbeyond",            // official account
    "jasonryan356",            // Dr. Jason Ryan, founder
    "brasine",
    "amandaalmostmd",
    "bankymedicine",
    "kylaanise__",
    "studentdoclaw",
  ],
  "First Aid USMLE": [
    "doctorbianchi",           // 27.3K likes
    "tawfi2_",                 // 12.2K likes
    "studywithericas",
    "madzzz1212",
    "medschoolali",
    "doctor.caitie",
    "vishaa.b",
    "usmle",                   // official USMLE account
    "whitecoatsandcorgis",     // sponsored First Aid Forward
    "dr.sandrakamel",
    "study.usmle.me",
    "nadia_mdloading",
    "realskintalk",
    "byhstbsr1",
  ],
  "Clerk App": [
    "clerk.app",               // own USMLE study app
    "diagnosus",               // medical education app/platform
  ],
  "General USMLE": [
    "medicinewithkee",         // independent creator, reviews resources
    "soakingmedical",          // 280 scorer, independent
    "pink.scrubs",             // independent med student, 4.7K likes
    "aloharutha",              // 6-week Step 1 pass guide
    "sophiastudiesmed",        // app promoter content
    "drrachelturner",          // independent doctor
    "medstudent_ri",           // independent med student
    "ibukun.ms4",              // independent MS4
    "onceuponadoctor",         // general med education creator
  ],
};

async function main() {
  // 1. Seed default settings
  await prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
  console.log("Seeded default settings");

  // 2. Upsert all apps
  const appMap = new Map<string, string>(); // name → id

  for (const app of APPS) {
    const record = await prisma.app.upsert({
      where: { name: app.name },
      update: { color: app.color, url: app.url },
      create: { name: app.name, color: app.color, url: app.url },
    });
    appMap.set(app.name, record.id);
    console.log(`  App: ${app.name} (${record.id})`);
  }
  console.log(`Seeded ${APPS.length} apps`);

  // 3. Upsert all tracked accounts
  let totalAccounts = 0;
  let newAccounts = 0;

  for (const [appName, usernames] of Object.entries(ACCOUNTS)) {
    const appId = appMap.get(appName);
    if (!appId) {
      console.warn(`  Skipping ${appName} — app not found`);
      continue;
    }

    for (const username of usernames) {
      if (!username) continue;
      totalAccounts++;

      try {
        const existing = await prisma.trackedAccount.findUnique({
          where: { username },
        });

        if (existing) {
          // Update app assignment if different
          if (existing.appId !== appId) {
            await prisma.trackedAccount.update({
              where: { username },
              data: { appId },
            });
            console.log(`  Updated @${username} → ${appName}`);
          } else {
            console.log(`  Exists: @${username} (${appName})`);
          }
        } else {
          await prisma.trackedAccount.create({
            data: {
              username,
              appId,
            },
          });
          newAccounts++;
          console.log(`  Created: @${username} → ${appName}`);
        }
      } catch (err: any) {
        // Handle race conditions or unique constraint violations
        if (err.code === "P2002") {
          console.log(`  Duplicate: @${username} (already exists)`);
        } else {
          console.error(`  Error for @${username}:`, err.message);
        }
      }
    }
  }

  console.log(`\nDone! ${totalAccounts} accounts processed, ${newAccounts} new.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
