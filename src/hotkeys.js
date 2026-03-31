import { GlobalKeyboardListener } from 'node-global-key-listener';
import config from '../config.js';

let _listener = null;

/**
 * Register global hotkeys.
 *
 * @param {object} callbacks
 * @param {() => void} callbacks.onAnalyze       - Triggered on analyze hotkey press
 * @param {() => void} callbacks.onVoiceStart    - Triggered on voice hotkey DOWN
 * @param {() => void} callbacks.onVoiceStop     - Triggered on voice hotkey UP
 * @param {() => void} callbacks.onTogglePause   - Triggered on pause toggle hotkey
 */
export function setupHotkeys({ onAnalyze, onVoiceStart, onVoiceStop, onTogglePause }) {
  _listener = new GlobalKeyboardListener();

  const { analyze, voiceInput, togglePause } = config.hotkeys;

  _listener.addListener((event) => {
    const key = event.name?.toUpperCase();
    const isDown = event.state === 'DOWN';

    if (key === analyze.toUpperCase() && isDown) {
      onAnalyze();
      return;
    }

    if (key === voiceInput.toUpperCase()) {
      if (isDown) onVoiceStart();
      else onVoiceStop();
      return;
    }

    if (key === togglePause.toUpperCase() && isDown) {
      onTogglePause();
    }
  });

  console.log(
    `[Hotkeys] ${analyze}=Analyze  ${voiceInput}=Voice (hold)  ${togglePause}=Pause/Resume`,
  );
}

export function stopHotkeys() {
  _listener?.kill();
  _listener = null;
}
