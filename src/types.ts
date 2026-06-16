export interface Note {
  pitch: number;
  velocity: number;
  onset: number;
  offset: number;
  duration: number;
}

export interface MidiInfo {
  trackCount: number;
  noteCount: number;
  pitchMin: number;
  pitchMax: number;
  duration: number;
  notes: Note[];
}

export interface Annotation {
  noteIndex: number;
  measureNumber: number;
}

export interface AnnotationState {
  annotations: Map<number, number>;
  nextMeasureNumber: number;
}
