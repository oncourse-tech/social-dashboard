"use client";

import { useState, useCallback, useRef, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Grid2x2, ArrowLeft } from "lucide-react";
import { ChatPanel, type SlideUrlData } from "@/components/studio/chat-panel";
import { PreviewPanel } from "@/components/studio/preview-panel";
import { SlideLightbox } from "@/components/studio/slide-lightbox";
import { EditTextsDialog } from "@/components/studio/edit-texts-dialog";
import { FeedbackDialog } from "@/components/studio/feedback-dialog";
import { useSlidePolling, type SlideState } from "@/components/studio/use-slide-polling";
import { cn } from "@/lib/utils";
import JSZip from "jszip";

interface ChatData {
  id: string;
  title: string;
  status: string;
  slug: string | null;
  slides: SlideUrlData["slides"] | null;
  manifest: Record<string, unknown> | null;
  messages: Array<{ id: string; role: "user" | "assistant"; content: string }>;
}

export default function SlideshowChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = use(params);
  const router = useRouter();
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/studio/chats/${chatId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Chat not found");
        return res.json();
      })
      .then((data) => setChatData(data))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [chatId]);

  if (loading) {
    return (
      <div className="-m-4 md:-m-6 flex items-center justify-center h-[calc(100vh-3.5rem)] md:h-screen">
        <div className="text-sm text-muted-foreground">Loading chat...</div>
      </div>
    );
  }

  if (error || !chatData) {
    return (
      <div className="-m-4 md:-m-6 flex flex-col items-center justify-center gap-3 h-[calc(100vh-3.5rem)] md:h-screen">
        <p className="text-sm text-destructive">{error || "Chat not found"}</p>
        <button
          onClick={() => router.push("/studio/slideshows")}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Back to chats
        </button>
      </div>
    );
  }

  return <ChatDetailInner chatData={chatData} />;
}

function ChatDetailInner({ chatData }: { chatData: ChatData }) {
  const router = useRouter();
  const initialSlides = chatData.slides?.map((s) => ({
    index: s.index,
    url: s.url,
    status: s.status as SlideState["status"],
  }));

  const slideState = useSlidePolling({
    initialSlug: chatData.slug,
    initialSlides,
    initialManifest: chatData.manifest,
  });

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editTextsOpen, setEditTextsOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "preview">("chat");
  const appendRef = useRef<((message: string) => void) | null>(null);

  const sendChatMessage = useCallback((text: string) => {
    appendRef.current?.(text);
  }, []);

  const handleSlugDetected = useCallback(
    (slug: string) => {
      slideState.startPolling(slug);
      // Persist slug to chat
      fetch(`/api/studio/chats/${chatData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
    },
    [slideState.startPolling, chatData.id]
  );

  const handleSlideUrlsDetected = useCallback(
    (data: SlideUrlData) => {
      const busted = {
        ...data,
        slides: data.slides.map((s) => ({
          ...s,
          url: s.url ? `${s.url}?t=${Date.now()}` : null,
        })),
      };
      slideState.setSlidesFromUrls(busted);
      setMobileTab("preview");

      // Persist slide state to chat
      fetch(`/api/studio/chats/${chatData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: data.slug,
          slides: data.slides,
          status: data.slides.every((s) => s.status === "ready") ? "complete" : "active",
        }),
      });
    },
    [slideState.setSlidesFromUrls, chatData.id]
  );

  const handleRegenerate = useCallback(
    (feedback: string) => {
      setRegenOpen(false);
      const msg = feedback.trim()
        ? `Regenerate the slideshow with this feedback: ${feedback}`
        : "Regenerate all 6 slides for the current slideshow with fresh images.";
      sendChatMessage(msg);
      slideState.reset();
      setMobileTab("chat");
    },
    [sendChatMessage, slideState.reset]
  );

  const handleEditTextsSubmit = useCallback(
    (texts: string[], feedback: string) => {
      setEditTextsOpen(false);
      const textsFormatted = texts
        .map((t, i) => `Slide ${i + 1}: "${t}"`)
        .join("\n");
      const feedbackPart = feedback.trim()
        ? `\n\nAdditional feedback: ${feedback}`
        : "";
      sendChatMessage(
        `Regenerate the slideshow with these updated texts:\n${textsFormatted}${feedbackPart}`
      );
      slideState.reset();
      setMobileTab("chat");
    },
    [sendChatMessage, slideState.reset]
  );

  const handleDownload = useCallback(async () => {
    const readySlides = slideState.slides.filter(
      (s) => s.status === "ready" && s.url
    );
    if (readySlides.length === 0) return;

    const zip = new JSZip();
    await Promise.all(
      readySlides.map(async (slide) => {
        const res = await fetch(slide.url!);
        const blob = await res.blob();
        zip.file(
          `slide_${String(slide.index).padStart(2, "0")}.png`,
          blob
        );
      })
    );

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slideState.slug || "slideshow"}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, [slideState.slides, slideState.slug]);

  const currentTexts =
    (slideState.manifest as { texts?: string[] })?.texts ?? Array(6).fill("");

  const readyCount = slideState.slides.filter(
    (s) => s.status === "ready"
  ).length;

  return (
    <div className="-m-4 md:-m-6 flex flex-col md:flex-row h-[calc(100vh-3.5rem)] md:h-screen">
      {/* Chat panel */}
      <div
        className={cn(
          "md:w-[55%] md:min-w-[360px] md:border-r md:border-border/50",
          "flex-1 min-h-0 md:flex-none",
          mobileTab === "chat" ? "flex flex-col" : "hidden md:flex md:flex-col"
        )}
      >
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border/50 px-3">
          <button
            onClick={() => router.push("/studio/slideshows")}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Chats
          </button>
          <span className="text-xs text-border/80">|</span>
          <span className="text-xs font-medium text-foreground/70 truncate">
            {chatData.title}
          </span>
        </div>
        <ChatPanel
          chatId={chatData.id}
          initialMessages={chatData.messages}
          onSlugDetected={handleSlugDetected}
          onSlideUrlsDetected={handleSlideUrlsDetected}
          appendRef={appendRef}
        />
      </div>

      {/* Preview panel */}
      <div
        className={cn(
          "md:w-[45%] md:min-w-[300px]",
          "flex-1 min-h-0 md:flex-none",
          mobileTab === "preview"
            ? "flex flex-col"
            : "hidden md:flex md:flex-col"
        )}
      >
        <PreviewPanel
          state={slideState}
          onSlideClick={setLightboxIndex}
          onRegenerate={() => setRegenOpen(true)}
          onEditTexts={() => setEditTextsOpen(true)}
          onDownload={handleDownload}
        />
      </div>

      {/* Mobile tab bar */}
      <div className="md:hidden shrink-0 flex border-t border-border/50 bg-background">
        <button
          onClick={() => setMobileTab("chat")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors",
            mobileTab === "chat"
              ? "text-indigo-400 border-t-2 border-indigo-400 -mt-px"
              : "text-muted-foreground"
          )}
        >
          <MessageSquare className="size-4" />
          Chat
        </button>
        <button
          onClick={() => setMobileTab("preview")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors relative",
            mobileTab === "preview"
              ? "text-indigo-400 border-t-2 border-indigo-400 -mt-px"
              : "text-muted-foreground"
          )}
        >
          <Grid2x2 className="size-4" />
          Preview
          {readyCount > 0 && (
            <span className="absolute top-2 right-[calc(50%-28px)] size-4 flex items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white">
              {readyCount}
            </span>
          )}
        </button>
      </div>

      {/* Modals */}
      <SlideLightbox
        slides={slideState.slides}
        activeIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />

      <FeedbackDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        title="Regenerate Slideshow"
        description="Optionally describe what to change. Leave empty to regenerate with the same concept."
        submitLabel="Regenerate"
        onSubmit={handleRegenerate}
      />

      <EditTextsDialog
        open={editTextsOpen}
        onOpenChange={setEditTextsOpen}
        initialTexts={currentTexts}
        onSubmit={handleEditTextsSubmit}
      />
    </div>
  );
}
