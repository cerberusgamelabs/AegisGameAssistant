// Aegis Game Assistant — user configuration
// Edit this file to customize behavior.

export default {
  game: {
    // Name of the game you're playing (shown to the LLM for context)
    name: 'Valheim',

    // Rolling conversation memory — number of past interactions to include
    // Set to 0 to disable
    memoryInteractions: 10,

    // System prompt sent to the LLM on every request
    systemPrompt:
      'You are Aegis, an AI assistant for the survival game Valheim. ' +
      'Analyze the screenshot and give concise, actionable advice in 1-3 sentences. ' +
      'Pay attention to: health and stamina bars, equipped gear, visible enemies or biome, ' +
      'active status effects, and inventory if open. ' +
      'Prioritize immediate survival threats, then resources or objectives.',
  },

  llm: {
    // Active provider: 'ollama' | 'anthropic' | 'openai'
    provider: 'ollama',

    ollama: {
      baseUrl: 'http://localhost:11434',
      // Must be a vision-capable model (e.g. llava, llava-phi3, moondream, minicpm-v)
      model: 'moondream',
    },

    anthropic: {
      // Requires ANTHROPIC_API_KEY in .env
      model: 'claude-opus-4-6',
    },

    openai: {
      // Requires OPENAI_API_KEY in .env
      // Set baseUrl to use a custom/local OpenAI-compatible endpoint
      baseUrl: undefined,
      model: 'gpt-4o',
    },
  },

  capture: {
    // How often to auto-analyze the screen (in seconds)
    intervalSeconds: 15,

    // Which monitor to capture (0 = primary)
    monitor: 0,
  },

  tts: {
    enabled: true,

    // 'kokoro-fastapi' — uses your local kokoro-fastapi server (faster, GPU-accelerated)
    // 'kokoro-js'      — runs Kokoro ONNX model directly in Node (no server needed)
    provider: 'kokoro-fastapi',

    kokoroFastapi: {
      baseUrl: 'http://localhost:8880',
    },

    // Kokoro voice — options: af_heart, af_bella, af_sarah, am_adam, am_michael,
    //   bf_emma, bf_isabella, bm_george, bm_lewis
    voice: 'af_heart',

    // Playback speed (1.0 = normal)
    speed: 1.0,
  },

  hotkeys: {
    // Immediately analyze the current screen
    analyze: 'F9',

    // Hold to record voice input, release to process
    voiceInput: 'F10',

    // Pause / resume the auto-capture interval
    togglePause: 'F11',
  },

  stt: {
    // Set to false to disable voice input entirely (no SoX required)
    enabled: false,

    // Whisper model — 'Xenova/whisper-tiny.en' is fastest; swap for larger for accuracy
    model: 'Xenova/whisper-tiny.en',

    // Audio sample rate for recording
    sampleRate: 16000,
  },
};
