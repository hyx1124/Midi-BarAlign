import { parseMidiFile } from "./midiParser";
import { initSidebar, updateMidiInfo, showError } from "./sidebar";
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
import type { MidiInfo } from "./types";
import type { WaterfallState } from "./waterfall";
import type { SidebarElements } from "./sidebar";
import type { PlayerState } from "./player";

let midiInfo: MidiInfo | null = null;
let waterfallState: WaterfallState | null = null;
let playerState: PlayerState | null = null;
let elements: SidebarElements | null = null;

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

  // Player onTick: update waterfall and time display
  playerState.onTick = (time: number) => {
    if (!waterfallState || !elements) return;
    waterfallState.currentTime = time;
    renderWaterfall(waterfallState);
    // sync time slider
    const slider = document.getElementById("time-slider") as HTMLInputElement;
    if (slider) {
      slider.value = String(time);
    }
    elements.timeDisplay.textContent = getFormattedTime(playerState!);
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
  });

  // --- Reset time ---
  elements.resetTimeBtn.addEventListener("click", () => {
    if (!playerState) return;
    stopPlayback(playerState);
    updatePlayPauseBtn();
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

      // Show zoom controls
      document.getElementById("zoom-wrapper")!.style.display = "block";

      // Reset zoom slider to default
      const defaultZoom = Math.min(15, Math.max(3, info.duration));
      elements!.zoomSlider.value = String(defaultZoom);
      elements!.zoomValue.textContent = `${defaultZoom}s`;
      setVisibleTimeWindow(waterfallState!, defaultZoom);

      // Show playback controls
      document.getElementById("playback-section")!.style.display = "block";

      // Initialize time slider
      initTimeSlider(canvasContainer, waterfallState!);
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
