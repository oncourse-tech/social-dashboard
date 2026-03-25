"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useEffect, useRef } from "react";
import { ArrowUp, Sparkles, Bot, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";

const transport = new DefaultChatTransport({
  api: "/api/studio/chat",
});

export interface SlideUrlData {
  slug: string;
  slides: Array<{ index: number; url: string | null; status: string }>;
}

interface ChatPanelProps {
  onSlugDetected: (slug: string) => void;
  onSlideUrlsDetected?: (data: SlideUrlData) => void;
  appendRef?: React.MutableRefObject<((message: string) => void) | null>;
}

const MANIFEST_RE = /MANIFEST:.*\/posts\/photo\/([^/]+)\/manifest\.json/;
const SLUG_RE = /(?:generating|rendering).*?(?:slug|concept)[:\s]+["']?([a-z0-9-]+)/i;
const SLIDE_URLS_RE = /```SLIDE_URLS\s*\n([\s\S]*?)```/;

export function ChatPanel({ onSlugDetected, onSlideUrlsDetected, appendRef }: ChatPanelProps) {
  const { messages, sendMessage, status } = useChat({ transport });

  const [input, setInput] = useState("");
  const [progressPhase, setProgressPhase] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const detectedSlugs = useRef<Set<string>>(new Set());

  const isStreaming = status === "streaming";
  const isSubmitted = status === "submitted";
  const isLoading = isStreaming || isSubmitted;

  useEffect(() => {
    if (appendRef) {
      appendRef.current = (text: string) => {
        sendMessage({ text });
      };
    }
  }, [sendMessage, appendRef]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  // Listen for progress events from the SSE stream
  useEffect(() => {
    if (!isLoading) {
      setProgressPhase(null);
      return;
    }

    // Poll for progress from a custom endpoint that reads the SSE side-channel
    // Since we can't intercept the AI SDK's stream, we use a simpler approach:
    // detect idle time and show progress based on elapsed time
    let elapsed = 0;
    // Phases spread across ~3.5 minutes (210s)
    // Each phase lasts ~30s to cover the full generation time
    const phases = [
      { at: 0, text: "Agent is working..." },
      { at: 8, text: "Writing slide texts..." },
      { at: 25, text: "Running image generator..." },
      { at: 50, text: "Generating slide 1 of 6..." },
      { at: 75, text: "Generating slide 3 of 6..." },
      { at: 100, text: "Generating slide 5 of 6..." },
      { at: 130, text: "Finishing image generation..." },
      { at: 155, text: "Uploading slides to storage..." },
      { at: 180, text: "Almost done..." },
    ];

    const timer = setInterval(() => {
      elapsed++;
      // Find the latest phase that has been reached
      let current = phases[0].text;
      for (const p of phases) {
        if (elapsed >= p.at) current = p.text;
      }
      setProgressPhase(current);
    }, 1000);

    return () => {
      clearInterval(timer);
      setProgressPhase(null);
    };
  }, [isLoading]);

  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      const text = getMessageText(msg);

      const slideUrlsMatch = text.match(SLIDE_URLS_RE);
      if (slideUrlsMatch) {
        try {
          const data = JSON.parse(slideUrlsMatch[1]) as SlideUrlData;
          if (data.slug && !detectedSlugs.current.has("urls:" + data.slug)) {
            detectedSlugs.current.add("urls:" + data.slug);
            onSlideUrlsDetected?.(data);
          }
        } catch { /* ignore */ }
      }

      const manifestMatch = text.match(MANIFEST_RE);
      const slug = manifestMatch?.[1] ?? text.match(SLUG_RE)?.[1];
      if (slug && !detectedSlugs.current.has(slug)) {
        detectedSlugs.current.add(slug);
        onSlugDetected(slug);
      }
    }
  }, [messages, onSlugDetected, onSlideUrlsDetected]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  };

  const getMessageText = (msg: (typeof messages)[number]): string => {
    return (
      msg.parts
        ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("") ?? ""
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 ring-1 ring-indigo-500/10">
              <Sparkles className="size-5 text-indigo-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground/80">Slideshow Studio</p>
              <p className="mt-1 text-xs text-muted-foreground max-w-[280px] leading-relaxed">
                Describe a concept and the agent will generate 6 photorealistic slides using the tiktok-brain workflow
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1 p-3">
            {messages.map((msg) => {
              const text = getMessageText(msg);
              const isUser = msg.role === "user";
              const isLastAssistant =
                msg.role === "assistant" &&
                msg === messages[messages.length - 1];

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-2.5 rounded-xl px-3 py-2.5",
                    isUser ? "bg-transparent" : "bg-muted/40"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md",
                      isUser ? "bg-foreground/10" : "bg-indigo-500/15"
                    )}
                  >
                    {isUser ? (
                      <User className="size-3.5 text-foreground/60" />
                    ) : (
                      <Bot className="size-3.5 text-indigo-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-muted-foreground mb-1">
                      {isUser ? "You" : "Agent"}
                    </p>
                    {!isUser && isLastAssistant && isLoading && !text ? (
                      <div className="flex items-center gap-2 py-0.5">
                        <Loader2 className="size-3.5 animate-spin text-indigo-400" />
                        <span className="text-xs text-muted-foreground" key={progressPhase}>
                          {progressPhase || "Agent is working..."}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[13px] leading-relaxed text-foreground/90 streamdown-wrapper">
                        <Streamdown
                          mode={isLastAssistant && isStreaming ? "streaming" : "static"}
                        >
                          {text}
                        </Streamdown>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border/50 p-3">
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 transition-colors focus-within:border-indigo-500/40 focus-within:bg-muted/50"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Describe your slideshow concept..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm leading-relaxed placeholder:text-muted-foreground/50 focus:outline-none"
            style={{ maxHeight: 120, minHeight: 20 }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg transition-all",
              input.trim() && !isLoading
                ? "bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm shadow-indigo-500/25"
                : "bg-foreground/5 text-muted-foreground cursor-not-allowed"
            )}
          >
            <ArrowUp className="size-3.5" strokeWidth={2.5} />
          </button>
        </form>
      </div>
    </div>
  );
}
