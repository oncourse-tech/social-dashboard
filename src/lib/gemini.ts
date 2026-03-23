import { generateText, UserContent } from "ai";
import { google } from "@ai-sdk/google";
import { VideoFormat } from "@prisma/client";

const VALID_FORMATS = new Set(Object.values(VideoFormat));

export type VideoAnalysis = {
  format: VideoFormat;
  hook: string;
  script: string;
  cta: string;
  relevant: boolean;
};

interface VideoMetadata {
  description: string;
  hashtags: string[];
  duration: number;
  musicName: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
}

const ANALYSIS_PROMPT = `You are an expert TikTok content analyst specializing in short-form video strategy for ed-tech and study apps. Watch this TikTok video end-to-end before responding.

## Post metadata:
- Caption: {description}
- Hashtags: {hashtags}
- Duration: {duration} seconds
- Sound: {musicName}

## Extract these five things:

### 1. RELEVANT
Is this video related to medical education, exam preparation (USMLE, MCAT, Step 1/2, board exams), study apps, study tips, medical school life, clinical rotations, residency, or healthcare careers? Answer true or false.
- **true**: The video is about studying medicine, reviewing study resources, med school experiences, clinical content, exam prep, or healthcare education
- **false**: The video is lifestyle, fashion, cooking, entertainment, personal vlogs, politics, or other content unrelated to medical education

### 2. FORMAT
Classify the video into exactly ONE of these content format categories based on what you SEE and HEAR in the video:

- **UGC_REACTION**: A creator reacting to something on screen. This includes duets, stitches, split-screen reactions, or any format where the creator is visibly responding to existing content. The key signal is a reaction to another piece of content.
- **UGC_VOICEOVER**: A creator narrating with their voice over visuals they did not film live. This includes voiceover on screen recordings, app demos, image slideshows, b-roll footage, or text animations. The key signal is that the voice is added in post, not filmed live.
- **CAROUSEL_SLIDESHOW**: A sequence of static images, text cards, infographic slides, or tip lists. May have transitions between frames. The key signal is that the content is primarily static images or text frames, not live video footage.
- **OTHER**: Does not clearly fit any of the three categories above.

### 3. HOOK
Extract the opening hook — the exact first thing the viewer sees or hears in the first 1-3 seconds that makes them stop scrolling. Write the exact words spoken or shown as text. If the hook is purely visual (no words), describe what the viewer sees in one sentence.

### 4. SCRIPT
Summarize the full video's script and narrative arc in 2-4 sentences. Capture: what tension, curiosity, or problem is introduced at the start, what insight or payoff is delivered, and how the video concludes. Focus on the storytelling structure, not just the topic.

### 5. CTA
Extract the call-to-action. This could be:
- Explicit: exact words like "Follow for more", "Link in bio", "Download the app", "Save this"
- Implicit: what action the viewer is naturally encouraged to take based on the video's structure (e.g., try the technique, check out the app)
If there is no CTA at all, write "None".

## Response format
Respond with ONLY this JSON. No markdown, no code blocks, no extra text:
{"relevant":<true|false>,"format":"<FORMAT>","hook":"<HOOK>","script":"<SCRIPT>","cta":"<CTA>"}`;

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
      model: google("gemini-3.1-pro-preview"),
      messages: [{ role: "user" as const, content: userContent }],
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { format: "OTHER" as VideoFormat, hook: "", script: "", cta: "", relevant: true };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      format: VALID_FORMATS.has(parsed.format) ? (parsed.format as VideoFormat) : ("OTHER" as VideoFormat),
      hook: parsed.hook || "",
      script: parsed.script || "",
      cta: parsed.cta || "",
      relevant: parsed.relevant !== false, // default to true if missing
    };
  } catch (error) {
    console.error("Gemini video analysis failed:", error);
    return { format: "OTHER" as VideoFormat, hook: "", script: "", cta: "", relevant: true };
  }
}

export async function classifyVideoFormat(
  video: Omit<VideoMetadata, "videoUrl"> & { videoUrl?: string | null }
): Promise<VideoFormat> {
  const result = await analyzeVideo({ ...video, videoUrl: video.videoUrl ?? null });
  return result.format;
}
