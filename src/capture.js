import screenshot from 'screenshot-desktop';
import config from '../config.js';

/**
 * Captures the configured monitor and returns a base64-encoded PNG string.
 * @returns {Promise<string>} Base64 PNG (no data URI prefix)
 */
export async function captureScreen() {
  const buffer = await screenshot({ screen: config.capture.monitor, format: 'png' });
  return buffer.toString('base64');
}
