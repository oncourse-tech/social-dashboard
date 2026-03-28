import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/studio/chats — list all chats
export async function GET() {
  const chats = await db.studioChat.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      slug: true,
      slides: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json(chats);
}

// POST /api/studio/chats — create new chat
export async function POST() {
  const chat = await db.studioChat.create({
    data: {},
    select: { id: true },
  });
  return NextResponse.json(chat, { status: 201 });
}
