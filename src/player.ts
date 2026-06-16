import type { Note } from "./types";
import { WorkletSynthesizer } from "spessasynth_lib";

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
  sfMode: "square" | "soundfont";
  sfSynth: WorkletSynthesizer | null;
  sfLoadError: boolean;
  sfChannel: number;
  sfActiveNotes: Set<number>;
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
    sfMode: "square",
    sfSynth: null,
    sfLoadError: false,
    sfChannel: 0,
    sfActiveNotes: new Set(),
  };
}

function ensureAudioContext(state: PlayerState): AudioContext {
  if (!state.audioCtx) {
    state.audioCtx = new AudioContext();
  }
  return state.audioCtx;
}

export async function initSoundFontPlayer(state: PlayerState): Promise<boolean> {
  if (state.sfSynth) return true; // already initialized

  try {
    const ctx = ensureAudioContext(state);

    // Load worklet processor
    await ctx.audioWorklet.addModule("./spessasynth_processor.min.js");

    // Fetch sf3 file
    const response = await fetch("./MS Basic.sf3");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const sfontBuffer = await response.arrayBuffer();

    // Initialize synthesizer
    const synth = new WorkletSynthesizer(ctx);
    await synth.soundBankManager.addSoundBank(sfontBuffer, "main");
    await synth.isReady;

    // Set to Acoustic Grand Piano (program 0) on channel 0
    synth.programChange(state.sfChannel, 0);

    state.sfSynth = synth;
    state.sfMode = "soundfont";
    state.sfLoadError = false;
    console.log("SoundFont loaded successfully: MS Basic.sf3");
    return true;
  } catch (err) {
    console.warn("SoundFont load failed, falling back to square wave:", err);
    state.sfSynth = null;
    state.sfMode = "square";
    state.sfLoadError = true;
    return false;
  }
}

function scheduleNotesSquare(state: PlayerState): void {
  const ctx = state.audioCtx;
  if (!ctx) return;

  const now = state.currentTime;
  const ahead = now + SCHEDULE_AHEAD;
  const speed = state.playbackSpeed;
  const ctxNow = ctx.currentTime;

  for (let i = 0; i < state.notes.length; i++) {
    const note = state.notes[i];

    if (note.offset <= now) {
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

    if (note.onset > ahead) continue;
    if (state.activeOscs.has(i)) continue;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.value = midiToFreq(note.pitch);

      const startTime = ctxNow;
      const attackTime = 0.01;
      const sustainLevel = 0.3 * (note.velocity / 127);
      const releaseTime = Math.min(0.05, note.duration * speed * 0.3);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(sustainLevel, startTime + attackTime);

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

function scheduleNotesSoundFont(state: PlayerState): void {
  const synth = state.sfSynth;
  if (!synth) return;

  const now = state.currentTime;
  const ahead = now + SCHEDULE_AHEAD;
  const ch = state.sfChannel;

  for (let i = 0; i < state.notes.length; i++) {
    const note = state.notes[i];

    // Stop notes that are past
    if (note.offset <= now) {
      if (state.sfActiveNotes.has(i)) {
        synth.noteOff(ch, note.pitch);
        state.sfActiveNotes.delete(i);
      }
      continue;
    }

    // Skip future notes
    if (note.onset > ahead) continue;

    // Skip already playing
    if (state.sfActiveNotes.has(i)) continue;

    // Play this note
    synth.noteOn(ch, note.pitch, note.velocity);
    state.sfActiveNotes.add(i);
  }
}

function scheduleNotes(state: PlayerState): void {
  if (state.sfMode === "soundfont") {
    scheduleNotesSoundFont(state);
  } else {
    scheduleNotesSquare(state);
  }
}

function stopAllSound(state: PlayerState): void {
  // Stop square wave oscillators
  for (const [, active] of state.activeOscs) {
    try {
      active.osc.stop();
    } catch {
      // Already stopped
    }
  }
  state.activeOscs.clear();

  // Stop SoundFont notes
  if (state.sfSynth) {
    for (const noteIdx of state.sfActiveNotes) {
      const note = state.notes[noteIdx];
      if (note) {
        state.sfSynth.noteOff(state.sfChannel, note.pitch);
      }
    }
    state.sfActiveNotes.clear();
  }
}

function playbackLoop(state: PlayerState): void {
  if (!state.isPlaying) return;

  const now = performance.now();
  const deltaMs = state.lastFrameTime > 0 ? now - state.lastFrameTime : 0;
  state.lastFrameTime = now;

  const clampedDelta = Math.min(deltaMs, 200);
  const deltaSec = (clampedDelta / 1000) * state.playbackSpeed;

  state.currentTime += deltaSec;

  if (state.currentTime >= state.totalDuration) {
    state.currentTime = state.totalDuration;
    state.isPlaying = false;
    stopAllSound(state);
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

  if (ctx.state === "suspended") {
    ctx.resume();
  }

  state.notes = notes;
  state.totalDuration = totalDuration;

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
  stopAllSound(state);
  if (state.onTick) state.onTick(state.currentTime);
}

export function stopPlayback(state: PlayerState): void {
  state.isPlaying = false;
  if (state.rafId !== null) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
  stopAllSound(state);
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

export function destroyPlayer(state: PlayerState): void {
  stopPlayback(state);
  if (state.sfSynth) {
    for (const noteIdx of state.sfActiveNotes) {
      const note = state.notes[noteIdx];
      if (note) {
        state.sfSynth.noteOff(state.sfChannel, note.pitch);
      }
    }
    state.sfActiveNotes.clear();
    state.sfSynth = null;
  }
  if (state.audioCtx) {
    state.audioCtx.close();
    state.audioCtx = null;
  }
}
