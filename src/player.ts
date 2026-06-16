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

const SCHEDULE_AHEAD = 0.05;

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
    console.log("[Audio] Created AudioContext, state:", state.audioCtx.state);
  }
  return state.audioCtx;
}

export async function initSoundFontPlayer(state: PlayerState, file?: File): Promise<boolean> {
  if (state.sfSynth && !file) {
    console.log("[SF] Already initialized, skipping");
    return true;
  }

  // If switching soundfont, destroy old synth first
  if (file && state.sfSynth) {
    console.log("[SF] Switching SoundFont, destroying old synth...");
    for (const noteIdx of state.sfActiveNotes) {
      const note = state.notes[noteIdx];
      if (note) state.sfSynth.noteOff(state.sfChannel, note.pitch);
    }
    state.sfActiveNotes.clear();
    state.sfSynth.destroy();
    state.sfSynth = null;
    state.sfMode = "square";
  }

  console.log("[SF] Starting SoundFont initialization...");
  try {
    const ctx = ensureAudioContext(state);
    console.log("[SF] AudioContext state:", ctx.state);

    // Load worklet processor (idempotent if already loaded)
    console.log("[SF] Loading worklet processor...");
    await ctx.audioWorklet.addModule("./spessasynth_processor.min.js");
    console.log("[SF] Worklet processor loaded");

    // Load sf2/sf3 file
    let sfontBuffer: ArrayBuffer;
    if (file) {
      console.log(`[SF] Reading local SoundFont file: ${file.name}...`);
      sfontBuffer = await file.arrayBuffer();
    } else {
      console.log("[SF] Fetching default SoundFont file (grand+piano.sf2)...");
      const response = await fetch("./grand+piano.sf2");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      sfontBuffer = await response.arrayBuffer();
    }
    console.log("[SF] SoundFont buffer decoded, bytes:", sfontBuffer.byteLength);

    // Initialize synthesizer
    console.log("[SF] Creating WorkletSynthesizer...");
    const synth = new WorkletSynthesizer(ctx);
    synth.connect(ctx.destination);
    console.log("[SF] Connected synth to AudioContext.destination");
    console.log("[SF] Adding sound bank...");
    await synth.soundBankManager.addSoundBank(sfontBuffer, "main");
    console.log("[SF] Waiting for synth to be ready...");
    await synth.isReady;
    console.log("[SF] Synth ready!");

    // Set to Acoustic Grand Piano (program 0) on channel 0
    synth.programChange(state.sfChannel, 0);
    console.log("[SF] Program set to Acoustic Grand Piano");

    state.sfSynth = synth;
    state.sfMode = "soundfont";
    state.sfLoadError = false;
    console.log("[SF] === SoundFont loaded successfully! ===");
    return true;
  } catch (err) {
    console.error("[SF] Load FAILED:", err);
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

  let scheduled = 0;
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
        } catch { /* already stopped */ }
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
      scheduled++;
    } catch { /* ignore */ }
  }

  if (scheduled > 0) {
    console.log("[Square] Scheduled", scheduled, "notes");
  }
}

function scheduleNotesSoundFont(state: PlayerState): void {
  const synth = state.sfSynth;
  if (!synth) return;

  const now = state.currentTime;
  const ahead = now + SCHEDULE_AHEAD;
  const ch = state.sfChannel;

  let started = 0;
  let stopped = 0;

  for (let i = 0; i < state.notes.length; i++) {
    const note = state.notes[i];

    if (note.offset <= now) {
      if (state.sfActiveNotes.has(i)) {
        synth.noteOff(ch, note.pitch);
        state.sfActiveNotes.delete(i);
        stopped++;
      }
      continue;
    }

    if (note.onset > ahead) continue;
    if (state.sfActiveNotes.has(i)) continue;

    synth.noteOn(ch, note.pitch, note.velocity);
    state.sfActiveNotes.add(i);
    started++;
  }

  if (started > 0 || stopped > 0) {
    console.log("[SF] Notes started:", started, "stopped:", stopped);
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
  for (const [, active] of state.activeOscs) {
    try { active.osc.stop(); } catch { /* ok */ }
  }
  state.activeOscs.clear();

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
    console.log("[Playback] Reached end, stopped");
    if (state.onTick) state.onTick(state.currentTime);
    return;
  }

  scheduleNotes(state);

  if (state.onTick) {
    state.onTick(state.currentTime);
  }

  state.rafId = requestAnimationFrame(() => playbackLoop(state));
}

export async function startPlayback(state: PlayerState, notes: Note[], totalDuration: number): Promise<void> {
  const ctx = ensureAudioContext(state);
  console.log("[Playback] startPlayback called. sfMode:", state.sfMode, "ctx.state:", ctx.state);

  if (ctx.state === "suspended") {
    console.log("[Playback] Resuming suspended AudioContext...");
    await ctx.resume();
    console.log("[Playback] AudioContext resumed, state now:", ctx.state);
  }

  state.notes = notes;
  state.totalDuration = totalDuration;

  if (state.currentTime >= totalDuration) {
    state.currentTime = 0;
  }

  state.isPlaying = true;
  state.lastFrameTime = 0;
  console.log("[Playback] Starting playback loop, notes:", notes.length, "duration:", totalDuration.toFixed(1));
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
