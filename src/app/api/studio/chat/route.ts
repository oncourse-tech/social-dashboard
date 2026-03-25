import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const openclaw = createOpenAI({
  baseURL: process.env.OPENCLAW_GATEWAY_URL + "/v1",
  apiKey: process.env.OPENCLAW_GATEWAY_TOKEN,
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openclaw("openclaw:main"),
    messages,
  });

  return result.toUIMessageStreamResponse();
}
