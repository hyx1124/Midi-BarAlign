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
const CHUNK_SIZE = 10;
const SCAN_INTERVAL = 0.5;

class NoteChunkIndex {
  private chunks: Note[][];

  constructor(notes: Note[], totalDuration: number) {
    const numBlocks = Math.max(1, Math.ceil(totalDuration / CHUNK_SIZE));
    this.chunks = new Array(numBlocks);
    for (let i = 0; i < numBlocks; i++) this.chunks[i] = [];

    for (const note of notes) {
      const s = Math.floor(note.onset / CHUNK_SIZE);
      const e = Math.floor(note.offset / CHUNK_SIZE);
      for (let b = Math.max(0, s); b <= Math.min(numBlocks - 1, e); b++) {
        this.chunks[b].push(note);
      }
    }
  }

  findLowest(moment: number): Note | null {
    const bi = Math.floor(moment / CHUNK_SIZE);
    if (bi < 0 || bi >= this.chunks.length) return null;
    let lowest: Note | null = null;
    for (const n of this.chunks[bi]) {
      if (n.onset <= moment && n.offset > moment) {
        if (lowest === null || n.pitch < lowest.pitch) lowest = n;
      }
    }
    return lowest;
  }
}

class BassPoolIndex {
  private pools: Map<number, number>[];

  constructor(chunkIndex: NoteChunkIndex, totalDuration: number) {
    const numBlocks = Math.max(1, Math.ceil(totalDuration / CHUNK_SIZE));
    this.pools = new Array(numBlocks);
    for (let i = 0; i < numBlocks; i++) this.pools[i] = new Map();

    for (let t = 0; t < totalDuration; t += SCAN_INTERVAL) {
      const lowest = chunkIndex.findLowest(t);
      if (!lowest) continue;
      const bi = Math.floor(t / CHUNK_SIZE);
      if (bi < numBlocks && !this.pools[bi].has(lowest.onset)) {
        this.pools[bi].set(lowest.onset, lowest.pitch);
      }
    }
  }

  findClosest(target: number, minOnset: number): number | null {
    const centerBi = Math.floor(target / CHUNK_SIZE);
    let bestOnset: number | null = null;
    let bestDist = Infinity;

    for (let db = -1; db <= 1; db++) {
      const bi = centerBi + db;
      if (bi < 0 || bi >= this.pools.length) continue;
      for (const onset of this.pools[bi].keys()) {
        if (onset < minOnset) continue;
        const dist = Math.abs(onset - target);
        if (dist < bestDist) {
          bestDist = dist;
          bestOnset = onset;
        }
      }
    }
    return bestOnset;
  }
}

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

  const chunkIndex = new NoteChunkIndex(notes, totalDuration);
  const bassPool = new BassPoolIndex(chunkIndex, totalDuration);
  console.log(`[BPM] Bass pool built`);

  while (true) {
    const confirmed = barLines.filter((b) => b.confirmed);
    if (confirmed.length < LOCAL_WINDOW) break;

    const recent = confirmed.slice(-LOCAL_WINDOW);
    const T = (recent[recent.length - 1].time - recent[0].time) / (recent.length - 1);
    if (T <= 0) break;

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

    const minOnset = lastBar.time + Math.max(0.5 * T, 1.0);
    const hit = bassPool.findClosest(predicted, minOnset);

    if (hit !== null) {
      barLines.push({ time: hit, measureNumber: nextMeasure, confirmed: true });
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

  console.log(`[BPM] ${barLines.length} bar lines, BPM=${displayBpm}`);
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
