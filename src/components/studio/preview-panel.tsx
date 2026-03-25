"use client";

import { Loader2, RotateCw, Pencil, Download, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SlideState, SlideshowState } from "./use-slide-polling";

interface PreviewPanelProps {
  state: SlideshowState;
  onSlideClick: (index: number) => void;
  onRegenerate: () => void;
  onEditTexts: () => void;
  onDownload: () => void;
}

function SlideSlot({
  slide,
  onClick,
}: {
  slide: SlideState;
  onClick: () => void;
}) {
  if (slide.status === "ready" && slide.url) {
    return (
      <button
        onClick={onClick}
        className="group relative aspect-[2/3] w-full overflow-hidden rounded-lg ring-1 ring-white/[0.06] transition-all hover:ring-2 hover:ring-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/5"
      >
        <img
          src={slide.url}
          alt={`Slide ${slide.index}`}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/80 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
          {slide.index}/6
        </span>
      </button>
    );
  }

  if (slide.status === "generating") {
    return (
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg ring-1 ring-white/[0.06] bg-muted/50">
        {/* Shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-[shimmer_2s_ease-in-out_infinite]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <Loader2 className="size-4 animate-spin text-indigo-400/60" />
          <span className="text-[10px] font-medium text-muted-foreground">
            Generating...
          </span>
        </div>
      </div>
    );
  }

  // pending
  return (
    <div className="flex aspect-[2/3] w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/[0.06] bg-muted/20">
      <ImageIcon className="size-4 text-muted-foreground/30" />
      <span className="text-[10px] text-muted-foreground/40">{slide.index}</span>
    </div>
  );
}

export function PreviewPanel({
  state,
  onSlideClick,
  onRegenerate,
  onEditTexts,
  onDownload,
}: PreviewPanelProps) {
  const allReady = state.slides.every((s) => s.status === "ready");
  const hasAnySlide = state.slides.some((s) => s.status === "ready");
  const isGenerating = state.status === "generating";
  const readyCount = state.slides.filter((s) => s.status === "ready").length;

  return (
    <div className="flex h-full flex-col bg-background/50">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/50 px-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Preview</h2>
          {isGenerating && (
            <div className="flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2 py-0.5">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-50" />
                <span className="relative inline-flex size-1.5 rounded-full bg-indigo-400" />
              </span>
              <span className="text-[10px] font-medium text-indigo-400">
                {readyCount}/6
              </span>
            </div>
          )}
          {allReady && (
            <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-medium text-emerald-400">
                Complete
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {state.slides.map((slide) => (
            <SlideSlot
              key={slide.index}
              slide={slide}
              onClick={() => onSlideClick(slide.index)}
            />
          ))}
        </div>

        {state.error && (
          <div className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 ring-1 ring-destructive/20">
            <p className="text-xs text-destructive">{state.error}</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex shrink-0 flex-wrap gap-2 border-t border-border/50 p-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onRegenerate}
          disabled={!hasAnySlide}
          className="h-8 gap-1.5 text-xs border-border/60 hover:bg-muted/50"
        >
          <RotateCw className="size-3" />
          Regenerate
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onEditTexts}
          disabled={!hasAnySlide}
          className="h-8 gap-1.5 text-xs border-border/60 hover:bg-muted/50"
        >
          <Pencil className="size-3" />
          Edit Texts
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onDownload}
          disabled={!allReady}
          className="h-8 gap-1.5 text-xs border-border/60 hover:bg-indigo-500/10 hover:text-indigo-400 hover:border-indigo-500/30"
        >
          <Download className="size-3" />
          Download
        </Button>
      </div>
    </div>
  );
}
