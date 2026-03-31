import config from '../config.js';
import { captureScreen } from './capture.js';
import { queryLLM } from './llm.js';
import { speak, isSpeaking } from './tts.js';
import { setupHotkeys } from './hotkeys.js';
import { startRecording, stopAndTranscribe } from './stt.js';

export class Assistant {
  constructor() {
    this.paused = false;
    this.busy = false;          // prevents overlapping LLM calls
    this._intervalId = null;
  }

  async start() {
    console.log(`\n=== Aegis Game Assistant ===`);
    console.log(`Game     : ${config.game.name}`);
    console.log(`Provider : ${config.llm.provider}`);
    console.log(`Interval : ${config.capture.intervalSeconds}s`);
    console.log(`TTS      : ${config.tts.enabled ? `on (${config.tts.voice})` : 'off'}`);
    console.log(`STT      : ${config.stt.enabled ? 'on' : 'off'}`);
    console.log('============================\n');

    // Register global hotkeys
    setupHotkeys({
      onAnalyze: () => this._handleManualTrigger(),
      onVoiceStart: () => this._handleVoiceStart(),
      onVoiceStop: () => this._handleVoiceStop(),
      onTogglePause: () => this._handleTogglePause(),
    });

    // Start auto-capture interval
    this._startInterval();

    // Keep process alive
    process.on('SIGINT', () => this.stop());
  }

  stop() {
    console.log('\n[Aegis] Shutting down...');
    if (this._intervalId) clearInterval(this._intervalId);
    process.exit(0);
  }

  // ─── Internal ────────────────────────────────────────────────────────────────

  _startInterval() {
    const ms = config.capture.intervalSeconds * 1000;
    this._intervalId = setInterval(() => this._handleAutoCapture(), ms);
    console.log(`[Aegis] Auto-capture every ${config.capture.intervalSeconds}s. Press Ctrl+C to quit.`);
  }

  async _handleAutoCapture() {
    if (this.paused || this.busy || isSpeaking()) return;
    await this._analyze({ mode: 'auto' });
  }

  async _handleManualTrigger() {
    if (this.busy) return;
    console.log('[Aegis] Manual analysis triggered.');
    await this._analyze({ mode: 'manual', interrupt: true });
  }

  async _handleVoiceStart() {
    if (!config.stt.enabled) return;
    console.log('[Aegis] Recording... (release key to stop)');
    try {
      startRecording();
    } catch (err) {
      console.error('[Aegis] Voice start failed (is SoX installed?):', err.message);
    }
  }

  async _handleVoiceStop() {
    if (!config.stt.enabled) return;
    if (this.busy) return;

    console.log('[Aegis] Processing voice input...');
    const text = await stopAndTranscribe();

    if (!text) {
      console.log('[Aegis] No speech detected.');
      return;
    }

    console.log(`[Aegis] Heard: "${text}"`);
    await this._analyze({ mode: 'voice', userQuery: text, interrupt: true });
  }

  _handleTogglePause() {
    this.paused = !this.paused;
    const state = this.paused ? 'PAUSED' : 'RESUMED';
    console.log(`[Aegis] Auto-capture ${state}.`);
    speak(this.paused ? 'Paused.' : 'Resumed.', { interrupt: true });
  }

  async _analyze({ mode, userQuery, interrupt = false } = {}) {
    this.busy = true;
    try {
      const base64Image = await captureScreen();
      console.log(`[Aegis] Querying ${config.llm.provider} (${mode})...`);

      const response = await queryLLM(base64Image, userQuery);
      console.log(`[Aegis] Response: ${response}`);

      await speak(response, { interrupt });
    } catch (err) {
      console.error(`[Aegis] Analysis failed:`, err.message);
    } finally {
      this.busy = false;
    }
  }
}
