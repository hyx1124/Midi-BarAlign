import type { Note, AnnotationState } from "./types";

export function createAnnotationState(): AnnotationState {
  return {
    annotations: new Map(),
    nextMeasureNumber: 1,
  };
}

/** Toggle annotation on a note. Returns true if added, false if removed. */
export function toggleAnnotation(
  state: AnnotationState,
  noteIndex: number,
  notes: Note[]
): boolean {
  if (state.annotations.has(noteIndex)) {
    // Remove and renumber
    state.annotations.delete(noteIndex);
    renumber(state, notes);
    return false;
  } else {
    // Add with next number
    state.annotations.set(noteIndex, state.nextMeasureNumber);
    state.nextMeasureNumber++;
    // Renumber to keep consistency (new annotation may be earlier in time)
    renumber(state, notes);
    return true;
  }
}

export function clearAnnotations(state: AnnotationState): void {
  state.annotations.clear();
  state.nextMeasureNumber = 1;
}

export function getAnnotation(
  state: AnnotationState,
  noteIndex: number
): number | null {
  return state.annotations.get(noteIndex) ?? null;
}

export function getAnnotationCount(state: AnnotationState): number {
  return state.annotations.size;
}

/** Get annotations sorted by note onset (earliest first). */
export function getSortedAnnotations(
  state: AnnotationState,
  notes: Note[]
): { noteIndex: number; measureNumber: number }[] {
  const result: { noteIndex: number; measureNumber: number }[] = [];
  for (const [idx, measure] of state.annotations) {
    result.push({ noteIndex: idx, measureNumber: measure });
  }
  result.sort((a, b) => notes[a.noteIndex].onset - notes[b.noteIndex].onset);
  return result;
}

/** Re-assign measure numbers 1..N to annotations in onset order. */
function renumber(state: AnnotationState, notes: Note[]): void {
  const sorted = getSortedAnnotations(state, notes);
  for (let i = 0; i < sorted.length; i++) {
    state.annotations.set(sorted[i].noteIndex, i + 1);
  }
  state.nextMeasureNumber = sorted.length + 1;
}
