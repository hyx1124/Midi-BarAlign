import type { MidiInfo } from "./types";

export interface SidebarElements {
  fileLabel: HTMLLabelElement;
  infoPanel: HTMLDivElement;
  trackCount: HTMLSpanElement;
  noteCount: HTMLSpanElement;
  pitchRange: HTMLSpanElement;
  duration: HTMLSpanElement;
  errorBox: HTMLDivElement;
  annotationSection: HTMLDivElement;
  annotationCount: HTMLSpanElement;
  resetBtn: HTMLButtonElement;
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

  // Annotation section (placeholder for Section 3)
  const annotationSection = document.createElement("div");
  annotationSection.id = "annotation-section";
  annotationSection.style.cssText = "display:none; margin-top: 20px; border-top: 1px solid #eee; padding-top: 16px;";

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
  sidebar.appendChild(annotationSection);

  return {
    fileLabel,
    infoPanel,
    trackCount: spans["track-count"] as HTMLSpanElement,
    noteCount: spans["note-count"] as HTMLSpanElement,
    pitchRange: spans["pitch-range"] as HTMLSpanElement,
    duration: spans["duration"] as HTMLSpanElement,
    errorBox,
    annotationSection,
    annotationCount,
    resetBtn,
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
