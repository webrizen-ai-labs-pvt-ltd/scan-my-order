// Centralized Quantum Audio & Notification Sound Player
// Provides browser autoplay unlocking, volume/mute state persistence, and haptic feedback

const STORAGE_KEY_MUTED = "smo_sound_muted";
const STORAGE_KEY_VOLUME = "smo_sound_volume";

let isUnlocked = false;
let audioContext = null;
let primedAudio = null;

/**
 * Initialize AudioContext and unlock browser autoplay restrictions on first user gesture
 */
export function initAudioUnlock() {
  if (typeof window === "undefined" || isUnlocked) return;

  const unlock = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx && !audioContext) {
        audioContext = new AudioCtx();
        if (audioContext.state === "suspended") {
          audioContext.resume();
        }
      }

      // Prime an audio element with empty buffer
      if (!primedAudio) {
        primedAudio = new Audio("/audios/notification.mp3");
        primedAudio.volume = 0.01;
        const playPromise = primedAudio.play();
        if (playPromise) {
          playPromise
            .then(() => {
              primedAudio.pause();
              primedAudio.currentTime = 0;
              primedAudio.volume = getAudioVolume();
            })
            .catch(() => {
              // Ignore failure on silent priming
            });
        }
      }

      isUnlocked = true;
    } catch (e) {
      // Autoplay unlock fallback
    } finally {
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("keydown", unlock);
    }
  };

  window.addEventListener("click", unlock, { once: true, passive: true });
  window.addEventListener("touchstart", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true, passive: true });
}

export function getAudioMuted() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY_MUTED) === "true";
}

export function setAudioMuted(muted) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_MUTED, muted ? "true" : "false");
}

export function getAudioVolume() {
  if (typeof window === "undefined") return 1.0;
  const val = localStorage.getItem(STORAGE_KEY_VOLUME);
  if (val !== null) {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= 1) return num;
  }
  return 1.0;
}

export function setAudioVolume(volume) {
  if (typeof window === "undefined") return;
  const clamped = Math.max(0, Math.min(1, Number(volume) || 0));
  localStorage.setItem(STORAGE_KEY_VOLUME, clamped.toString());
}

/**
 * Play the centralized notification audio chime
 * @param {Object} options
 * @param {string} [options.soundUrl] - Path to audio, defaults to '/audios/notification.mp3'
 * @param {number} [options.volume] - Volume between 0.0 and 1.0
 * @param {boolean} [options.force] - Play even if muted (useful for settings test button)
 * @param {boolean} [options.haptic] - Trigger device vibration if supported
 */
export async function playNotificationChime(options = {}) {
  if (typeof window === "undefined") return;

  const {
    soundUrl = "/audios/notification.mp3",
    volume = getAudioVolume(),
    force = false,
    haptic = true
  } = options;

  if (getAudioMuted() && !force) {
    return;
  }

  // Haptic feedback
  if (haptic && typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate([150, 75, 150]);
    } catch (e) {
      // Vibrate not permitted
    }
  }

  try {
    const audio = new Audio(soundUrl);
    audio.volume = Math.max(0, Math.min(1, volume));
    
    // Fallback URL if local public audio fails
    audio.onerror = () => {
      if (soundUrl !== "/assets/audios/notification.mp3") {
        const fallbackAudio = new Audio("/assets/audios/notification.mp3");
        fallbackAudio.volume = audio.volume;
        fallbackAudio.play().catch(() => {});
      }
    };

    const playPromise = audio.play();
    if (playPromise) {
      await playPromise;
    }
  } catch (err) {
    console.debug("[AudioPlayer] Notification chime blocked by browser policy:", err.message);
  }
}
