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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const prompt = `Classify this TikTok video into exactly one format category based on the metadata provided.

Video metadata:
- Description: ${video.description}
- Hashtags: ${video.hashtags.join(", ")}
- Duration: ${video.duration}s
- Music: ${video.musicName ?? "Unknown"}

Categories:
- UGC_REACTION: Creator reacting to content, duets, stitches
- UGC_VOICEOVER: Creator voiceover on screen recordings, slides, or b-roll
- TALKING_HEAD: Creator speaking directly to camera
- CAROUSEL_SLIDESHOW: Image/text slides, educational content, tips lists
- SCREEN_RECORDING: App demo, tutorial walkthrough, software showcase
- SKIT_COMEDY: Scripted comedic scenarios, relatable situations
- GREEN_SCREEN: Creator over a background image/article/screenshot
- TEXT_ON_SCREEN: Primarily text overlays with music, no face
- INTERVIEW_PODCAST: Clip from longer conversation
- WHITEBOARD: Drawing, writing, diagramming on screen
- BEFORE_AFTER: Transformation or comparison format
- ASMR_AESTHETIC: Satisfying visuals, study-with-me, desk setups
- OTHER: Does not fit any category above

Respond with ONLY a JSON object: {"format": "<CATEGORY>"}`;

    const result = await model.generateContent(prompt);
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
