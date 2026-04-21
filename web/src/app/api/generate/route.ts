import { NextRequest } from "next/server";
import { generateScript } from "@/lib/gemini";
import { generateAudio } from "@/lib/elevenlabs";
import { renderSegments, compositeVideo, uploadAudio } from "@/lib/renderer";
import { GenerateRequest } from "@/lib/types";

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as GenerateRequest;

  if (!body.term?.trim()) {
    return Response.json({ error: "term is required" }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(new TextEncoder().encode(sseEvent(data)));
      };

      try {
        send({ stage: "generating_script", detail: "Generating script and animation plan…" });
        const script = await generateScript(body);

        send({ stage: "generating_audio", detail: "Generating narration audio…" });
        const audioBuffer = await generateAudio(script.full_narration);
        const audioPath = await uploadAudio(audioBuffer);

        send({ stage: "rendering_video", detail: "Rendering Manim animations…" });
        const videoPaths = await renderSegments(script.segments);

        send({ stage: "compositing", detail: "Compositing final video…" });
        const videoUrl = await compositeVideo(videoPaths, audioPath);

        send({ stage: "done", video_url: videoUrl });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ stage: "error", error: message });
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
    },
  });
}
