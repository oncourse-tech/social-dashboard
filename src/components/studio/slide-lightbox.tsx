"use client";

import { useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { SlideState } from "./use-slide-polling";

interface SlideLightboxProps {
  slides: SlideState[];
  activeIndex: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function SlideLightbox({
  slides,
  activeIndex,
  onClose,
  onNavigate,
}: SlideLightboxProps) {
  const readySlides = slides.filter((s) => s.status === "ready" && s.url);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && activeIndex !== null) {
        const prev =
          readySlides.findIndex((s) => s.index === activeIndex) - 1;
        if (prev >= 0) onNavigate(readySlides[prev].index);
      }
      if (e.key === "ArrowRight" && activeIndex !== null) {
        const next =
          readySlides.findIndex((s) => s.index === activeIndex) + 1;
        if (next < readySlides.length) onNavigate(readySlides[next].index);
      }
    },
    [activeIndex, onClose, onNavigate, readySlides]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (activeIndex === null) return null;
  const current = slides.find((s) => s.index === activeIndex);
  if (!current?.url) return null;

  const currentReadyIdx = readySlides.findIndex(
    (s) => s.index === activeIndex
  );
  const hasPrev = currentReadyIdx > 0;
  const hasNext = currentReadyIdx < readySlides.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute top-3 right-3 md:top-4 md:right-4 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-sm transition-colors hover:bg-white/20"
        onClick={onClose}
      >
        <X className="size-5" />
      </button>

      {/* Nav + Image */}
      <div
        className="relative flex h-full w-full items-center justify-center p-4 md:p-12"
        onClick={(e) => e.stopPropagation()}
      >
        {hasPrev && (
          <button
            className="absolute left-2 md:left-6 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-sm transition-colors hover:bg-white/20"
            onClick={() =>
              onNavigate(readySlides[currentReadyIdx - 1].index)
            }
          >
            <ChevronLeft className="size-5" />
          </button>
        )}

        <img
          src={current.url}
          alt={`Slide ${activeIndex}`}
          className="max-h-full max-w-full rounded-lg object-contain"
          onClick={onClose}
        />

        {hasNext && (
          <button
            className="absolute right-2 md:right-6 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-sm transition-colors hover:bg-white/20"
            onClick={() =>
              onNavigate(readySlides[currentReadyIdx + 1].index)
            }
          >
            <ChevronRight className="size-5" />
          </button>
        )}

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 backdrop-blur-sm">
          <span className="text-xs font-medium text-white/70">
            {activeIndex} / 6
          </span>
        </div>
      </div>
    </div>
  );
}
