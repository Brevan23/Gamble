# Basic Strategy Advisor — Design Spec
**Date:** 2026-05-21
**Status:** Approved

---

## Overview

Add a keyboard-driven basic strategy advisor to the card-counter overlay. The user presses `H` to enter Hand Mode, types their total and the dealer's upcard, and the widget instantly shows the correct action (Hit, Stand, Double, Split, or Surrender) based on 6-deck S17 basic strategy. Card keys pressed in Hand Mode are interpreted as hand/dealer input — not counted toward the running count.

---

## Keyboard Flow

| Step | Key(s) | Effect |
|------|--------|--------|
| 1 | `H` | Enter Hand Mode. Widget shows input area. |
| 2 (optional) | `S` | Mark hand as **soft** (Ace counting as 11) |
| 2 (optional) | `P` | Mark hand as a **pair** |
| 3 | digit(s) | Build player total. `1``6` = 16, `8` = 8. Max 2 digits. |
| 4 | card key | Set dealer upcard (2–9, T, A). Advice appears instantly. |
| — | `H` or `Esc` | Clear Hand Mode, return to normal. |

**Key conflict rule:** While in Hand Mode, card keys (2–9, T, J, Q, K, A) are consumed by the hand input state machine and do **not** call `counter.logCard()`. The running count is unaffected.

**Examples:**
- Hard 16 vs dealer 10 → `H` `1` `6` `T` → STAND
- Soft 18 vs dealer 6 → `H` `S` `1` `8` `6` → DOUBLE
- Pair of 8s vs dealer 9 → `H` `P` `8` `9` → SPLIT
- Hard 11 vs dealer 7 → `H` `1` `1` `7` → DOUBLE

---

## Hand Mode State Machine

Three fields tracked in renderer state:

```
handMode:   boolean       (H toggles)
handPrefix: 'hard'|'soft'|'pair'  (default 'hard')
playerTotal: number|null  (built from digit keypresses, 4–21)
dealerCard:  string|null  (set by card key, triggers advice render)
```

**Digit handling:** first digit sets tens place if > 2 (e.g. `9` = 9 immediately), or waits for second digit if it could be 10+ (e.g. `1` waits, then `1``6` = 16). Max total = 21. Pairs: after pressing `P`, the next keypress is the **card value** of one card in the pair — not the total. `P``8` = pair of 8s, `P``A` = pair of Aces, `P``T` = pair of Tens. The dealer card key follows immediately after.

**Auto-clear:** entering a new dealer card when both fields are already set resets the hand and starts fresh.

---

## strategy.js — Lookup Table

**File:** `src/strategy.js`

**Input:** `{ total: number, soft: boolean, pair: boolean, dealer: string }`
**Output:** `{ action: 'H'|'S'|'D'|'P'|'R', label: string, color: string }`

Actions:
- `H` = Hit → label "HIT", color `#f59e0b` (yellow)
- `S` = Stand → label "STAND", color `#3b82f6` (blue)
- `D` = Double (else Hit) → label "DOUBLE", color `#22c55e` (green)
- `Ds` = Double (else Stand) → label "DOUBLE", color `#22c55e` (green)
- `P` = Split → label "SPLIT", color `#22c55e` (green)
- `R` = Surrender (else Hit) → label "SURRENDER", color `#ef4444` (red)

**Dealer card normalisation:** `'j'`, `'q'`, `'k'` → treated as `'t'` (all worth 10).

### Hard Totals Table (6-deck, S17)

Columns: dealer 2, 3, 4, 5, 6, 7, 8, 9, T, A

```
 8:  H   H   H   H   H   H   H   H   H   H
 9:  H   D   D   D   D   H   H   H   H   H
10:  D   D   D   D   D   D   D   D   H   H
11:  D   D   D   D   D   D   D   D   D   H
12:  H   H   S   S   S   H   H   H   H   H
13:  S   S   S   S   S   H   H   H   H   H
14:  S   S   S   S   S   H   H   H   H   H
15:  S   S   S   S   S   H   H   H   R   R
16:  S   S   S   S   S   H   H   R   R   R
17+: S   S   S   S   S   S   S   S   S   S
```

Totals ≤ 8 and totals of exactly 21: always S (stand) or H (hit ≤8).

### Soft Totals Table (Ace counts as 11)

```
A+2 (13): H   H   H   D   D   H   H   H   H   H
A+3 (14): H   H   H   D   D   H   H   H   H   H
A+4 (15): H   H   D   D   D   H   H   H   H   H
A+5 (16): H   H   D   D   D   H   H   H   H   H
A+6 (17): H   D   D   D   D   H   H   H   H   H
A+7 (18): S  Ds  Ds  Ds  Ds   S   S   H   H   H
A+8 (19): S   S   S   S   S   S   S   S   S   S
A+9 (20): S   S   S   S   S   S   S   S   S   S
```

### Pairs Table

```
2-2:  P   P   P   P   P   P   H   H   H   H
3-3:  P   P   P   P   P   P   H   H   H   H
4-4:  H   H   H   P   P   H   H   H   H   H
5-5:  D   D   D   D   D   D   D   D   H   H
6-6:  P   P   P   P   P   H   H   H   H   H
7-7:  P   P   P   P   P   P   H   H   H   H
8-8:  P   P   P   P   P   P   P   P   P   P
9-9:  P   P   P   P   P   S   P   P   S   S
T-T:  S   S   S   S   S   S   S   S   S   S
A-A:  P   P   P   P   P   P   P   P   P   P
```

---

## Widget UI Changes

### `src/renderer/index.html`

Add a hand mode section inside `#expanded-view`, between the capture row and the counts row:

```html
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
```

`#hand-mode-row` shows while Hand Mode is active (replaces nothing, sits above counts).
`#strategy-block` shows when both player total and dealer card are known.

### `src/renderer/style.css`

Add styles for `.hand-mode-row`, `.hand-mode-label`, `.hand-mode-hint`, and color variants for `.advice-block.strategy`.

### `src/renderer/app.js`

Add:
- Hand mode state variables: `handMode`, `handPrefix`, `playerDigits[]`, `dealerCard`
- `H` key handler in the existing `keydown` listener
- `renderHandMode()` — updates `#hand-mode-label` and `#strategy-block`
- Import-style call to `strategy.getAdvice()` via a new IPC channel or inline (see below)

---

## IPC / Integration

`strategy.js` is a **pure module with no Electron dependency**. It is required directly in the renderer via the existing `nodeIntegration: false` + contextBridge pattern — meaning it cannot be required directly.

**Approach:** expose `getAdvice` through the preload. The preload script runs with Node.js access, so `require` works there.

`src/preload.js` addition:
```js
getAdvice: (hand) => {
  const { getAdvice } = require('./strategy');
  return getAdvice(hand);
},
```

`src/renderer/app.js` calls `window.api.getAdvice({ total, soft, pair, dealer })` and renders the result synchronously (the function is pure and instant — no async needed, but the IPC round-trip makes it promise-based).

---

## Files Changed

| File | Change |
|------|--------|
| `src/strategy.js` | Create — pure lookup table |
| `test/strategy.test.js` | Create — unit tests |
| `src/preload.js` | Add `getAdvice` exposure |
| `src/renderer/index.html` | Add hand-mode-row + strategy-block |
| `src/renderer/style.css` | Add hand mode + strategy styles |
| `src/renderer/app.js` | Add hand mode state machine + render |

No changes to `main.js`, `counter.js`, `settings.js`, or IPC handlers in main.

---

## Error Handling

| Situation | Handling |
|-----------|----------|
| Player total out of range (< 4 or > 21) | Ignore digit, don't update display |
| Unknown dealer card | Ignore keypress |
| Pair flag + total > 11 (impossible pair) | Fall back to hard total lookup |
| `getAdvice` called with incomplete input | Return null — strategy block stays hidden |

---

## Out of Scope (v1)

- Auto-detecting hand from screen (OCR)
- Multi-card hand entry (user enters total, not individual cards)
- Deck-specific rule variations (DAS, RSA, etc.)
- Count-based strategy deviations (Illustrious 18) — kept separate from basic strategy
