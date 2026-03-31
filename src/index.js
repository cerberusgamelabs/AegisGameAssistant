import 'dotenv/config';
import { Assistant } from './assistant.js';

const assistant = new Assistant();
assistant.start().catch((err) => {
  console.error('[Aegis] Fatal startup error:', err);
  process.exit(1);
});
