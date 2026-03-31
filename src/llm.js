import 'dotenv/config';
import config from '../config.js';

// Lazy-loaded provider clients
let _ollama, _anthropic, _openai;

async function getOllama() {
  if (!_ollama) {
    const { Ollama } = await import('ollama');
    _ollama = new Ollama({ host: config.llm.ollama.baseUrl });
  }
  return _ollama;
}

async function getAnthropic() {
  if (!_anthropic) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

async function getOpenAI() {
  if (!_openai) {
    const { default: OpenAI } = await import('openai');
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      ...(config.llm.openai.baseUrl ? { baseURL: config.llm.openai.baseUrl } : {}),
    });
  }
  return _openai;
}

/**
 * Send a screenshot + optional text query to the configured LLM provider.
 *
 * @param {string}   base64Image - Base64-encoded PNG (no data URI prefix)
 * @param {string}   [userQuery] - Additional text from the user (voice/hotkey query)
 * @param {Array}    [history]   - Prior interactions [{ userText, assistantText }, ...]
 * @returns {Promise<string>}    - LLM response text
 */
export async function queryLLM(base64Image, userQuery, history = []) {
  const systemPrompt = config.game.systemPrompt;
  const gameContext = `Game: ${config.game.name}`;
  const userText = userQuery
    ? `${gameContext}\n\nUser question: ${userQuery}`
    : `${gameContext}\n\nAnalyze this screenshot and provide concise gaming advice.`;

  switch (config.llm.provider) {
    case 'ollama':
      return queryOllama(base64Image, systemPrompt, userText, history);
    case 'anthropic':
      return queryAnthropic(base64Image, systemPrompt, userText, history);
    case 'openai':
      return queryOpenAI(base64Image, systemPrompt, userText, history);
    default:
      throw new Error(`Unknown LLM provider: "${config.llm.provider}"`);
  }
}

async function queryOllama(base64Image, systemPrompt, userText, history) {
  const ollama = await getOllama();

  // Prior turns are text-only; only the current turn includes the screenshot
  const historyMessages = history.flatMap(({ userText: u, assistantText: a }) => [
    { role: 'user', content: u },
    { role: 'assistant', content: a },
  ]);

  const response = await ollama.chat({
    model: config.llm.ollama.model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: userText, images: [base64Image] },
    ],
  });
  return response.message.content.trim();
}

async function queryAnthropic(base64Image, systemPrompt, userText, history) {
  const anthropic = await getAnthropic();

  const historyMessages = history.flatMap(({ userText: u, assistantText: a }) => [
    { role: 'user', content: u },
    { role: 'assistant', content: a },
  ]);

  const response = await anthropic.messages.create({
    model: config.llm.anthropic.model,
    max_tokens: 512,
    system: systemPrompt,
    messages: [
      ...historyMessages,
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64Image } },
          { type: 'text', text: userText },
        ],
      },
    ],
  });
  return response.content[0].text.trim();
}

async function queryOpenAI(base64Image, systemPrompt, userText, history) {
  const openai = await getOpenAI();

  const historyMessages = history.flatMap(({ userText: u, assistantText: a }) => [
    { role: 'user', content: u },
    { role: 'assistant', content: a },
  ]);

  const response = await openai.chat.completions.create({
    model: config.llm.openai.model,
    max_tokens: 512,
    messages: [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Image}` } },
        ],
      },
    ],
  });
  return response.choices[0].message.content.trim();
}
