/**
 * Speech-to-text via Whisper (@huggingface/transformers).
 *
 * Requirements:
 *   - SoX must be installed and on your PATH (https://sourceforge.net/projects/sox/)
 *   - On Windows: install SoX and ensure sox.exe is accessible in PATH
 *
 * Voice input is automatically disabled if SoX is not available.
 */

import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { rm } from 'fs/promises';
import recorder from 'node-record-lpcm16';
import config from '../config.js';

let _pipeline = null;
let _recording = null;
let _recordingChunks = [];
let _resolveRecording = null;

async function getPipeline() {
  if (!_pipeline) {
    console.log('[STT] Loading Whisper model (first run may download ~150 MB)...');
    const { pipeline } = await import('@huggingface/transformers');
    _pipeline = await pipeline('automatic-speech-recognition', config.stt.model, {
      dtype: 'fp32',
    });
    console.log('[STT] Whisper ready.');
  }
  return _pipeline;
}

/**
 * Start recording microphone audio.
 * Call stopRecording() to finalize and transcribe.
 */
export function startRecording() {
  if (_recording) return;

  _recordingChunks = [];
  _recording = recorder.record({
    sampleRateHertz: config.stt.sampleRate,
    threshold: 0,
    silence: '60.0', // effectively infinite — we stop manually
    recordProgram: 'sox',
    channels: 1,
    audioType: 'wav',
  });

  _recording.stream().on('data', (chunk) => {
    _recordingChunks.push(chunk);
  });

  _recording.stream().on('error', (err) => {
    console.error('[STT] Recording error:', err.message);
    if (_resolveRecording) _resolveRecording(null);
  });
}

/**
 * Stop the active recording and transcribe it.
 * @returns {Promise<string|null>} Transcribed text, or null on failure.
 */
export async function stopAndTranscribe() {
  if (!_recording) return null;

  _recording.stop();
  _recording = null;

  if (_recordingChunks.length === 0) return null;

  const tempFile = join(tmpdir(), `aegis-stt-${Date.now()}.wav`);
  try {
    // Combine all chunks and write WAV to temp file
    const buffer = Buffer.concat(_recordingChunks);
    await writeWavFile(tempFile, buffer, config.stt.sampleRate);

    const pipe = await getPipeline();
    const result = await pipe(tempFile);
    return result?.text?.trim() ?? null;
  } catch (err) {
    console.error('[STT] Transcription error:', err.message);
    return null;
  } finally {
    _recordingChunks = [];
    rm(tempFile, { force: true }).catch(() => {});
  }
}

/**
 * Write raw PCM samples to a WAV file with proper headers.
 */
async function writeWavFile(filePath, pcmBuffer, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);         // PCM chunk size
  header.writeUInt16LE(1, 20);          // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  const { writeFile } = await import('fs/promises');
  await writeFile(filePath, Buffer.concat([header, pcmBuffer]));
}
