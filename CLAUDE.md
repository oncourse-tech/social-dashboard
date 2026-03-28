# Social Dashboard — CLAUDE.md

## Project Overview

Next.js 16 App Router dashboard for TikTok/social content management and AI-powered content creation (Studio).

## Development Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Build (runs prisma generate first)
pnpm lint         # ESLint
```

## Deployment

**Hosting:** Vercel (project: `oncourse/social-dashboard`)

**Deploy to production:**
```bash
vercel --prod
```

**Prisma migrations are NOT run automatically on deploy.** After adding/changing Prisma models:
```bash
# 1. Apply migration locally
npx prisma migrate dev --name <migration-name>

# 2. Apply to production database
npx prisma migrate deploy

# 3. Deploy
vercel --prod
```

If `prisma migrate dev` fails due to drift, use `prisma db push` then create a migration file manually and mark it applied with `prisma migrate resolve --applied <migration-name>`.

## Database

- **Provider:** PostgreSQL on Supabase (ap-northeast-1)
- **ORM:** Prisma (schema at `prisma/schema.prisma`)
- **Client:** Exported as `db` from `src/lib/db.ts`
- **Connection:** Uses connection pooler (port 6543) for `DATABASE_URL`, direct connection (port 5432) for `DIRECT_URL`

## Key Architecture

### Studio (Content Creation)

- `/studio` — Landing page with format cards
- `/studio/slideshows` — Chat list (persistent, DB-backed)
- `/studio/slideshows/[chatId]` — Chat + Preview for slideshow generation
- Chat streams through OpenClaw gateway (remote Mac agent)
- Slides generated on remote Mac, uploaded to Supabase Storage CDN
- Models: `StudioChat`, `StudioMessage`

### Social Analytics

- TikTok account tracking, video analytics, viral detection
- Models: `TrackedAccount`, `Video`, `AccountSnapshot`, `VideoSnapshot`

## Environment Variables

Key vars (see `.env` for full list):
- `DATABASE_URL` / `DIRECT_URL` — Supabase PostgreSQL
- `OPENCLAW_GATEWAY_URL` / `OPENCLAW_GATEWAY_TOKEN` — AI agent gateway
- `OPENCLAW_SSH_HOST` / `OPENCLAW_SSH_USER` / `OPENCLAW_SSH_PRIVATE_KEY` — Remote Mac SSH
- `NEXTAUTH_SECRET` / `NEXTAUTH_URL` — Auth
