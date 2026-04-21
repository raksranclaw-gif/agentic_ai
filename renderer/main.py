import os
import uuid
import shutil
import subprocess
import tempfile
import textwrap
from pathlib import Path

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from scene_generator import generate_manim_code

app = FastAPI(title="BiteSized Renderer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR", "/tmp/bitesized_output"))
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(OUTPUT_DIR)), name="static")

RENDERER_PUBLIC_URL = os.environ.get("RENDERER_PUBLIC_URL", "http://localhost:8000")


class Segment(BaseModel):
    narration: str
    manim_prompt: str
    duration_seconds: float


class RenderRequest(BaseModel):
    segments: list[Segment]


class CompositeRequest(BaseModel):
    video_paths: list[str]
    audio_path: str


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/render")
async def render(req: RenderRequest):
    """Generate Manim code from prompts, render each segment, return video paths."""
    job_id = uuid.uuid4().hex[:8]
    job_dir = OUTPUT_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    video_paths: list[str] = []

    for i, segment in enumerate(req.segments):
        scene_name = f"Segment{i}"
        manim_code = generate_manim_code(
            prompt=segment.manim_prompt,
            scene_name=scene_name,
            duration=segment.duration_seconds,
        )

        scene_file = job_dir / f"scene_{i}.py"
        scene_file.write_text(manim_code)

        result = subprocess.run(
            [
                "manim",
                "render",
                "-ql",  # low quality for speed; switch to -qm or -qh for production
                "--format", "mp4",
                "--media_dir", str(job_dir / "media"),
                str(scene_file),
                scene_name,
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode != 0:
            raise RuntimeError(
                f"Manim render failed for segment {i}:\n"
                f"STDOUT: {result.stdout[-2000:]}\n"
                f"STDERR: {result.stderr[-2000:]}"
            )

        rendered = list((job_dir / "media" / "videos").rglob(f"{scene_name}.mp4"))
        if not rendered:
            raise RuntimeError(f"No output video found for segment {i}")

        out_name = f"seg_{i}.mp4"
        final_path = job_dir / out_name
        shutil.move(str(rendered[0]), str(final_path))
        video_paths.append(str(final_path))

    return {"video_paths": video_paths}


@app.post("/upload-audio")
async def upload_audio(file: UploadFile = File(...)):
    """Accept an audio file upload, return its local path."""
    job_id = uuid.uuid4().hex[:8]
    audio_dir = OUTPUT_DIR / job_id
    audio_dir.mkdir(parents=True, exist_ok=True)
    audio_path = audio_dir / (file.filename or "narration.mp3")

    with open(audio_path, "wb") as f:
        content = await file.read()
        f.write(content)

    return {"path": str(audio_path)}


@app.post("/composite")
async def composite(req: CompositeRequest):
    """Concatenate segment videos and overlay audio, return final video URL."""
    job_id = uuid.uuid4().hex[:8]
    job_dir = OUTPUT_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    concat_list = job_dir / "concat.txt"
    normalized_paths: list[str] = []

    for i, vp in enumerate(req.video_paths):
        norm_path = job_dir / f"norm_{i}.mp4"
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", vp,
                "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1",
                "-r", "30",
                "-c:v", "libx264", "-preset", "fast",
                "-an",
                str(norm_path),
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        normalized_paths.append(str(norm_path))

    with open(concat_list, "w") as f:
        for p in normalized_paths:
            f.write(f"file '{p}'\n")

    concat_video = job_dir / "concat.mp4"
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-f", "concat", "-safe", "0",
            "-i", str(concat_list),
            "-c", "copy",
            str(concat_video),
        ],
        capture_output=True,
        text=True,
        timeout=120,
    )

    final_video = job_dir / "final.mp4"
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", str(concat_video),
            "-i", req.audio_path,
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            str(final_video),
        ],
        capture_output=True,
        text=True,
        timeout=120,
    )

    rel = final_video.relative_to(OUTPUT_DIR)
    video_url = f"{RENDERER_PUBLIC_URL}/static/{rel}"
    return {"video_url": video_url}
