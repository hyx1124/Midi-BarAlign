import type { Note } from "./types";
import type { BeatGrid } from "./bpm";

export interface WaterfallState {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  displayWidth: number;
  displayHeight: number;
  notes: Note[];
  pitchMin: number;
  pitchMax: number;
  totalDuration: number;
  currentTime: number;
  visibleTimeWindow: number;
  annotations: Map<number, number> | null;
  onNoteClick: ((noteIndex: number) => void) | null;
  beatGrid: BeatGrid | null;
}

const NOTE_RADIUS = 4;
const JUDGMENT_LINE_COLOR = "#e74c3c";
const JUDGMENT_LINE_WIDTH = 2;
const FUTURE_NOTE_COLOR = "#222";
const CROSSING_NOTE_COLOR = "#555";
const ANNOTATION_COLOR = "#6A89A7";
const GRID_LINE_COLOR = "#eee";
const BG_COLOR = "#fff";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function pitchToNoteName(pitch: number): string {
  const name = NOTE_NAMES[pitch % 12];
  const octave = Math.floor(pitch / 12) - 1;
  return `${name}${octave}`;
}

/** Find first note index where onset > timeMax, for right-bound filtering */
function findEndIndex(notes: Note[], timeMax: number): number {
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (notes[mid].onset <= timeMax) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function renderWaterfall(state: WaterfallState): void {
  const { ctx, notes, pitchMin, pitchMax, currentTime, visibleTimeWindow } = state;
  const W = state.displayWidth;
  const H = state.displayHeight;

  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.scale(dpr, dpr);

  // Clear
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, W, H);

  const pitchCount = pitchMax - pitchMin + 1;
  const rowHeight = H / pitchCount;

  // Draw grid lines
  ctx.strokeStyle = GRID_LINE_COLOR;
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= pitchCount; i++) {
    const y = i * rowHeight;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Draw pitch labels on the right
  ctx.fillStyle = "#aaa";
  ctx.font = "10px -apple-system, sans-serif";
  ctx.textAlign = "right";
  const shownLabels = new Set<number>();
  const step = Math.max(1, Math.floor(pitchCount / 20));
  for (let i = 0; i <= pitchCount; i += step) {
    const pitch = pitchMax - i;
    const y = i * rowHeight + rowHeight * 0.7;
    if (shownLabels.has(pitch)) continue;
    shownLabels.add(pitch);
    if (y < H) {
      ctx.fillText(pitchToNoteName(pitch), W - 4, y);
    }
  }

  // Clip: hide everything left of the judgment line (x < 0)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();

  // Render notes from start to visible window
  const timeMax = currentTime + visibleTimeWindow;
  const endIdx = findEndIndex(notes, timeMax);

  for (let i = 0; i < endIdx; i++) {
    const note = notes[i];

    // Skip if completely past (right edge already behind judgment line)
    const xEnd = ((note.offset - currentTime) / visibleTimeWindow) * W;
    if (xEnd <= 0) continue;

    const xStart = ((note.onset - currentTime) / visibleTimeWindow) * W;
    const noteWidth = Math.max(1, xEnd - xStart);
    const drawW = Math.min(noteWidth, W - xStart);
    if (drawW <= 0) continue;

    const rowTop = ((pitchMax - note.pitch) / pitchCount) * H;
    const noteHeight = rowHeight;

    // Color: annotation takes priority, then future vs crossing
    if (state.annotations && state.annotations.has(i)) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = ANNOTATION_COLOR;
    } else if (note.onset >= currentTime) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = FUTURE_NOTE_COLOR;
    } else {
      ctx.globalAlpha = 1;
      ctx.fillStyle = CROSSING_NOTE_COLOR;
    }

    drawRoundedRect(ctx, xStart, rowTop + 1, drawW, noteHeight - 2, NOTE_RADIUS);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore(); // undo clip

  // Draw bar lines
  if (state.beatGrid) {
    for (const bar of state.beatGrid.barLines) {
      const x = ((bar.time - currentTime) / visibleTimeWindow) * W;
      if (x < 0 || x > W) continue;

      ctx.strokeStyle = bar.confirmed ? "#ddd" : "#e5e5e5";
      ctx.lineWidth = 1;

      if (!bar.confirmed) {
        ctx.setLineDash([4, 4]);
      }

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();

      if (!bar.confirmed) {
        ctx.setLineDash([]);
      }
    }
  }

  // Draw time labels at bottom (fixed round numbers, scroll with waterfall)
  ctx.fillStyle = "#aaa";
  ctx.font = "10px -apple-system, sans-serif";
  ctx.textAlign = "center";
  const labelStep = 3; // label every 3 seconds
  const firstLabel = Math.ceil(currentTime / labelStep) * labelStep;
  for (let absTime = firstLabel; absTime <= currentTime + visibleTimeWindow; absTime += labelStep) {
    const x = ((absTime - currentTime) / visibleTimeWindow) * W;
    ctx.fillText(`${absTime.toFixed(0)}s`, x, H - 4);
  }

  // Draw judgment line (on top of everything, full height)
  ctx.strokeStyle = JUDGMENT_LINE_COLOR;
  ctx.lineWidth = JUDGMENT_LINE_WIDTH;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, H);
  ctx.stroke();

  ctx.restore();
}

export function initWaterfall(container: HTMLElement): WaterfallState {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block; flex:1; width:100%;";
  container.prepend(canvas);

  const ctx = canvas.getContext("2d")!;

  const state: WaterfallState = {
    canvas,
    ctx,
    displayWidth: 0,
    displayHeight: 0,
    notes: [],
    pitchMin: 0,
    pitchMax: 127,
    totalDuration: 0,
    currentTime: 0,
    visibleTimeWindow: 15,
    annotations: null,
    onNoteClick: null,
    beatGrid: null,
  };

  function resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height - 20;
    state.displayWidth = w;
    state.displayHeight = Math.max(1, h);
    canvas.width = w * dpr;
    canvas.height = Math.max(1, h) * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = Math.max(1, h) + "px";
    renderWaterfall(state);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  // Mouse wheel scrolling
  canvas.addEventListener("wheel", (e: WheelEvent) => {
    e.preventDefault();
    const step = (e.deltaY / 100) * (state.visibleTimeWindow / 15);
    state.currentTime += step;
    state.currentTime = Math.max(0, Math.min(state.currentTime, Math.max(0, state.totalDuration - state.visibleTimeWindow * 0.5)));
    syncSlider(state);
    renderWaterfall(state);
  }, { passive: false });

  // Click-to-annotate: map canvas click to note index
  canvas.addEventListener("click", (e: MouseEvent) => {
    if (!state.onNoteClick || !state.notes.length) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const clickTime = state.currentTime + (canvasX / state.displayWidth) * state.visibleTimeWindow;
    const clickPitch = state.pitchMax - (canvasY / state.displayHeight) * (state.pitchMax - state.pitchMin);

    const TIME_THRESHOLD = 0.15; // 150ms
    const PITCH_THRESHOLD = 0.5; // half semitone

    let bestIdx = -1;
    let bestDist = Infinity;

    for (let i = 0; i < state.notes.length; i++) {
      const note = state.notes[i];
      // Time distance: 0 if click falls within note duration, else distance to nearest edge
      let timeDist: number;
      if (clickTime >= note.onset && clickTime <= note.offset) {
        timeDist = 0;
      } else {
        timeDist = Math.min(Math.abs(note.onset - clickTime), Math.abs(note.offset - clickTime));
      }
      const pitchDist = Math.abs(note.pitch - clickPitch);
      if (timeDist <= TIME_THRESHOLD && pitchDist <= PITCH_THRESHOLD) {
        if (timeDist < bestDist) {
          bestDist = timeDist;
          bestIdx = i;
        }
      }
    }

    if (bestIdx >= 0) {
      state.onNoteClick(bestIdx);
    }
  });

  return state;
}

let sliderSyncing = false;

function syncSlider(state: WaterfallState): void {
  if (sliderSyncing) return;
  const slider = document.getElementById("time-slider") as HTMLInputElement;
  if (!slider) return;
  sliderSyncing = true;
  slider.value = String(state.currentTime);
  sliderSyncing = false;
}

export interface SliderBar {
  slider: HTMLInputElement;
  timeDisplay: HTMLSpanElement;
}

export function initTimeSlider(
  container: HTMLElement,
  state: WaterfallState
): SliderBar {
  const wrapper = document.getElementById("slider-bar") as HTMLDivElement;
  if (!wrapper) {
    const w = document.createElement("div");
    w.id = "slider-bar";
    w.style.cssText =
      "display:none; align-items:center; border-top:1px solid #eee; background:#fafafa;";

    const s = document.createElement("input");
    s.type = "range";
    s.id = "time-slider";
    s.style.cssText =
      "flex:1; height:20px; margin:0; padding:0 10px; border:none; " +
      "background:transparent; cursor:pointer; " +
      "-webkit-appearance:none; appearance:none;";

    const td = document.createElement("span");
    td.id = "time-display-slider";
    td.style.cssText =
      "flex-shrink:0; padding:0 10px; color:#888; font-size:12px; white-space:nowrap;";
    td.textContent = "0.0s / 0.0s";

    w.appendChild(s);
    w.appendChild(td);
    container.appendChild(w);
    return initTimeSlider(container, state);
  }

  wrapper.style.display = "flex";
  const slider = wrapper.querySelector("#time-slider") as HTMLInputElement;
  const timeDisplay = wrapper.querySelector("#time-display-slider") as HTMLSpanElement;

  slider.min = "0";
  slider.max = String(Math.max(0.1, state.totalDuration));
  slider.step = "0.1";
  slider.value = String(state.currentTime);

  // Remove old listener by cloning
  const newSlider = slider.cloneNode(true) as HTMLInputElement;
  newSlider.addEventListener("input", () => {
    state.currentTime = parseFloat(newSlider.value);
    renderWaterfall(state);
  });
  slider.replaceWith(newSlider);

  return { slider: newSlider, timeDisplay };
}

export function setVisibleTimeWindow(state: WaterfallState, seconds: number): void {
  state.visibleTimeWindow = seconds;
  renderWaterfall(state);
}

export function setWaterfallNotes(
  state: WaterfallState,
  notes: Note[],
  pitchMin: number,
  pitchMax: number,
  totalDuration: number
): void {
  state.notes = notes;
  state.pitchMin = pitchMin;
  state.pitchMax = pitchMax;
  state.totalDuration = totalDuration;
  state.currentTime = 0;
  state.visibleTimeWindow = Math.min(15, totalDuration);

  const slider = document.getElementById("time-slider") as HTMLInputElement;
  if (slider) {
    slider.max = String(Math.max(0.1, totalDuration));
    slider.value = "0";
  }

  renderWaterfall(state);
}
