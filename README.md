# BiteSized – Learn Any Concept in 60 Seconds

A web application that generates bite-sized, animated learning videos. Enter a technical term and your education level, and the app produces a ~60-second narrated Manim animation explaining the concept.

## Architecture

```
┌─────────────────────────────────────────────┐
│               Next.js Web App               │
│  (Vercel / Docker)                          │
│                                             │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  │
│  │ Landing  │  │ /api/    │  │ SSE       │  │
│  │ Page UI  │──│ generate │──│ Progress  │  │
│  └─────────┘  └────┬─────┘  └───────────┘  │
│                     │                       │
└─────────────────────┼───────────────────────┘
                      │
        ┌─────────────┼──────────────┐
        │             │              │
   ┌────▼────┐  ┌─────▼─────┐  ┌────▼──────┐
   │ Google  │  │ ElevenLabs│  │  Renderer  │
   │ Gemini  │  │ TTS API   │  │  (FastAPI) │
   │         │  │           │  │            │
   │ Script &│  │ Narration │  │ Manim code │
   │ Manim   │  │ audio     │  │ generation │
   │ prompts │  │ (.mp3)    │  │ + render   │
   └─────────┘  └───────────┘  │ + ffmpeg   │
                               │ composite  │
                               └────────────┘
```

### Pipeline Flow

1. **Script Generation** – Gemini generates a structured script with narration text and Manim scene descriptions, split into 4-6 segments (~60s total).
2. **Audio Generation** – ElevenLabs converts the full narration into high-quality speech audio.
3. **Manim Rendering** – Each segment's scene description is converted to Manim Python code (via Gemini), then rendered to MP4 clips.
4. **Compositing** – ffmpeg concatenates the video segments and overlays the narration audio.
5. **Delivery** – The final video URL is streamed back to the browser via SSE.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, TypeScript |
| Script Generation | Google Gemini |
| Voice Synthesis | ElevenLabs Text-to-Speech |
| Animation | Manim Community Edition |
| Video Processing | ffmpeg |
| Renderer Backend | Python 3.12, FastAPI, Uvicorn |
| Deployment | Vercel (web) + Docker (renderer) |

## Quick Start

### Prerequisites

- Node.js 22+
- Python 3.12+
- Docker & Docker Compose (recommended)
- API keys for [Google AI Studio (Gemini)](https://aistudio.google.com/apikey) and [ElevenLabs](https://elevenlabs.io/)

### Option 1: Docker Compose (recommended)

```bash
# Clone and configure
cp .env.example .env
# Edit .env with your API keys

# Start everything
docker compose up --build
```

The web app will be at `http://localhost:3000` and the renderer at `http://localhost:8000`.

### Option 2: Manual Setup

**Renderer service:**

```bash
cd renderer
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# You also need: ffmpeg, LaTeX (texlive), cairo, pango
# macOS: brew install ffmpeg mactex cairo pango
# Ubuntu: apt install ffmpeg texlive-full libcairo2-dev libpango1.0-dev

cp .env.example .env  # add your GEMINI_API_KEY
uvicorn main:app --reload --port 8000
```

**Web app:**

```bash
cd web
npm install
cp .env.example .env.local  # add your API keys
npm run dev
```

Open `http://localhost:3000`.

## Deploying to Vercel

The Next.js web app deploys directly to Vercel:

1. Push the repo to GitHub.
2. Import the project in Vercel, set the root directory to `web/`.
3. Add environment variables in Vercel's dashboard:
   - `GEMINI_API_KEY`
   - `ELEVENLABS_API_KEY`
   - `RENDERER_URL` – the public URL of your renderer service

The renderer service must be hosted separately (e.g., Railway, Fly.io, or any Docker host) since it needs Python, Manim, LaTeX, and ffmpeg.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | – | Google Gemini API key for script + code generation |
| `ELEVENLABS_API_KEY` | Yes | – | ElevenLabs API key for TTS |
| `GEMINI_MODEL` | No | `gemini-2.0-flash` | Gemini model to use |
| `ELEVENLABS_VOICE_ID` | No | `EXAVITQu4vr4xnSDxMaL` | ElevenLabs voice ID ("Sarah") |
| `ELEVENLABS_MODEL_ID` | No | `eleven_multilingual_v2` | ElevenLabs TTS model |
| `RENDERER_URL` | No | `http://localhost:8000` | URL of the renderer service |
| `RENDERER_PUBLIC_URL` | No | `http://localhost:8000` | Public URL for video delivery |

## Project Structure

```
├── web/                    # Next.js frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # Main UI
│   │   │   ├── layout.tsx         # Root layout
│   │   │   ├── globals.css        # Global styles
│   │   │   └── api/generate/
│   │   │       └── route.ts       # SSE orchestration endpoint
│   │   └── lib/
│   │       ├── types.ts           # Shared TypeScript types
│   │       ├── gemini.ts          # Script generation via Gemini
│   │       ├── elevenlabs.ts      # Audio generation via ElevenLabs
│   │       └── renderer.ts       # Renderer service client
│   ├── Dockerfile
│   └── package.json
├── renderer/               # Python Manim renderer
│   ├── main.py             # FastAPI application
│   ├── scene_generator.py  # LLM-powered Manim code generation (Gemini)
│   ├── Dockerfile
│   └── requirements.txt
├── docker-compose.yml
└── .env.example
```

## License

MIT
