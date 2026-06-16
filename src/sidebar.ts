import type { MidiInfo } from "./types";

export interface SidebarElements {
  fileLabel: HTMLLabelElement;
  infoPanel: HTMLDivElement;
  trackCount: HTMLSpanElement;
  noteCount: HTMLSpanElement;
  pitchRange: HTMLSpanElement;
  duration: HTMLSpanElement;
  errorBox: HTMLDivElement;
  zoomSlider: HTMLInputElement;
  zoomValue: HTMLSpanElement;
  playBtn: HTMLButtonElement;
  resetTimeBtn: HTMLButtonElement;
  speedGroup: HTMLDivElement;
  speedBtns: HTMLButtonElement[];
  timeDisplay: HTMLSpanElement;
  sfFallbackHint: HTMLDivElement;
  sfFileLabel: HTMLLabelElement;
  sfFileName: HTMLSpanElement;
  annotationSection: HTMLDivElement;
  annotationCount: HTMLSpanElement;
  bpmDisplay: HTMLSpanElement;
  barLineCount: HTMLSpanElement;
  resetBtn: HTMLButtonElement;
  confirmBtn: HTMLButtonElement;
  exportBtn: HTMLButtonElement;
  importBtn: HTMLButtonElement;
}

export function initSidebar(): SidebarElements {
  const sidebar = document.getElementById("sidebar")!;
  sidebar.innerHTML = "";

  // Title
  const title = document.createElement("h2");
  title.textContent = "MidiDisplay";
  title.style.cssText = "margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #222;";
  sidebar.appendChild(title);

  // File input
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".mid,.midi";
  fileInput.id = "file-input";
  fileInput.style.display = "none";

  const fileLabel = document.createElement("label");
  fileLabel.htmlFor = "file-input";
  fileLabel.textContent = "选择 MIDI 文件";
  fileLabel.style.cssText =
    "display:block; padding:10px 16px; border:1px solid #ddd; border-radius:8px; " +
    "cursor:pointer; text-align:center; font-size:14px; color:#333; background:#fff; " +
    "transition: border-color 0.2s; width:100%; box-sizing:border-box;";

  const fileWrapper = document.createElement("div");
  fileWrapper.style.cssText = "margin-bottom: 20px;";
  fileWrapper.appendChild(fileInput);
  fileWrapper.appendChild(fileLabel);

  // Hover effect
  fileLabel.addEventListener("mouseenter", () => {
    fileLabel.style.borderColor = "#999";
  });
  fileLabel.addEventListener("mouseleave", () => {
    fileLabel.style.borderColor = "#ddd";
  });

  sidebar.appendChild(fileWrapper);

  // Info panel
  const infoPanel = document.createElement("div");
  infoPanel.id = "info-panel";
  infoPanel.style.cssText = "display:none; margin-bottom: 20px;";

  const infoRows: [string, string][] = [
    ["轨道数", "track-count"],
    ["音符数", "note-count"],
    ["音高范围", "pitch-range"],
    ["时长", "duration"],
  ];

  const spans: Record<string, HTMLSpanElement> = {};

  for (const [label, id] of infoRows) {
    const row = document.createElement("div");
    row.style.cssText = "display:flex; justify-content:space-between; padding:6px 0; font-size:13px;";

    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    labelEl.style.cssText = "color:#888;";

    const valueEl = document.createElement("span");
    valueEl.id = id;
    valueEl.style.cssText = "color:#333; font-weight:500;";
    spans[id] = valueEl;

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    infoPanel.appendChild(row);
  }

  sidebar.appendChild(infoPanel);

  // Error box (hidden by default)
  const errorBox = document.createElement("div");
  errorBox.id = "error-box";
  errorBox.style.cssText =
    "display:none; padding:10px; background:#fef2f2; border:1px solid #fecaca; " +
    "border-radius:8px; color:#dc2626; font-size:13px; margin-bottom:20px;";
  sidebar.appendChild(errorBox);

  // SoundFont file selector
  const sfFileInput = document.createElement("input");
  sfFileInput.type = "file";
  sfFileInput.accept = ".sf2,.sf3";
  sfFileInput.id = "sf-file-input";
  sfFileInput.style.display = "none";

  const sfFileLabel = document.createElement("label");
  sfFileLabel.htmlFor = "sf-file-input";
  sfFileLabel.textContent = "选择音色文件";
  sfFileLabel.style.cssText =
    "display:block; padding:6px 12px; border:1px solid #ddd; border-radius:8px; " +
    "cursor:pointer; text-align:center; font-size:12px; color:#666; background:#fff; " +
    "width:100%; box-sizing:border-box;";

  sfFileLabel.addEventListener("mouseenter", () => { sfFileLabel.style.borderColor = "#999"; });
  sfFileLabel.addEventListener("mouseleave", () => { sfFileLabel.style.borderColor = "#ddd"; });

  const sfFileName = document.createElement("span");
  sfFileName.textContent = "";
  sfFileName.style.cssText = "display:block; color:#333; font-size:12px; margin-top:4px; text-align:center;";

  const sfWrapper = document.createElement("div");
  sfWrapper.id = "sf-wrapper";
  sfWrapper.style.cssText = "display:none; margin-bottom: 16px;";
  sfWrapper.appendChild(sfFileInput);
  sfWrapper.appendChild(sfFileLabel);
  sfWrapper.appendChild(sfFileName);

  sidebar.appendChild(sfWrapper);

  // Zoom slider
  const zoomWrapper = document.createElement("div");
  zoomWrapper.id = "zoom-wrapper";
  zoomWrapper.style.cssText = "display:none; margin-bottom: 20px;";

  const zoomLabelRow = document.createElement("div");
  zoomLabelRow.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;";

  const zoomLabel = document.createElement("span");
  zoomLabel.textContent = "视图缩放";
  zoomLabel.style.cssText = "color:#888; font-size:13px;";

  const zoomValue = document.createElement("span");
  zoomValue.id = "zoom-value";
  zoomValue.textContent = "15s";
  zoomValue.style.cssText = "color:#333; font-size:13px; font-weight:500;";

  zoomLabelRow.appendChild(zoomLabel);
  zoomLabelRow.appendChild(zoomValue);

  const zoomSlider = document.createElement("input");
  zoomSlider.type = "range";
  zoomSlider.id = "zoom-slider";
  zoomSlider.min = "3";
  zoomSlider.max = "60";
  zoomSlider.step = "1";
  zoomSlider.value = "15";
  zoomSlider.style.cssText =
    "width:100%; margin:0; -webkit-appearance:none; appearance:none; " +
    "height:4px; background:#e0e0e0; border-radius:2px; outline:none; cursor:pointer;";
  // Note: thumb styling applied via style.css because inline pseudo-elements don't work

  zoomWrapper.appendChild(zoomLabelRow);
  zoomWrapper.appendChild(zoomSlider);
  sidebar.appendChild(zoomWrapper);

  // Playback controls
  const playbackSection = document.createElement("div");
  playbackSection.id = "playback-section";
  playbackSection.style.cssText = "display:none; margin-bottom: 20px; border-top: 1px solid #eee; padding-top: 16px;";

  const playbackLabel = document.createElement("div");
  playbackLabel.textContent = "播放控制";
  playbackLabel.style.cssText = "color:#888; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom: 10px;";
  playbackSection.appendChild(playbackLabel);

  // Play + Reset buttons row
  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex; gap:8px; margin-bottom: 12px;";

  const playBtn = document.createElement("button");
  playBtn.id = "play-btn";
  playBtn.textContent = "▶ 播放";
  playBtn.style.cssText =
    "flex:2; padding:8px 12px; border:1px solid #ddd; border-radius:8px; " +
    "background:#fff; color:#333; cursor:pointer; font-size:13px; transition: all 0.2s;";
  const resetTimeBtn = document.createElement("button");
  resetTimeBtn.id = "reset-time-btn";
  resetTimeBtn.textContent = "↺ 开头";
  resetTimeBtn.style.cssText =
    "flex:1; padding:8px 12px; border:1px solid #ddd; border-radius:8px; " +
    "background:#fff; color:#666; cursor:pointer; font-size:13px; transition: all 0.2s;";

  btnRow.appendChild(playBtn);
  btnRow.appendChild(resetTimeBtn);
  playbackSection.appendChild(btnRow);

  // Speed buttons
  const speedLabel = document.createElement("span");
  speedLabel.textContent = "速度";
  speedLabel.style.cssText = "color:#888; font-size:12px; display:block; margin-bottom: 4px;";
  playbackSection.appendChild(speedLabel);

  const speedGroup = document.createElement("div");
  speedGroup.id = "speed-group";
  speedGroup.style.cssText = "display:flex; gap:4px; margin-bottom: 12px;";

  const speeds = [0.5, 1, 1.5, 2];
  const speedBtns: HTMLButtonElement[] = [];
  for (const s of speeds) {
    const btn = document.createElement("button");
    btn.textContent = `${s}x`;
    btn.dataset.speed = String(s);
    btn.style.cssText =
      "flex:1; padding:4px 8px; border:1px solid #ddd; border-radius:6px; " +
      "background:#fff; color:#666; cursor:pointer; font-size:12px; transition: all 0.2s;";
    if (s === 1) {
      btn.style.borderColor = "#aaa";
      btn.style.color = "#333";
      btn.style.fontWeight = "600";
    }
    speedGroup.appendChild(btn);
    speedBtns.push(btn);
  }
  playbackSection.appendChild(speedGroup);

  // Time display
  const timeDisplay = document.createElement("div");
  timeDisplay.id = "time-display";
  timeDisplay.textContent = "0.0s / 0.0s";
  timeDisplay.style.cssText = "text-align:center; color:#888; font-size:12px;";
  playbackSection.appendChild(timeDisplay);

  // Fallback hint (hidden by default)
  const sfFallbackHint = document.createElement("div");
  sfFallbackHint.id = "sf-fallback-hint";
  sfFallbackHint.textContent = "钢琴音色加载失败，已使用合成器音色";
  sfFallbackHint.style.cssText =
    "display:none; color:#aaa; font-size:11px; text-align:center; margin-top:4px;";
  playbackSection.appendChild(sfFallbackHint);

  sidebar.appendChild(playbackSection);

  // Annotation section (placeholder for Section 4)
  const annotationSection = document.createElement("div");
  annotationSection.id = "annotation-section";
  annotationSection.style.cssText = "display:none; margin-top: 20px; border-top: 1px solid #eee; padding-top: 16px;";

  // BPM display
  const bpmRow = document.createElement("div");
  bpmRow.style.cssText = "display:flex; justify-content:space-between; align-items:center; font-size:13px; margin-bottom:6px;";
  const bpmLabel = document.createElement("span");
  bpmLabel.textContent = "BPM";
  bpmLabel.style.cssText = "color:#888;";
  const bpmDisplay = document.createElement("span");
  bpmDisplay.id = "bpm-display";
  bpmDisplay.textContent = "--";
  bpmDisplay.style.cssText = "color:#333; font-weight:500;";
  bpmRow.appendChild(bpmLabel);
  bpmRow.appendChild(bpmDisplay);
  annotationSection.appendChild(bpmRow);

  // Bar line count
  const barRow = document.createElement("div");
  barRow.style.cssText = "display:flex; justify-content:space-between; align-items:center; font-size:13px; margin-bottom:8px;";
  const barLabel = document.createElement("span");
  barLabel.textContent = "小节线";
  barLabel.style.cssText = "color:#888;";
  const barLineCount = document.createElement("span");
  barLineCount.id = "barline-count";
  barLineCount.textContent = "0 条";
  barLineCount.style.cssText = "color:#333; font-weight:500;";
  barRow.appendChild(barLabel);
  barRow.appendChild(barLineCount);
  annotationSection.appendChild(barRow);

  const countRow = document.createElement("div");
  countRow.style.cssText = "display:flex; justify-content:space-between; align-items:center; font-size:13px;";

  const countLabel = document.createElement("span");
  countLabel.textContent = "已标注";
  countLabel.style.cssText = "color:#888;";

  const annotationCount = document.createElement("span");
  annotationCount.id = "annotation-count";
  annotationCount.style.cssText = "color:#333; font-weight:600;";
  annotationCount.textContent = "0 个小节";

  countRow.appendChild(countLabel);
  countRow.appendChild(annotationCount);
  annotationSection.appendChild(countRow);

  const confirmBtn = document.createElement("button");
  confirmBtn.id = "confirm-btn";
  confirmBtn.textContent = "确认至此";
  confirmBtn.style.cssText =
    "width:100%; margin-top:12px; padding:8px 16px; border:1px solid #ddd; border-radius:8px; " +
    "background:#fff; color:#333; cursor:pointer; font-size:13px; transition: all 0.2s;";
  confirmBtn.addEventListener("mouseenter", () => {
    confirmBtn.style.borderColor = "#6A89A7";
    confirmBtn.style.color = "#6A89A7";
  });
  confirmBtn.addEventListener("mouseleave", () => {
    confirmBtn.style.borderColor = "#ddd";
    confirmBtn.style.color = "#333";
  });
  annotationSection.appendChild(confirmBtn);

  const resetBtn = document.createElement("button");
  resetBtn.id = "reset-btn";
  resetBtn.textContent = "清除标注";
  resetBtn.style.cssText =
    "width:100%; margin-top:12px; padding:8px 16px; border:1px solid #ddd; border-radius:8px; " +
    "background:#fff; color:#666; cursor:pointer; font-size:13px; transition: all 0.2s;";
  resetBtn.addEventListener("mouseenter", () => {
    resetBtn.style.borderColor = "#e74c3c";
    resetBtn.style.color = "#e74c3c";
  });
  resetBtn.addEventListener("mouseleave", () => {
    resetBtn.style.borderColor = "#ddd";
    resetBtn.style.color = "#666";
  });

  annotationSection.appendChild(resetBtn);

  // Import/Export buttons
  const ioRow = document.createElement("div");
  ioRow.style.cssText = "display:flex; gap:8px; margin-top:8px;";

  const exportBtn = document.createElement("button");
  exportBtn.id = "export-btn";
  exportBtn.textContent = "导出标注";
  exportBtn.style.cssText =
    "flex:1; padding:6px 8px; border:1px solid #ddd; border-radius:8px; " +
    "background:#fff; color:#666; cursor:pointer; font-size:12px; transition: all 0.2s;";

  const importBtn = document.createElement("button");
  importBtn.id = "import-btn";
  importBtn.textContent = "导入标注";
  importBtn.style.cssText =
    "flex:1; padding:6px 8px; border:1px solid #ddd; border-radius:8px; " +
    "background:#fff; color:#666; cursor:pointer; font-size:12px; transition: all 0.2s;";

  ioRow.appendChild(exportBtn);
  ioRow.appendChild(importBtn);
  annotationSection.appendChild(ioRow);

  sidebar.appendChild(annotationSection);

  return {
    fileLabel,
    infoPanel,
    trackCount: spans["track-count"] as HTMLSpanElement,
    noteCount: spans["note-count"] as HTMLSpanElement,
    pitchRange: spans["pitch-range"] as HTMLSpanElement,
    duration: spans["duration"] as HTMLSpanElement,
    errorBox,
    zoomSlider,
    zoomValue,
    playBtn,
    resetTimeBtn,
    speedGroup,
    speedBtns,
    timeDisplay,
    sfFallbackHint,
    sfFileLabel,
    sfFileName,
    annotationSection,
    annotationCount,
    bpmDisplay,
    barLineCount,
    resetBtn,
    confirmBtn,
    exportBtn,
    importBtn,
  };
}

export function updateMidiInfo(elements: SidebarElements, info: MidiInfo): void {
  elements.trackCount.textContent = String(info.trackCount);
  elements.noteCount.textContent = String(info.noteCount);
  elements.pitchRange.textContent = `${info.pitchMin} - ${info.pitchMax}`;
  elements.duration.textContent = `${info.duration.toFixed(1)}s`;
  elements.infoPanel.style.display = "block";
  elements.errorBox.style.display = "none";
}

export function showError(elements: SidebarElements, message: string): void {
  elements.errorBox.textContent = message;
  elements.errorBox.style.display = "block";
  elements.infoPanel.style.display = "none";
}

export function showAnnotationSection(elements: SidebarElements): void {
  elements.annotationSection.style.display = "block";
}

export function updateAnnotationCount(elements: SidebarElements, count: number): void {
  elements.annotationCount.textContent = `${count} 个小节`;
}

export function updateBpmDisplay(elements: SidebarElements, bpm: number | null, barLineCount: number): void {
  elements.bpmDisplay.textContent = bpm !== null ? `≈ ${bpm}` : "--";
  elements.barLineCount.textContent = `${barLineCount} 条`;
}
