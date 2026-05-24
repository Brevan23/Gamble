# Count-Adjusted Strategy & Side Bets — Design Spec

**Date:** 2026-05-24  
**Status:** Approved

---

## Overview

Extend the basic strategy advisor to factor in the Hi-Lo true count. When the count deviates from neutral, the mathematically optimal play changes — these deviations are known as the **Illustrious 18** (Don Schlesinger, *Blackjack Attack*), the 18 most player-valuable index plays for Hi-Lo 6-deck S17.

Additionally, show pre-round side bet advice when the true count makes a side bet statistically favorable. The side bet block disappears once the player's first card is entered (bets are locked before cards are dealt).

---

## Goals

1. `getAdvice()` returns the mathematically best single action given the true count — not just basic strategy.
2. Side bet advice surfaces automatically when favorable and hides once the hand starts.
3. All existing tests (121) continue to pass without modification.

---

## Illustrious 18 Index Plays

Source: Don Schlesinger, *Blackjack Attack* (3rd ed.), Hi-Lo count, 6-deck S17.

Each entry below specifies: the condition under which the **deviation from basic strategy** applies.

| # | Hand | Dealer | Index | Deviation (→ do this instead) | Basic default |
|---|------|--------|-------|-------------------------------|---------------|
| 1 | Insurance | A | TC ≥ +3 | Take insurance | Decline |
| 2 | Hard 16 | T | TC ≥ 0 | Stand | Hit/Surrender |
| 3 | Hard 15 | T | TC ≥ +4 | Stand | Hit/Surrender |
| 4 | T,T | 5 | TC ≥ +5 | Split | Stand |
| 5 | T,T | 6 | TC ≥ +4 | Split | Stand |
| 6 | Hard 10 | T | TC ≥ +4 | Double | Hit |
| 7 | Hard 12 | 3 | TC ≥ +2 | Stand | Hit |
| 8 | Hard 12 | 2 | TC ≥ +3 | Stand | Hit |
| 9 | Hard 11 | A | TC ≥ +1 | Double | Hit |
| 10 | Hard 9 | 2 | TC ≥ +1 | Double | Hit |
| 11 | Hard 10 | A | TC ≥ +4 | Double | Hit |
| 12 | Hard 9 | 7 | TC ≥ +3 | Double | Hit |
| 13 | Hard 16 | 9 | TC ≥ +5 | Stand | Hit/Surrender |
| 14 | Hard 13 | 2 | TC ≤ -1 | Hit | Stand |
| 15 | Hard 12 | 4 | TC ≤ -1 | Hit | Stand |
| 16 | Hard 13 | 3 | TC ≤ -2 | Hit | Stand |
| 17 | Soft 19 (A,8) | 6 | TC ≥ +1 | Double | Stand |

Play #1 (Insurance) is handled both as an index play within `getAdvice()` and independently as a side bet in `getSideBetAdvice()`.

### Index Play Resolution

Index plays are evaluated **before** the basic strategy tables. If an index condition is met, return the deviation action immediately.

**Match logic:**

- `pair` check first (T,T entries): `pair === 't'`
- `soft` check second: `soft === true && total === 19`
- `hard` total check: `soft === false && pair === false`
- `dealer` is the dealer's upcard character: `'2'`–`'9'`, `'t'`, `'a'`
- `trueCount` is a float; comparisons use `>=` and `<=`

### Backward Compatibility

When `trueCount` is `null` or `undefined`, skip all index play checks and fall through to the existing basic strategy tables. All 121 existing tests pass `trueCount` as undefined, so they remain valid without modification.

---

## Side Bet Advice

### Bets Covered

| Bet | Show when | Condition |
|-----|-----------|-----------|
| Insurance | Dealer shows A + TC ≥ +3 | `dealerCard === 'a' && trueCount >= 3` |
| Bust It | TC ≥ +3 (deck is rich in tens, bad for dealer) | `trueCount >= 3` |
| 21+3 | TC ≥ +8 (rare; very ten-rich) | `trueCount >= 8` |

**Perfect Pairs** is excluded: Hi-Lo does not track suit or specific rank composition. The house edge (~5–7%) does not move meaningfully with Hi-Lo TC, so advice would be unreliable.

### Display Timing

- Shown **only** when `playerCards.length === 0` (before any player card is entered).
- Hidden immediately when the first player card is entered.
- If no bets are currently favorable, the side bet block is hidden entirely (no empty block).

### Thresholds — Justification

| Bet | Threshold | Rationale |
|-----|-----------|-----------|
| Insurance | TC ≥ +3 | Standard Hi-Lo breakeven point; EV positive above this |
| Bust It | TC ≥ +3 | Ten-rich decks increase dealer bust probability |
| 21+3 | TC ≥ +8 | Poker hand combinations improve sharply in very ten-heavy shoes |

---

## API Changes

### `getAdvice({ total, soft, pair, dealer, trueCount })`

- New optional parameter: `trueCount` (number or null/undefined).
- Returns same shape as before: `{ action, label, color }`.
- Index plays are checked first; if no match, falls through to existing basic strategy tables.

### New module: `src/sidebets.js`

```js
/**
 * getSideBetAdvice({ trueCount, dealerCard })
 * @param {number|null} trueCount
 * @param {string|null} dealerCard  - 'a', '2'–'9', 't', or null
 * @returns {Array<{ name: string, reason: string }>}
 */
function getSideBetAdvice({ trueCount, dealerCard }) { ... }
module.exports = { getSideBetAdvice };
```

Returns an array of objects for each currently favorable bet:

```js
[
  { name: 'Insurance', reason: 'TC ≥ +3 with dealer A' },
  { name: 'Bust It',   reason: 'TC ≥ +3' },
]
```

Empty array `[]` when no bets are favorable.

---

## UI Changes

### Side Bet Block

Positioned **between** the bet/action advice rows and the card input section.

```
┌─────────────────────────────┐
│ 🎯 Action   STAND           │
│ 💰 Bet      2× min          │
├─────────────────────────────┤  ← side bet block (only visible pre-hand)
│ 🎰 SIDE BETS                │
│ ✅ Insurance  TC ≥ +3       │
│ ✅ Bust It    TC ≥ +3       │
├─────────────────────────────┤
│ YOUR HAND  · hold H         │
│ ...                         │
```

- Block hidden (`display: none`) when `playerCards.length > 0` or no favorable bets.
- Purple accent: `#a855f7` / `#a855f718` (consistent with a "special bet" feel distinct from strategy blue and count amber).
- Each row: checkmark icon + bet name + count condition.

### IPC / Preload

The renderer calls `getSideBetAdvice` as a synchronous-style call via contextBridge:

```js
// preload.js addition
getSideBetAdvice: (trueCount, dealerCard) =>
  ipcRenderer.invoke('counter:getSideBetAdvice', trueCount, dealerCard)
```

Alternatively (simpler): `getSideBetAdvice` is a pure function with no Electron state dependency, so it can be loaded directly in the renderer. The preload exposes it as a thin wrapper around a require.

**Decision: expose via contextBridge as a direct function call** (no IPC round-trip needed since it's pure computation). Preload requires `sidebets.js` and exposes `getSideBetAdvice` directly.

### `getAdvice` call site (renderer)

```js
const advice = window.api.getAdvice({
  total: info.total,
  soft: info.soft,
  pair: info.pair,
  dealer: s.dealerCard,
  trueCount: s.trueCount   // ← new
});
```

---

## Files Affected

| File | Change |
|------|--------|
| `src/strategy.js` | Add `trueCount` param; add 17-entry index plays table; check index plays before basic strategy tables |
| `src/sidebets.js` | New file — `getSideBetAdvice({ trueCount, dealerCard })` |
| `src/preload.js` | Expose `getSideBetAdvice` via contextBridge; update `getAdvice` to accept and forward `trueCount` |
| `src/renderer/app.js` | Pass `trueCount: s.trueCount` in `getAdvice` call; add `renderSideBetAdvice(s)`; hide side bet block when `playerCards.length > 0` |
| `src/renderer/index.html` | Add `#side-bet-block` element between advice rows and card input section |
| `src/renderer/style.css` | Add `.side-bet-block`, `.side-bet-row`, `.side-bet-name` purple styles |
| `test/strategy.test.js` | Add describe block for index plays (one test per entry + TC just below threshold returns basic strategy) |
| `test/sidebets.test.js` | New file — full coverage of `getSideBetAdvice` |

---

## Out of Scope

- Deck composition tracking (exact rank counts) — not needed for Hi-Lo.
- Perfect Pairs side bet — excluded; Hi-Lo cannot reliably predict pairs.
- Split / pot sizing based on count — not in scope for this feature.
- Settings panel changes — thresholds are hardcoded (not user-configurable).
- Optimal bet spread calculation — only the best single action and side bets are advised.
