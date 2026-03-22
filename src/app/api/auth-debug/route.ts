import { NextResponse } from "next/server";

export async function GET() {
  const teamPassword = process.env.TEAM_PASSWORD;
  const hasTeamPassword = !!teamPassword;
  const fallback = "oncourse2026";
  const effective = teamPassword || fallback;

  return NextResponse.json({
    hasTeamPasswordEnv: hasTeamPassword,
    effectivePasswordLength: effective.length,
    effectivePasswordFirst3: effective.substring(0, 3),
    effectivePasswordLast3: effective.substring(effective.length - 3),
    matchesOncourse2026: effective === "oncourse2026",
  });
}
