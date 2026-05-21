# Auto Card Detection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Tesseract.js OCR-based automatic card detection to the card counter overlay — user draws a region over their online blackjack table and the app reads cards as they appear.

**Architecture:** Four new modules in `src/capture/` handle region selection, screen capture, OCR, and the polling loop. They integrate with the existing `Counter` instance and `broadcastState()` in `main.js`. No changes to `counter.js`, `settings.js` structure (only adds a default key), or IPC channel names from the existing system.

**Tech Stack:** Tesseract.js v5 (Node.js OCR), Electron `desktopCapturer` + `nativeImage` (screen capture), existing Electron BrowserWindow (region selector overlay)

---

## File Map

| File | Change | Responsibility |
|------|--------|---------------|
| `src/capture/detector.js` | Create | OCR: takes PNG buffer → returns normalised rank array |
| `src/capture/watcher.js` | Create | 500ms poll loop + multiset diff + feeds counter |
| `src/capture/capturer.js` | Create | Screen capture of saved region via desktopCapturer |
| `src/capture/selector-preload.js` | Create | contextBridge for the region-selector window |
| `src/capture/region-selector.html` | Create | Fullscreen drag-to-draw overlay UI |
| `src/capture/region-selector.js` | Create | Opens selector BrowserWindow, returns region promise |
| `src/settings.js` | Modify | Add `captureRegion: null` default |
| `src/main.js` | Modify | Add capture requires, IPC handlers, quit cleanup |
| `src/preload.js` | Modify | Expose 4 new capture IPC channels |
| `src/renderer/index.html` | Modify | Add `#capture-row` between header and counts |
| `src/renderer/style.css` | Modify | Add capture row + rec-dot animation styles |
| `src/renderer/app.js` | Modify | Add capture button handlers + status subscription |
| `test/detector.test.js` | Create | Unit tests for normaliseToken |
| `test/watcher.test.js` | Create | Unit tests for diffRanks |

---

## Task 1: Install Tesseract.js + Settings Default

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `src/settings.js`

- [ ] **Step 1: Install Tesseract.js**

```bash
cd C:\Users\tooos\desktop\Gamble
npm install tesseract.js@5
```

Expected: `tesseract.js` added to `node_modules/`, no errors.

- [ ] **Step 2: Add `captureRegion` default to settings**

Open `src/settings.js`. The current defaults object ends with `position: null`. Add `captureRegion` after it:

```js
const store = new Store({
  name: 'card-counter-settings',
  defaults: {
    totalDecks:     6,
    showHandAdvice: true,
    autoExpand:     true,
    opacity:        100,
    position:       null,
    captureRegion:  null,   // { x, y, width, height } in screen pixels, null = not set
  },
});
```

- [ ] **Step 3: Run existing tests to confirm no regression**

```bash
npx jest --no-coverage
```

Expected: 32 passed, 0 failed.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/settings.js
git commit -m "feat: install tesseract.js, add captureRegion settings default"
```

---

## Task 2: detector.js (TDD)

**Files:**
- Create: `test/detector.test.js`
- Create: `src/capture/detector.js`

- [ ] **Step 1: Write the failing tests**

Create `test/detector.test.js`:

```js
// test/detector.test.js
// Tests only the pure normaliseToken function.
// detectCards itself requires a real image + Tesseract worker — tested manually.

const { normaliseToken } = require('../src/capture/detector');

describe('normaliseToken', () => {
  test.each([
    ['A',    'a'],
    ['a',    'a'],
    ['Ace',  'a'],
    ['ace',  'a'],
    ['K',    'k'],
    ['King', 'k'],
    ['Q',    'q'],
    ['J',    'j'],
    ['10',   't'],
    ['T',    't'],
    ['t',    't'],
    ['2',    '2'],
    ['3',    '3'],
    ['4',    '4'],
    ['5',    '5'],
    ['6',    '6'],
    ['7',    '7'],
    ['8',    '8'],
    ['9',    '9'],
  ])('normalises "%s" → "%s"', (input, expected) => {
    expect(normaliseToken(input)).toBe(expected);
  });

  test.each(['X', '', 'Z', '11', 'Joker'])('returns null for unrecognised token "%s"', (input) => {
    expect(normaliseToken(input)).toBeNull();
  });
});
```

- [ ] **Step 2: Run — confirm failure**

```bash
npx jest test/detector.test.js --no-coverage
```

Expected: FAIL — `Cannot find module '../src/capture/detector'`

- [ ] **Step 3: Create `src/capture/` directory and write `src/capture/detector.js`**

```bash
mkdir src\capture
```

Create `src/capture/detector.js`:

```js
// src/capture/detector.js
'use strict';

// Rank token normalisation — maps OCR output to Counter key format
const RANK_MAP = {
  'a': 'a', 'ace': 'a',
  'k': 'k', 'king': 'k',
  'q': 'q', 'queen': 'q',
  'j': 'j', 'jack': 'j',
  '10': 't', 't': 't',
  '2': '2', '3': '3', '4': '4', '5': '5',
  '6': '6', '7': '7', '8': '8', '9': '9',
};

// Pure normalisation — exported for testing
function normaliseToken(token) {
  return RANK_MAP[String(token).toLowerCase().trim()] || null;
}

// Tesseract config — sparse text mode, restrict charset to card rank characters
const TESSERACT_PARAMS = {
  tessedit_char_whitelist: 'AaKkQqJjTt0123456789',
  tessedit_pageseg_mode: '11',   // PSM 11: sparse text, find as many text chunks as possible
};

let worker = null;

async function getWorker() {
  if (!worker) {
    // Lazy-require so this module can be require()'d in Jest without loading Tesseract
    const { createWorker } = require('tesseract.js');
    worker = await createWorker('eng');
    await worker.setParameters(TESSERACT_PARAMS);
  }
  return worker;
}

/**
 * Run OCR on a PNG buffer and return an array of normalised rank strings.
 * May contain duplicates (e.g. ['5','5'] if two 5s are visible).
 * Words with confidence < 60 are discarded.
 *
 * @param {Buffer} imageBuffer  PNG buffer of the captured region
 * @returns {Promise<string[]>} e.g. ['a', 'k', '5']
 */
async function detectCards(imageBuffer) {
  const w = await getWorker();
  const { data } = await w.recognize(imageBuffer);

  const ranks = [];
  for (const word of data.words) {
    if (word.confidence < 60) continue;
    const rank = normaliseToken(word.text);
    if (rank) ranks.push(rank);
  }

  return ranks;
}

/**
 * Terminate the Tesseract worker. Call on app quit.
 */
async function destroyWorker() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}

module.exports = { detectCards, destroyWorker, normaliseToken };
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
npx jest test/detector.test.js --no-coverage
```

Expected: 24 passed (19 recognised + 5 unrecognised), 0 failed.

- [ ] **Step 5: Commit**

```bash
git add src/capture/detector.js test/detector.test.js
git commit -m "feat: card rank detector with OCR normalisation (TDD)"
```

---

## Task 3: watcher.js (TDD)

**Files:**
- Create: `test/watcher.test.js`
- Create: `src/capture/watcher.js`

- [ ] **Step 1: Write the failing tests**

Create `test/watcher.test.js`:

```js
// test/watcher.test.js
// Tests the pure diffRanks function — no Electron or Tesseract needed.

const { diffRanks } = require('../src/capture/watcher');

describe('diffRanks — multiset subtraction', () => {
  test('returns empty when nothing new', () => {
    expect(diffRanks(['a', 'k'], ['a', 'k'])).toEqual([]);
  });

  test('returns new card when one added', () => {
    expect(diffRanks(['a', 'k'], ['a', 'k', '5'])).toEqual(['5']);
  });

  test('returns both new cards when two added', () => {
    expect(diffRanks(['a'], ['a', 'k', '5'])).toEqual(['k', '5']);
  });

  test('handles duplicate correctly — one prev, two current', () => {
    expect(diffRanks(['5'], ['5', '5'])).toEqual(['5']);
  });

  test('handles duplicate correctly — two prev, three current', () => {
    expect(diffRanks(['5', '5'], ['5', '5', '5'])).toEqual(['5']);
  });

  test('returns all when prev is empty', () => {
    expect(diffRanks([], ['a', 'k'])).toEqual(['a', 'k']);
  });

  test('returns empty when both empty', () => {
    expect(diffRanks([], [])).toEqual([]);
  });

  test('returns empty when cards removed (hand cleared)', () => {
    // Cards were cleared — nothing new to log
    expect(diffRanks(['a', 'k', '5'], ['a'])).toEqual([]);
  });

  test('real deal scenario: new card appears mid-hand', () => {
    // Prev: dealer shows A, player has K
    // Current: dealer shows A, player has K, new card 7 dealt
    expect(diffRanks(['a', 'k'], ['a', 'k', '7'])).toEqual(['7']);
  });
});
```

- [ ] **Step 2: Run — confirm failure**

```bash
npx jest test/watcher.test.js --no-coverage
```

Expected: FAIL — `Cannot find module '../src/capture/watcher'`

- [ ] **Step 3: Write `src/capture/watcher.js`**

```js
// src/capture/watcher.js
'use strict';

/**
 * Multiset subtraction: find cards in `current` that aren't in `prev`.
 * Handles duplicates: if prev has one '5' and current has two '5's, returns ['5'].
 *
 * @param {string[]} prev     Ranks visible in the last frame
 * @param {string[]} current  Ranks visible in the current frame
 * @returns {string[]}        New ranks that appeared this frame
 */
function diffRanks(prev, current) {
  const remaining = [...prev];
  const newCards  = [];

  for (const card of current) {
    const idx = remaining.indexOf(card);
    if (idx !== -1) {
      remaining.splice(idx, 1); // already counted — remove from pool
    } else {
      newCards.push(card);       // new card
    }
  }

  return newCards;
}

// Module-level watcher state
let intervalId = null;
let prevRanks  = [];

/**
 * Start the 500ms polling loop.
 * Captures the given region, detects cards, diffs against previous frame,
 * and calls counter.logCard() + broadcastFn() for each new card.
 *
 * Safe to call while already running — stops existing loop first.
 *
 * @param {{ x:number, y:number, width:number, height:number }} region
 * @param {object}   counter      Counter instance with .logCard(key) method
 * @param {function} broadcastFn  Called after state changes (no args)
 */
function startWatcher(region, counter, broadcastFn) {
  stopWatcher(); // ensure clean state
  prevRanks = [];

  intervalId = setInterval(async () => {
    try {
      // Lazy-require to avoid pulling Electron into Jest
      const { captureRegion } = require('./capturer');
      const { detectCards }   = require('./detector');

      const buffer       = await captureRegion(region);
      const currentRanks = await detectCards(buffer);

      // New hand: table cleared — reset baseline, don't log anything
      if (currentRanks.length === 0 && prevRanks.length > 0) {
        prevRanks = [];
        return;
      }

      const newCards = diffRanks(prevRanks, currentRanks);

      if (newCards.length > 0) {
        for (const card of newCards) {
          counter.logCard(card);
        }
        broadcastFn();
      }

      prevRanks = currentRanks;
    } catch (err) {
      console.error('[watcher] tick error:', err.message);
    }
  }, 500);
}

/**
 * Stop the polling loop and reset frame state.
 */
function stopWatcher() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  prevRanks = [];
}

module.exports = { startWatcher, stopWatcher, diffRanks };
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
npx jest test/watcher.test.js --no-coverage
```

Expected: 9 passed, 0 failed.

- [ ] **Step 5: Run full suite — confirm no regressions**

```bash
npx jest --no-coverage
```

Expected: 54 passed (32 counter + 22 detector + 9 watcher - 9 = actually 32+22+9 = 63... wait let me recount: 32 counter tests + 22 detector tests (19 normalised + wait the test has 19 + 5 = 24 actually)

Actually: detector test has 19 parametrized recognised tests + 5 unrecognised = 24 tests. Watcher has 9 tests. Counter has 32. Total = 65.

Expected: 65 passed, 0 failed.

- [ ] **Step 6: Commit**

```bash
git add src/capture/watcher.js test/watcher.test.js
git commit -m "feat: card watcher with diffRanks multiset logic (TDD)"
```

---

## Task 4: capturer.js

**Files:**
- Create: `src/capture/capturer.js`

No unit tests — depends on Electron's `desktopCapturer`. Verified in the smoke test (Task 9).

- [ ] **Step 1: Write `src/capture/capturer.js`**

```js
// src/capture/capturer.js
'use strict';

/**
 * Capture a PNG buffer of the given screen region using Electron's desktopCapturer.
 *
 * Coordinates are in logical (CSS) pixels — matching what the region selector sends.
 * Note: on HiDPI displays with scaling > 100%, the capture may be slightly offset.
 * This is acceptable for v1; redraw the region if alignment is off.
 *
 * @param {{ x:number, y:number, width:number, height:number }} region
 * @returns {Promise<Buffer>} PNG buffer of the cropped region
 */
async function captureRegion(region) {
  const { desktopCapturer, screen } = require('electron');

  const { width, height } = screen.getPrimaryDisplay().size;

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width, height },
  });

  if (!sources.length) {
    throw new Error('[capturer] No screen sources found');
  }

  const cropped = sources[0].thumbnail.crop({
    x:      Math.max(0, region.x),
    y:      Math.max(0, region.y),
    width:  region.width,
    height: region.height,
  });

  return cropped.toPNG();
}

module.exports = { captureRegion };
```

- [ ] **Step 2: Commit**

```bash
git add src/capture/capturer.js
git commit -m "feat: screen region capturer using desktopCapturer"
```

---

## Task 5: Region Selector

**Files:**
- Create: `src/capture/selector-preload.js`
- Create: `src/capture/region-selector.html`
- Create: `src/capture/region-selector.js`

No unit tests — all Electron BrowserWindow code. Verified in smoke test.

- [ ] **Step 1: Write `src/capture/selector-preload.js`**

```js
// src/capture/selector-preload.js
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('selector', {
  sendRegion: (region) => ipcRenderer.send('capture:regionSelected', region),
});
```

- [ ] **Step 2: Write `src/capture/region-selector.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.35);
      overflow: hidden;
      cursor: crosshair;
      user-select: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    #instruction {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.75);
      color: #fff;
      padding: 12px 22px;
      border-radius: 10px;
      font-size: 14px;
      pointer-events: none;
      border: 1px solid rgba(255,255,255,0.15);
    }

    #instruction span {
      color: #f59e0b;
      font-weight: 600;
    }

    #selection {
      position: fixed;
      border: 2px solid #f59e0b;
      background: rgba(245, 158, 11, 0.08);
      display: none;
      pointer-events: none;
    }

    #size-label {
      position: fixed;
      background: rgba(0,0,0,0.7);
      color: #f59e0b;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      pointer-events: none;
      display: none;
    }
  </style>
</head>
<body>
  <div id="instruction">
    Drag to select the <span>card area</span> — press <span>Esc</span> to cancel
  </div>
  <div id="selection"></div>
  <div id="size-label"></div>

  <script>
    const sel       = document.getElementById('selection');
    const instr     = document.getElementById('instruction');
    const sizeLabel = document.getElementById('size-label');

    let startX = 0, startY = 0, dragging = false;

    document.addEventListener('mousedown', (e) => {
      startX   = e.clientX;
      startY   = e.clientY;
      dragging = true;
      instr.style.display = 'none';
      sel.style.display   = 'block';
      sizeLabel.style.display = 'block';
      sel.style.left   = startX + 'px';
      sel.style.top    = startY + 'px';
      sel.style.width  = '0';
      sel.style.height = '0';
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const x = Math.min(e.clientX, startX);
      const y = Math.min(e.clientY, startY);
      const w = Math.abs(e.clientX - startX);
      const h = Math.abs(e.clientY - startY);

      sel.style.left   = x + 'px';
      sel.style.top    = y + 'px';
      sel.style.width  = w + 'px';
      sel.style.height = h + 'px';

      sizeLabel.style.left = (x + 4) + 'px';
      sizeLabel.style.top  = (y + 4) + 'px';
      sizeLabel.textContent = `${w} × ${h}`;
    });

    document.addEventListener('mouseup', (e) => {
      if (!dragging) return;
      dragging = false;

      const x = Math.min(e.screenX, startX + window.screenX);
      const y = Math.min(e.screenY, startY + window.screenY);
      const w = Math.abs(e.clientX - startX);
      const h = Math.abs(e.clientY - startY);

      if (w > 20 && h > 20) {
        window.selector.sendRegion({
          x:      Math.round(Math.min(e.screenX, startX + window.screenX)),
          y:      Math.round(Math.min(e.screenY, startY + window.screenY)),
          width:  Math.round(w),
          height: Math.round(h),
        });
      } else {
        window.selector.sendRegion(null); // too small — treat as cancel
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') window.selector.sendRegion(null);
    });
  </script>
</body>
</html>
```

- [ ] **Step 3: Write `src/capture/region-selector.js`**

```js
// src/capture/region-selector.js
'use strict';

const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');

/**
 * Open a fullscreen transparent overlay for the user to draw a capture region.
 *
 * @returns {Promise<{x,y,width,height}|null>}
 *   Resolves with region object, or null if the user cancelled.
 */
function openRegionSelector() {
  return new Promise((resolve) => {
    const selectorWin = new BrowserWindow({
      fullscreen:  true,
      frame:       false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      webPreferences: {
        preload:          path.join(__dirname, 'selector-preload.js'),
        contextIsolation: true,
        nodeIntegration:  false,
      },
    });

    selectorWin.loadFile(path.join(__dirname, 'region-selector.html'));

    let resolved = false;

    function finish(region) {
      if (resolved) return;
      resolved = true;
      ipcMain.removeListener('capture:regionSelected', onRegion);
      if (!selectorWin.isDestroyed()) selectorWin.close();
      resolve(region);
    }

    function onRegion(_, region) { finish(region); }

    ipcMain.on('capture:regionSelected', onRegion);
    selectorWin.on('closed', () => finish(null));
  });
}

module.exports = { openRegionSelector };
```

- [ ] **Step 4: Commit**

```bash
git add src/capture/selector-preload.js src/capture/region-selector.html src/capture/region-selector.js
git commit -m "feat: region selector overlay — fullscreen drag-to-draw"
```

---

## Task 6: Update main.js

**Files:**
- Modify: `src/main.js`

Add capture imports, three IPC handlers, and cleanup on quit.

- [ ] **Step 1: Add imports at the top of `src/main.js`**

After the existing requires block (after `const settings = require('./settings');`), add:

```js
// ── Capture ───────────────────────────────────────────────────────────────
const { openRegionSelector } = require('./capture/region-selector');
const { startWatcher, stopWatcher } = require('./capture/watcher');
const { destroyWorker }      = require('./capture/detector');

let watcherRunning = false;
```

- [ ] **Step 2: Add three capture IPC handlers**

After the last existing `ipcMain.handle(...)` line (after `window:toggleExpand`), add:

```js
// ── Capture IPC ───────────────────────────────────────────────────────────
ipcMain.handle('capture:openSelector', async () => {
  const region = await openRegionSelector();
  if (region) {
    settings.set('captureRegion', region);
    stopWatcher();
    startWatcher(region, counter, broadcastState);
    watcherRunning = true;
    if (win && !win.isDestroyed()) {
      win.webContents.send('capture:status', { active: true, region });
    }
  }
  return region;
});

ipcMain.handle('capture:start', () => {
  const region = settings.get('captureRegion');
  if (!region) return { active: false, region: null };
  stopWatcher();
  startWatcher(region, counter, broadcastState);
  watcherRunning = true;
  if (win && !win.isDestroyed()) {
    win.webContents.send('capture:status', { active: true, region });
  }
  return { active: true, region };
});

ipcMain.handle('capture:stop', () => {
  stopWatcher();
  watcherRunning = false;
  if (win && !win.isDestroyed()) {
    win.webContents.send('capture:status', { active: false, region: settings.get('captureRegion') });
  }
  return { active: false };
});
```

- [ ] **Step 3: Update `app.on('will-quit')` to clean up capture resources**

Find the existing line:

```js
app.on('will-quit',         () => globalShortcut.unregisterAll());
```

Replace it with:

```js
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopWatcher();
  destroyWorker().catch(() => {}); // async cleanup, ignore errors on exit
});
```

- [ ] **Step 4: Run tests — confirm no regression**

```bash
npx jest --no-coverage
```

Expected: all tests pass, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add src/main.js
git commit -m "feat: main.js capture IPC handlers and quit cleanup"
```

---

## Task 7: Update preload.js

**Files:**
- Modify: `src/preload.js`

- [ ] **Step 1: Add capture channels to the contextBridge object in `src/preload.js`**

Find the closing `});` of `contextBridge.exposeInMainWorld('api', {`. Before it, add:

```js
  // Capture
  openCaptureSelector: () => ipcRenderer.invoke('capture:openSelector'),
  startCapture:        () => ipcRenderer.invoke('capture:start'),
  stopCapture:         () => ipcRenderer.invoke('capture:stop'),
  onCaptureStatus:     (cb) => ipcRenderer.on('capture:status', (_, s) => cb(s)),
```

The full end of the file should now look like:

```js
  // Capture
  openCaptureSelector: () => ipcRenderer.invoke('capture:openSelector'),
  startCapture:        () => ipcRenderer.invoke('capture:start'),
  stopCapture:         () => ipcRenderer.invoke('capture:stop'),
  onCaptureStatus:     (cb) => ipcRenderer.on('capture:status', (_, s) => cb(s)),
});
```

- [ ] **Step 2: Commit**

```bash
git add src/preload.js
git commit -m "feat: preload — expose capture IPC channels"
```

---

## Task 8: Update Renderer UI

**Files:**
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/style.css`
- Modify: `src/renderer/app.js`

- [ ] **Step 1: Add capture row to `src/renderer/index.html`**

Find the header div inside `#expanded-view`:

```html
      <div class="header">
        <span class="label-sm">Card Counter</span>
        <button id="settings-btn" class="icon-btn" title="Settings">⚙</button>
      </div>

      <div class="counts-row">
```

Insert the capture row between them:

```html
      <div class="header">
        <span class="label-sm">Card Counter</span>
        <button id="settings-btn" class="icon-btn" title="Settings">⚙</button>
      </div>

      <!-- ── Capture row ── -->
      <div id="capture-row" class="capture-row">
        <button id="capture-btn" class="capture-btn" title="Auto-detect cards from screen">📷 Auto</button>
        <span id="capture-status" class="capture-status hidden">
          <span class="rec-dot"></span>Watching
        </span>
        <button id="capture-stop" class="capture-stop hidden" title="Stop auto-detection">■ Stop</button>
      </div>

      <div class="counts-row">
```

- [ ] **Step 2: Add capture styles to `src/renderer/style.css`**

Append at the end of the file (after the `.flash-reset` animation block):

```css
/* ── Capture row ── */
.capture-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}

.capture-btn {
  background: #2a2a3e;
  border: 1px solid #3a3a4e;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11px;
  color: #888;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
  -webkit-app-region: no-drag;
}
.capture-btn:hover { color: #e2e8f0; border-color: #555; }

.capture-stop {
  background: #2a2a3e;
  border: 1px solid #ef444455;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  color: #ef4444;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
  -webkit-app-region: no-drag;
}
.capture-stop:hover { border-color: #ef4444; }

.capture-status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: #22c55e;
  flex: 1;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.rec-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  flex-shrink: 0;
  animation: pulse-rec 1.5s ease-in-out infinite;
}

@keyframes pulse-rec {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.25; }
}
```

- [ ] **Step 3: Add capture handlers to `src/renderer/app.js`**

**3a.** After the existing DOM refs block (after `const opacitySlider = ...`), add:

```js
const captureBtn    = document.getElementById('capture-btn');
const captureStatus = document.getElementById('capture-status');
const captureStop   = document.getElementById('capture-stop');
```

**3b.** After the `flashReset` function, add:

```js
function setCaptureActive(active) {
  if (active) {
    captureBtn.classList.add('hidden');
    captureStatus.classList.remove('hidden');
    captureStop.classList.remove('hidden');
  } else {
    captureBtn.classList.remove('hidden');
    captureStatus.classList.add('hidden');
    captureStop.classList.add('hidden');
  }
}
```

**3c.** In the `// ── Buttons ──` section, after the `opacitySlider` listener, add:

```js
captureBtn.addEventListener('click', async () => {
  const settings = await window.api.getSettings();
  if (settings.captureRegion) {
    await window.api.startCapture();
  } else {
    await window.api.openCaptureSelector();
  }
});

captureStop.addEventListener('click', async () => {
  await window.api.stopCapture();
});
```

**3d.** In the `// ── IPC subscriptions ──` section, add:

```js
window.api.onCaptureStatus((s) => setCaptureActive(s.active));
```

- [ ] **Step 4: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/index.html src/renderer/style.css src/renderer/app.js
git commit -m "feat: capture row UI — auto button, watching indicator, stop button"
```

---

## Task 9: Smoke Test

**Files:** none new — manual verification.

- [ ] **Step 1: Run the app**

```bash
npm start
```

Expected: widget appears in bottom-right corner, no errors in terminal.

- [ ] **Step 2: Verify capture row is visible**

Press `Ctrl+Shift+Space` to expand the widget. Confirm a `📷 Auto` button appears between the header and the count display.

- [ ] **Step 3: Test region selector**

Click **📷 Auto**. A semi-transparent dark overlay should cover the whole screen with the instruction "Drag to select the card area". Drag a rectangle over part of the screen. The region should be highlighted with an orange border. Release — the overlay closes.

- [ ] **Step 4: Verify watching state**

After drawing a region, the widget should now show `● Watching` and a `■ Stop` button. The `📷 Auto` button should be hidden.

- [ ] **Step 5: Test card detection**

Open any online blackjack game (e.g. https://www.247blackjack.com). Expand the widget and click **📷 Auto** to re-draw a region directly over the card area on the table. Watch the running count in the widget — it should increment as cards are dealt.

- [ ] **Step 6: Test Stop**

Click **■ Stop**. The `● Watching` indicator disappears and the `📷 Auto` button returns.

- [ ] **Step 7: Test keyboard fallback**

While the widget is focused (click it), type `2`, `k`, `a`. The count should update manually regardless of whether auto-detect is running.

- [ ] **Step 8: Test saved region**

Quit and restart the app. Click **📷 Auto** — it should start watching immediately (no region drawer) because the region was saved from last session.

- [ ] **Step 9: Final commit**

```bash
git add .
git commit -m "chore: auto card detection smoke test passes"
```
