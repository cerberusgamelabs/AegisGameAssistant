import { tmpdir } from 'os';
import { join } from 'path';
import { rm, writeFile } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import config from '../config.js';

const execAsync = promisify(exec);

let _kokoroJs = null;
let _isSpeaking = false;

async function getKokoroJs() {
  if (!_kokoroJs) {
    console.log('[TTS] Loading Kokoro model (first run may download ~300 MB)...');
    const { KokoroTTS } = await import('kokoro-js');
    _kokoroJs = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0', {
      dtype: 'q8',
    });
    console.log('[TTS] Kokoro ready.');
  }
  return _kokoroJs;
}

/**
 * Speak text aloud using the configured TTS provider.
 * If already speaking and interrupt=false, the call is skipped.
 *
 * @param {string} text
 * @param {object} [opts]
 * @param {boolean} [opts.interrupt=false] - Skip if already speaking when false
 */
export async function speak(text, { interrupt = false } = {}) {
  if (!config.tts.enabled) return;
  if (_isSpeaking && !interrupt) return;

  _isSpeaking = true;
  const tempFile = join(tmpdir(), `aegis-tts-${Date.now()}.wav`);

  try {
    if (config.tts.provider === 'kokoro-fastapi') {
      await speakViaFastApi(text, tempFile);
    } else {
      await speakViaKokoroJs(text, tempFile);
    }
    await playWav(tempFile);
  } catch (err) {
    console.error('[TTS] Error:', err.message);
  } finally {
    _isSpeaking = false;
    rm(tempFile, { force: true }).catch(() => {});
  }
}

export function isSpeaking() {
  return _isSpeaking;
}

async function speakViaFastApi(text, outputPath) {
  const { baseUrl } = config.tts.kokoroFastapi;

  // Sanitize text — apostrophes/smart quotes cause JSON parse errors in kokoro-fastapi
  const sanitized = text.replace(/['']/g, "'").replace(/[""]/g, '"');

  const response = await fetch(`${baseUrl}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'kokoro',
      input: sanitized,
      voice: config.tts.voice,
      speed: config.tts.speed,
      response_format: 'wav',
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`kokoro-fastapi responded ${response.status}: ${await response.text()}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await writeFile(outputPath, Buffer.from(arrayBuffer));
}

async function speakViaKokoroJs(text, outputPath) {
  const tts = await getKokoroJs();
  const audio = await tts.generate(text, {
    voice: config.tts.voice,
    speed: config.tts.speed,
  });
  await audio.save(outputPath);
}

// ffplay via WinGet install — falls back to PATH if not found there
const FFPLAY_WINGET = `${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.0-full_build\\bin\\ffplay.exe`;
const FFPLAY = process.env.FFPLAY_PATH ?? FFPLAY_WINGET;

async function playWav(filePath) {
  const platform = process.platform;
  if (platform === 'win32') {
    // Try resolved path first, fall back to ffplay on PATH
    try {
      await execAsync(`"${FFPLAY}" -nodisp -autoexit "${filePath}"`, { windowsHide: true });
    } catch {
      await execAsync(`ffplay -nodisp -autoexit "${filePath}"`, { windowsHide: true });
    }
  } else if (platform === 'darwin') {
    await execAsync(`afplay "${filePath}"`);
  } else {
    try {
      await execAsync(`paplay "${filePath}"`);
    } catch {
      await execAsync(`aplay "${filePath}"`);
    }
  }
}
