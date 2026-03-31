import { tmpdir } from 'os';
import { join } from 'path';
import { rm } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import config from '../config.js';

const execAsync = promisify(exec);

let _tts = null;
let _isSpeaking = false;

async function getTTS() {
  if (!_tts) {
    console.log('[TTS] Loading Kokoro model (first run may download ~300 MB)...');
    const { KokoroTTS } = await import('kokoro-js');
    _tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0', {
      dtype: 'q8',
    });
    console.log('[TTS] Kokoro ready.');
  }
  return _tts;
}

/**
 * Speak text aloud using Kokoro TTS.
 * If already speaking, the current speech is interrupted.
 *
 * @param {string} text
 * @param {object} [opts]
 * @param {boolean} [opts.interrupt=false] - Cancel any in-progress speech
 */
export async function speak(text, { interrupt = false } = {}) {
  if (!config.tts.enabled) return;
  if (_isSpeaking && !interrupt) return;

  _isSpeaking = true;
  const tempFile = join(tmpdir(), `aegis-tts-${Date.now()}.wav`);

  try {
    const tts = await getTTS();
    const audio = await tts.generate(text, {
      voice: config.tts.voice,
      speed: config.tts.speed,
    });

    await audio.save(tempFile);
    await playWav(tempFile);
  } catch (err) {
    console.error('[TTS] Error:', err.message);
  } finally {
    _isSpeaking = false;
    rm(tempFile, { force: true }).catch(() => {});
  }
}

/** Returns true if TTS is currently playing audio. */
export function isSpeaking() {
  return _isSpeaking;
}

/** Platform-appropriate WAV playback. */
async function playWav(filePath) {
  const platform = process.platform;

  if (platform === 'win32') {
    await execAsync(
      `powershell -NoProfile -Command "(New-Object Media.SoundPlayer '${filePath}').PlaySync()"`,
    );
  } else if (platform === 'darwin') {
    await execAsync(`afplay "${filePath}"`);
  } else {
    // Linux — try paplay (PulseAudio) then aplay (ALSA)
    try {
      await execAsync(`paplay "${filePath}"`);
    } catch {
      await execAsync(`aplay "${filePath}"`);
    }
  }
}
