export interface GenerateRequest {
  term: string;
  level: "middle_school" | "high_school" | "undergraduate" | "graduate";
}

export interface ScriptSegment {
  narration: string;
  manim_prompt: string;
  duration_seconds: number;
}

export interface GeneratedScript {
  title: string;
  segments: ScriptSegment[];
  full_narration: string;
}

export interface SSEEvent {
  stage?: string;
  video_url?: string;
  error?: string;
  detail?: string;
}
