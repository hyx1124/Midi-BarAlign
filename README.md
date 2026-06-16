# Midi-BarAlign

**Human-assisted MIDI bar line alignment tool with visual waterfall.**

真人演奏 MIDI 的节拍网格对齐工具。通过可视化瀑布流 + 人工标注 + 低音启发性算法，将没有可靠 tempo 轨道的 MIDI 文件对齐到正确的小节线网格上。

---

## Features

- **Waterfall Piano Roll** — Synthesia-style horizontal scrolling waterfall visualization
- **Manual Downbeat Annotation** — Click notes to mark measure downbeats; toggle to correct
- **Auto Bar Line Detection** — Bass-note heuristic algorithm autonomously extends bar lines from user annotations
- **BPM Estimation** — Rolling-window local BPM adapts to tempo changes across sections
- **SF2/SF3 Playback** — Realistic SoundFont synthesis via spessasynth_lib (with square-wave fallback)
- **Confirm & Export** — Batch-lock verified bar sections; export annotations as JSON
- **Import/Export Annotations** — Save and restore annotation sessions

---

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. Click **选择 MIDI 文件** to load a `.mid` file.

> **To hear audio playback**, load a SoundFont file (`.sf2` or `.sf3`) via the sidebar **选择音色文件** button, or place one at `public/your-font.sf2` and update the code path in `player.ts`.

---

## Usage

1. **Load a MIDI file** — Notes appear as dark rounded rectangles in the waterfall, scrolling right-to-left. The red vertical line is the judgment line. Mouse wheel scrolls through time.
2. **Annotate 5 downbeats** — Click notes at the start of measures 1–5. Annotated notes turn slate-blue. Sidebar shows "已标注 N 个小节".
3. **Auto-detect** — After 5 annotations, the algorithm extends bar lines across the entire file. Solid bar lines = confirmed by bass heuristic. Dashed = unconfirmed prediction.
4. **Verify & confirm** — Scroll through the generated bar lines. Drag the judgment line to where everything looks correct, click **确认至此** to batch-convert confirmed bar lines into user annotations.
5. **Export** — Use **导出标注** to save your annotations as a JSON file. Use **导入标注** to restore them later.

---

## Tech Stack

- [Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [@tonejs/midi](https://github.com/Tonejs/Midi) — MIDI parsing
- [spessasynth_lib](https://github.com/spessasus/spessasynth_lib) — SF2/SF3 synthesis
- Canvas 2D — Waterfall rendering

---

## License

GPL-3.0 © 2026

---

## SoundFonts

This project does **not** distribute SoundFont files. You must provide your own `.sf2` or `.sf3` file (e.g., FluidR3, TimGM6mb, Musyng Kite) and load it via the sidebar.
