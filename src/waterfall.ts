import type { Note } from "./types";

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
}

const NOTE_RADIUS = 4;
const PAST_WINDOW = 2;
const JUDGMENT_LINE_COLOR = "#e74c3c";
const JUDGMENT_LINE_WIDTH = 2;
const FUTURE_NOTE_COLOR = "#222";
const PAST_NOTE_COLOR = "#ccc";
const PAST_NOTE_ALPHA = 0.4;
const CROSSING_NOTE_COLOR = "#555";
const GRID_LINE_COLOR = "#eee";
const BG_COLOR = "#fff";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function pitchToNoteName(pitch: number): string {
  const name = NOTE_NAMES[pitch % 12];
  const octave = Math.floor(pitch / 12) - 1;
  return `${name}${octave}`;
}

function findVisibleNoteRange(
  notes: Note[],
  timeMin: number,
  timeMax: number
): [number, number] {
  // Binary search for first note whose onset >= timeMin (with generous buffer for long notes)
  let lo = 0;
  let hi = notes.length;
  const searchMin = timeMin - 5; // 5s buffer for long notes starting before window
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (notes[mid].onset < searchMin) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  const startIdx = lo;

  // Binary search for first note whose onset > timeMax
  lo = 0;
  hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (notes[mid].onset <= timeMax) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  const endIdx = lo;

  return [startIdx, endIdx];
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
  const pastWindowPixels = (PAST_WINDOW / visibleTimeWindow) * W;

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
  const step = Math.max(1, Math.floor(pitchCount / 20)); // Show ~20 labels
  for (let i = 0; i <= pitchCount; i += step) {
    const pitch = pitchMax - i;
    const y = i * rowHeight + rowHeight * 0.7;
    if (shownLabels.has(pitch)) continue;
    shownLabels.add(pitch);
    if (y < H) {
      ctx.fillText(pitchToNoteName(pitch), W - 4, y);
    }
  }

  // Find visible notes
  const timeMin = currentTime - PAST_WINDOW;
  const timeMax = currentTime + visibleTimeWindow;
  const [startIdx, endIdx] = findVisibleNoteRange(notes, timeMin, timeMax);

  // Draw notes
  for (let i = startIdx; i < endIdx; i++) {
    const note = notes[i];
    if (note.offset <= currentTime - PAST_WINDOW) continue;

    const xStart = ((note.onset - currentTime) / visibleTimeWindow) * W;
    const xEnd = ((note.offset - currentTime) / visibleTimeWindow) * W;
    const noteWidth = Math.max(1, xEnd - xStart);

    const rowTop = ((pitchMax - note.pitch) / pitchCount) * H;
    const noteHeight = rowHeight;

    // Clamp drawing to visible area
    const drawX = Math.max(-pastWindowPixels, xStart);
    let drawW = Math.min(noteWidth, W - drawX);

    // Past notes must not extend past the judgment line (x=0)
    if (note.offset <= currentTime) {
      drawW = Math.min(drawW, -drawX);
    }

    if (drawW <= 0) continue;

    // Determine note color
    if (note.offset <= currentTime) {
      // Fully past the judgment line
      ctx.globalAlpha = PAST_NOTE_ALPHA;
      ctx.fillStyle = PAST_NOTE_COLOR;
    } else if (note.onset >= currentTime) {
      // Fully in the future
      ctx.globalAlpha = 1;
      ctx.fillStyle = FUTURE_NOTE_COLOR;
    } else {
      // Currently crossing the judgment line
      ctx.globalAlpha = 1;
      ctx.fillStyle = CROSSING_NOTE_COLOR;
    }

    drawRoundedRect(ctx, drawX, rowTop + 1, drawW, noteHeight - 2, NOTE_RADIUS);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Draw judgment line
  ctx.strokeStyle = JUDGMENT_LINE_COLOR;
  ctx.lineWidth = JUDGMENT_LINE_WIDTH;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, H);
  ctx.stroke();

  // Draw time labels at bottom
  ctx.fillStyle = "#aaa";
  ctx.font = "10px -apple-system, sans-serif";
  ctx.textAlign = "center";
  const timeStep = Math.max(1, Math.floor(visibleTimeWindow / 5));
  for (let t = 0; t <= visibleTimeWindow; t += timeStep) {
    const x = (t / visibleTimeWindow) * W;
    ctx.fillText(`${t.toFixed(0)}s`, x, H - 4);
  }

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
  };

  function resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    // Subtract slider height (20px) if visible
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

export function initTimeSlider(
  container: HTMLElement,
  state: WaterfallState
): HTMLInputElement {
  const slider = document.getElementById("time-slider") as HTMLInputElement;
  if (!slider) {
    const s = document.createElement("input");
    s.type = "range";
    s.id = "time-slider";
    s.style.cssText =
      "display:block; width:100%; height:20px; margin:0; padding:0 10px; border:none; " +
      "background:#fafafa; cursor:pointer; border-top:1px solid #eee; box-sizing:border-box; " +
      "-webkit-appearance:none; appearance:none;";
    container.appendChild(s);
    return initTimeSlider(container, state);
  }

  slider.style.display = "block";
  slider.min = "0";
  slider.max = String(Math.max(0.1, state.totalDuration));
  slider.step = "0.1";
  slider.value = String(state.currentTime);

  slider.addEventListener("input", () => {
    state.currentTime = parseFloat(slider.value);
    renderWaterfall(state);
  });

  return slider;
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
