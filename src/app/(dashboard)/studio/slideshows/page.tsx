"use client";

import { useState, useCallback, useRef } from "react";
import { ChatPanel, type SlideUrlData } from "@/components/studio/chat-panel";
import { PreviewPanel } from "@/components/studio/preview-panel";
import { SlideLightbox } from "@/components/studio/slide-lightbox";
import { EditTextsDialog } from "@/components/studio/edit-texts-dialog";
import { FeedbackDialog } from "@/components/studio/feedback-dialog";
import { useSlidePolling } from "@/components/studio/use-slide-polling";
import JSZip from "jszip";

export default function SlideshowStudioPage() {
  const slideState = useSlidePolling();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editTextsOpen, setEditTextsOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
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
      // Add cache-busting timestamp to URLs
      const busted = {
        ...data,
        slides: data.slides.map((s) => ({
          ...s,
          url: s.url ? `${s.url}?t=${Date.now()}` : null,
        })),
      };
      slideState.setSlidesFromUrls(busted);
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

  return (
    <div className="-m-4 md:-m-6 flex h-[calc(100vh-3.5rem)] md:h-screen">
      <div className="w-[55%] min-w-[360px] border-r border-border/50">
        <ChatPanel
          onSlugDetected={handleSlugDetected}
          onSlideUrlsDetected={handleSlideUrlsDetected}
          appendRef={appendRef}
        />
      </div>

      <div className="w-[45%] min-w-[300px]">
        <PreviewPanel
          state={slideState}
          onSlideClick={setLightboxIndex}
          onRegenerate={() => setRegenOpen(true)}
          onEditTexts={() => setEditTextsOpen(true)}
          onDownload={handleDownload}
        />
      </div>

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
