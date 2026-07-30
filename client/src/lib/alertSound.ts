/**
 * Dryness alert chime, synthesised with WebAudio.
 *
 * No audio file: a two-note blip is a few lines of oscillator code, ships nothing extra,
 * and works offline. The AudioContext must be created or resumed inside a user gesture or
 * browsers refuse to play anything later — `unlockAlertSound()` is called from the
 * Start capture click for exactly that reason.
 */

const SOUND_KEY = "pipo-care-alert-sound";

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  return ctx;
}

/** True unless the user switched the sound off in Settings. */
export function alertSoundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setAlertSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "1" : "0");
  } catch {
    /* private mode — the setting just will not persist */
  }
}

/** Call from a click/tap so the context is allowed to make noise afterwards. */
export function unlockAlertSound() {
  const c = audioContext();
  if (c && c.state === "suspended") void c.resume();
}

/**
 * Two short rising blips. Deliberately gentle — this can repeat every few seconds
 * while the user is on another tab, so it has to be noticeable without being punishing.
 */
export function playAlertChime() {
  if (!alertSoundEnabled()) return;
  const c = audioContext();
  if (!c) return;
  if (c.state === "suspended") void c.resume();

  const start = c.currentTime;
  [880, 1174.7].forEach((frequency, i) => {
    const at = start + i * 0.18;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.18, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    osc.connect(gain).connect(c.destination);
    osc.start(at);
    osc.stop(at + 0.18);
  });
}
