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

const LOCAL_WINDOW = 3;

export function createBeatGrid(): BeatGrid {
  return { bpm: 0, barLines: [] };
}

export function buildBeatGrid(
  annotations: Map<number, number>,
  notes: Note[]
): BeatGrid | null {
  if (annotations.size < 5) return null;

  const userBars = getUserBarLines(annotations, notes);
  if (userBars.length < 5) return null;

  const totalDuration = notes[notes.length - 1]?.offset ?? 0;
  const barLines: BarLine[] = userBars.map((b) => ({ ...b }));

  while (true) {
    const confirmed = barLines.filter((b) => b.confirmed);
    if (confirmed.length < LOCAL_WINDOW) break;

    const recent = confirmed.slice(-LOCAL_WINDOW);
    const T = (recent[recent.length - 1].time - recent[0].time) / (recent.length - 1);

    const lastBar = barLines[barLines.length - 1];
    const nextMeasure = lastBar.measureNumber + 1;
    const predicted = lastBar.time + T;

    if (predicted >= totalDuration) break;

    const userHit = userBars.find((b) => b.measureNumber === nextMeasure);
    if (userHit) {
      const existingIdx = barLines.findIndex((b) => b.measureNumber === nextMeasure);
      if (existingIdx >= 0) {
        barLines[existingIdx] = { time: userHit.time, measureNumber: nextMeasure, confirmed: true };
      } else {
        barLines.push({ time: userHit.time, measureNumber: nextMeasure, confirmed: true });
      }
      continue;
    }

    // Phase 1: lowest-note heuristic (only method for confirmed bar lines)
    const heuristicOnset = findBarByLowestNote(notes, predicted, T);
    if (heuristicOnset !== null) {
      barLines.push({ time: heuristicOnset, measureNumber: nextMeasure, confirmed: true });
    } else {
      barLines.push({ time: predicted, measureNumber: nextMeasure, confirmed: false });
    }

    if (barLines.length > 10000) break;
  }

  const confirmedDiffs = getConfirmedDiffs(barLines);
  const displayBpm =
    confirmedDiffs.length > 0
      ? Math.round((240 / (confirmedDiffs.reduce((a, b) => a + b, 0) / confirmedDiffs.length)) * 10) / 10
      : 0;

  return { bpm: displayBpm, barLines };
}

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

function findBarByLowestNote(
  notes: Note[],
  predicted: number,
  barDuration: number
): number | null {
  const offsets = [-0.1, 0, 0.1];
  const candidates: number[] = [];

  for (const offset of offsets) {
    const moment = predicted + offset * barDuration;
    const lowest = findLowestActiveNote(notes, moment);
    if (lowest !== null) {
      candidates.push(lowest.onset);
    }
  }

  if (candidates.length === 0) {
    console.log(`[Heuristic] No active notes at any of 3 checkpoints near t=${predicted.toFixed(2)}`);
    return null;
  }

  let best = candidates[0];
  let bestDist = Math.abs(best - predicted);
  for (let i = 1; i < candidates.length; i++) {
    const dist = Math.abs(candidates[i] - predicted);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidates[i];
    }
  }
  console.log(`[Heuristic] t=${predicted.toFixed(2)} candidates=[${candidates.map(c => c.toFixed(2)).join(', ')}] → picked ${best.toFixed(2)} (dist=${bestDist.toFixed(3)}s)`);
  return best;
}

function findLowestActiveNote(notes: Note[], moment: number): Note | null {
  let lowest: Note | null = null;
  for (const note of notes) {
    if (note.onset <= moment && note.offset > moment) {
      if (lowest === null || note.pitch < lowest.pitch) {
        lowest = note;
      }
    }
  }
  return lowest;
}
