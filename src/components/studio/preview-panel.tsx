"use client";

import { Loader2, RotateCw, Pencil, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SlideState, SlideshowState } from "./use-slide-polling";

interface PreviewPanelProps {
  state: SlideshowState;
  onSlideClick: (index: number) => void;
  onRegenerate: () => void;
  onEditTexts: () => void;
  onDownload: () => void;
}

function SlideSlot({ slide, onClick }: { slide: SlideState; onClick: () => void }) {
  if (slide.status === "ready" && slide.url) {
    return (
      <button
        onClick={onClick}
        className="group relative aspect-[2/3] w-full overflow-hidden rounded-md border border-border bg-muted transition-all hover:ring-2 hover:ring-primary"
      >
        <img src={slide.url} alt={`Slide ${slide.index}`} className="h-full w-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
          <span className="text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            {slide.index}
          </span>
        </div>
      </button>
    );
  }

  if (slide.status === "generating") {
    return (
      <div className="flex aspect-[2/3] w-full items-center justify-center rounded-md border border-border bg-muted">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex aspect-[2/3] w-full items-center justify-center rounded-md border border-dashed border-border bg-muted/50">
      <span className="text-xs text-muted-foreground">{slide.index}</span>
    </div>
  );
}

export function PreviewPanel({ state, onSlideClick, onRegenerate, onEditTexts, onDownload }: PreviewPanelProps) {
  const allReady = state.slides.every((s) => s.status === "ready");
  const hasAnySlide = state.slides.some((s) => s.status === "ready");

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center border-b border-border px-4">
        <h2 className="text-sm font-semibold">Preview</h2>
        {state.status === "generating" && (
          <span className="ml-2 text-xs text-muted-foreground">Generating...</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          {state.slides.map((slide) => (
            <SlideSlot key={slide.index} slide={slide} onClick={() => onSlideClick(slide.index)} />
          ))}
        </div>
        {state.error && <p className="mt-3 text-xs text-destructive">{state.error}</p>}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-border p-3">
        <Button variant="outline" size="sm" onClick={onRegenerate} disabled={!hasAnySlide}>
          <RotateCw className="mr-1.5 size-3.5" /> Regenerate
        </Button>
        <Button variant="outline" size="sm" onClick={onEditTexts} disabled={!state.manifest}>
          <Pencil className="mr-1.5 size-3.5" /> Edit Texts
        </Button>
        <Button variant="outline" size="sm" onClick={onDownload} disabled={!allReady}>
          <Download className="mr-1.5 size-3.5" /> Download
        </Button>
      </div>
    </div>
  );
}
