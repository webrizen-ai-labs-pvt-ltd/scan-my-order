// Centralized Quantum Audio & Notification Sound Player
// Provides browser autoplay unlocking, volume/mute state persistence, and haptic feedback

import { DEFAULT_NOTIFICATION_SOUND, isNotificationSound } from "./sounds.mjs";

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
 * Synthesizes a crisp, pleasant two-tone bell chime using Web Audio API
 * Guaranteed to work without external network assets
 */
export function playSynthesizedChime(volume = 0.5) {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = audioContext || new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    const now = ctx.currentTime;
    
    // Tone 1: D5 (587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(Math.max(0.01, volume * 0.4), now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2: A5 (880 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.1);
    gain2.gain.setValueAtTime(Math.max(0.01, volume * 0.5), now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.55);
  } catch (e) {
    // Ignore fallback failure
  }
}

// The sound the current store chose; every notification on this screen uses it
let currentSound = DEFAULT_NOTIFICATION_SOUND;

/** Sets which sound notifications play (a key from @smo/shared/sounds); unknown keys fall back to the default */
export function setNotificationSound(key) {
  currentSound = isNotificationSound(key) ? key : DEFAULT_NOTIFICATION_SOUND;
}

export function getNotificationSound() {
  return currentSound;
}

// Each generated sound is a list of notes: [frequency Hz, start s, length s, loudness 0-1, wave shape]
const SYNTH_SOUNDS = {
  chime: [[587.33, 0, 0.35, 0.4, "sine"], [880, 0.1, 0.45, 0.5, "sine"]],
  bell: [[880, 0, 1.3, 0.5, "sine"], [1760, 0, 0.9, 0.18, "sine"], [2640, 0, 0.5, 0.08, "sine"]],
  dingdong: [[659.25, 0, 0.5, 0.5, "sine"], [523.25, 0.42, 0.8, 0.5, "sine"]],
  beeps: [[1000, 0, 0.11, 0.3, "square"], [1000, 0.19, 0.11, 0.3, "square"], [1000, 0.38, 0.11, 0.3, "square"]],
  alert: [[740, 0, 0.16, 0.34, "square"], [1040, 0.17, 0.16, 0.34, "square"], [740, 0.4, 0.16, 0.34, "square"], [1040, 0.57, 0.22, 0.34, "square"]],
  soft: [[523.25, 0, 0.9, 0.35, "sine"]]
};

/** Plays one of the generated sounds. Needs no audio file, so it works offline too. */
export function playSynthesizedSound(key, volume = 0.5) {
  const notes = SYNTH_SOUNDS[key];
  if (!notes) return playSynthesizedChime(volume);
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = audioContext || (audioContext = new AudioCtx());
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    for (const [frequency, start, length, loudness, shape] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = shape;
      osc.frequency.setValueAtTime(frequency, now + start);
      gain.gain.setValueAtTime(Math.max(0.0001, volume * loudness), now + start);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + length);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + length);
    }
  } catch (e) {
    // Sound is a nicety; never let it break the screen
  }
}

/**
 * Play the centralized notification audio chime
 * @param {Object} options
 * @param {string} [options.soundUrl] - Path to audio, defaults to '/audios/notification.mp3'
 * @param {number} [options.volume] - Volume between 0.0 and 1.0
 * @param {boolean} [options.force] - Play even if muted (useful for settings test button)
 * @param {boolean} [options.haptic] - Trigger device vibration if supported
 * @param {string} [options.sound] - A sound key to play instead of the store's chosen one (e.g. to preview it)
 */
export async function playNotificationChime(options = {}) {
  if (typeof window === "undefined") return;

  const {
    soundUrl = "/audios/notification.mp3",
    volume = getAudioVolume(),
    force = false,
    haptic = true,
    sound = currentSound
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

  // Every sound except the classic one is generated on the spot
  if (sound !== DEFAULT_NOTIFICATION_SOUND && isNotificationSound(sound)) {
    playSynthesizedSound(sound, volume);
    return;
  }

  try {
    const audio = new Audio(soundUrl);
    audio.volume = Math.max(0, Math.min(1, volume));
    
    audio.onerror = () => {
      // Fallback to Web Audio synthesized chime if file loading fails
      playSynthesizedChime(volume);
    };

    const playPromise = audio.play();
    if (playPromise) {
      await playPromise.catch(() => {
        // Fallback to Web Audio synthesized chime if play was blocked/failed
        playSynthesizedChime(volume);
      });
    }
  } catch (err) {
    playSynthesizedChime(volume);
  }
}
