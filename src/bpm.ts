import type { Note } from "./types";

export interface BarLine {
  time: number;
  measureNumber: number;
  confirmed: boolean;
}

export interface BeatGrid {
  bpm: number;
  barLines: BarLine[];
}

const DEFAULT_THRESHOLD = 0.1; // 100ms
const TRIM_RATIO = 0.2; // trim 20% from each end

export function createBeatGrid(): BeatGrid {
  return { bpm: 0, barLines: [] };
}

/**
 * Build a beat grid from user annotations + algorithm snap.
 * Uses trimmed-mean of inter-bar intervals for robust BPM estimation.
 * Requires at least 5 user-annotated downbeats.
 */
export function buildBeatGrid(
  annotations: Map<number, number>,
  notes: Note[],
  threshold: number = DEFAULT_THRESHOLD
): BeatGrid | null {
  if (annotations.size < 5) return null;

  // --- Phase 1: Collect user-annotated bar lines ---
  const userBars = getUserBarLines(annotations, notes);
  if (userBars.length < 5) return null;

  const totalDuration = notes[notes.length - 1]?.offset ?? 0;

  // Seed with user annotations as the initial confirmed bar lines
  const barLines: BarLine[] = userBars.map((b) => ({ ...b }));

  // --- Phase 2: Iteratively predict and snap ---
  let lastConfirmedIdx = barLines.length - 1;

  while (true) {
    const diffs = getConfirmedDiffs(barLines);
    const trimmedMean = trimmedMeanDiff(diffs);
    if (trimmedMean === null) break;

    const lastBar = barLines[lastConfirmedIdx];
    const nextMeasure = lastBar.measureNumber + 1;
    const predicted = lastBar.time + trimmedMean;

    if (predicted >= totalDuration) break;

    // Check if user already annotated this measure
    const userHit = userBars.find((b) => b.measureNumber === nextMeasure);

    if (userHit) {
      // User marked this measure → use their onset directly
      const existingIdx = barLines.findIndex((b) => b.measureNumber === nextMeasure);
      if (existingIdx >= 0) {
        barLines[existingIdx] = { time: userHit.time, measureNumber: nextMeasure, confirmed: true };
      } else {
        barLines.push({ time: userHit.time, measureNumber: nextMeasure, confirmed: true });
      }
      lastConfirmedIdx = barLines.length - 1;
      continue;
    }

    // Snap to nearest onset
    const snapped = findNearestOnset(notes, predicted, threshold);

    if (snapped !== null) {
      barLines.push({ time: snapped, measureNumber: nextMeasure, confirmed: true });
    } else {
      barLines.push({ time: predicted, measureNumber: nextMeasure, confirmed: false });
    }

    lastConfirmedIdx = barLines.length - 1;

    // Safety: limit iterations
    if (barLines.length > 10000) break;
  }

  // Compute final BPM from trimmed mean of confirmed diffs
  const confirmedDiffs = getConfirmedDiffs(barLines);
  const finalMean = trimmedMeanDiff(confirmedDiffs);
  const bpm = finalMean !== null ? Math.round((240 / finalMean) * 10) / 10 : 0;

  return { bpm, barLines };
}

/** Extract user-annotated bar lines sorted by measure number. */
function getUserBarLines(
  annotations: Map<number, number>,
  notes: Note[]
): { time: number; measureNumber: number; confirmed: boolean }[] {
  const result: { time: number; measureNumber: number; confirmed: boolean }[] = [];
  for (const [idx, measure] of annotations) {
    result.push({ time: notes[idx].onset, measureNumber: measure, confirmed: true });
  }
  result.sort((a, b) => a.measureNumber - b.measureNumber);
  return result;
}

/** Get consecutive intervals between confirmed bar lines (sorted by measure). */
function getConfirmedDiffs(barLines: BarLine[]): number[] {
  const confirmed = barLines
    .filter((b) => b.confirmed)
    .sort((a, b) => a.measureNumber - b.measureNumber);

  const diffs: number[] = [];
  for (let i = 1; i < confirmed.length; i++) {
    diffs.push(confirmed[i].time - confirmed[i - 1].time);
  }
  return diffs;
}

/**
 * Trimmed mean: sort diffs, remove top/bottom TRIM_RATIO, average the rest.
 * Returns null if not enough data after trimming (need >= 3 remaining).
 */
function trimmedMeanDiff(diffs: number[]): number | null {
  if (diffs.length < 3) return null;

  const sorted = [...diffs].sort((a, b) => a - b);
  const trimCount = Math.max(1, Math.floor(sorted.length * TRIM_RATIO));

  if (sorted.length - 2 * trimCount < 2) {
    // Not enough after trimming → fall back to median
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
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
