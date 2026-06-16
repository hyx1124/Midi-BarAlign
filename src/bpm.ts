import type { Note } from "./types";

export interface BarLine {
  time: number;
  measureNumber: number;
  confirmed: boolean;
}

export interface BeatGrid {
  bpm: number;
  barLines: BarLine[];
  bpmHistory: number[];
}

const HISTORY_WINDOW = 5;
const DEFAULT_THRESHOLD = 0.1; // 100ms

export function createBeatGrid(): BeatGrid {
  return { bpm: 0, barLines: [], bpmHistory: [] };
}

/**
 * Build a beat grid from user annotations.
 * Requires at least 5 annotated downbeats (measures 1-5).
 * Returns null if fewer than 5 annotations.
 */
export function buildBeatGrid(
  annotations: Map<number, number>,
  notes: Note[],
  threshold: number = DEFAULT_THRESHOLD
): BeatGrid | null {
  if (annotations.size < 5) return null;

  // Extract onsets for the first 5 measures in order
  const downbeats = getSortedDownbeats(annotations, notes);
  if (downbeats.length < 5) return null;

  const onsets = downbeats.slice(0, 5).map((d) => d.onset);

  // Compute initial BPM history from intervals between consecutive downbeats
  const barLines: BarLine[] = [];
  const bpmHistory: number[] = [];

  for (let i = 0; i < 4; i++) {
    const interval = onsets[i + 1] - onsets[i];
    const bpm = 240 / interval;
    bpmHistory.push(bpm);
  }

  // First 5 measures are confirmed bar lines (from user annotations)
  for (let i = 0; i < 5; i++) {
    barLines.push({ time: onsets[i], measureNumber: i + 1, confirmed: true });
  }

  // Predictive extension
  const totalDuration = notes[notes.length - 1]?.offset ?? 0;
  let lastOnset = onsets[4];
  let measureNum = 6;

  while (true) {
    const rollingBpm = bpmHistory.reduce((a, b) => a + b, 0) / bpmHistory.length;
    const predicted = lastOnset + 240 / rollingBpm;

    if (predicted >= totalDuration) break;

    // Snap to nearest onset within threshold
    const snapped = findNearestOnset(notes, predicted, threshold);

    if (snapped !== null) {
      barLines.push({ time: snapped, measureNumber: measureNum, confirmed: true });
      const newBpm = 240 / (snapped - lastOnset);
      bpmHistory.push(newBpm);
      if (bpmHistory.length > HISTORY_WINDOW) bpmHistory.shift();
      lastOnset = snapped;
    } else {
      barLines.push({ time: predicted, measureNumber: measureNum, confirmed: false });
      // Use predicted value as seed for next prediction
      lastOnset = predicted;
    }

    measureNum++;
  }

  const finalBpm = bpmHistory.reduce((a, b) => a + b, 0) / bpmHistory.length;

  return { bpm: Math.round(finalBpm * 10) / 10, barLines, bpmHistory };
}

function getSortedDownbeats(
  annotations: Map<number, number>,
  notes: Note[]
): { noteIndex: number; onset: number; measureNumber: number }[] {
  const result: { noteIndex: number; onset: number; measureNumber: number }[] = [];
  for (const [idx, measure] of annotations) {
    result.push({ noteIndex: idx, onset: notes[idx].onset, measureNumber: measure });
  }
  result.sort((a, b) => a.measureNumber - b.measureNumber);
  return result;
}

function findNearestOnset(
  notes: Note[],
  target: number,
  threshold: number
): number | null {
  let bestOnset: number | null = null;
  let bestDist = Infinity;

  for (const note of notes) {
    const dist = Math.abs(note.onset - target);
    if (dist <= threshold && dist < bestDist) {
      bestDist = dist;
      bestOnset = note.onset;
    }
  }

  return bestOnset;
}
