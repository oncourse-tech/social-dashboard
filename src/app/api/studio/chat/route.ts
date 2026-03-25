import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type UIMessage } from "ai";

const openclaw = createOpenAI({
  baseURL: process.env.OPENCLAW_GATEWAY_URL + "/v1",
  apiKey: process.env.OPENCLAW_GATEWAY_TOKEN,
});

export const maxDuration = 120;

function uiMessagesToSimple(
  messages: UIMessage[]
): Array<{ role: "user" | "assistant"; content: string }> {
  return messages.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content:
      msg.parts
        ?.filter(
          (p): p is { type: "text"; text: string } => p.type === "text"
        )
        .map((p) => p.text)
        .join("") ?? "",
  }));
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openclaw("openclaw:main"),
    messages: uiMessagesToSimple(messages),
  });

  return result.toUIMessageStreamResponse();
}
