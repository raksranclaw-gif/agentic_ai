import { GeneratedScript, GenerateRequest } from "./types";

const SYSTEM_PROMPT = `You are an expert educational content creator and Manim (Community Edition) animator.
Given a technical term and the learner's education level, produce a JSON object with this exact schema:

{
  "title": "Short title for the video",
  "segments": [
    {
      "narration": "What the narrator says during this segment (2-3 sentences).",
      "manim_prompt": "A precise, self-contained Manim CE (v0.18+) scene description. Include the class name, objects to create, animations to apply, colors, and positioning. Each prompt must be a complete, independent scene that can be rendered on its own. Use standard Manim classes like Scene, MathTex, Text, Arrow, Circle, Square, Axes, NumberPlane, etc.",
      "duration_seconds": 10
    }
  ],
  "full_narration": "All narration segments joined together as one script."
}

RULES:
- Target approximately 60 seconds total (sum of all segment durations).
- Use 4-6 segments.
- Narration should be conversational, clear, and matched to the education level.
- Each manim_prompt should describe exactly what to render: shapes, equations, text, graphs, transformations, animations (FadeIn, Write, Create, Transform, etc.).
- Keep manim_prompt descriptions precise enough that a code generator can produce a working Manim scene from them.
- Use colors like BLUE, RED, GREEN, YELLOW, WHITE, PURPLE for visual variety.
- Do NOT include Python code in manim_prompt; describe the scene declaratively.
- Respond with ONLY the JSON object, no markdown fences or extra text.`;

export async function generateScript(
  req: GenerateRequest
): Promise<GeneratedScript> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const userPrompt = `Term: "${req.term}"
Education level: ${req.level.replace("_", " ")}

Generate the educational video script and Manim animation plan.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} – ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");

  const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(cleaned) as GeneratedScript;
}
