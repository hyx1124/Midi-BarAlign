import type { Note } from "./types";

interface ActiveOsc {
  osc: OscillatorNode;
  gain: GainNode;
}

export interface PlayerState {
  isPlaying: boolean;
  playbackSpeed: number;
  currentTime: number;
  notes: Note[];
  totalDuration: number;
  audioCtx: AudioContext | null;
  activeOscs: Map<number, ActiveOsc>;
  rafId: number | null;
  lastFrameTime: number;
  onTick: ((time: number) => void) | null;
}

const SCHEDULE_AHEAD = 0.05; // 50ms look-ahead

function midiToFreq(pitch: number): number {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}

export function createPlayerState(): PlayerState {
  return {
    isPlaying: false,
    playbackSpeed: 1,
    currentTime: 0,
    notes: [],
    totalDuration: 0,
    audioCtx: null,
    activeOscs: new Map(),
    rafId: null,
    lastFrameTime: 0,
    onTick: null,
  };
}

function ensureAudioContext(state: PlayerState): AudioContext {
  if (!state.audioCtx) {
    state.audioCtx = new AudioContext();
  }
  return state.audioCtx;
}

function scheduleNotes(state: PlayerState): void {
  const ctx = state.audioCtx;
  if (!ctx) return;

  const now = state.currentTime;
  const ahead = now + SCHEDULE_AHEAD;
  const speed = state.playbackSpeed;
  const ctxNow = ctx.currentTime;

  for (let i = 0; i < state.notes.length; i++) {
    const note = state.notes[i];

    // Skip notes that are already past
    if (note.offset <= now) {
      // Stop oscillator if still running
      const active = state.activeOscs.get(i);
      if (active) {
        try {
          active.gain.gain.cancelScheduledValues(ctxNow);
          active.gain.gain.setValueAtTime(active.gain.gain.value, ctxNow);
          active.gain.gain.exponentialRampToValueAtTime(0.001, ctxNow + 0.02);
          active.osc.stop(ctxNow + 0.03);
        } catch {
          // Already stopped
        }
        state.activeOscs.delete(i);
      }
      continue;
    }

    // Skip notes in the far future
    if (note.onset > ahead) continue;

    // Skip notes already scheduled
    if (state.activeOscs.has(i)) continue;

    // This note should be playing now
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.value = midiToFreq(note.pitch);

      // ADSR envelope
      const startTime = ctxNow;
      const attackTime = 0.01;
      const sustainLevel = 0.3 * (note.velocity / 127);
      const releaseTime = Math.min(0.05, note.duration * speed * 0.3);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(sustainLevel, startTime + attackTime);

      // Schedule release
      const noteEndInContext = startTime + note.duration * speed;
      gain.gain.setValueAtTime(sustainLevel, noteEndInContext - releaseTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteEndInContext);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(noteEndInContext + 0.01);

      state.activeOscs.set(i, { osc, gain });
    } catch {
      // Ignore scheduling errors
    }
  }
}

function stopAllOscillators(state: PlayerState): void {
  for (const [, active] of state.activeOscs) {
    try {
      active.osc.stop();
    } catch {
      // Already stopped
    }
  }
  state.activeOscs.clear();
}

function playbackLoop(state: PlayerState): void {
  if (!state.isPlaying) return;

  const now = performance.now();
  const deltaMs = state.lastFrameTime > 0 ? now - state.lastFrameTime : 0;
  state.lastFrameTime = now;

  // Clamp delta to avoid huge jumps (e.g. tab was backgrounded)
  const clampedDelta = Math.min(deltaMs, 200);
  const deltaSec = (clampedDelta / 1000) * state.playbackSpeed;

  state.currentTime += deltaSec;

  // Check if playback reached the end
  if (state.currentTime >= state.totalDuration) {
    state.currentTime = state.totalDuration;
    state.isPlaying = false;
    stopAllOscillators(state);
    if (state.onTick) state.onTick(state.currentTime);
    return;
  }

  scheduleNotes(state);

  if (state.onTick) {
    state.onTick(state.currentTime);
  }

  state.rafId = requestAnimationFrame(() => playbackLoop(state));
}

export function startPlayback(state: PlayerState, notes: Note[], totalDuration: number): void {
  const ctx = ensureAudioContext(state);

  // Resume AudioContext if suspended (browser autoplay policy)
  if (ctx.state === "suspended") {
    ctx.resume();
  }

  state.notes = notes;
  state.totalDuration = totalDuration;

  // If already at the end, restart from beginning
  if (state.currentTime >= totalDuration) {
    state.currentTime = 0;
  }

  state.isPlaying = true;
  state.lastFrameTime = 0;
  state.rafId = requestAnimationFrame(() => playbackLoop(state));
}

export function pausePlayback(state: PlayerState): void {
  state.isPlaying = false;
  if (state.rafId !== null) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
  stopAllOscillators(state);
  if (state.onTick) state.onTick(state.currentTime);
}

export function stopPlayback(state: PlayerState): void {
  state.isPlaying = false;
  if (state.rafId !== null) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
  stopAllOscillators(state);
  state.currentTime = 0;
  if (state.onTick) state.onTick(0);
}

export function setSpeed(state: PlayerState, speed: number): void {
  state.playbackSpeed = speed;
}

export function getFormattedTime(state: PlayerState): string {
  const fmt = (t: number) => {
    const totalSec = Math.floor(t);
    const tenth = Math.floor((t - totalSec) * 10);
    return `${totalSec}.${tenth}s`;
  };
  return `${fmt(state.currentTime)} / ${fmt(state.totalDuration)}`;
}
