"use client";

import { useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SlideState } from "./use-slide-polling";

interface SlideLightboxProps {
  slides: SlideState[];
  activeIndex: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function SlideLightbox({ slides, activeIndex, onClose, onNavigate }: SlideLightboxProps) {
  const readySlides = slides.filter((s) => s.status === "ready" && s.url);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && activeIndex !== null) {
        const prev = readySlides.findIndex((s) => s.index === activeIndex) - 1;
        if (prev >= 0) onNavigate(readySlides[prev].index);
      }
      if (e.key === "ArrowRight" && activeIndex !== null) {
        const next = readySlides.findIndex((s) => s.index === activeIndex) + 1;
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

  const currentReadyIdx = readySlides.findIndex((s) => s.index === activeIndex);
  const hasPrev = currentReadyIdx > 0;
  const hasNext = currentReadyIdx < readySlides.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <img src={current.url} alt={`Slide ${activeIndex}`} className="max-h-[85vh] rounded-lg object-contain" />
        <Button variant="ghost" size="icon" className="absolute -right-12 top-0 text-white hover:bg-white/20" onClick={onClose}>
          <X className="size-5" />
        </Button>
        {hasPrev && (
          <Button variant="ghost" size="icon" className="absolute -left-12 top-1/2 -translate-y-1/2 text-white hover:bg-white/20" onClick={() => onNavigate(readySlides[currentReadyIdx - 1].index)}>
            <ChevronLeft className="size-6" />
          </Button>
        )}
        {hasNext && (
          <Button variant="ghost" size="icon" className="absolute -right-12 top-1/2 -translate-y-1/2 text-white hover:bg-white/20" onClick={() => onNavigate(readySlides[currentReadyIdx + 1].index)}>
            <ChevronRight className="size-6" />
          </Button>
        )}
        <div className="mt-2 text-center text-sm text-white/70">Slide {activeIndex} of 6</div>
      </div>
    </div>
  );
}
