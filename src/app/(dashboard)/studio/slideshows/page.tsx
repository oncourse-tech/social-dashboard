"use client";

import { useState, useCallback, useRef } from "react";
import { MessageSquare, Grid2x2 } from "lucide-react";
import { ChatPanel, type SlideUrlData } from "@/components/studio/chat-panel";
import { PreviewPanel } from "@/components/studio/preview-panel";
import { SlideLightbox } from "@/components/studio/slide-lightbox";
import { EditTextsDialog } from "@/components/studio/edit-texts-dialog";
import { FeedbackDialog } from "@/components/studio/feedback-dialog";
import { useSlidePolling } from "@/components/studio/use-slide-polling";
import { cn } from "@/lib/utils";
import JSZip from "jszip";

export default function SlideshowStudioPage() {
  const slideState = useSlidePolling();
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
    },
    [slideState.startPolling]
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
      // Auto-switch to preview on mobile when slides arrive
      setMobileTab("preview");
    },
    [slideState.setSlidesFromUrls]
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
      {/* Desktop: side-by-side */}
      {/* Mobile: tabbed view */}

      {/* Chat panel */}
      <div
        className={cn(
          "md:w-[55%] md:min-w-[360px] md:border-r md:border-border/50",
          "flex-1 md:flex-none",
          mobileTab === "chat" ? "flex flex-col" : "hidden md:flex md:flex-col"
        )}
      >
        <ChatPanel
          onSlugDetected={handleSlugDetected}
          onSlideUrlsDetected={handleSlideUrlsDetected}
          appendRef={appendRef}
        />
      </div>

      {/* Preview panel */}
      <div
        className={cn(
          "md:w-[45%] md:min-w-[300px]",
          "flex-1 md:flex-none",
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
