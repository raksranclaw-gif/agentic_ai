/**
 * Text-to-speech using the Gemini TTS API.
 *
 * Returns raw WAV audio bytes (PCM 24 kHz, 16-bit, mono wrapped in a WAV header).
 * The API returns base64-encoded linear16 PCM at 24 kHz which we wrap in a
 * standard WAV header so ffmpeg and browsers can play it directly.
 */

function writeWavHeader(pcmData: Uint8Array, sampleRate = 24000, channels = 1, bitsPerSample = 16): Uint8Array {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmData.byteLength;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const result = new Uint8Array(buffer);
  result.set(pcmData, headerSize);
  return result;
}

export async function generateAudio(text: string): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const ttsModel = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
  const voiceName = process.env.GEMINI_TTS_VOICE || "Kore";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${ttsModel}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Say in a clear, friendly, educational tone: ${text}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini TTS API error: ${response.status} – ${err}`);
  }

  const data = await response.json();

  const audioPart = data.candidates?.[0]?.content?.parts?.find(
    (p: { inlineData?: { mimeType?: string } }) => p.inlineData?.mimeType?.startsWith("audio/")
  );
  if (!audioPart?.inlineData?.data) {
    throw new Error("No audio data in Gemini TTS response");
  }

  const pcmBytes = Buffer.from(audioPart.inlineData.data, "base64");
  const wavBytes = writeWavHeader(new Uint8Array(pcmBytes));
  return Buffer.from(wavBytes);
}
