import { Midi } from "@tonejs/midi";
import type { Note, MidiInfo } from "./types";

function noteSortKey(a: Note, b: Note): number {
  if (a.onset !== b.onset) return a.onset - b.onset;
  if (a.pitch !== b.pitch) return a.pitch - b.pitch;
  return a.velocity - b.velocity;
}

export async function parseMidiFile(file: File): Promise<MidiInfo> {
  const arrayBuffer = await file.arrayBuffer();
  const midi = new Midi(arrayBuffer);

  const notes: Note[] = [];

  for (const track of midi.tracks) {
    if (track.instrument.percussion) continue;

    for (const n of track.notes) {
      const velocity = Math.max(1, Math.min(127, Math.round(n.velocity * 127)));
      notes.push({
        pitch: n.midi,
        velocity,
        onset: n.time,
        offset: n.time + n.duration,
        duration: n.duration,
      });
    }
  }

  if (notes.length === 0) {
    throw new Error("No notes found in the MIDI file. All tracks may be percussion-only.");
  }

  notes.sort(noteSortKey);

  const pitchMin = notes.reduce((min, n) => Math.min(min, n.pitch), 127);
  const pitchMax = notes.reduce((max, n) => Math.max(max, n.pitch), 0);

  let trackCount = 0;
  for (const track of midi.tracks) {
    if (!track.instrument.percussion) trackCount++;
  }

  return {
    trackCount,
    noteCount: notes.length,
    pitchMin,
    pitchMax,
    duration: midi.duration,
    notes,
  };
}
