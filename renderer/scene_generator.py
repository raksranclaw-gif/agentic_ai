"""
Generates runnable Manim Community Edition Python code from a declarative prompt.

Uses Google Gemini to translate natural-language scene descriptions into Manim code,
with a fallback template in case the LLM is unavailable.
"""

import os
import re
import textwrap

from google import genai
from google.genai import types

SYSTEM_PROMPT = textwrap.dedent("""\
    You are a Manim Community Edition (v0.18+) code generator.
    Given a scene description, produce a COMPLETE, RUNNABLE Python file that:

    1. Imports everything needed from manim.
    2. Defines exactly one Scene subclass with the provided class name.
    3. Implements the `construct` method with the described animations.
    4. Uses self.wait() to fill remaining time so total scene duration ≈ target seconds.
    5. Uses a dark background (BLACK).

    RULES:
    - Output ONLY valid Python code. No markdown fences, no explanations.
    - Never use external assets (images, SVGs, data files).
    - Use standard Manim objects: Text, MathTex, Tex, Circle, Square, Rectangle,
      Arrow, Axes, NumberPlane, VGroup, FadeIn, FadeOut, Write, Create,
      Transform, ReplacementTransform, GrowFromCenter, etc.
    - Keep visuals clean and well-positioned (use .to_edge(), .shift(), .next_to()).
    - Apply colors for visual variety (BLUE, RED, GREEN, YELLOW, PURPLE, WHITE, ORANGE).
    - The scene MUST be self-contained and error-free.
    - For MathTex, use raw strings r"..." for LaTeX.
    - Total animation time should approximate the target duration.
""")


def generate_manim_code(prompt: str, scene_name: str, duration: float) -> str:
    """Generate Manim Python code from a prompt. Falls back to a safe template on failure."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return _fallback_scene(scene_name, prompt, duration)

    try:
        client = genai.Client(api_key=api_key)
        model_name = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash-lite")

        user_msg = (
            f"Scene class name: {scene_name}\n"
            f"Target duration: {duration} seconds\n"
            f"Scene description: {prompt}\n\n"
            f"Generate the complete Manim Python file."
        )

        response = client.models.generate_content(
            model=model_name,
            contents=user_msg,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.3,
                max_output_tokens=3000,
            ),
        )

        code = response.text or ""
        code = _strip_markdown_fences(code)

        if f"class {scene_name}" not in code:
            return _fallback_scene(scene_name, prompt, duration)

        return code

    except Exception:
        return _fallback_scene(scene_name, prompt, duration)


def _strip_markdown_fences(code: str) -> str:
    code = re.sub(r"^```(?:python)?\s*\n?", "", code.strip())
    code = re.sub(r"\n?```\s*$", "", code.strip())
    return code


def _fallback_scene(scene_name: str, prompt: str, duration: float) -> str:
    """A simple but always-valid fallback scene that displays the prompt text."""
    safe_text = prompt.replace('"', '\\"')[:200]
    wait_time = max(1, duration - 4)
    return textwrap.dedent(f'''\
        from manim import *

        class {scene_name}(Scene):
            def construct(self):
                self.camera.background_color = BLACK

                title = Text("{safe_text}", font_size=28, color=WHITE)
                title.scale_to_fit_width(12)

                self.play(Write(title), run_time=2)
                self.wait({wait_time})
                self.play(FadeOut(title), run_time=1)
    ''')
