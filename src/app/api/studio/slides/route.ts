import { NextRequest, NextResponse } from "next/server";
import { sshExec, sshReadFile, sshFileExists } from "@/lib/ssh";
import { uploadSlide } from "@/lib/storage";

const SLIDES_BASE = "~/clawd-oncourse/tiktok-marketing/posts/photo";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  const dir = `${SLIDES_BASE}/${slug}`;

  try {
    const lsOutput = await sshExec(
      `ls ${dir}/slide_*.png 2>/dev/null || echo ""`
    ).catch(() => "");

    const existingFiles = lsOutput
      .trim()
      .split("\n")
      .filter((f) => f.endsWith(".png") && !f.includes(".raw."));

    const manifestPath = `${dir}/manifest.json`;
    const hasManifest = await sshFileExists(manifestPath);
    let manifest = null;
    if (hasManifest) {
      const manifestBuf = await sshReadFile(manifestPath);
      manifest = JSON.parse(manifestBuf.toString());
    }

    const slides = await Promise.all(
      Array.from({ length: 6 }, async (_, i) => {
        const num = String(i + 1).padStart(2, "0");
        const remotePath = `${dir}/slide_${num}.png`;
        const exists = existingFiles.some((f) => f.includes(`slide_${num}.png`));

        if (!exists) {
          return {
            index: i + 1,
            url: null,
            status: hasManifest ? "failed" : ("pending" as const),
          };
        }

        try {
          const buffer = await sshReadFile(remotePath);
          const url = await uploadSlide(slug, num, buffer);
          return { index: i + 1, url, status: "ready" as const };
        } catch {
          return { index: i + 1, url: null, status: "generating" as const };
        }
      })
    );

    const allReady = slides.every((s) => s.status === "ready");

    return NextResponse.json({
      slug,
      status: allReady ? "complete" : "generating",
      slides,
      manifest,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to connect to slide server", detail: String(error) },
      { status: 502 }
    );
  }
}
