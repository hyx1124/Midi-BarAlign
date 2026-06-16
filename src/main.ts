import { parseMidiFile } from "./midiParser";
import { initSidebar, updateMidiInfo, showError } from "./sidebar";
import { initWaterfall, setWaterfallNotes, initTimeSlider, renderWaterfall } from "./waterfall";
import type { MidiInfo } from "./types";
import type { WaterfallState } from "./waterfall";

let midiInfo: MidiInfo | null = null;
let waterfallState: WaterfallState | null = null;

export function getMidiInfo(): MidiInfo | null {
  return midiInfo;
}

function init(): void {
  const elements = initSidebar();

  const canvasContainer = document.getElementById("canvas-container")!;

  // Initialize waterfall (once)
  waterfallState = initWaterfall(canvasContainer);

  const fileInput = document.getElementById("file-input") as HTMLInputElement;
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    elements.fileLabel.textContent = file.name;

    try {
      const info = await parseMidiFile(file);
      midiInfo = info;
      updateMidiInfo(elements, info);

      // Load notes into waterfall
      setWaterfallNotes(
        waterfallState!,
        info.notes,
        info.pitchMin,
        info.pitchMax,
        info.duration
      );

      // Initialize time slider
      initTimeSlider(canvasContainer, waterfallState!);
      renderWaterfall(waterfallState!);

      console.log("Parsed MIDI notes:", info.notes);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to parse MIDI file";
      showError(elements, message);
      midiInfo = null;
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
