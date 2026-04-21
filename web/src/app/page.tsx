"use client";

import { useState, useRef } from "react";

type Stage =
  | "idle"
  | "generating_script"
  | "generating_audio"
  | "rendering_video"
  | "compositing"
  | "done"
  | "error";

const EDUCATION_LEVELS = [
  { value: "middle_school", label: "Middle School" },
  { value: "high_school", label: "High School" },
  { value: "undergraduate", label: "Undergraduate" },
  { value: "graduate", label: "Graduate / Professional" },
];

const STAGE_LABELS: Record<Stage, string> = {
  idle: "",
  generating_script: "Writing the script & animation plan…",
  generating_audio: "Generating narration with ElevenLabs…",
  rendering_video: "Rendering Manim animations…",
  compositing: "Compositing final video…",
  done: "Your video is ready!",
  error: "Something went wrong.",
};

const STAGE_PROGRESS: Record<Stage, number> = {
  idle: 0,
  generating_script: 15,
  generating_audio: 40,
  rendering_video: 70,
  compositing: 90,
  done: 100,
  error: 0,
};

export default function Home() {
  const [term, setTerm] = useState("");
  const [level, setLevel] = useState("undergraduate");
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isWorking = !["idle", "done", "error"].includes(stage);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!term.trim()) return;

    setStage("generating_script");
    setErrorMsg("");
    setVideoUrl(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: term.trim(), level }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;

          try {
            const event = JSON.parse(payload);
            if (event.stage) setStage(event.stage as Stage);
            if (event.video_url) setVideoUrl(event.video_url);
            if (event.error) {
              setErrorMsg(event.error);
              setStage("error");
            }
          } catch {
            // skip non-JSON lines
          }
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setStage("error");
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-10 max-w-2xl">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
          <span className="bg-gradient-to-r from-accent to-purple-400 bg-clip-text text-transparent animate-gradient">
            BiteSized
          </span>
        </h1>
        <p className="text-foreground/60 text-lg">
          Learn any technical concept in 60 seconds with a beautifully animated,
          narrated video.
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleGenerate}
        className="w-full max-w-lg bg-surface border border-border rounded-2xl p-6 shadow-xl space-y-5"
      >
        <div>
          <label
            htmlFor="term"
            className="block text-sm font-medium text-foreground/80 mb-1.5"
          >
            Technical Term
          </label>
          <input
            id="term"
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="e.g. Fourier Transform, TCP Handshake, Mitosis…"
            disabled={isWorking}
            className="w-full rounded-lg bg-surface-light border border-border px-4 py-2.5 text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50 transition"
          />
        </div>

        <div>
          <label
            htmlFor="level"
            className="block text-sm font-medium text-foreground/80 mb-1.5"
          >
            Education Level
          </label>
          <select
            id="level"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            disabled={isWorking}
            className="w-full rounded-lg bg-surface-light border border-border px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50 transition"
          >
            {EDUCATION_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={isWorking || !term.trim()}
          className="w-full py-3 rounded-lg bg-accent hover:bg-accent-light text-white font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {isWorking ? "Generating…" : "Generate Video"}
        </button>
      </form>

      {/* Progress */}
      {isWorking && (
        <div className="mt-8 w-full max-w-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="relative h-3 w-3">
              <span className="absolute inset-0 rounded-full bg-accent animate-pulse-ring" />
              <span className="absolute inset-0 rounded-full bg-accent" />
            </div>
            <span className="text-sm text-foreground/70">
              {STAGE_LABELS[stage]}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-surface-light overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent to-purple-400 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${STAGE_PROGRESS[stage]}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {stage === "error" && (
        <div className="mt-8 w-full max-w-lg bg-red-950/40 border border-red-800/50 rounded-xl p-4 text-red-300 text-sm">
          <p className="font-medium mb-1">Error</p>
          <p>{errorMsg}</p>
        </div>
      )}

      {/* Video Player */}
      {videoUrl && stage === "done" && (
        <div className="mt-8 w-full max-w-2xl">
          <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-2xl">
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              autoPlay
              className="w-full aspect-video bg-black"
            />
            <div className="px-5 py-3 flex items-center justify-between">
              <span className="text-sm text-foreground/60">
                {term} – {EDUCATION_LEVELS.find((l) => l.value === level)?.label}
              </span>
              <a
                href={videoUrl}
                download
                className="text-sm text-accent hover:text-accent-light transition font-medium"
              >
                Download ↓
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto pt-16 pb-6 text-center text-xs text-foreground/30">
        Powered by OpenAI · ElevenLabs · Manim
      </footer>
    </main>
  );
}
