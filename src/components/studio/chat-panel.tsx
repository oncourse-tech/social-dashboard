"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  onSlugDetected: (slug: string) => void;
  appendRef?: React.MutableRefObject<((message: string) => void) | null>;
}

const MANIFEST_RE = /MANIFEST:.*\/posts\/photo\/([^/]+)\/manifest\.json/;
const SLUG_RE = /(?:generating|rendering).*?(?:slug|concept)[:\s]+["']?([a-z0-9-]+)/i;

export function ChatPanel({ onSlugDetected, appendRef }: ChatPanelProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading, append } =
    useChat({ api: "/api/studio/chat" });

  const scrollRef = useRef<HTMLDivElement>(null);
  const detectedSlugs = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (appendRef) {
      appendRef.current = (text: string) => {
        append({ role: "user", content: text });
      };
    }
  }, [append, appendRef]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      const manifestMatch = msg.content.match(MANIFEST_RE);
      const slug = manifestMatch?.[1] ?? msg.content.match(SLUG_RE)?.[1];
      if (slug && !detectedSlugs.current.has(slug)) {
        detectedSlugs.current.add(slug);
        onSlugDetected(slug);
      }
    }
  }, [messages, onSlugDetected]);

  return (
    <div className="flex h-full flex-col border-r border-border">
      <div className="flex h-12 shrink-0 items-center border-b border-border px-4">
        <h2 className="text-sm font-semibold">Chat</h2>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Describe a slideshow concept to get started
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "max-w-[85%] rounded-lg px-3 py-2 text-sm",
              msg.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-muted"
            )}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2">
            <div className="flex gap-1">
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0.1s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0.2s]" />
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 items-center gap-2 border-t border-border p-3"
      >
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Describe your slideshow concept..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
