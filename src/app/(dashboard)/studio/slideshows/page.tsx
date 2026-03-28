"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, Trash2, Loader2, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ChatSummary {
  id: string;
  title: string;
  status: string;
  slug: string | null;
  slides: Array<{ index: number; url: string | null; status: string }> | null;
  createdAt: string;
  updatedAt: string;
}

export default function SlideshowsListPage() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/studio/chats")
      .then((res) => res.json())
      .then(setChats)
      .finally(() => setLoading(false));
  }, []);

  const createChat = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/studio/chats", { method: "POST" });
      const { id } = await res.json();
      router.push(`/studio/slideshows/${id}`);
    } finally {
      setCreating(false);
    }
  };

  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    await fetch(`/api/studio/chats/${chatId}`, { method: "DELETE" });
  };

  const getStatusIcon = (chat: ChatSummary) => {
    if (chat.status === "complete") {
      return <CheckCircle2 className="size-3.5 text-emerald-400" />;
    }
    if (chat.status === "active" && chat.slug) {
      return <Loader2 className="size-3.5 animate-spin text-indigo-400" />;
    }
    return <Clock className="size-3.5 text-muted-foreground/40" />;
  };

  const getPreviewThumbnail = (chat: ChatSummary) => {
    const readySlide = chat.slides?.find((s) => s.status === "ready" && s.url);
    return readySlide?.url ?? null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Slideshows</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your slideshow generation chats
          </p>
        </div>
        <button
          onClick={createChat}
          disabled={creating}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all",
            "bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm shadow-indigo-500/25",
            creating && "opacity-50 cursor-not-allowed"
          )}
        >
          {creating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          New Slideshow
        </button>
      </div>

      {chats.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 ring-1 ring-indigo-500/10">
            <Sparkles className="size-5 text-indigo-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground/80">No slideshows yet</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-[280px]">
              Create your first slideshow to get started
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => {
            const thumb = getPreviewThumbnail(chat);

            return (
              <button
                key={chat.id}
                onClick={() => router.push(`/studio/slideshows/${chat.id}`)}
                className="group w-full flex items-center gap-3 rounded-xl border border-border/60 p-3 transition-all hover:border-border hover:bg-muted/30 text-left"
              >
                {/* Thumbnail or placeholder */}
                <div className="size-12 shrink-0 rounded-lg overflow-hidden bg-muted/50 ring-1 ring-white/[0.06]">
                  {thumb ? (
                    <img src={thumb} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="size-full flex items-center justify-center">
                      <Sparkles className="size-4 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(chat)}
                    <span className="text-sm font-medium truncate">
                      {chat.title}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(chat.updatedAt), { addSuffix: true })}
                  </p>
                </div>

                {/* Delete */}
                <button
                  onClick={(e) => deleteChat(chat.id, e)}
                  className="shrink-0 p-1.5 rounded-md text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
