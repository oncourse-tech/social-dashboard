import { createOpenAI } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, type UIMessage } from "ai";

const openclaw = createOpenAI({
  baseURL: process.env.OPENCLAW_GATEWAY_URL + "/v1",
  apiKey: process.env.OPENCLAW_GATEWAY_TOKEN,
});

export const maxDuration = 120;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openclaw("openclaw:main"),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
