# Basic Strategy Advisor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a keyboard-driven basic strategy advisor — press `H` to enter hand mode, type your total and the dealer's upcard, and the widget instantly shows Hit/Stand/Double/Split/Surrender.

**Architecture:** A pure `src/strategy.js` lookup table is exposed synchronously via the existing preload contextBridge. The renderer manages a lightweight hand-input state machine in `app.js` that intercepts `H`/digit/card keys and renders advice into two new HTML elements.

**Tech Stack:** Vanilla JS (no new dependencies), existing Electron contextBridge, Jest for unit tests

---

## File Map

| File | Change | Responsibility |
|------|--------|----------------|
| `src/strategy.js` | Create | Pure lookup tables — getAdvice({ total, soft, pair, dealer }) |
| `test/strategy.test.js` | Create | Unit tests for all table entries and edge cases |
| `src/preload.js` | Modify | Expose `getAdvice` synchronously via contextBridge |
| `src/renderer/index.html` | Modify | Add `#hand-mode-row` and `#strategy-block` elements |
| `src/renderer/style.css` | Modify | Add hand mode and strategy block styles |
| `src/renderer/app.js` | Modify | Add hand mode state machine and keydown handling |

No changes to `main.js`, `counter.js`, `settings.js`, or IPC handlers in main.

---

## Task 1: strategy.js (TDD)

**Files:**
- Create: `test/strategy.test.js`
- Create: `src/strategy.js`

- [ ] **Step 1: Write the failing tests**

Create `test/strategy.test.js`:

```js
// test/strategy.test.js
const { getAdvice } = require('../src/strategy');

describe('getAdvice — hard totals', () => {
  test('hard 8 vs any dealer → HIT', () => {
    expect(getAdvice({ total: 8, soft: false, pair: false, dealer: '7' }).label).toBe('HIT');
  });
  test('hard 9 vs dealer 3 → DOUBLE', () => {
    expect(getAdvice({ total: 9, soft: false, pair: false, dealer: '3' }).action).toBe('D');
  });
  test('hard 9 vs dealer 2 → HIT', () => {
    expect(getAdvice({ total: 9, soft: false, pair: false, dealer: '2' }).label).toBe('HIT');
  });
  test('hard 10 vs dealer 9 → DOUBLE', () => {
    expect(getAdvice({ total: 10, soft: false, pair: false, dealer: '9' }).action).toBe('D');
  });
  test('hard 10 vs dealer T → HIT', () => {
    expect(getAdvice({ total: 10, soft: false, pair: false, dealer: 't' }).label).toBe('HIT');
  });
  test('hard 11 vs dealer T → DOUBLE', () => {
    expect(getAdvice({ total: 11, soft: false, pair: false, dealer: 't' }).action).toBe('D');
  });
  test('hard 12 vs dealer 4 → STAND', () => {
    expect(getAdvice({ total: 12, soft: false, pair: false, dealer: '4' }).label).toBe('STAND');
  });
  test('hard 12 vs dealer 2 → HIT', () => {
    expect(getAdvice({ total: 12, soft: false, pair: false, dealer: '2' }).label).toBe('HIT');
  });
  test('hard 16 vs dealer 6 → STAND', () => {
    expect(getAdvice({ total: 16, soft: false, pair: false, dealer: '6' }).label).toBe('STAND');
  });
  test('hard 16 vs dealer 7 → HIT', () => {
    expect(getAdvice({ total: 16, soft: false, pair: false, dealer: '7' }).label).toBe('HIT');
  });
  test('hard 16 vs dealer T → SURRENDER', () => {
    expect(getAdvice({ total: 16, soft: false, pair: false, dealer: 't' }).label).toBe('SURRENDER');
  });
  test('hard 15 vs dealer T → SURRENDER', () => {
    expect(getAdvice({ total: 15, soft: false, pair: false, dealer: 't' }).label).toBe('SURRENDER');
  });
  test('hard 15 vs dealer 9 → HIT', () => {
    expect(getAdvice({ total: 15, soft: false, pair: false, dealer: '9' }).label).toBe('HIT');
  });
  test('hard 17 → always STAND regardless of dealer', () => {
    ['2','3','4','5','6','7','8','9','t','a'].forEach(d => {
      expect(getAdvice({ total: 17, soft: false, pair: false, dealer: d }).label).toBe('STAND');
    });
  });
  test('hard 20 → STAND', () => {
    expect(getAdvice({ total: 20, soft: false, pair: false, dealer: '6' }).label).toBe('STAND');
  });
  test('hard 7 or less → HIT', () => {
    expect(getAdvice({ total: 7, soft: false, pair: false, dealer: '6' }).label).toBe('HIT');
  });
});

describe('getAdvice — soft totals', () => {
  test('soft 13 (A+2) vs dealer 5 → DOUBLE', () => {
    expect(getAdvice({ total: 13, soft: true, pair: false, dealer: '5' }).action).toBe('D');
  });
  test('soft 13 vs dealer 4 → HIT', () => {
    expect(getAdvice({ total: 13, soft: true, pair: false, dealer: '4' }).label).toBe('HIT');
  });
  test('soft 17 (A+6) vs dealer 6 → DOUBLE', () => {
    expect(getAdvice({ total: 17, soft: true, pair: false, dealer: '6' }).action).toBe('D');
  });
  test('soft 17 vs dealer 7 → HIT', () => {
    expect(getAdvice({ total: 17, soft: true, pair: false, dealer: '7' }).label).toBe('HIT');
  });
  test('soft 18 (A+7) vs dealer 2 → STAND', () => {
    expect(getAdvice({ total: 18, soft: true, pair: false, dealer: '2' }).label).toBe('STAND');
  });
  test('soft 18 vs dealer 3 → DOUBLE (Ds action, DOUBLE label)', () => {
    const r = getAdvice({ total: 18, soft: true, pair: false, dealer: '3' });
    expect(r.action).toBe('Ds');
    expect(r.label).toBe('DOUBLE');
  });
  test('soft 18 vs dealer 9 → HIT', () => {
    expect(getAdvice({ total: 18, soft: true, pair: false, dealer: '9' }).label).toBe('HIT');
  });
  test('soft 19 → always STAND', () => {
    expect(getAdvice({ total: 19, soft: true, pair: false, dealer: '6' }).label).toBe('STAND');
  });
});

describe('getAdvice — pairs', () => {
  test('pair of 8s vs any → SPLIT', () => {
    expect(getAdvice({ total: null, soft: false, pair: '8', dealer: 't' }).label).toBe('SPLIT');
    expect(getAdvice({ total: null, soft: false, pair: '8', dealer: 'a' }).label).toBe('SPLIT');
  });
  test('pair of Aces → always SPLIT', () => {
    expect(getAdvice({ total: null, soft: false, pair: 'a', dealer: '8' }).label).toBe('SPLIT');
  });
  test('pair of Tens → STAND', () => {
    expect(getAdvice({ total: null, soft: false, pair: 't', dealer: '6' }).label).toBe('STAND');
  });
  test('pair of 5s → DOUBLE (treated same as hard 10)', () => {
    expect(getAdvice({ total: null, soft: false, pair: '5', dealer: '6' }).label).toBe('DOUBLE');
  });
  test('pair of 9s vs dealer 7 → STAND', () => {
    expect(getAdvice({ total: null, soft: false, pair: '9', dealer: '7' }).label).toBe('STAND');
  });
  test('pair of 9s vs dealer 6 → SPLIT', () => {
    expect(getAdvice({ total: null, soft: false, pair: '9', dealer: '6' }).label).toBe('SPLIT');
  });
  test('pair of 4s vs dealer 5 → SPLIT', () => {
    expect(getAdvice({ total: null, soft: false, pair: '4', dealer: '5' }).label).toBe('SPLIT');
  });
  test('pair of 4s vs dealer 7 → HIT', () => {
    expect(getAdvice({ total: null, soft: false, pair: '4', dealer: '7' }).label).toBe('HIT');
  });
});

describe('getAdvice — dealer normalisation', () => {
  test('J, Q, K treated identically to T', () => {
    const ref = getAdvice({ total: 16, soft: false, pair: false, dealer: 't' }).label;
    expect(getAdvice({ total: 16, soft: false, pair: false, dealer: 'j' }).label).toBe(ref);
    expect(getAdvice({ total: 16, soft: false, pair: false, dealer: 'q' }).label).toBe(ref);
    expect(getAdvice({ total: 16, soft: false, pair: false, dealer: 'k' }).label).toBe(ref);
  });
});

describe('getAdvice — color coding', () => {
  test('HIT → yellow #f59e0b', () => {
    expect(getAdvice({ total: 8, soft: false, pair: false, dealer: '7' }).color).toBe('#f59e0b');
  });
  test('STAND → blue #3b82f6', () => {
    expect(getAdvice({ total: 17, soft: false, pair: false, dealer: '7' }).color).toBe('#3b82f6');
  });
  test('DOUBLE → green #22c55e', () => {
    expect(getAdvice({ total: 11, soft: false, pair: false, dealer: '6' }).color).toBe('#22c55e');
  });
  test('SPLIT → green #22c55e', () => {
    expect(getAdvice({ total: null, soft: false, pair: '8', dealer: '6' }).color).toBe('#22c55e');
  });
  test('SURRENDER → red #ef4444', () => {
    expect(getAdvice({ total: 16, soft: false, pair: false, dealer: 't' }).color).toBe('#ef4444');
  });
});

describe('getAdvice — invalid / edge inputs', () => {
  test('null dealer → null', () => {
    expect(getAdvice({ total: 16, soft: false, pair: false, dealer: null })).toBeNull();
  });
  test('null total (non-pair) → null', () => {
    expect(getAdvice({ total: null, soft: false, pair: false, dealer: '7' })).toBeNull();
  });
  test('unknown dealer card → null', () => {
    expect(getAdvice({ total: 16, soft: false, pair: false, dealer: 'x' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — confirm failure**

```bash
npx jest test/strategy.test.js --no-coverage
```

Expected: FAIL — `Cannot find module '../src/strategy'`

- [ ] **Step 3: Write `src/strategy.js`**

```js
// src/strategy.js
'use strict';

// Dealer column order — used for array indexing
const DEALERS = ['2', '3', '4', '5', '6', '7', '8', '9', 't', 'a'];

// Hard totals (rows 8–16; ≤7 → always H, ≥17 → always S)
// Columns: dealer 2, 3, 4, 5, 6, 7, 8, 9, T, A
const HARD = {
  8:  ['H',  'H',  'H',  'H',  'H',  'H',  'H',  'H',  'H',  'H'],
  9:  ['H',  'D',  'D',  'D',  'D',  'H',  'H',  'H',  'H',  'H'],
  10: ['D',  'D',  'D',  'D',  'D',  'D',  'D',  'D',  'H',  'H'],
  11: ['D',  'D',  'D',  'D',  'D',  'D',  'D',  'D',  'D',  'H'],
  12: ['H',  'H',  'S',  'S',  'S',  'H',  'H',  'H',  'H',  'H'],
  13: ['S',  'S',  'S',  'S',  'S',  'H',  'H',  'H',  'H',  'H'],
  14: ['S',  'S',  'S',  'S',  'S',  'H',  'H',  'H',  'H',  'H'],
  15: ['S',  'S',  'S',  'S',  'S',  'H',  'H',  'H',  'R',  'R'],
  16: ['S',  'S',  'S',  'S',  'S',  'H',  'H',  'R',  'R',  'R'],
};

// Soft totals (A+2 through A+9, keyed by total 13–20)
// Columns: dealer 2, 3, 4, 5, 6, 7, 8, 9, T, A
const SOFT = {
  13: ['H',  'H',  'H',  'D',  'D',  'H',  'H',  'H',  'H',  'H'], // A+2
  14: ['H',  'H',  'H',  'D',  'D',  'H',  'H',  'H',  'H',  'H'], // A+3
  15: ['H',  'H',  'D',  'D',  'D',  'H',  'H',  'H',  'H',  'H'], // A+4
  16: ['H',  'H',  'D',  'D',  'D',  'H',  'H',  'H',  'H',  'H'], // A+5
  17: ['H',  'D',  'D',  'D',  'D',  'H',  'H',  'H',  'H',  'H'], // A+6
  18: ['S',  'Ds', 'Ds', 'Ds', 'Ds', 'S',  'S',  'H',  'H',  'H'], // A+7
  19: ['S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S'], // A+8
  20: ['S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S'], // A+9
};

// Pairs (keyed by the card value of one card in the pair)
// Columns: dealer 2, 3, 4, 5, 6, 7, 8, 9, T, A
const PAIRS = {
  '2': ['P',  'P',  'P',  'P',  'P',  'P',  'H',  'H',  'H',  'H'],
  '3': ['P',  'P',  'P',  'P',  'P',  'P',  'H',  'H',  'H',  'H'],
  '4': ['H',  'H',  'H',  'P',  'P',  'H',  'H',  'H',  'H',  'H'],
  '5': ['D',  'D',  'D',  'D',  'D',  'D',  'D',  'D',  'H',  'H'],
  '6': ['P',  'P',  'P',  'P',  'P',  'H',  'H',  'H',  'H',  'H'],
  '7': ['P',  'P',  'P',  'P',  'P',  'P',  'H',  'H',  'H',  'H'],
  '8': ['P',  'P',  'P',  'P',  'P',  'P',  'P',  'P',  'P',  'P'],
  '9': ['P',  'P',  'P',  'P',  'P',  'S',  'P',  'P',  'S',  'S'],
  't': ['S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S'],
  'a': ['P',  'P',  'P',  'P',  'P',  'P',  'P',  'P',  'P',  'P'],
};

// Maps raw action codes → display info
const ACTION_INFO = {
  'H':  { label: 'HIT',       color: '#f59e0b' },
  'S':  { label: 'STAND',     color: '#3b82f6' },
  'D':  { label: 'DOUBLE',    color: '#22c55e' },
  'Ds': { label: 'DOUBLE',    color: '#22c55e' },
  'R':  { label: 'SURRENDER', color: '#ef4444' },
  'P':  { label: 'SPLIT',     color: '#22c55e' },
};

/** Normalise J/Q/K to T */
function normCard(c) {
  const s = String(c).toLowerCase();
  return ['j', 'q', 'k'].includes(s) ? 't' : s;
}

/**
 * Look up basic strategy for 6-deck S17 blackjack.
 *
 * @param {{
 *   total:  number|null,   — player hand total (4–21); ignored when pair is set
 *   soft:   boolean,       — true if hand contains an Ace counting as 11
 *   pair:   string|false,  — card value of one card if it's a pair ('8','a','t'…)
 *   dealer: string|null    — dealer upcard ('2'–'9','t','j','q','k','a')
 * }} hand
 * @returns {{ action: string, label: string, color: string }|null}
 */
function getAdvice({ total, soft, pair, dealer }) {
  if (!dealer) return null;

  const d   = normCard(dealer);
  const col = DEALERS.indexOf(d);
  if (col === -1) return null;

  let action;

  if (pair) {
    const pairCard = normCard(pair);
    const row = PAIRS[pairCard];
    if (!row) return null;
    action = row[col];
  } else if (soft) {
    if (total == null || total < 13 || total > 20) return null;
    action = SOFT[total]?.[col] ?? 'S';
  } else {
    if (total == null) return null;
    if (total <= 7)   action = 'H';
    else if (total >= 17) action = 'S';
    else action = HARD[total]?.[col];
  }

  if (!action) return null;
  const info = ACTION_INFO[action];
  if (!info) return null;
  return { action, label: info.label, color: info.color };
}

module.exports = { getAdvice };
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
npx jest test/strategy.test.js --no-coverage
```

Expected: 36+ tests passed, 0 failed.

- [ ] **Step 5: Run full suite — no regressions**

```bash
npx jest --no-coverage
```

Expected: 65 + new strategy tests passed, 0 failed.

- [ ] **Step 6: Commit**

```bash
git add src/strategy.js test/strategy.test.js
git commit -m "feat: basic strategy lookup table with full test coverage (TDD)"
```

---

## Task 2: Update preload.js

**Files:**
- Modify: `src/preload.js`

- [ ] **Step 1: Add `getAdvice` to the contextBridge object**

Open `src/preload.js`. Find the closing `});` of `contextBridge.exposeInMainWorld('api', {`. Before that closing line, add:

```js
  // Strategy
  getAdvice: (hand) => {
    const { getAdvice } = require('./strategy');
    return getAdvice(hand);
  },
```

The preload runs with Node.js access, so `require('./strategy')` resolves relative to `src/preload.js` → `src/strategy.js`. This call is **synchronous** — no Promise needed.

The complete end of the file should look like:

```js
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

- [ ] **Step 2: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/preload.js
git commit -m "feat: expose getAdvice synchronously via preload contextBridge"
```

---

## Task 3: Renderer — HTML, CSS, and Hand Mode Logic

**Files:**
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/style.css`
- Modify: `src/renderer/app.js`

### Part A — index.html

- [ ] **Step 1: Add hand mode elements to `src/renderer/index.html`**

Find the capture row and counts row:

```html
      </div><!-- end capture-row -->

      <div class="counts-row">
```

Insert two new blocks between them:

```html
      </div><!-- end capture-row -->

      <!-- ── Hand mode input ── -->
      <div id="hand-mode-row" class="hand-mode-row hidden">
        <span id="hand-mode-label" class="hand-mode-label">H: — · D: —</span>
        <span class="hand-mode-hint">Esc to clear</span>
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
```

### Part B — style.css

- [ ] **Step 2: Append new styles to the end of `src/renderer/style.css`**

```css
/* ── Hand mode row ── */
.hand-mode-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding: 6px 10px;
  background: #2a2a3e;
  border-radius: 8px;
  border: 1px solid #3a3a4e;
}

.hand-mode-label {
  font-size: 11px;
  color: #e2e8f0;
  font-weight: 600;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.5px;
}

.hand-mode-hint {
  font-size: 9px;
  color: #444;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Strategy block reuses .advice-block — border/bg set dynamically */
.advice-block.strategy {
  margin-bottom: 6px;
}
```

### Part C — app.js

- [ ] **Step 3: Add DOM refs and state at the top of `src/renderer/app.js`**

After the existing DOM refs block (after `const captureStop = ...`), add:

```js
const handModeRow   = document.getElementById('hand-mode-row');
const handModeLabel = document.getElementById('hand-mode-label');
const strategyBlock = document.getElementById('strategy-block');
const strategyText  = document.getElementById('strategy-text');
```

After the existing state variables (`let currentDecks = 6;`), add:

```js
// Hand mode state
let handMode      = false;
let handPrefix    = 'hard';    // 'hard' | 'soft' | 'pair'
let playerDigits  = [];        // digit strings building the total
let playerPairCard = null;     // card value string for pair mode
let hdDealerCard  = null;      // dealer upcard for strategy lookup
```

- [ ] **Step 4: Add `enterHandMode`, `exitHandMode`, `renderHandMode` functions**

After the `setCaptureActive` function, add:

```js
function enterHandMode() {
  handMode       = true;
  handPrefix     = 'hard';
  playerDigits   = [];
  playerPairCard = null;
  hdDealerCard   = null;
  handModeRow.classList.remove('hidden');
  strategyBlock.classList.add('hidden');
  renderHandMode();
}

function exitHandMode() {
  handMode       = false;
  handPrefix     = 'hard';
  playerDigits   = [];
  playerPairCard = null;
  hdDealerCard   = null;
  handModeRow.classList.add('hidden');
  strategyBlock.classList.add('hidden');
}

function renderHandMode() {
  // Build player display string
  let playerDisplay = '';
  if (handPrefix === 'soft')      playerDisplay = 'soft ';
  else if (handPrefix === 'pair') playerDisplay = 'pair ';

  if (handPrefix === 'pair' && playerPairCard) {
    playerDisplay += playerPairCard.toUpperCase() + 's';
  } else if (playerDigits.length > 0) {
    playerDisplay += playerDigits.join('');
  } else {
    playerDisplay += '—';
  }

  const dealerDisplay = hdDealerCard ? hdDealerCard.toUpperCase() : '—';
  handModeLabel.textContent = `H: ${playerDisplay} · D: ${dealerDisplay}`;

  // Determine if we have enough info for a lookup
  const playerTotal = handPrefix !== 'pair'
    ? (playerDigits.length > 0 ? parseInt(playerDigits.join(''), 10) : null)
    : null;
  const hasPair  = handPrefix === 'pair' && playerPairCard !== null;
  const hasTotal = hasPair || (playerTotal !== null && playerTotal >= 4);

  if (!hasTotal || !hdDealerCard) {
    strategyBlock.classList.add('hidden');
    return;
  }

  const advice = window.api.getAdvice({
    total:  playerTotal,
    soft:   handPrefix === 'soft',
    pair:   hasPair ? playerPairCard : false,
    dealer: hdDealerCard,
  });

  if (advice) {
    strategyBlock.style.background   = advice.color + '18';
    strategyBlock.style.border       = `1px solid ${advice.color}44`;
    strategyText.style.color         = advice.color;
    strategyText.textContent         = advice.label;
    strategyBlock.classList.remove('hidden');
  } else {
    strategyBlock.classList.add('hidden');
  }
}
```

- [ ] **Step 5: Add `handleHandModeKey` function**

After `renderHandMode`, add:

```js
// Note: reuses existing CARD_KEYS set already defined in app.js

function handleHandModeKey(key) {
  // Toggle / escape
  if (key === 'h' || key === 'escape') { exitHandMode(); return; }

  // Prefix keys (only before any digits or pair card)
  if (key === 's' && playerDigits.length === 0 && !playerPairCard && handPrefix === 'hard') {
    handPrefix = 'soft'; renderHandMode(); return;
  }
  if (key === 'p' && playerDigits.length === 0 && !playerPairCard && handPrefix === 'hard') {
    handPrefix = 'pair'; renderHandMode(); return;
  }

  // Pair mode: next card key is the pair card value
  if (handPrefix === 'pair' && playerPairCard === null) {
    if (CARD_KEYS.has(key)) {
      // Normalise face cards to 't'
      playerPairCard = ['j','q','k'].includes(key) ? 't' : key;
      renderHandMode(); return;
    }
    return; // ignore non-card keys while waiting for pair card
  }

  // Digit entry for hard/soft total (only while dealer not yet set)
  if (handPrefix !== 'pair' && hdDealerCard === null && /^\d$/.test(key)) {
    const tentative = parseInt([...playerDigits, key].join(''), 10);
    if (tentative <= 21 && playerDigits.length < 2) {
      playerDigits.push(key);
      renderHandMode();
    }
    return;
  }

  // Dealer card — set when player input is ready
  const playerReady = handPrefix === 'pair'
    ? playerPairCard !== null
    : playerDigits.length > 0;

  if (playerReady && CARD_KEYS.has(key)) {
    if (hdDealerCard !== null) {
      // Already had a dealer card — reset for new hand
      playerDigits   = [];
      playerPairCard = null;
      hdDealerCard   = null;
      handPrefix     = 'hard';
    }
    hdDealerCard = key;
    renderHandMode();
  }
}
```

- [ ] **Step 6: Wire `H` key into the existing keydown listener**

Find the existing keydown listener in `src/renderer/app.js`. It currently starts with:

```js
document.addEventListener('keydown', async (e) => {
  const key = e.key.toLowerCase();

  if (CARD_KEYS.has(key)) {
```

Replace the entire listener with this updated version:

```js
document.addEventListener('keydown', async (e) => {
  const key = e.key.toLowerCase();

  // Hand mode intercepts all keys first
  if (handMode) {
    handleHandModeKey(key);
    return;
  }

  // Toggle hand mode
  if (key === 'h') { enterHandMode(); return; }

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
    await window.api.toggleExpand();
  }
});
```

- [ ] **Step 7: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/index.html src/renderer/style.css src/renderer/app.js
git commit -m "feat: hand mode UI — H key triggers basic strategy advisor"
```

---

## Task 4: Smoke Test

- [ ] **Step 1: Launch the app**

```bash
npm start
```

Expected: widget appears bottom-right, no errors in terminal.

- [ ] **Step 2: Verify hand mode activates**

Press `Ctrl+Shift+Space` to expand. Click the widget to focus it. Press `H`. The widget should show a dark row: `H: — · D: —` with "Esc to clear" on the right.

- [ ] **Step 3: Test hard hand lookup**

With hand mode active, press `1` then `6` → label updates to `H: 16 · D: —`. Press `T` → strategy block appears: **SURRENDER** in red. Press `H` to clear.

- [ ] **Step 4: Test soft hand**

Press `H`, then `S`, then `1` then `8` → `H: soft 18 · D: —`. Press `3` → **DOUBLE** in green.

- [ ] **Step 5: Test pair**

Press `H`, then `P`, then `8` → `H: pair 8s · D: —`. Press `9` → **SPLIT** in green.

- [ ] **Step 6: Test new-hand reset**

While in hand mode with a result showing, press `T` (another dealer card) → resets to `H: — · D: T` waiting for new player total.

- [ ] **Step 7: Verify card counting still works**

Press `Esc` to exit hand mode. Press `2`, `5`, `K` → running count updates to +1. Hand mode did not interfere with counting.

- [ ] **Step 8: Final commit**

```bash
git add .
git commit -m "chore: basic strategy advisor smoke test passes"
```
