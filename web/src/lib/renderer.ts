import { ScriptSegment } from "./types";

const RENDERER_URL =
  process.env.RENDERER_URL || "http://localhost:8000";

export async function renderSegments(
  segments: ScriptSegment[]
): Promise<string[]> {
  const response = await fetch(`${RENDERER_URL}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ segments }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Renderer error: ${response.status} – ${err}`);
  }

  const data = await response.json();
  return data.video_paths as string[];
}

export async function compositeVideo(
  videoPaths: string[],
  audioPath: string
): Promise<string> {
  const response = await fetch(`${RENDERER_URL}/composite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video_paths: videoPaths, audio_path: audioPath }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Compositor error: ${response.status} – ${err}`);
  }

  const data = await response.json();
  return data.video_url as string;
}

export async function uploadAudio(audioBuffer: Buffer): Promise<string> {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([audioBuffer as BlobPart], { type: "audio/wav" }),
    "narration.wav"
  );

  const response = await fetch(`${RENDERER_URL}/upload-audio`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Audio upload error: ${response.status} – ${err}`);
  }

  const data = await response.json();
  return data.path as string;
}
