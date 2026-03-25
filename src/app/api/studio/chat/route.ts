import { type UIMessage } from "ai";

export const maxDuration = 120;

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

  const openaiMessages = [
    {
      role: "system",
      content: `You are a slideshow production assistant. Use the tiktok-brain skill to generate photorealistic slideshows.

Follow the production-slides workflow from the tiktok-brain skill:
1. Write 6 slide texts (Hook → Problem → Discovery → Reveal → Result → CTA)
2. Run generate-photo-slides.js at ~/clawd-oncourse/tiktok-marketing/scripts/generate-photo-slides.js
3. Use flags: --concept, --texts, --scene, --account @oncourse.usmle, --cta

After generate-photo-slides.js completes, ALWAYS run the upload script:
  node ~/clawd-oncourse/tiktok-marketing/scripts/upload-slides-to-supabase.js --manifest ~/clawd-oncourse/tiktok-marketing/posts/photo/{slug}/manifest.json

The upload script outputs JSON with Supabase CDN URLs for each slide. Include the full JSON output in your response so the UI can display the slides. Format it as a code block tagged SLIDE_URLS:
\`\`\`SLIDE_URLS
{the JSON output from the upload script}
\`\`\``,
    },
    ...messages.map((msg) => ({
      role: msg.role,
      content: extractText(msg),
    })),
  ];

  const response = await fetch(
    `${process.env.OPENCLAW_GATEWAY_URL}/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN}`,
      },
      body: JSON.stringify({
        model: "openclaw",
        messages: openaiMessages,
        stream: true,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    return new Response(text, { status: response.status });
  }

  // Convert OpenAI SSE stream → AI SDK v6 UI Message Stream protocol
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const msgId = `msg_${Date.now()}`;
  const textId = `txt_${Date.now()}`;

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      let buffer = "";

      // Start message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "start", messageId: msgId })}\n\n`)
      );
      // Start text block
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "text-start", id: textId })}\n\n`)
      );

      try {
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
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "text-delta", id: textId, delta: content })}\n\n`
                  )
                );
              }
            } catch {
              // Skip unparseable chunks
            }
          }
        }

        // End text block
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "text-end", id: textId })}\n\n`)
        );
        // Finish message
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "finish", messageId: msgId, finishReason: "stop" })}\n\n`
          )
        );
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "x-vercel-ai-ui-message-stream": "v1",
    },
  });
}
