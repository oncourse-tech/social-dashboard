import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/studio/chats/[chatId] — get chat with messages
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
  const chat = await db.studioChat.findUnique({
    where: { id: chatId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  return NextResponse.json(chat);
}

// PATCH /api/studio/chats/[chatId] — update chat fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
  const body = await req.json();

  const allowed = ["title", "status", "slug", "slides", "manifest"] as const;
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  const chat = await db.studioChat.update({
    where: { id: chatId },
    data,
  });

  return NextResponse.json(chat);
}

// DELETE /api/studio/chats/[chatId] — delete chat + messages (cascade)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
  await db.studioChat.delete({ where: { id: chatId } });
  return new NextResponse(null, { status: 204 });
}
