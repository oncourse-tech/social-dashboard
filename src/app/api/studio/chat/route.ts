import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";

export const maxDuration = 300;

const SYSTEM_PROMPT = `You are a slideshow production assistant. Use the tiktok-brain skill to generate photorealistic slideshows.

Follow the production-slides workflow from the tiktok-brain skill:
1. Write 6 slide texts (Hook → Problem → Discovery → Reveal → Result → CTA)
2. Run generate-photo-slides.js at ~/clawd-oncourse/tiktok-marketing/scripts/generate-photo-slides.js
3. Use flags: --concept, --texts, --scene, --account @oncourse.usmle, --cta

After generate-photo-slides.js completes, ALWAYS run the upload script:
  node ~/clawd-oncourse/tiktok-marketing/scripts/upload-slides-to-supabase.js --manifest ~/clawd-oncourse/tiktok-marketing/posts/photo/{slug}/manifest.json

The upload script outputs JSON with Supabase CDN URLs for each slide. Include the full JSON output in your response so the UI can display the slides. Format it as a code block tagged SLIDE_URLS:
\`\`\`SLIDE_URLS
{the JSON output from the upload script}
\`\`\``;

function extractText(msg: UIMessage): string {
  return (
    msg.parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("") ?? ""
  );
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const input = messages.map((msg) => ({
    type: "message" as const,
    role: msg.role,
    content: extractText(msg),
  }));

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const response = await fetch(
        `${process.env.OPENCLAW_GATEWAY_URL}/v1/responses`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN}`,
          },
          body: JSON.stringify({
            model: "openclaw",
            instructions: SYSTEM_PROMPT,
            input,
            stream: true,
          }),
        }
      );

      // Send start event so useChat creates the assistant message
      writer.write({ type: "start" });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Gateway error (${response.status}): ${text}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const textId = `txt_${Date.now()}`;
      let textStarted = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);

            // OpenResponses text deltas — real streaming
            if (parsed.type === "response.output_text.delta" && parsed.delta) {
              if (!textStarted) {
                writer.write({ type: "text-start", id: textId });
                textStarted = true;
              }
              writer.write({
                type: "text-delta",
                id: textId,
                delta: parsed.delta,
              });
            }

            // Fallback: chat completions format
            if (parsed.choices?.[0]?.delta?.content) {
              if (!textStarted) {
                writer.write({ type: "text-start", id: textId });
                textStarted = true;
              }
              writer.write({
                type: "text-delta",
                id: textId,
                delta: parsed.choices[0].delta.content,
              });
            }
          } catch {
            // Skip unparseable
          }
        }
      }

      if (textStarted) {
        writer.write({ type: "text-end", id: textId });
      }
      writer.write({ type: "finish", finishReason: "stop" });
    },
    onError: (error) => {
      return error instanceof Error ? error.message : String(error);
    },
  });

  return createUIMessageStreamResponse({
    stream,
    headers: {
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
