import { GoogleGenerativeAI } from "@google/generative-ai";
import { VideoFormat } from "@prisma/client";

const VALID_FORMATS = new Set(Object.values(VideoFormat));

interface VideoMetadata {
  description: string;
  hashtags: string[];
  duration: number;
  musicName: string | null;
  thumbnailUrl: string | null;
}

const CLASSIFICATION_PROMPT = `You are a TikTok video format classifier. Analyze the video thumbnail image AND metadata to classify this video into exactly one format category.

Video metadata:
- Description: {description}
- Hashtags: {hashtags}
- Duration: {duration}s
- Music: {musicName}

Look at the thumbnail carefully and classify into ONE of these categories:

- UGC_REACTION: Creator reacting to content on screen, duets, stitches, split-screen reactions
- UGC_VOICEOVER: Creator voiceover on screen recordings, slides, or b-roll footage
- TALKING_HEAD: Creator speaking directly to camera, face visible, no split screen
- CAROUSEL_SLIDESHOW: Image/text slides, educational cards, tips lists, multiple static frames
- SCREEN_RECORDING: App demo, tutorial walkthrough, phone/desktop screen capture
- SKIT_COMEDY: Scripted comedic scenarios, acting out relatable situations, comedy sketches
- GREEN_SCREEN: Creator visible in corner/side with background image/article/screenshot behind them
- TEXT_ON_SCREEN: Primarily text overlays with music, no face visible, text-based content
- INTERVIEW_PODCAST: Clip from longer conversation, two or more people talking
- WHITEBOARD: Drawing, writing, diagramming on screen or paper
- BEFORE_AFTER: Transformation or comparison format, split before/after
- ASMR_AESTHETIC: Satisfying visuals, study-with-me, desk setups, aesthetic content
- OTHER: Does not clearly fit any category above

IMPORTANT: Use the thumbnail as the primary signal. The image shows what type of content this is.

Respond with ONLY a JSON object: {"format": "<CATEGORY>"}`;

async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = response.headers.get("content-type") || "image/jpeg";

    return { data: base64, mimeType: contentType };
  } catch {
    return null;
  }
}

export async function classifyVideoFormat(
  video: VideoMetadata
): Promise<VideoFormat> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY not set, defaulting to OTHER");
    return VideoFormat.OTHER;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = CLASSIFICATION_PROMPT
      .replace("{description}", video.description || "No description")
      .replace("{hashtags}", video.hashtags.join(", ") || "None")
      .replace("{duration}", String(video.duration))
      .replace("{musicName}", video.musicName ?? "Unknown");

    // Build content parts — text + optional thumbnail image
    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];

    // Try to fetch and include thumbnail for better classification
    if (video.thumbnailUrl) {
      const imageData = await fetchImageAsBase64(video.thumbnailUrl);
      if (imageData) {
        parts.push({ inlineData: imageData });
      }
    }

    parts.push({ text: prompt });

    const result = await model.generateContent(parts);
    const text = result.response.text().trim();

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return VideoFormat.OTHER;

    const parsed = JSON.parse(jsonMatch[0]);
    const format = parsed.format as string;

    if (VALID_FORMATS.has(format as VideoFormat)) {
      return format as VideoFormat;
    }

    return VideoFormat.OTHER;
  } catch (error) {
    console.error("Gemini classification failed:", error);
    return VideoFormat.OTHER;
  }
}
