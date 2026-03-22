import { generateText, UserContent } from "ai";
import { google } from "@ai-sdk/google";
import { VideoFormat } from "@prisma/client";

const VALID_FORMATS = new Set(Object.values(VideoFormat));

export type VideoAnalysis = {
  format: VideoFormat;
  hook: string;
  script: string;
  cta: string;
};

interface VideoMetadata {
  description: string;
  hashtags: string[];
  duration: number;
  musicName: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
}

const ANALYSIS_PROMPT = `You are an expert TikTok content analyst for educational apps. Watch this TikTok video carefully and extract four things.

## Post metadata:
- Caption: {description}
- Hashtags: {hashtags}
- Duration: {duration} seconds
- Sound: {musicName}

## Extract:

### FORMAT — classify into exactly ONE:
- UGC_REACTION: Creator reacting to content on screen, duets, stitches, split-screen
- UGC_VOICEOVER: Voice narrating over b-roll/screen recordings/slides
- TALKING_HEAD: Creator speaking directly to camera, face visible, single shot
- CAROUSEL_SLIDESHOW: Sequence of static images/text cards/slides
- SCREEN_RECORDING: Phone/desktop screen capture showing an app
- SKIT_COMEDY: Scripted comedic scenario, acting out situations
- GREEN_SCREEN: Creator with background image behind them
- TEXT_ON_SCREEN: Primarily text overlays with music, no face
- INTERVIEW_PODCAST: Conversation between two or more people
- WHITEBOARD: Hand-drawn diagrams, writing on board/paper
- BEFORE_AFTER: Comparison showing transformation
- ASMR_AESTHETIC: Satisfying visuals, study-with-me, desk setups
- OTHER: None of the above

### HOOK — the exact opening words/text from the first 1-3 seconds that stops the scroll. If purely visual, describe it.

### SCRIPT — 2-4 sentence summary of the narrative arc: problem/tension → insight/solution → resolution.

### CTA — the call-to-action (explicit like "Follow for more" or implicit action the viewer is encouraged to take).

Respond with ONLY valid JSON, no markdown:
{"format":"<FORMAT>","hook":"<HOOK>","script":"<SCRIPT>","cta":"<CTA>"}`;

export async function analyzeVideo(
  video: VideoMetadata
): Promise<VideoAnalysis> {
  try {
    const promptText = ANALYSIS_PROMPT
      .replace("{description}", video.description || "No caption")
      .replace("{hashtags}", video.hashtags.join(", ") || "None")
      .replace("{duration}", String(video.duration))
      .replace("{musicName}", video.musicName ?? "Original sound");

    const userContent: UserContent = [];

    if (video.videoUrl) {
      userContent.push({
        type: "file",
        data: new URL(video.videoUrl),
        mediaType: "video/mp4",
      });
    } else if (video.thumbnailUrl) {
      userContent.push({
        type: "file",
        data: new URL(video.thumbnailUrl),
        mediaType: "image/jpeg",
      });
    }

    userContent.push({ type: "text", text: promptText });

    const { text } = await generateText({
      model: google("gemini-2.5-pro"),
      messages: [{ role: "user" as const, content: userContent }],
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { format: "OTHER" as VideoFormat, hook: "", script: "", cta: "" };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      format: VALID_FORMATS.has(parsed.format) ? (parsed.format as VideoFormat) : ("OTHER" as VideoFormat),
      hook: parsed.hook || "",
      script: parsed.script || "",
      cta: parsed.cta || "",
    };
  } catch (error) {
    console.error("Gemini video analysis failed:", error);
    return { format: "OTHER" as VideoFormat, hook: "", script: "", cta: "" };
  }
}

export async function classifyVideoFormat(
  video: Omit<VideoMetadata, "videoUrl"> & { videoUrl?: string | null }
): Promise<VideoFormat> {
  const result = await analyzeVideo({ ...video, videoUrl: video.videoUrl ?? null });
  return result.format;
}
