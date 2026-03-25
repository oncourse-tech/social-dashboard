"use client";

import { useState, useCallback, useRef } from "react";
import { ChatPanel } from "@/components/studio/chat-panel";
import { PreviewPanel } from "@/components/studio/preview-panel";
import { SlideLightbox } from "@/components/studio/slide-lightbox";
import { EditTextsDialog } from "@/components/studio/edit-texts-dialog";
import { useSlidePolling } from "@/components/studio/use-slide-polling";
import JSZip from "jszip";

export default function SlideshowStudioPage() {
  const slideState = useSlidePolling();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editTextsOpen, setEditTextsOpen] = useState(false);
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

  const handleRegenerate = useCallback(() => {
    sendChatMessage("Regenerate all 6 slides for the current slideshow with the same concept and scene.");
    slideState.reset();
  }, [sendChatMessage, slideState.reset]);

  const handleEditTextsSubmit = useCallback(
    (texts: string[]) => {
      setEditTextsOpen(false);
      const textsFormatted = texts
        .map((t, i) => `Slide ${i + 1}: "${t}"`)
        .join("\n");
      sendChatMessage(
        `Regenerate the slideshow with these updated texts:\n${textsFormatted}`
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
    (slideState.manifest as { texts?: string[] })?.texts ??
    Array(6).fill("");

  return (
    <div className="flex h-[calc(100vh-3.5rem)] md:h-screen">
      <div className="w-1/2 min-w-[320px]">
        <ChatPanel onSlugDetected={handleSlugDetected} appendRef={appendRef} />
      </div>

      <div className="w-1/2 min-w-[320px]">
        <PreviewPanel
          state={slideState}
          onSlideClick={setLightboxIndex}
          onRegenerate={handleRegenerate}
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

      <EditTextsDialog
        open={editTextsOpen}
        onOpenChange={setEditTextsOpen}
        initialTexts={currentTexts}
        onSubmit={handleEditTextsSubmit}
      />
    </div>
  );
}
