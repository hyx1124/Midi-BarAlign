import { parseMidiFile } from "./midiParser";
import { initSidebar, updateMidiInfo, showError, showAnnotationSection, updateAnnotationCount, updateBpmDisplay } from "./sidebar";
import {
  initWaterfall,
  setWaterfallNotes,
  setVisibleTimeWindow,
  initTimeSlider,
  renderWaterfall,
} from "./waterfall";
import {
  createPlayerState,
  startPlayback,
  pausePlayback,
  stopPlayback,
  setSpeed,
  getFormattedTime,
  initSoundFontPlayer,
} from "./player";
import type { MidiInfo, AnnotationState } from "./types";
import type { WaterfallState, SliderBar } from "./waterfall";
import type { SidebarElements } from "./sidebar";
import type { PlayerState } from "./player";
import {
  createAnnotationState,
  toggleAnnotation,
  clearAnnotations,
  getAnnotationCount,
  exportAnnotations,
  importAnnotations,
} from "./annotation";
import { buildBeatGrid, type BeatGrid } from "./bpm";

let midiInfo: MidiInfo | null = null;
let waterfallState: WaterfallState | null = null;
let playerState: PlayerState | null = null;
let elements: SidebarElements | null = null;
let sliderBar: SliderBar | null = null;
let annotationState: AnnotationState | null = null;
let beatGrid: BeatGrid | null = null;

export function getMidiInfo(): MidiInfo | null {
  return midiInfo;
}

function updatePlayPauseBtn(): void {
  if (!elements || !playerState) return;
  const btn = elements.playBtn;
  if (playerState.isPlaying) {
    btn.textContent = "⏸ 暂停";
    btn.style.borderColor = "#aaa";
  } else {
    btn.textContent = "▶ 播放";
    btn.style.borderColor = "#ddd";
  }
}

function updateSpeedBtns(): void {
  if (!elements || !playerState) return;
  const speed = playerState.playbackSpeed;
  for (const btn of elements.speedBtns) {
    const btnSpeed = parseFloat(btn.dataset.speed || "1");
    if (btnSpeed === speed) {
      btn.style.borderColor = "#aaa";
      btn.style.color = "#333";
      btn.style.fontWeight = "600";
    } else {
      btn.style.borderColor = "#ddd";
      btn.style.color = "#666";
      btn.style.fontWeight = "400";
    }
  }
}

function init(): void {
  elements = initSidebar();
  playerState = createPlayerState();

  const canvasContainer = document.getElementById("canvas-container")!;

  // Initialize waterfall (once)
  waterfallState = initWaterfall(canvasContainer);

  // --- Annotation: canvas click -> toggle ---
  waterfallState.onNoteClick = (noteIndex: number) => {
    if (!annotationState || !waterfallState || !midiInfo || !elements) return;
    toggleAnnotation(annotationState, noteIndex, midiInfo.notes);
    updateAnnotationCount(elements, getAnnotationCount(annotationState));

    // Rebuild beat grid if enough annotations
    beatGrid = buildBeatGrid(annotationState.annotations, midiInfo.notes);
    waterfallState.beatGrid = beatGrid;
    updateBpmDisplay(elements, beatGrid?.bpm ?? null, beatGrid?.barLines.length ?? 0);

    renderWaterfall(waterfallState);
  };

  // --- Annotation: reset button ---
  elements.resetBtn.addEventListener("click", () => {
    if (!annotationState || !waterfallState || !elements) return;
    clearAnnotations(annotationState);
    updateAnnotationCount(elements, 0);
    beatGrid = null;
    waterfallState.beatGrid = null;
    updateBpmDisplay(elements, null, 0);
    renderWaterfall(waterfallState);
  });

  // --- Annotation: export ---
  elements.exportBtn.addEventListener("click", () => {
    if (!annotationState || !midiInfo) return;
    const data = exportAnnotations(annotationState, midiInfo.notes);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "annotations.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  // --- Annotation: import ---
  const importFileInput = document.createElement("input");
  importFileInput.type = "file";
  importFileInput.accept = ".json";
  importFileInput.style.cssText = "position:absolute;left:-9999px;top:0;";
  document.body.appendChild(importFileInput);

  elements.importBtn.addEventListener("click", () => importFileInput.click());

  importFileInput.addEventListener("change", async () => {
    const file = importFileInput.files?.[0];
    if (!file || !annotationState || !midiInfo || !waterfallState || !elements) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const imported = importAnnotations(data, annotationState, midiInfo.notes);
      updateAnnotationCount(elements, getAnnotationCount(annotationState));
      beatGrid = buildBeatGrid(annotationState.annotations, midiInfo.notes);
      waterfallState.beatGrid = beatGrid;
      updateBpmDisplay(elements, beatGrid?.bpm ?? null, beatGrid?.barLines.length ?? 0);
      renderWaterfall(waterfallState);
      console.log(`Imported ${imported} annotations`);
    } catch (err) {
      console.error("Import failed:", err);
    }
  });

  // Player onTick: update waterfall and time display
  playerState.onTick = (time: number) => {
    if (!waterfallState || !elements) return;
    waterfallState.currentTime = time;
    renderWaterfall(waterfallState);
    // sync time slider (one-way, no re-trigger)
    if (sliderBar) {
      sliderBar.slider.value = String(time);
      sliderBar.timeDisplay.textContent = getFormattedTime(playerState!);
    }
  };

  // --- Play/Pause ---
  elements.playBtn.addEventListener("click", async () => {
    if (!playerState || !midiInfo) return;
    if (playerState.isPlaying) {
      pausePlayback(playerState);
    } else {
      await startPlayback(playerState, midiInfo.notes, midiInfo.duration);
    }
    updatePlayPauseBtn();
    // Disable slider during playback, enable when stopped
    if (sliderBar) {
      sliderBar.slider.disabled = playerState.isPlaying;
      sliderBar.slider.style.opacity = playerState.isPlaying ? "0.4" : "1";
      sliderBar.slider.style.cursor = playerState.isPlaying ? "default" : "pointer";
    }
  });

  // --- Reset time ---
  elements.resetTimeBtn.addEventListener("click", () => {
    if (!playerState) return;
    stopPlayback(playerState);
    updatePlayPauseBtn();
    if (sliderBar) {
      sliderBar.slider.disabled = false;
      sliderBar.slider.style.opacity = "1";
      sliderBar.slider.style.cursor = "pointer";
    }
  });

  // --- Speed buttons ---
  for (const btn of elements.speedBtns) {
    btn.addEventListener("click", () => {
      if (!playerState) return;
      const speed = parseFloat(btn.dataset.speed || "1");
      setSpeed(playerState, speed);
      updateSpeedBtns();
    });
  }

  // --- Zoom slider ---
  elements.zoomSlider.addEventListener("input", () => {
    if (!waterfallState) return;
    const val = parseInt(elements!.zoomSlider.value);
    elements!.zoomValue.textContent = `${val}s`;
    setVisibleTimeWindow(waterfallState, val);
  });

  // --- File input ---
  const fileInput = document.getElementById("file-input") as HTMLInputElement;

  // --- SoundFont file input ---
  const sfFileInput = document.getElementById("sf-file-input") as HTMLInputElement;
  sfFileInput.addEventListener("change", async () => {
    const file = sfFileInput.files?.[0];
    if (!file || !playerState) return;
    elements!.sfFileLabel.textContent = file.name;
    elements!.sfFileName.textContent = `加载中: ${file.name}`;
    try {
      const ok = await initSoundFontPlayer(playerState, file);
      if (ok) {
        elements!.sfFileName.textContent = file.name;
        elements!.sfFallbackHint.style.display = "none";
      } else {
        elements!.sfFileName.textContent = `${file.name} (加载失败)`;
      }
    } catch {
      elements!.sfFileName.textContent = `${file.name} (加载失败)`;
    }
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    // Stop any active playback
    if (playerState && playerState.isPlaying) {
      pausePlayback(playerState);
      updatePlayPauseBtn();
    }

    elements!.fileLabel.textContent = file.name;

    try {
      const info = await parseMidiFile(file);
      midiInfo = info;
      updateMidiInfo(elements!, info);

      // Load notes into waterfall
      setWaterfallNotes(
        waterfallState!,
        info.notes,
        info.pitchMin,
        info.pitchMax,
        info.duration
      );

      // Reset player for new file
      if (playerState) {
        stopPlayback(playerState);
        updatePlayPauseBtn();
      }

      // Init / clear annotations
      annotationState = createAnnotationState();
      waterfallState!.annotations = annotationState.annotations;
      showAnnotationSection(elements!);
      updateAnnotationCount(elements!, 0);

      // Show zoom controls
      document.getElementById("zoom-wrapper")!.style.display = "block";

      // Reset zoom slider to default
      const defaultZoom = Math.min(15, Math.max(3, info.duration));
      elements!.zoomSlider.value = String(defaultZoom);
      elements!.zoomValue.textContent = `${defaultZoom}s`;
      setVisibleTimeWindow(waterfallState!, defaultZoom);

      // Show playback controls
      document.getElementById("playback-section")!.style.display = "block";

      // Show SoundFont selector
      document.getElementById("sf-wrapper")!.style.display = "block";

      // Initialize time slider
      sliderBar = initTimeSlider(canvasContainer, waterfallState!);
      sliderBar.timeDisplay.textContent = `0.0s / ${info.duration.toFixed(1)}s`;
      // Sync player time when slider is dragged
      sliderBar.slider.addEventListener("input", () => {
        if (playerState) playerState.currentTime = waterfallState!.currentTime;
      });
      // Hide sidebar time display (moved to slider bar)
      elements!.timeDisplay.style.display = "none";
      renderWaterfall(waterfallState!);

      // Create AudioContext during user gesture (before async sf3 loading)
      if (playerState && !playerState.audioCtx) {
        playerState.audioCtx = new AudioContext();
      }

      // Load SoundFont asynchronously (non-blocking)
      initSoundFontPlayer(playerState!).then((ok) => {
        if (!ok && elements) {
          elements.sfFallbackHint.style.display = "block";
        }
      });

      console.log("Parsed MIDI notes:", info.notes);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to parse MIDI file";
      showError(elements!, message);
      midiInfo = null;
    }
  });
}

// Debug: expose on window for console testing
(window as any).__midiDisplay__ = {
  get playerState() { return playerState!; },
  get midiInfo() { return midiInfo!; },
  testNote: async (pitch = 60, velocity = 100) => {
    const ps = playerState;
    if (!ps || !ps.sfSynth) {
      console.log("No synth available, sfMode:", ps?.sfMode);
      return;
    }
    console.log(`[Test] Playing note: pitch=${pitch}, velocity=${velocity}`);
    ps.sfSynth.noteOn(0, pitch, velocity);
    setTimeout(() => {
      ps.sfSynth?.noteOff(0, pitch);
      console.log("[Test] Note stopped");
    }, 1000);
  },
};

document.addEventListener("DOMContentLoaded", init);
