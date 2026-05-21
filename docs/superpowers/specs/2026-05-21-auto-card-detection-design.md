# Auto Card Detection — Design Spec
**Date:** 2026-05-21  
**Status:** Approved

---

## Overview

Add automatic card detection to the existing card-counter overlay. The user draws a region over their online blackjack table once, and the app watches that region via periodic screenshots, runs OCR (Tesseract.js) to read card ranks, and automatically feeds newly-appeared cards into the existing `Counter`. Manual keyboard input remains fully functional alongside auto-detection.

---

## Architecture

Four new files in `src/capture/`. No changes to `src/counter.js`, `src/settings.js`, or `src/preload.js` channel names (new channels are added). Minimal changes to `src/main.js` (new IPC handlers + watcher lifecycle) and `src/renderer/app.js` (new UI row).

```
src/capture/
  region-selector.js   Creates the selector BrowserWindow, handles IPC, returns region promise
  region-selector.html Fullscreen transparent overlay UI — click-drag rectangle drawing
  capturer.js          Takes a screenshot of the saved region via desktopCapturer
  detector.js          Runs Tesseract.js OCR on image buffer, returns array of rank strings
  watcher.js           500ms polling loop — diffs frames, calls counter.logCard() for new cards
```

**Data flow:**
```
watcher.js
  → capturer.js        → PNG buffer of region
  → detector.js        → ['a', 'k', '5', '5']  (current visible ranks)
  → diff vs prev frame → ['5']  (new ranks this tick)
  → counter.logCard('5')
  → broadcastState()   → widget updates
```

---

## Module Specs

### `src/capture/region-selector.js`

Creates a second `BrowserWindow` (fullscreen, transparent, always-on-top, frame:false) that loads `src/capture/region-selector.html`. The overlay lets the user click-drag to draw a rectangle. On mouse-up it sends the region `{ x, y, width, height }` back to main via IPC (`capture:regionSelected`), then the window closes.

The region coordinates are in **screen pixels** (not CSS pixels), matching what `desktopCapturer` returns.

Exported function: `openRegionSelector(mainWindow)` — returns a Promise that resolves to `{ x, y, width, height }`.

---

### `src/capture/capturer.js`

Uses `desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width, height } })` to grab a full-screen thumbnail, then crops it to the saved region using Electron's `nativeImage` crop API.

Returns a PNG `Buffer`.

Exported function: `captureRegion(region)` — returns `Promise<Buffer>`.

---

### `src/capture/detector.js`

Takes a PNG buffer, passes it to `Tesseract.recognize()` with a custom whitelist (`AKQJT234567890`) and PSM 11 (sparse text — no assumed layout). Extracts all word tokens from the result, normalises them to the Counter's key format:

| OCR output | Normalised |
|-----------|------------|
| A, Ace | a |
| K, King | k |
| Q, Queen | q |
| J, Jack | j |
| 10, T | t |
| 2–9 | '2'–'9' |

Returns a string array of rank tokens (may contain duplicates, e.g. `['5','5','a','k']`).

Exported function: `detectCards(imageBuffer)` — returns `Promise<string[]>`.

---

### `src/capture/watcher.js`

Polling loop that runs every 500ms while active. Maintains `prevRanks: string[]` (sorted, to allow stable comparison).

**Algorithm each tick:**
1. Call `captureRegion(region)` → buffer
2. Call `detectCards(buffer)` → `currentRanks[]`
3. **New hand detection:** if `currentRanks.length === 0` and `prevRanks.length > 0`, reset `prevRanks = []` (table cleared, new hand incoming)
4. **Diff:** compute `newCards = currentRanks - prevRanks` (multiset subtraction — handles duplicates). Example: if `prevRanks = ['a','k']` and `currentRanks = ['a','k','5','5']`, then `newCards = ['5','5']` — both fives are logged.
5. For each card in `newCards`: call `counter.logCard(card)`, then `broadcastState()`
6. Set `prevRanks = currentRanks`

Exported functions:
- `startWatcher(region, counter, broadcastFn)` — starts the interval, returns watcher ID
- `stopWatcher(id)` — clears the interval

---

## IPC Additions

New channels added to `src/main.js` and exposed via `src/preload.js`:

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `capture:openSelector` | renderer → main | Open region selector window |
| `capture:regionSelected` | selector → main | Region coords from selector overlay |
| `capture:start` | renderer → main | Start watcher with saved region |
| `capture:stop` | renderer → main | Stop watcher |
| `capture:status` | main → renderer | Push: `{ active: bool, region: {x,y,w,h} \| null }` |

Region is persisted in `settings` under key `captureRegion` (default `null`).

---

## Widget UI Changes

**`src/renderer/index.html`** — add one new row inside `#expanded-view`, between the header and the counts row:

```html
<div id="capture-row" class="capture-row">
  <button id="capture-btn" class="capture-btn">📷 Auto</button>
  <span id="capture-status" class="capture-status hidden">
    <span class="rec-dot"></span> Watching
  </span>
  <button id="capture-stop" class="capture-btn stop hidden">■ Stop</button>
</div>
```

**`src/renderer/style.css`** — add styles for `.capture-row`, `.capture-btn`, `.capture-status`, `.rec-dot` (animated green pulse).

**`src/renderer/app.js`** — add handlers:
- `capture-btn` click → reads `settings.captureRegion`; if null, calls `window.api.openCaptureSelector()` (draws new region then auto-starts); if region already saved, calls `window.api.startCapture()` directly
- `capture-stop` click → `window.api.stopCapture()`
- `window.api.onCaptureStatus(cb)` subscription → shows/hides rec indicator and stop button

---

## New preload.js Additions

```js
// Capture
openCaptureSelector: () => ipcRenderer.invoke('capture:openSelector'),
startCapture:        () => ipcRenderer.invoke('capture:start'),
stopCapture:         () => ipcRenderer.invoke('capture:stop'),
onCaptureStatus:     (cb) => ipcRenderer.on('capture:status', (_, s) => cb(s)),
```

---

## Dependencies

```bash
npm install tesseract.js@5
```

Tesseract.js v5 runs in Node.js (main process). No additional native modules required. Worker threads managed internally by Tesseract.js.

**Tesseract runs in the main process** (not renderer) to avoid CSP issues and keep the renderer fast.

---

## Error Handling

| Situation | Handling |
|-----------|----------|
| Region not set | `capture-btn` click opens selector automatically |
| Selector closed without drawing | No region saved, watcher not started |
| desktopCapturer returns no sources | Log warning, retry next tick |
| OCR returns no recognisable ranks | Treat as empty frame (no new cards logged) |
| OCR confidence < 60% on a token | Discard that token |
| Watcher crashes | Catch error, stop watcher, push `capture:status { active: false }` |

---

## Out of Scope (v1)

- Webcam / physical card detection
- Multiple simultaneous regions
- Auto-detecting which window is the blackjack game
- Suit detection (only rank is needed for Hi-Lo)
- Video stream processing (screenshot polling is sufficient)
