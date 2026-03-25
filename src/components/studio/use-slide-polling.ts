"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type SlideStatus = "pending" | "generating" | "ready" | "failed";

export interface SlideState {
  index: number;
  url: string | null;
  status: SlideStatus;
}

export interface SlideshowState {
  slug: string | null;
  status: "idle" | "generating" | "complete" | "error";
  slides: SlideState[];
  manifest: Record<string, unknown> | null;
  error: string | null;
}

const EMPTY_SLIDES: SlideState[] = Array.from({ length: 6 }, (_, i) => ({
  index: i + 1,
  url: null,
  status: "pending" as const,
}));

export function useSlidePolling() {
  const [state, setState] = useState<SlideshowState>({
    slug: null,
    status: "idle",
    slides: EMPTY_SLIDES,
    manifest: null,
    error: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
  }, []);

  const startPolling = useCallback(
    (slug: string) => {
      stopPolling();
      setState({
        slug,
        status: "generating",
        slides: EMPTY_SLIDES.map((s) => ({ ...s, status: "generating" })),
        manifest: null,
        error: null,
      });

      const poll = async () => {
        try {
          const res = await fetch(`/api/studio/slides?slug=${slug}`);
          if (!res.ok) throw new Error("Failed to fetch slides");
          const data = await res.json();
          setState((prev) => ({
            ...prev,
            slides: data.slides,
            manifest: data.manifest,
            status: data.status === "complete" ? "complete" : "generating",
          }));
          if (data.status === "complete") stopPolling();
        } catch (err) {
          setState((prev) => ({ ...prev, error: String(err), status: "error" }));
          stopPolling();
        }
      };

      poll();
      intervalRef.current = setInterval(poll, 5000);
      timeoutRef.current = setTimeout(() => {
        stopPolling();
        setState((prev) => ({
          ...prev,
          status: "error",
          error: "Generation timed out after 10 minutes",
        }));
      }, 10 * 60 * 1000);
    },
    [stopPolling]
  );

  const reset = useCallback(() => {
    stopPolling();
    setState({ slug: null, status: "idle", slides: EMPTY_SLIDES, manifest: null, error: null });
  }, [stopPolling]);

  useEffect(() => stopPolling, [stopPolling]);

  return { ...state, startPolling, stopPolling, reset };
}
