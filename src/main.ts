import { parseMidiFile } from "./midiParser";
import { initSidebar, updateMidiInfo, showError } from "./sidebar";
import type { MidiInfo } from "./types";

let midiInfo: MidiInfo | null = null;

export function getMidiInfo(): MidiInfo | null {
  return midiInfo;
}

function init(): void {
  const elements = initSidebar();

  const fileInput = document.getElementById("file-input") as HTMLInputElement;
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    elements.fileLabel.textContent = file.name;

    try {
      const info = await parseMidiFile(file);
      midiInfo = info;
      updateMidiInfo(elements, info);
      console.log("Parsed MIDI notes:", info.notes);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to parse MIDI file";
      showError(elements, message);
      midiInfo = null;
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
