# Card Input Pad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the keyboard-only hand mode with an always-visible on-screen card pad; every card seen at the table is entered through it, with Hold-H/Hold-D modifier keys routing specific cards to the strategy advisor.

**Architecture:** Extend `Counter` with `playerCards`/`dealerCard` state and `newHand`/`deleteCard` methods; wire two new IPC handlers; replace the hand-mode DOM section with a card pad + hand display section; rewrite the renderer's keyboard/click logic to use held-key modifiers instead of a modal hand-entry mode.

**Tech Stack:** Electron, vanilla JS (no framework), Jest (tests), CSS custom properties already in use.

---

## File Map

| File | Change |
|------|--------|
| `src/counter.js` | Add `playerCards`, `dealerCard` state; extend `logCard(key, target)`; add `newHand()`, `deleteCard()`; update `reset()` and `getState()` |
| `test/counter.test.js` | Add tests for all new Counter behaviour |
| `src/main.js` | Update `counter:logCard` handler; add `counter:newHand`, `counter:deleteCard` handlers; update `EXPANDED` height |
| `src/preload.js` | Expose `newHand`, `deleteCard`; update `logCard` signature |
| `src/renderer/index.html` | Remove `hand-mode-row`; add card-input section (hand displays + card pad + hint); replace footer with two-button reset row |
| `src/renderer/style.css` | Add card pad, hand display, modifier-active, and reset-row styles; remove hand-mode-row styles |
| `src/renderer/app.js` | Remove hand mode code; add held-key tracking; add card pad + keyboard handlers; add `renderHandDisplay()` and `computeHandInfo()` |

---

## Task 1: Extend Counter with hand state

**Files:**
- Modify: `src/counter.js`
- Modify: `test/counter.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `test/counter.test.js`:

```js
describe('Counter — hand state', () => {
  test('starts with empty playerCards and null dealerCard', () => {
    const c = new Counter();
    expect(c.playerCards).toEqual([]);
    expect(c.dealerCard).toBeNull();
  });

  test('logCard with target "player" adds card to playerCards', () => {
    const c = new Counter();
    c.logCard('9', 'player');
    expect(c.playerCards).toEqual(['9']);
    expect(c.cardsSeen).toBe(1);
  });

  test('logCard with target "dealer" sets dealerCard', () => {
    const c = new Counter();
    c.logCard('6', 'dealer');
    expect(c.dealerCard).toBe('6');
    expect(c.cardsSeen).toBe(1);
  });

  test('logCard with no target only counts, does not touch hand state', () => {
    const c = new Counter();
    c.logCard('2');
    expect(c.playerCards).toEqual([]);
    expect(c.dealerCard).toBeNull();
    expect(c.runningCount).toBe(1);
  });

  test('logCard normalises j/q/k to "t" when adding to player hand', () => {
    const c = new Counter();
    c.logCard('k', 'player');
    expect(c.playerCards).toEqual(['t']);
  });

  test('logCard normalises j/q/k to "t" when setting dealer card', () => {
    const c = new Counter();
    c.logCard('q', 'dealer');
    expect(c.dealerCard).toBe('t');
  });

  test('logCard setting a second dealer card replaces the first', () => {
    const c = new Counter();
    c.logCard('6', 'dealer');
    c.logCard('a', 'dealer');
    expect(c.dealerCard).toBe('a');
  });
});

describe('Counter — newHand', () => {
  test('clears playerCards and dealerCard but keeps count', () => {
    const c = new Counter();
    c.logCard('2', 'player');
    c.logCard('9', 'player');
    c.logCard('6', 'dealer');
    c.newHand();
    expect(c.playerCards).toEqual([]);
    expect(c.dealerCard).toBeNull();
    expect(c.runningCount).toBe(1); // the 2 was still counted
    expect(c.cardsSeen).toBe(3);
  });
});

describe('Counter — deleteCard', () => {
  test('removes last card from playerCards when hand is non-empty', () => {
    const c = new Counter();
    c.logCard('9', 'player');
    c.logCard('7', 'player');
    c.deleteCard();
    expect(c.playerCards).toEqual(['9']);
  });

  test('clears dealerCard when playerCards is empty', () => {
    const c = new Counter();
    c.logCard('6', 'dealer');
    c.deleteCard();
    expect(c.dealerCard).toBeNull();
  });

  test('does nothing when both hand and dealer are empty', () => {
    const c = new Counter();
    expect(() => c.deleteCard()).not.toThrow();
    expect(c.playerCards).toEqual([]);
    expect(c.dealerCard).toBeNull();
  });
});

describe('Counter — reset clears hand state', () => {
  test('reset clears playerCards and dealerCard', () => {
    const c = new Counter();
    c.logCard('9', 'player');
    c.logCard('6', 'dealer');
    c.reset();
    expect(c.playerCards).toEqual([]);
    expect(c.dealerCard).toBeNull();
  });
});

describe('Counter — getState includes hand state', () => {
  test('getState returns playerCards and dealerCard', () => {
    const c = new Counter();
    c.logCard('9', 'player');
    c.logCard('6', 'dealer');
    const s = c.getState();
    expect(s.playerCards).toEqual(['9']);
    expect(s.dealerCard).toBe('6');
  });

  test('getState returns a copy of playerCards (not the internal array)', () => {
    const c = new Counter();
    c.logCard('9', 'player');
    const s = c.getState();
    s.playerCards.push('MUTATED');
    expect(c.playerCards).toEqual(['9']);
  });
});
```

- [ ] **Step 2: Run tests — confirm they all fail**

```
npx jest test/counter.test.js --no-coverage
```

Expected: multiple failures about `playerCards`, `dealerCard`, `newHand`, `deleteCard` not existing.

- [ ] **Step 3: Implement the changes in `src/counter.js`**

Replace the entire file with:

```js
// src/counter.js
'use strict';

const LOW  = new Set(['2','3','4','5','6']);
const HIGH = new Set(['t','j','q','k','a']);

// Normalise face cards to 't' for hand tracking
function normaliseCard(k) {
  return (k === 'j' || k === 'q' || k === 'k') ? 't' : k;
}

class Counter {
  constructor(totalDecks = 6) {
    this.totalDecks   = totalDecks;
    this.runningCount = 0;
    this.cardsSeen    = 0;
    this.playerCards  = [];   // individual card keys, e.g. ['9','7']
    this.dealerCard   = null; // single upcard key, e.g. '6'
  }

  // target: 'player' | 'dealer' | undefined (count only)
  logCard(key, target) {
    const k = key.toLowerCase();
    if (LOW.has(k))       this.runningCount += 1;
    else if (HIGH.has(k)) this.runningCount -= 1;
    this.cardsSeen += 1;

    if (target === 'player') {
      this.playerCards.push(normaliseCard(k));
    } else if (target === 'dealer') {
      this.dealerCard = normaliseCard(k);
    }
  }

  newHand() {
    this.playerCards = [];
    this.dealerCard  = null;
  }

  deleteCard() {
    if (this.playerCards.length > 0) {
      this.playerCards.pop();
    } else if (this.dealerCard !== null) {
      this.dealerCard = null;
    }
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
    this.playerCards  = [];
    this.dealerCard   = null;
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
      playerCards:    [...this.playerCards],
      dealerCard:     this.dealerCard,
    };
  }
}

module.exports = Counter;
```

- [ ] **Step 4: Run all counter tests — confirm they all pass**

```
npx jest test/counter.test.js --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 5: Run the full test suite — confirm nothing regressed**

```
npx jest --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```
git add src/counter.js test/counter.test.js
git commit -m "feat: add hand state (playerCards, dealerCard) to Counter"
```

---

## Task 2: Wire new IPC handlers

**Files:**
- Modify: `src/main.js` — update logCard handler; add newHand + deleteCard handlers; update EXPANDED height
- Modify: `src/preload.js` — expose newHand, deleteCard; update logCard signature

- [ ] **Step 1: Update `src/main.js`**

Make three changes:

**2a. Update EXPANDED height** (line 24):
```js
const EXPANDED  = { width: 220, height: 460 };
```

**2b. Update the `counter:logCard` handler** (line 129 — pass target through):
```js
ipcMain.handle('counter:logCard', (_, key, target) => {
  counter.logCard(key, target);
  broadcastState();
  return counter.getState();
});
```

**2c. Add two new handlers** directly after the `counter:setDecks` handler:
```js
ipcMain.handle('counter:newHand', () => {
  counter.newHand();
  broadcastState();
  return counter.getState();
});

ipcMain.handle('counter:deleteCard', () => {
  counter.deleteCard();
  broadcastState();
  return counter.getState();
});
```

- [ ] **Step 2: Update `src/preload.js`**

Replace the entire file with:

```js
// src/preload.js
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Counter
  logCard:      (key, target) => ipcRenderer.invoke('counter:logCard', key, target),
  reset:        ()            => ipcRenderer.invoke('counter:reset'),
  getState:     ()            => ipcRenderer.invoke('counter:getState'),
  setDecks:     (n)           => ipcRenderer.invoke('counter:setDecks', n),
  newHand:      ()            => ipcRenderer.invoke('counter:newHand'),
  deleteCard:   ()            => ipcRenderer.invoke('counter:deleteCard'),

  // Settings
  getSettings:  ()           => ipcRenderer.invoke('settings:getAll'),
  setSetting:   (key, value) => ipcRenderer.invoke('settings:set', key, value),

  // Window
  toggleExpand: () => ipcRenderer.invoke('window:toggleExpand'),

  // Subscriptions (main → renderer pushes)
  onStateUpdate:  (cb) => ipcRenderer.on('counter:stateUpdate', (_, s)  => cb(s)),
  onExpandChange: (cb) => ipcRenderer.on('window:expandChange', (_, ex) => cb(ex)),
  onReset:        (cb) => ipcRenderer.on('counter:reset',       ()      => cb()),

  // Capture
  openCaptureSelector: () => ipcRenderer.invoke('capture:openSelector'),
  startCapture:        () => ipcRenderer.invoke('capture:start'),
  stopCapture:         () => ipcRenderer.invoke('capture:stop'),
  onCaptureStatus:     (cb) => ipcRenderer.on('capture:status', (_, s) => cb(s)),

  // Strategy
  getAdvice: (hand) => {
    const { getAdvice } = require('./strategy');
    return getAdvice(hand);
  },
});
```

- [ ] **Step 3: Commit**

```
git add src/main.js src/preload.js
git commit -m "feat: wire counter:newHand and counter:deleteCard IPC handlers"
```

---

## Task 3: Update HTML structure

**Files:**
- Modify: `src/renderer/index.html`

- [ ] **Step 1: Replace the entire `src/renderer/index.html`**

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

      <!-- ── Capture row ── -->
      <div id="capture-row" class="capture-row">
        <button id="capture-btn" class="capture-btn" title="Auto-detect cards from screen">📷 Auto</button>
        <span id="capture-status" class="capture-status hidden">
          <span class="rec-dot"></span>Watching
        </span>
        <button id="capture-stop" class="capture-stop hidden" title="Stop auto-detection">■ Stop</button>
      </div>

      <!-- ── Strategy advice ── -->
      <div id="strategy-block" class="advice-block strategy hidden">
        <span class="advice-icon">🎯</span>
        <div>
          <div class="label-xs">Action</div>
          <div id="strategy-text" class="advice-text">—</div>
        </div>
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

      <!-- ── Card input section ── -->
      <div class="card-input-section">

        <!-- Your hand -->
        <div class="hand-section">
          <div class="section-label">
            Your hand
            <span class="modifier-hint">· hold <kbd class="key-h">H</kbd></span>
          </div>
          <div id="player-hand-row" class="hand-display-row">
            <span class="empty-hand">—</span>
          </div>
        </div>

        <!-- Dealer card -->
        <div class="hand-section">
          <div class="section-label">
            Dealer
            <span class="modifier-hint">· hold <kbd class="key-d">D</kbd></span>
          </div>
          <div id="dealer-hand-row" class="hand-display-row">
            <span class="empty-hand">—</span>
          </div>
        </div>

        <!-- Card pad -->
        <div id="card-pad" class="card-pad">
          <button class="card-pad-btn" data-card="2">2</button>
          <button class="card-pad-btn" data-card="3">3</button>
          <button class="card-pad-btn" data-card="4">4</button>
          <button class="card-pad-btn" data-card="5">5</button>
          <button class="card-pad-btn" data-card="6">6</button>
          <button class="card-pad-btn" data-card="7">7</button>
          <button class="card-pad-btn" data-card="8">8</button>
          <button class="card-pad-btn" data-card="9">9</button>
          <button class="card-pad-btn" data-card="t">T</button>
          <button class="card-pad-btn" data-card="a">A</button>
          <button id="delete-btn" class="card-pad-btn card-pad-delete">⌫</button>
        </div>

        <!-- Pad hint -->
        <div class="pad-hint">
          tap = any &nbsp;·&nbsp;
          <kbd class="key-h">H</kbd> = yours &nbsp;·&nbsp;
          <kbd class="key-d">D</kbd> = dealer
        </div>

      </div><!-- /card-input-section -->

      <!-- ── Reset buttons ── -->
      <div class="reset-row">
        <button id="new-hand-btn" class="new-hand-btn">↺ New Hand</button>
        <button id="reshuffle-btn" class="reshuffle-btn">🔀 Reshuffle</button>
      </div>

      <!-- ── Deck progress ── -->
      <div class="deck-section">
        <div class="deck-row">
          <span class="label-xs">Decks remaining</span>
          <span id="decks-label" class="label-xs muted">5.5 / 6</span>
        </div>
        <div class="progress-track">
          <div id="progress-fill" class="progress-fill" style="width:92%"></div>
        </div>
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
        <span class="label-xs muted">Toggle: Ctrl+Shift+Space · New hand: N · Reshuffle: R</span>
      </div>
    </div>

  </div><!-- /app -->
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```
git add src/renderer/index.html
git commit -m "feat: add card input pad and hand display to HTML, remove hand-mode-row"
```

---

## Task 4: Add CSS

**Files:**
- Modify: `src/renderer/style.css`

- [ ] **Step 1: Remove the hand-mode-row block and add new styles**

In `src/renderer/style.css`, delete the entire hand-mode-row section (the comment `/* ── Hand mode row ── */` through the `.hand-mode-hint` rule, approximately the last ~30 lines), then append the following in its place:

```css
/* ── Card input section ── */
.card-input-section {
  margin-bottom: 8px;
}

.hand-section {
  margin-bottom: 6px;
}

.section-label {
  font-size: 9px;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.modifier-hint {
  color: #333;
  display: flex;
  align-items: center;
  gap: 3px;
}

.key-h, .key-d {
  display: inline-block;
  border-radius: 3px;
  padding: 0 4px;
  font-size: 9px;
  font-weight: 700;
  font-family: 'Courier New', monospace;
  font-style: normal;
}

.key-h {
  background: #3b82f611;
  border: 1px solid #3b82f655;
  color: #93c5fd;
}

.key-d {
  background: #f59e0b11;
  border: 1px solid #f59e0b55;
  color: #f59e0b;
}

.hand-display-row {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 5px 7px;
  background: #2a2a3e;
  border-radius: 7px;
  border: 1px solid #3a3a4e;
  min-height: 28px;
  transition: border-color 0.2s;
}

.hand-display-row.player-active { border-color: #3b82f633; }
.hand-display-row.dealer-active { border-color: #f59e0b33; }

.mini-card {
  background: #1e1e2e;
  border: 1px solid #3a3a4e;
  border-radius: 4px;
  padding: 2px 5px;
  font-size: 11px;
  font-weight: 700;
}

.mini-card.player { border-color: #3b82f666; color: #93c5fd; }
.mini-card.dealer  { border-color: #f59e0b66; color: #f59e0b; }

.hand-total {
  margin-left: auto;
  font-size: 10px;
  font-weight: 700;
  color: #3b82f6;
}

.empty-hand {
  font-size: 9px;
  color: #333;
}

/* ── Card pad ── */
.card-pad {
  display: flex;
  gap: 3px;
  margin-bottom: 4px;
}

.card-pad-btn {
  background: #2a2a3e;
  border: 1px solid #3a3a4e;
  border-radius: 6px;
  padding: 5px 0;
  flex: 1;
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  color: #888;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  -webkit-app-region: no-drag;
}

.card-pad-btn:hover { color: #e2e8f0; border-color: #555; }

.card-pad-delete {
  flex: 0 0 26px;
  color: #ef4444;
  border-color: #ef444433;
  background: #ef444411;
}

.card-pad-delete:hover { border-color: #ef4444; }

/* Modifier active states — card pad highlights when H or D is held */
.card-pad.modifier-player .card-pad-btn:not(.card-pad-delete) {
  background: #3b82f622;
  border-color: #3b82f655;
  color: #93c5fd;
}

.card-pad.modifier-dealer .card-pad-btn:not(.card-pad-delete) {
  background: #f59e0b22;
  border-color: #f59e0b55;
  color: #f59e0b;
}

/* Pad hint */
.pad-hint {
  font-size: 9px;
  color: #333;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 2px;
}

/* ── Reset row ── */
.reset-row {
  display: flex;
  gap: 5px;
  margin-bottom: 10px;
}

.new-hand-btn {
  flex: 1;
  background: #2a2a3e;
  border: 1px solid #3b82f633;
  border-radius: 6px;
  padding: 4px 0;
  font-size: 10px;
  font-weight: 600;
  color: #3b82f6;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
  -webkit-app-region: no-drag;
}

.new-hand-btn:hover { border-color: #3b82f6; color: #93c5fd; }

.reshuffle-btn {
  flex: 1;
  background: #2a2a3e;
  border: 1px solid #3a3a4e;
  border-radius: 6px;
  padding: 4px 0;
  font-size: 10px;
  color: #555;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
  -webkit-app-region: no-drag;
}

.reshuffle-btn:hover { color: #e2e8f0; border-color: #555; }
```

- [ ] **Step 2: Commit**

```
git add src/renderer/style.css
git commit -m "feat: add card pad, hand display, and reset row CSS"
```

---

## Task 5: Rewrite renderer logic in app.js

**Files:**
- Modify: `src/renderer/app.js`

- [ ] **Step 1: Replace the entire `src/renderer/app.js`**

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
const deckButtons       = document.querySelectorAll('.deck-btn');
const handAdviceToggle  = document.getElementById('hand-advice-toggle');
const opacitySlider     = document.getElementById('opacity-slider');
const captureBtn        = document.getElementById('capture-btn');
const captureStatus     = document.getElementById('capture-status');
const captureStop       = document.getElementById('capture-stop');

const strategyBlock     = document.getElementById('strategy-block');
const strategyText      = document.getElementById('strategy-text');
const playerHandRow     = document.getElementById('player-hand-row');
const dealerHandRow     = document.getElementById('dealer-hand-row');
const cardPadEl         = document.getElementById('card-pad');
const deleteBtn         = document.getElementById('delete-btn');
const newHandBtn        = document.getElementById('new-hand-btn');
const reshuffleBtn      = document.getElementById('reshuffle-btn');

// ── State ─────────────────────────────────────────────────────────────────
let expanded       = false;
let showHandAdvice = true;
let currentDecks   = 6;

// Keys currently held — used to determine card routing
const heldKeys = new Set();

// ── Card key set (keyboard) ───────────────────────────────────────────────
const CARD_KEYS = new Set(['2','3','4','5','6','7','8','9','t','j','q','k','a']);

// ── Hand computation ──────────────────────────────────────────────────────
// Returns { total, soft, pair } or null if cards array is empty.
function computeHandInfo(cards) {
  if (cards.length === 0) return null;
  // All face cards already normalised to 't' by Counter, but guard anyway
  const norm = cards.map(c => (c === 'j' || c === 'q' || c === 'k') ? 't' : c);

  // Pair: exactly two identical cards
  const pair = norm.length === 2 && norm[0] === norm[1] ? norm[0] : false;

  // Total: aces count as 11, reduced to 1 if bust
  let total = 0;
  let aces  = 0;
  for (const c of norm) {
    if      (c === 'a') { total += 11; aces++; }
    else if (c === 't') { total += 10; }
    else                { total += parseInt(c, 10); }
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }

  // Soft: an ace is still counting as 11
  const soft = aces > 0;

  return { total, soft, pair };
}

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

  // Count-based deviation hints
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

  // Hand displays + strategy advice
  renderHandDisplay(s);
}

function renderHandDisplay(s) {
  const { playerCards, dealerCard } = s;

  // ── Player hand ──
  if (!playerCards || playerCards.length === 0) {
    playerHandRow.innerHTML = '<span class="empty-hand">—</span>';
    playerHandRow.classList.remove('player-active');
  } else {
    const info = computeHandInfo(playerCards);
    const cardEls = playerCards
      .map(c => `<span class="mini-card player">${c.toUpperCase()}</span>`)
      .join('');
    const totalEl = info ? `<span class="hand-total">${info.total}</span>` : '';
    playerHandRow.innerHTML = cardEls + totalEl;
    playerHandRow.classList.add('player-active');
  }

  // ── Dealer card ──
  if (!dealerCard) {
    dealerHandRow.innerHTML = '<span class="empty-hand">—</span>';
    dealerHandRow.classList.remove('dealer-active');
  } else {
    dealerHandRow.innerHTML = `<span class="mini-card dealer">${dealerCard.toUpperCase()}</span>`;
    dealerHandRow.classList.add('dealer-active');
  }

  // ── Strategy advice (only when both hand and dealer are set) ──
  const info = playerCards && playerCards.length > 0 ? computeHandInfo(playerCards) : null;

  if (info && dealerCard && info.total >= 4 && info.total <= 21) {
    const advice = window.api.getAdvice({
      total:  info.total,
      soft:   info.soft,
      pair:   info.pair,
      dealer: dealerCard,
    });
    if (advice) {
      strategyBlock.style.background = advice.color + '18';
      strategyBlock.style.border     = `1px solid ${advice.color}44`;
      strategyText.style.color       = advice.color;
      strategyText.textContent       = advice.label;
      strategyBlock.classList.remove('hidden');
    } else {
      strategyBlock.classList.add('hidden');
    }
  } else {
    strategyBlock.classList.add('hidden');
  }
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

// ── Modifier key tracking ─────────────────────────────────────────────────
function updatePadModifier() {
  cardPadEl.classList.remove('modifier-player', 'modifier-dealer');
  if (heldKeys.has('h')) {
    cardPadEl.classList.add('modifier-player');
  } else if (heldKeys.has('d')) {
    cardPadEl.classList.add('modifier-dealer');
  }
}

// If the window loses focus while H/D is held, clear held state
window.addEventListener('blur', () => {
  heldKeys.clear();
  updatePadModifier();
});

// ── Keyboard ──────────────────────────────────────────────────────────────
document.addEventListener('keydown', async (e) => {
  const key = e.key.toLowerCase();

  // Track H and D as modifier keys — don't treat as card keys
  if (key === 'h' || key === 'd') {
    heldKeys.add(key);
    updatePadModifier();
    return;
  }

  // Card keys — route based on held modifier
  if (CARD_KEYS.has(key)) {
    const target = heldKeys.has('h') ? 'player'
                 : heldKeys.has('d') ? 'dealer'
                 : undefined;
    const state = await window.api.logCard(key, target);
    renderState(state);
    return;
  }

  // N = new hand (clear hand/dealer, keep count)
  if (key === 'n') {
    const state = await window.api.newHand();
    renderState(state);
    return;
  }

  // Backspace = delete last player card (or dealer card)
  if (key === 'backspace') {
    const state = await window.api.deleteCard();
    renderState(state);
    return;
  }

  // R = reshuffle (full hard reset)
  if (key === 'r') {
    const state = await window.api.reset();
    renderState(state);
    flashReset();
    return;
  }

  if (key === 'escape') {
    await window.api.toggleExpand();
  }
});

document.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'h' || key === 'd') {
    heldKeys.delete(key);
    updatePadModifier();
  }
});

// ── Card pad clicks ───────────────────────────────────────────────────────
cardPadEl.querySelectorAll('.card-pad-btn[data-card]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const card   = btn.dataset.card;
    const target = heldKeys.has('h') ? 'player'
                 : heldKeys.has('d') ? 'dealer'
                 : undefined;
    const state  = await window.api.logCard(card, target);
    renderState(state);
  });
});

deleteBtn.addEventListener('click', async () => {
  const state = await window.api.deleteCard();
  renderState(state);
});

newHandBtn.addEventListener('click', async () => {
  const state = await window.api.newHand();
  renderState(state);
});

reshuffleBtn.addEventListener('click', async () => {
  const state = await window.api.reset();
  renderState(state);
  flashReset();
});

// ── IPC subscriptions ─────────────────────────────────────────────────────
window.api.onStateUpdate((s)   => renderState(s));
window.api.onExpandChange((ex) => setExpanded(ex));
window.api.onReset(()          => flashReset());
window.api.onCaptureStatus((s) => setCaptureActive(s.active));

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
  await window.api.setSetting('showHandAdvice', showHandAdvice);
  const state = await window.api.getState();
  renderState(state);
});

opacitySlider.addEventListener('input', async () => {
  const val = parseInt(opacitySlider.value, 10);
  document.documentElement.style.opacity = val / 100;
  await window.api.setSetting('opacity', val);
});

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

// ── Initialise ────────────────────────────────────────────────────────────
(async () => {
  const [state, settings] = await Promise.all([
    window.api.getState(),
    window.api.getSettings(),
  ]);

  showHandAdvice = settings.showHandAdvice !== false;
  handAdviceToggle.checked = showHandAdvice;
  opacitySlider.value = settings.opacity || 100;
  document.documentElement.style.opacity = (settings.opacity || 100) / 100;
  currentDecks = settings.totalDecks || 6;

  deckButtons.forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.decks, 10) === currentDecks);
  });

  renderState(state);
})();
```

- [ ] **Step 2: Run the full test suite — confirm nothing is broken**

```
npx jest --no-coverage
```

Expected: all tests PASS. (app.js has no unit tests — verified visually in next step.)

- [ ] **Step 3: Launch the app and verify manually**

```
npm start
```

Check each of the following:

| Action | Expected result |
|--------|----------------|
| Click the widget to expand | Card pad with 2–9, T, A, ⌫ is visible |
| Tap card buttons (no key held) | Running count updates; hand display stays `—` |
| Hold H on keyboard, tap a card button | Card appears in "Your hand" row (blue); count updates |
| Hold H, tap a second card | Second card appended; total shows on right |
| Hold D on keyboard, tap a card button | Card appears in "Dealer" row (orange); strategy advice appears |
| Release H/D | Card pad returns to grey |
| Click ⌫ | Last player card removed; if hand empty, dealer card clears |
| Click ↺ New Hand | Hand + dealer clear; count unchanged |
| Click 🔀 Reshuffle | Everything resets; widget flashes red |
| Press N key | Same as ↺ New Hand |
| Press R key | Same as 🔀 Reshuffle |
| Press Backspace key | Same as ⌫ |
| Alt-tab away while holding H | On return, card pad is grey (blur cleared held keys) |

- [ ] **Step 4: Commit**

```
git add src/renderer/app.js
git commit -m "feat: card input pad — hold H/D modifier, click-to-count, new-hand and reshuffle buttons"
```

---

## Done

All five tasks complete. The feature is fully implemented:

- On-screen card pad always visible in expanded view
- Hold **H** + tap/click → adds card to your hand (strategy + counting)
- Hold **D** + tap/click → sets dealer upcard (strategy + counting)
- Tap/click with no modifier → counts card only (other players)
- **⌫** removes last player card, then dealer card
- **↺ New Hand** clears hand state, preserves count
- **🔀 Reshuffle** hard resets everything
- Keyboard shortcuts: `N` (new hand), `R` (reshuffle), `Backspace` (delete)
