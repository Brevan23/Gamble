# Card Counter Overlay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a frameless always-on-top Electron desktop overlay that tracks a Hi-Lo blackjack card count and shows running count, true count, bet advice, and deviation hints in a corner widget.

**Architecture:** Electron main process owns all state (Counter instance + Settings) and registers one global shortcut (`Ctrl+Shift+Space`) to toggle the widget. The renderer displays state pushed via IPC; card keypresses are captured locally in the renderer when the window has focus. A contextBridge preload keeps main/renderer cleanly separated.

**Tech Stack:** Electron 32, electron-store 10, electron-builder 25, Jest 29 (tests), vanilla HTML/CSS/JS (renderer)

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/counter.js` | Pure Hi-Lo counting logic — no Electron dependency |
| `src/settings.js` | electron-store wrapper with typed defaults |
| `src/preload.js` | contextBridge — exposes safe IPC API to renderer |
| `src/main.js` | BrowserWindow, Tray, globalShortcut, IPC handlers |
| `src/renderer/index.html` | Widget markup — collapsed + expanded views |
| `src/renderer/style.css` | Dark theme, transitions, collapsed/expanded states |
| `src/renderer/app.js` | DOM updates, keydown handler, IPC listeners |
| `src/assets/tray.png` | 16×16 tray icon (generated in Task 1) |
| `test/counter.test.js` | Unit tests for counter.js |
| `package.json` | npm scripts, Electron entry, Jest config |
| `electron-builder.yml` | Windows NSIS installer config |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `electron-builder.yml`
- Create: `src/assets/` directory + placeholder tray icon

- [ ] **Step 1: Initialise the project**

```bash
cd C:\Users\tooos\desktop\Gamble
npm init -y
```

Expected: `package.json` created with default fields.

- [ ] **Step 2: Install dependencies**

```bash
npm install --save electron@32 electron-store@10
npm install --save-dev electron-builder@25 jest@29
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Write `package.json`** (replace the generated one entirely)

```json
{
  "name": "card-counter",
  "version": "1.0.0",
  "description": "Floating blackjack card counter overlay",
  "main": "src/main.js",
  "scripts": {
    "start": "electron .",
    "test": "jest",
    "build": "electron-builder"
  },
  "jest": {
    "testEnvironment": "node",
    "testMatch": ["**/test/**/*.test.js"]
  },
  "dependencies": {
    "electron": "^32.0.0",
    "electron-store": "^10.0.0"
  },
  "devDependencies": {
    "electron-builder": "^25.0.0",
    "jest": "^29.0.0"
  }
}
```

- [ ] **Step 4: Write `electron-builder.yml`**

```yaml
appId: com.cardcounter.app
productName: Card Counter
directories:
  output: dist
win:
  target: nsis
  icon: src/assets/tray.png
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

- [ ] **Step 5: Create asset directories and generate tray icon**

```bash
mkdir src\assets src\renderer test
```

Then create `src/assets/make-icon.js`:

```js
// src/assets/make-icon.js
// Generates a minimal 16x16 PNG tray icon using raw PNG bytes.
// Run once: node src/assets/make-icon.js
const fs = require('fs');
const path = require('path');

// Minimal valid 16x16 orange circle PNG (base64-encoded)
// Generated offline — a 16x16 solid #f59e0b square with transparency
const BASE64_PNG = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAWklEQVQ4T2NkIAIwEqmHgWoGnDt37n9MTAyRJqSkpBClH6sBFy5cYGBkZGQkygAGBgaGy5cvM6AYQEtLIANevHjBgGIALS2BDHjx4gUDigG0tAQy4MWLFwDgFhERL9lwqQAAAABJRU5ErkJggg==';

fs.writeFileSync(
  path.join(__dirname, 'tray.png'),
  Buffer.from(BASE64_PNG, 'base64')
);
console.log('tray.png written');
```

Run it:

```bash
node src/assets/make-icon.js
```

Expected: `src/assets/tray.png` created (109 bytes).

- [ ] **Step 6: Commit**

```bash
git init
git add .
git commit -m "chore: project scaffold — Electron + deps + tray icon"
```

---

## Task 2: Counter Logic (TDD)

**Files:**
- Create: `src/counter.js`
- Create: `test/counter.test.js`

- [ ] **Step 1: Write the failing tests**

Create `test/counter.test.js`:

```js
const Counter = require('../src/counter');

describe('Counter — initialisation', () => {
  test('starts at zero with default 6 decks', () => {
    const c = new Counter();
    expect(c.runningCount).toBe(0);
    expect(c.cardsSeen).toBe(0);
    expect(c.totalDecks).toBe(6);
  });

  test('accepts custom deck count', () => {
    const c = new Counter(8);
    expect(c.totalDecks).toBe(8);
  });
});

describe('Counter — logCard', () => {
  test.each(['2','3','4','5','6'])('low card "%s" increments count by 1', (key) => {
    const c = new Counter();
    c.logCard(key);
    expect(c.runningCount).toBe(1);
    expect(c.cardsSeen).toBe(1);
  });

  test.each(['7','8','9'])('neutral card "%s" does not change count', (key) => {
    const c = new Counter();
    c.logCard(key);
    expect(c.runningCount).toBe(0);
    expect(c.cardsSeen).toBe(1);
  });

  test.each(['t','j','q','k','a','T','J','Q','K','A'])('high card "%s" decrements count by 1', (key) => {
    const c = new Counter();
    c.logCard(key);
    expect(c.runningCount).toBe(-1);
    expect(c.cardsSeen).toBe(1);
  });
});

describe('Counter — derived values', () => {
  test('decksRemaining decreases as cards are seen', () => {
    const c = new Counter(6);
    for (let i = 0; i < 52; i++) c.logCard('7'); // neutral — see 1 deck
    expect(c.decksRemaining).toBeCloseTo(5.0, 1);
  });

  test('trueCount = runningCount / decksRemaining', () => {
    const c = new Counter(6);
    // log 10 low cards and burn 1 deck of neutral cards
    for (let i = 0; i < 10; i++) c.logCard('2');
    for (let i = 0; i < 52; i++) c.logCard('7');
    // runningCount=10, cardsSeen=62, decksRemaining=(312-62)/52≈4.81
    expect(c.trueCount).toBeCloseTo(10 / ((312 - 62) / 52), 1);
  });

  test('decksRemaining never goes below 0.5', () => {
    const c = new Counter(1);
    for (let i = 0; i < 60; i++) c.logCard('7'); // more than 1 deck
    expect(c.decksRemaining).toBe(0.5);
  });
});

describe('Counter — betAdvice', () => {
  function forceTC(c, targetTC) {
    // Force a specific true count by loading low cards and burning neutral cards.
    // We burn most of the shoe first so decksRemaining is ~1.
    for (let i = 0; i < 260; i++) c.logCard('7'); // burn 5 decks neutral
    const needed = Math.round(targetTC * c.decksRemaining);
    for (let i = 0; i < Math.abs(needed); i++) {
      c.logCard(needed >= 0 ? '2' : 't');
    }
  }

  test('TC >= 2 returns level "high"', () => {
    const c = new Counter(6);
    forceTC(c, 2.5);
    expect(c.betAdvice.level).toBe('high');
    expect(c.betAdvice.label).toBe('Raise 2–3×');
  });

  test('TC 1–1.9 returns level "medium"', () => {
    const c = new Counter(6);
    forceTC(c, 1.3);
    expect(c.betAdvice.level).toBe('medium');
    expect(c.betAdvice.label).toBe('Raise slightly');
  });

  test('TC 0–0.9 returns level "neutral"', () => {
    const c = new Counter(6);
    expect(c.betAdvice.level).toBe('neutral');
    expect(c.betAdvice.label).toBe('Table minimum');
  });

  test('TC < 0 returns level "low"', () => {
    const c = new Counter(6);
    forceTC(c, -1.5);
    expect(c.betAdvice.level).toBe('low');
    expect(c.betAdvice.label).toBe('Sit out / minimum');
  });
});

describe('Counter — handAdvice', () => {
  test('returns null when TC is between -1 and +1', () => {
    const c = new Counter(6);
    expect(c.handAdvice).toBeNull();
  });

  test('returns insurance hint at TC >= 3', () => {
    const c = new Counter(6);
    for (let i = 0; i < 260; i++) c.logCard('7');
    for (let i = 0; i < Math.round(3 * c.decksRemaining) + 1; i++) c.logCard('2');
    expect(c.handAdvice).toMatch(/Insurance/);
  });
});

describe('Counter — reset / setDecks', () => {
  test('reset clears runningCount and cardsSeen', () => {
    const c = new Counter();
    c.logCard('2'); c.logCard('5'); c.logCard('k');
    c.reset();
    expect(c.runningCount).toBe(0);
    expect(c.cardsSeen).toBe(0);
  });

  test('setDecks changes totalDecks and resets state', () => {
    const c = new Counter(6);
    c.logCard('2');
    c.setDecks(8);
    expect(c.totalDecks).toBe(8);
    expect(c.runningCount).toBe(0);
    expect(c.cardsSeen).toBe(0);
  });

  test('getState returns a plain object snapshot', () => {
    const c = new Counter(6);
    c.logCard('2');
    const s = c.getState();
    expect(s).toMatchObject({
      runningCount: 1,
      cardsSeen: 1,
      totalDecks: 6,
    });
    expect(typeof s.decksRemaining).toBe('number');
    expect(typeof s.trueCount).toBe('number');
    expect(typeof s.betAdvice).toBe('object');
  });
});
```

- [ ] **Step 2: Run tests — confirm all fail**

```bash
npx jest test/counter.test.js --no-coverage
```

Expected: many failures with `Cannot find module '../src/counter'`.

- [ ] **Step 3: Write `src/counter.js`**

```js
// src/counter.js
'use strict';

const LOW  = new Set(['2','3','4','5','6']);
const HIGH = new Set(['t','j','q','k','a']);

class Counter {
  constructor(totalDecks = 6) {
    this.totalDecks   = totalDecks;
    this.runningCount = 0;
    this.cardsSeen    = 0;
  }

  logCard(key) {
    const k = key.toLowerCase();
    if (LOW.has(k))       this.runningCount += 1;
    else if (HIGH.has(k)) this.runningCount -= 1;
    // 7/8/9 = neutral, no change
    this.cardsSeen += 1;
  }

  get decksRemaining() {
    const remaining = (this.totalDecks * 52 - this.cardsSeen) / 52;
    return Math.max(0.5, remaining);
  }

  get trueCount() {
    return this.runningCount / this.decksRemaining;
  }

  get betAdvice() {
    const tc = this.trueCount;
    if (tc >= 2)  return { label: 'Raise 2–3×',      level: 'high'    };
    if (tc >= 1)  return { label: 'Raise slightly',   level: 'medium'  };
    if (tc >= 0)  return { label: 'Table minimum',    level: 'neutral' };
    return              { label: 'Sit out / minimum', level: 'low'     };
  }

  get handAdvice() {
    const tc = this.trueCount;
    if (tc >= 3)  return 'Insurance profitable (TC ≥ +3)';
    if (tc >= 2)  return 'Stand 16 vs 10';
    if (tc >= 1)  return 'Stand 12 vs 3';
    if (tc <= -1) return 'Hit 12 vs 4 (negative shoe)';
    return null;
  }

  reset() {
    this.runningCount = 0;
    this.cardsSeen    = 0;
  }

  setDecks(n) {
    this.totalDecks = n;
    this.reset();
  }

  getState() {
    return {
      runningCount:   this.runningCount,
      cardsSeen:      this.cardsSeen,
      totalDecks:     this.totalDecks,
      decksRemaining: Math.round(this.decksRemaining * 10) / 10,
      trueCount:      Math.round(this.trueCount      * 10) / 10,
      betAdvice:      this.betAdvice,
      handAdvice:     this.handAdvice,
    };
  }
}

module.exports = Counter;
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
npx jest test/counter.test.js --no-coverage
```

Expected: all green, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/counter.js test/counter.test.js
git commit -m "feat: Hi-Lo counter logic with full test coverage"
```

---

## Task 3: Settings Module

**Files:**
- Create: `src/settings.js`

- [ ] **Step 1: Write `src/settings.js`**

```js
// src/settings.js
'use strict';

const Store = require('electron-store');

const store = new Store({
  name: 'card-counter-settings',
  defaults: {
    totalDecks:  6,
    handAdvice:  true,
    autoExpand:  true,
    opacity:     100,
    position:    null,   // { x, y } — null means default bottom-right
  },
});

module.exports = {
  get:    (key)        => store.get(key),
  set:    (key, value) => store.set(key, value),
  getAll: ()           => store.store,   // returns a plain object copy
};
```

- [ ] **Step 2: Commit**

```bash
git add src/settings.js
git commit -m "feat: settings module with electron-store defaults"
```

---

## Task 4: Preload Script

**Files:**
- Create: `src/preload.js`

- [ ] **Step 1: Write `src/preload.js`**

```js
// src/preload.js
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Counter
  logCard:        (key) => ipcRenderer.invoke('counter:logCard', key),
  reset:          ()    => ipcRenderer.invoke('counter:reset'),
  getState:       ()    => ipcRenderer.invoke('counter:getState'),
  setDecks:       (n)   => ipcRenderer.invoke('counter:setDecks', n),

  // Settings
  getSettings:    ()           => ipcRenderer.invoke('settings:getAll'),
  setSetting:     (key, value) => ipcRenderer.invoke('settings:set', key, value),

  // Window
  toggleExpand:   ()    => ipcRenderer.invoke('window:toggleExpand'),

  // Subscriptions (main → renderer pushes)
  onStateUpdate:  (cb)  => ipcRenderer.on('counter:stateUpdate',  (_, s)  => cb(s)),
  onExpandChange: (cb)  => ipcRenderer.on('window:expandChange',  (_, ex) => cb(ex)),
  onReset:        (cb)  => ipcRenderer.on('counter:reset',        ()      => cb()),
});
```

- [ ] **Step 2: Commit**

```bash
git add src/preload.js
git commit -m "feat: preload contextBridge — counter + settings + window IPC"
```

---

## Task 5: Renderer — HTML and CSS

**Files:**
- Create: `src/renderer/index.html`
- Create: `src/renderer/style.css`

- [ ] **Step 1: Write `src/renderer/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'self'; style-src 'self' 'unsafe-inline'">
  <title>Card Counter</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app">

    <!-- ── Collapsed view ── -->
    <div id="collapsed-view">
      <div id="collapsed-count">0</div>
      <div id="collapsed-bar" class="bar neutral"></div>
    </div>

    <!-- ── Expanded view ── -->
    <div id="expanded-view" class="hidden">

      <div class="header">
        <span class="label-sm">Card Counter</span>
        <button id="settings-btn" class="icon-btn" title="Settings">⚙</button>
      </div>

      <div class="counts-row">
        <div class="count-block">
          <div class="label-sm">Running</div>
          <div id="running-count" class="count-lg">0</div>
        </div>
        <div class="count-block align-right">
          <div class="label-sm">True</div>
          <div id="true-count" class="count-md">0.0</div>
        </div>
      </div>

      <div id="bet-advice-block" class="advice-block neutral">
        <span class="advice-icon">💰</span>
        <div>
          <div class="label-xs">Bet</div>
          <div id="bet-advice-text" class="advice-text">Table minimum</div>
        </div>
      </div>

      <div id="hand-advice-block" class="advice-block hand">
        <span class="advice-icon">🃏</span>
        <div>
          <div class="label-xs">Deviation</div>
          <div id="hand-advice-text" class="advice-text">None at this count</div>
        </div>
      </div>

      <div class="deck-section">
        <div class="deck-row">
          <span class="label-xs">Decks remaining</span>
          <span id="decks-label" class="label-xs muted">5.5 / 6</span>
        </div>
        <div class="progress-track">
          <div id="progress-fill" class="progress-fill" style="width:92%"></div>
        </div>
      </div>

      <div class="footer">
        <span class="hint-text">2–6 +1 · 7–9 0 · 10-A −1</span>
        <button id="reset-btn" class="reset-btn" title="Reset shoe (R)">↺ Reset</button>
      </div>

    </div><!-- /expanded-view -->

    <!-- ── Settings panel (overlays expanded view) ── -->
    <div id="settings-panel" class="hidden">
      <div class="header">
        <span class="label-sm">Settings</span>
        <button id="settings-close" class="icon-btn">✕</button>
      </div>

      <div class="setting-row">
        <span class="label-sm">Decks</span>
        <div id="deck-buttons" class="deck-buttons">
          <button class="deck-btn" data-decks="1">1</button>
          <button class="deck-btn" data-decks="2">2</button>
          <button class="deck-btn" data-decks="4">4</button>
          <button class="deck-btn active" data-decks="6">6</button>
          <button class="deck-btn" data-decks="8">8</button>
        </div>
      </div>

      <div class="setting-row">
        <span class="label-sm">Hand hints</span>
        <label class="toggle">
          <input type="checkbox" id="hand-advice-toggle" checked>
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="setting-row">
        <span class="label-sm">Opacity</span>
        <input type="range" id="opacity-slider" min="40" max="100" value="100" class="slider">
      </div>

      <div class="setting-row shortcuts">
        <span class="label-xs muted">Toggle: Ctrl+Shift+Space · Reset: R · Close: Esc</span>
      </div>
    </div>

  </div><!-- /app -->
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `src/renderer/style.css`**

```css
/* ── Reset & base ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  width: 100%; height: 100%;
  overflow: hidden;
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  user-select: none;
}

#app {
  width: 100%; height: 100%;
  position: relative;
}

/* ── Utility ── */
.hidden { display: none !important; }
.label-sm  { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 1px; }
.label-xs  { font-size: 9px;  color: #555; text-transform: uppercase; letter-spacing: 1px; }
.muted     { color: #777; }
.align-right { text-align: right; }

/* ── Collapsed view ── */
#collapsed-view {
  width: 90px; height: 90px;
  background: #1e1e2e;
  border-radius: 16px;
  border: 1px solid #2a2a3e;
  box-shadow: 0 4px 24px rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  cursor: pointer;
  -webkit-app-region: drag;
}

#collapsed-count {
  font-size: 28px;
  font-weight: 800;
  color: #f59e0b;
  line-height: 1;
  -webkit-app-region: no-drag;
}

.bar {
  width: 48px; height: 5px;
  border-radius: 99px;
  transition: background 0.3s;
}
.bar.high    { background: #22c55e; }
.bar.medium  { background: #86efac; }
.bar.neutral { background: #94a3b8; }
.bar.low     { background: #ef4444; }

/* ── Expanded view ── */
#expanded-view {
  width: 220px;
  background: #1e1e2e;
  border-radius: 16px;
  border: 1px solid #2a2a3e;
  box-shadow: 0 4px 32px rgba(0,0,0,0.7);
  padding: 14px;
  -webkit-app-region: drag;
}

/* Disable drag on interactive elements */
button, input, .deck-buttons { -webkit-app-region: no-drag; }

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.icon-btn {
  background: none;
  border: none;
  color: #555;
  font-size: 14px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: color 0.2s;
}
.icon-btn:hover { color: #e2e8f0; }

/* Counts */
.counts-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 12px;
}
.count-block { display: flex; flex-direction: column; gap: 2px; }
.count-lg { font-size: 34px; font-weight: 800; color: #f59e0b; line-height: 1; }
.count-md { font-size: 22px; font-weight: 700; color: #e2e8f0; }

/* Advice blocks */
.advice-block {
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 9px;
  padding: 7px 10px;
  margin-bottom: 6px;
}
.advice-icon { font-size: 15px; }
.advice-text { font-size: 12px; font-weight: 700; margin-top: 1px; }

.advice-block.high    { background: #22c55e18; border: 1px solid #22c55e44; }
.advice-block.high    .advice-text { color: #22c55e; }
.advice-block.medium  { background: #86efac18; border: 1px solid #86efac44; }
.advice-block.medium  .advice-text { color: #86efac; }
.advice-block.neutral { background: #94a3b818; border: 1px solid #94a3b844; }
.advice-block.neutral .advice-text { color: #94a3b8; }
.advice-block.low     { background: #ef444418; border: 1px solid #ef444444; }
.advice-block.low     .advice-text { color: #ef4444; }
.advice-block.hand    { background: #3b82f618; border: 1px solid #3b82f644; }
.advice-block.hand    .advice-text { color: #93c5fd; }

/* Deck progress */
.deck-section { margin-bottom: 10px; }
.deck-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}
.progress-track {
  background: #2a2a3e;
  border-radius: 99px;
  height: 4px;
  overflow: hidden;
}
.progress-fill {
  background: #f59e0b;
  height: 100%;
  border-radius: 99px;
  transition: width 0.3s ease;
}

/* Footer */
.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.hint-text { font-size: 9px; color: #333; }
.reset-btn {
  background: #2a2a3e;
  border: 1px solid #3a3a4e;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 10px;
  color: #888;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
}
.reset-btn:hover { color: #e2e8f0; border-color: #555; }

/* ── Settings panel ── */
#settings-panel {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: #1e1e2e;
  border-radius: 16px;
  border: 1px solid #2a2a3e;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.setting-row.shortcuts { margin-top: auto; }

.deck-buttons { display: flex; gap: 4px; }
.deck-btn {
  background: #2a2a3e;
  border: 1px solid #3a3a4e;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  color: #888;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background 0.2s;
}
.deck-btn:hover  { color: #e2e8f0; border-color: #555; }
.deck-btn.active { background: #f59e0b22; border-color: #f59e0b; color: #f59e0b; }

/* Toggle switch */
.toggle { position: relative; display: inline-block; width: 34px; height: 18px; }
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute; inset: 0;
  background: #2a2a3e;
  border-radius: 99px;
  transition: background 0.2s;
  cursor: pointer;
}
.toggle-slider::before {
  content: '';
  position: absolute;
  width: 12px; height: 12px;
  left: 3px; top: 3px;
  background: #555;
  border-radius: 50%;
  transition: transform 0.2s, background 0.2s;
}
.toggle input:checked + .toggle-slider { background: #22c55e33; }
.toggle input:checked + .toggle-slider::before {
  transform: translateX(16px);
  background: #22c55e;
}

.slider {
  width: 80px;
  accent-color: #f59e0b;
}

/* ── Reset flash animation ── */
@keyframes flash-reset {
  0%   { border-color: #ef4444; }
  50%  { border-color: #ef444488; }
  100% { border-color: #2a2a3e; }
}
.flash-reset { animation: flash-reset 0.5s ease; }
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/index.html src/renderer/style.css
git commit -m "feat: renderer HTML and dark theme CSS"
```

---

## Task 6: Renderer — JavaScript

**Files:**
- Create: `src/renderer/app.js`

- [ ] **Step 1: Write `src/renderer/app.js`**

```js
// src/renderer/app.js
'use strict';

// ── DOM refs ──────────────────────────────────────────────────────────────
const collapsedView     = document.getElementById('collapsed-view');
const expandedView      = document.getElementById('expanded-view');
const settingsPanel     = document.getElementById('settings-panel');

const collapsedCount    = document.getElementById('collapsed-count');
const collapsedBar      = document.getElementById('collapsed-bar');

const runningCountEl    = document.getElementById('running-count');
const trueCountEl       = document.getElementById('true-count');
const betAdviceBlock    = document.getElementById('bet-advice-block');
const betAdviceText     = document.getElementById('bet-advice-text');
const handAdviceBlock   = document.getElementById('hand-advice-block');
const handAdviceText    = document.getElementById('hand-advice-text');
const decksLabel        = document.getElementById('decks-label');
const progressFill      = document.getElementById('progress-fill');

const settingsBtn       = document.getElementById('settings-btn');
const settingsClose     = document.getElementById('settings-close');
const resetBtn          = document.getElementById('reset-btn');
const deckButtons       = document.querySelectorAll('.deck-btn');
const handAdviceToggle  = document.getElementById('hand-advice-toggle');
const opacitySlider     = document.getElementById('opacity-slider');

// ── State ─────────────────────────────────────────────────────────────────
let expanded        = false;
let showHandAdvice  = true;
let currentDecks    = 6;

// ── Render ────────────────────────────────────────────────────────────────
function renderState(s) {
  // Collapsed
  collapsedCount.textContent = s.runningCount >= 0 ? `+${s.runningCount}` : `${s.runningCount}`;
  collapsedBar.className = `bar ${s.betAdvice.level}`;

  // Counts
  runningCountEl.textContent = s.runningCount >= 0 ? `+${s.runningCount}` : `${s.runningCount}`;
  trueCountEl.textContent    = s.trueCount    >= 0 ? `+${s.trueCount}`    : `${s.trueCount}`;

  // Bet advice
  betAdviceBlock.className = `advice-block ${s.betAdvice.level}`;
  betAdviceText.textContent = s.betAdvice.label;

  // Hand advice
  if (showHandAdvice && s.handAdvice) {
    handAdviceBlock.classList.remove('hidden');
    handAdviceText.textContent = s.handAdvice;
  } else {
    handAdviceBlock.classList.add('hidden');
  }

  // Deck progress
  const pct = Math.max(0, Math.min(100, (s.decksRemaining / s.totalDecks) * 100));
  progressFill.style.width = `${pct}%`;
  decksLabel.textContent   = `${s.decksRemaining} / ${s.totalDecks}`;
}

function setExpanded(ex) {
  expanded = ex;
  if (ex) {
    collapsedView.classList.add('hidden');
    expandedView.classList.remove('hidden');
  } else {
    collapsedView.classList.remove('hidden');
    expandedView.classList.add('hidden');
    settingsPanel.classList.add('hidden');
  }
}

function flashReset() {
  collapsedView.classList.add('flash-reset');
  setTimeout(() => collapsedView.classList.remove('flash-reset'), 500);
}

// ── Keyboard ──────────────────────────────────────────────────────────────
const CARD_KEYS = new Set(['2','3','4','5','6','7','8','9','t','j','q','k','a']);

document.addEventListener('keydown', async (e) => {
  const key = e.key.toLowerCase();

  if (CARD_KEYS.has(key)) {
    const state = await window.api.logCard(key);
    renderState(state);
    return;
  }

  if (key === 'r') {
    const state = await window.api.reset();
    renderState(state);
    flashReset();
    return;
  }

  if (key === 'escape') {
    await window.api.toggleExpand(); // main will send window:expandChange
  }
});

// ── IPC subscriptions ─────────────────────────────────────────────────────
window.api.onStateUpdate((s)  => renderState(s));
window.api.onExpandChange((ex) => setExpanded(ex));
window.api.onReset(()         => flashReset());

// ── Buttons ───────────────────────────────────────────────────────────────
collapsedView.addEventListener('click', () => window.api.toggleExpand());

settingsBtn.addEventListener('click', () => {
  settingsPanel.classList.remove('hidden');
  expandedView.classList.add('hidden');
});

settingsClose.addEventListener('click', () => {
  settingsPanel.classList.add('hidden');
  expandedView.classList.remove('hidden');
});

resetBtn.addEventListener('click', async () => {
  const state = await window.api.reset();
  renderState(state);
  flashReset();
});

deckButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    const n = parseInt(btn.dataset.decks, 10);
    deckButtons.forEach(b => b.classList.toggle('active', b === btn));
    await window.api.setSetting('totalDecks', n);
    const state = await window.api.setDecks(n);
    renderState(state);
    currentDecks = n;
  });
});

handAdviceToggle.addEventListener('change', async () => {
  showHandAdvice = handAdviceToggle.checked;
  await window.api.setSetting('handAdvice', showHandAdvice);
  const state = await window.api.getState();
  renderState(state);
});

opacitySlider.addEventListener('input', async () => {
  const val = parseInt(opacitySlider.value, 10);
  document.documentElement.style.opacity = val / 100;
  await window.api.setSetting('opacity', val);
});

// ── Initialise ────────────────────────────────────────────────────────────
(async () => {
  const [state, settings] = await Promise.all([
    window.api.getState(),
    window.api.getSettings(),
  ]);

  // Apply saved settings
  showHandAdvice = settings.handAdvice !== false;
  handAdviceToggle.checked = showHandAdvice;
  opacitySlider.value = settings.opacity || 100;
  document.documentElement.style.opacity = (settings.opacity || 100) / 100;
  currentDecks = settings.totalDecks || 6;

  // Highlight active deck button
  deckButtons.forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.decks, 10) === currentDecks);
  });

  renderState(state);
})();
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/app.js
git commit -m "feat: renderer app.js — state rendering, keyboard handler, settings UI"
```

---

## Task 7: Main Process

**Files:**
- Create: `src/main.js`

- [ ] **Step 1: Write `src/main.js`**

```js
// src/main.js
'use strict';

const {
  app, BrowserWindow, Tray, Menu,
  globalShortcut, ipcMain, screen, nativeImage,
} = require('electron');
const path    = require('path');
const Counter  = require('./counter');
const settings = require('./settings');

// ── State ─────────────────────────────────────────────────────────────────
const counter   = new Counter(settings.get('totalDecks'));
let win         = null;
let tray        = null;
let isExpanded  = false;

const COLLAPSED = { width: 90,  height: 90  };
const EXPANDED  = { width: 220, height: 300 };

// ── Helpers ───────────────────────────────────────────────────────────────
function getDefaultPosition(size) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return { x: width - size.width - 20, y: height - size.height - 20 };
}

function broadcastState() {
  if (win && !win.isDestroyed()) {
    win.webContents.send('counter:stateUpdate', counter.getState());
  }
}

function setExpanded(expanded) {
  isExpanded = expanded;
  const size = expanded ? EXPANDED : COLLAPSED;

  // Resize from the bottom-right corner by adjusting x/y accordingly
  const [cx, cy] = win.getPosition();
  const [cw, ch] = win.getSize();
  const nx = cx + cw  - size.width;
  const ny = cy + ch  - size.height;

  win.setBounds({ x: nx, y: ny, width: size.width, height: size.height }, true);
  win.webContents.send('window:expandChange', expanded);

  if (expanded) win.focus();
}

// ── Window ────────────────────────────────────────────────────────────────
function createWindow() {
  const savedPos = settings.get('position');
  const size     = COLLAPSED;
  const pos      = savedPos || getDefaultPosition(size);

  win = new BrowserWindow({
    width:       size.width,
    height:      size.height,
    x:           pos.x,
    y:           pos.y,
    frame:       false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable:   false,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.on('moved', () => {
    const [x, y] = win.getPosition();
    settings.set('position', { x, y });
  });
}

// ── Tray ──────────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  const icon     = nativeImage.createFromPath(iconPath);
  tray           = new Tray(icon);

  tray.setToolTip('Card Counter');

  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: 'Show / Hide',
      click: () => win.isVisible() ? win.hide() : win.show(),
    },
    {
      label: 'Reset Shoe',
      click: () => { counter.reset(); broadcastState(); win.webContents.send('counter:reset'); },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));

  tray.on('click', () => win.isVisible() ? win.hide() : win.show());
}

// ── Global shortcut ───────────────────────────────────────────────────────
function registerShortcuts() {
  // Ctrl+Shift+Space = toggle expand/collapse (only global shortcut)
  const registered = globalShortcut.register('Ctrl+Shift+Space', () => {
    if (!win.isVisible()) { win.show(); setExpanded(true); }
    else setExpanded(!isExpanded);
  });

  if (!registered) {
    console.error('Warning: Ctrl+Shift+Space shortcut could not be registered');
  }
}

// ── IPC handlers ──────────────────────────────────────────────────────────
ipcMain.handle('counter:logCard',  (_, key) => { counter.logCard(key); broadcastState(); return counter.getState(); });
ipcMain.handle('counter:reset',    ()       => { counter.reset();      broadcastState(); win.webContents.send('counter:reset'); return counter.getState(); });
ipcMain.handle('counter:getState', ()       => counter.getState());
ipcMain.handle('counter:setDecks', (_, n)   => { counter.setDecks(n);  broadcastState(); return counter.getState(); });

ipcMain.handle('settings:getAll',  ()            => settings.getAll());
ipcMain.handle('settings:set',     (_, key, val) => { settings.set(key, val); return true; });

ipcMain.handle('window:toggleExpand', () => {
  setExpanded(!isExpanded);
  return isExpanded;
});

// ── App lifecycle ─────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();
  registerShortcuts();
});

app.on('will-quit',         () => globalShortcut.unregisterAll());
app.on('window-all-closed', (e) => e.preventDefault()); // keep alive in tray
```

- [ ] **Step 2: Commit**

```bash
git add src/main.js
git commit -m "feat: main process — BrowserWindow, Tray, IPC, Ctrl+Shift+Space global shortcut"
```

---

## Task 8: Smoke Test

**Files:** none new — this is a manual run step.

- [ ] **Step 1: Run the app**

```bash
npm start
```

Expected: a small dark widget appears in the **bottom-right corner** of your screen. No errors in the terminal.

- [ ] **Step 2: Verify collapsed state**

The widget should show `+0` and a grey bar. It should be on top of all other windows.

- [ ] **Step 3: Verify expand / collapse**

Press `Ctrl+Shift+Space`. The widget should animate to full size showing all sections. Press `Ctrl+Shift+Space` again — it collapses.

- [ ] **Step 4: Verify card logging**

Click the widget to expand it, then focus it (click on it). Type `2` — running count should jump to `+1`. Type `a` — count back to `0`. Type `t` five times — count shows `−5`, bar turns red, bet advice says "Sit out / minimum".

- [ ] **Step 5: Verify reset**

Press `R` while the widget is focused. Count returns to `0`, widget flashes briefly.

- [ ] **Step 6: Verify settings**

Click the ⚙ button. Change decks from 6 to 8 — deck progress bar updates. Drag the opacity slider — widget fades. Close settings.

- [ ] **Step 7: Verify tray**

Find the Card Counter icon in the system tray. Right-click it — confirm "Show/Hide", "Reset Shoe", and "Quit" all work.

- [ ] **Step 8: Final commit**

```bash
git add .
git commit -m "chore: verify smoke test passes — app fully functional"
```

---

## Task 9: Build Windows Installer (Optional)

- [ ] **Step 1: Build**

```bash
npm run build
```

Expected: `dist/Card Counter Setup 1.0.0.exe` created.

- [ ] **Step 2: Install and verify**

Run the installer. Launch "Card Counter" from the Start Menu. Confirm the overlay appears and all features work as in the smoke test.

- [ ] **Step 3: Commit build config if adjusted**

```bash
git add electron-builder.yml
git commit -m "chore: finalize electron-builder config for Windows NSIS installer"
```
