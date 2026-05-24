# Count-Adjusted Strategy & Side Bets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `getAdvice()` to use Hi-Lo true count for Illustrious 18 index plays, and add a `getSideBetAdvice()` function that surfaces favorable side bets before the hand starts.

**Architecture:** A new `INDEX_PLAYS` array in `strategy.js` is checked before the basic strategy tables when `trueCount` is a number (null/undefined → pure basic strategy, preserving all 121 existing tests). A new `src/sidebets.js` module is pure JS with no Electron dependency — exposed to the renderer via preload's contextBridge. The renderer calls both functions on each state update and renders a purple side-bet block that auto-hides once the first player card is entered.

**Tech Stack:** Node.js, Electron 32, Jest 29, vanilla JS renderer, contextBridge IPC.

---

## File Map

| File | Change |
|------|--------|
| `src/strategy.js` | Add `INDEX_PLAYS` array, `'INS'` action, `trueCount` param |
| `src/sidebets.js` | New — `getSideBetAdvice({ trueCount, dealerCard })` |
| `src/preload.js` | Expose `getSideBetAdvice` via contextBridge |
| `src/renderer/index.html` | Add `#side-bet-block` between deviation hints and card input |
| `src/renderer/style.css` | Add `.side-bet-block` purple styles |
| `src/renderer/app.js` | Pass `trueCount` to `getAdvice`; add `renderSideBetAdvice` |
| `test/strategy.test.js` | Add index-plays describe block (17 plays × 2 tests each + 2 compat) |
| `test/sidebets.test.js` | New — full coverage of `getSideBetAdvice` |

---

## Task 1: Add Illustrious 18 index plays to strategy.js

**Files:**
- Modify: `src/strategy.js`
- Modify: `test/strategy.test.js`

### Background

`getAdvice` is a pure function in `src/strategy.js`. Its current signature is `{ total, soft, pair, dealer }`. We add an optional `trueCount` param. When `typeof trueCount === 'number'`, we check `INDEX_PLAYS` before the basic strategy tables. When `trueCount` is null/undefined, we skip them entirely — preserving all 121 existing tests without any changes to those tests.

The `ACTION_INFO` map gets a new entry `'INS'` for the insurance index play.

The basic strategy tables (`HARD`, `SOFT`, `PAIRS`) and `normCard` helper are unchanged.

- [ ] **Step 1: Write the failing index-play tests**

Append this `describe` block to `test/strategy.test.js` (after the existing describes):

```js
describe('getAdvice — Illustrious 18 index plays (Hi-Lo 6-deck S17)', () => {
  // Backward compatibility: trueCount absent or null → pure basic strategy
  test('no trueCount → hard 16 vs T still SURRENDER', () => {
    expect(getAdvice({ total: 16, soft: false, pair: false, dealer: 't' }).label)
      .toBe('SURRENDER');
  });
  test('trueCount null → hard 16 vs T still SURRENDER', () => {
    expect(getAdvice({ total: 16, soft: false, pair: false, dealer: 't', trueCount: null }).label)
      .toBe('SURRENDER');
  });

  // #1 Insurance
  test('#1 dealer A, TC +3 → TAKE INSURANCE', () => {
    const r = getAdvice({ total: 16, soft: false, pair: false, dealer: 'a', trueCount: 3 });
    expect(r.action).toBe('INS');
    expect(r.label).toBe('TAKE INSURANCE');
    expect(r.color).toBe('#a855f7');
  });
  test('#1 TC +2 with dealer A → falls to basic strategy', () => {
    const r = getAdvice({ total: 16, soft: false, pair: false, dealer: 'a', trueCount: 2 });
    expect(r.action).not.toBe('INS');
  });

  // #2 Hard 16 vs T
  test('#2 hard 16 vs T, TC 0 → STAND', () => {
    expect(getAdvice({ total: 16, soft: false, pair: false, dealer: 't', trueCount: 0 }).label)
      .toBe('STAND');
  });
  test('#2 hard 16 vs T, TC -1 → SURRENDER (basic strategy)', () => {
    expect(getAdvice({ total: 16, soft: false, pair: false, dealer: 't', trueCount: -1 }).label)
      .toBe('SURRENDER');
  });

  // #3 Hard 15 vs T
  test('#3 hard 15 vs T, TC +4 → STAND', () => {
    expect(getAdvice({ total: 15, soft: false, pair: false, dealer: 't', trueCount: 4 }).label)
      .toBe('STAND');
  });
  test('#3 hard 15 vs T, TC +3 → SURRENDER (basic strategy)', () => {
    expect(getAdvice({ total: 15, soft: false, pair: false, dealer: 't', trueCount: 3 }).label)
      .toBe('SURRENDER');
  });

  // #4 T,T vs 5
  test('#4 pair T vs 5, TC +5 → SPLIT', () => {
    expect(getAdvice({ total: null, soft: false, pair: 't', dealer: '5', trueCount: 5 }).label)
      .toBe('SPLIT');
  });
  test('#4 pair T vs 5, TC +4 → STAND (basic strategy)', () => {
    expect(getAdvice({ total: null, soft: false, pair: 't', dealer: '5', trueCount: 4 }).label)
      .toBe('STAND');
  });

  // #5 T,T vs 6
  test('#5 pair T vs 6, TC +4 → SPLIT', () => {
    expect(getAdvice({ total: null, soft: false, pair: 't', dealer: '6', trueCount: 4 }).label)
      .toBe('SPLIT');
  });
  test('#5 pair T vs 6, TC +3 → STAND (basic strategy)', () => {
    expect(getAdvice({ total: null, soft: false, pair: 't', dealer: '6', trueCount: 3 }).label)
      .toBe('STAND');
  });

  // #6 Hard 10 vs T
  test('#6 hard 10 vs T, TC +4 → DOUBLE', () => {
    expect(getAdvice({ total: 10, soft: false, pair: false, dealer: 't', trueCount: 4 }).label)
      .toBe('DOUBLE');
  });
  test('#6 hard 10 vs T, TC +3 → HIT (basic strategy)', () => {
    expect(getAdvice({ total: 10, soft: false, pair: false, dealer: 't', trueCount: 3 }).label)
      .toBe('HIT');
  });

  // #7 Hard 12 vs 3
  test('#7 hard 12 vs 3, TC +2 → STAND', () => {
    expect(getAdvice({ total: 12, soft: false, pair: false, dealer: '3', trueCount: 2 }).label)
      .toBe('STAND');
  });
  test('#7 hard 12 vs 3, TC +1 → HIT (basic strategy)', () => {
    expect(getAdvice({ total: 12, soft: false, pair: false, dealer: '3', trueCount: 1 }).label)
      .toBe('HIT');
  });

  // #8 Hard 12 vs 2
  test('#8 hard 12 vs 2, TC +3 → STAND', () => {
    expect(getAdvice({ total: 12, soft: false, pair: false, dealer: '2', trueCount: 3 }).label)
      .toBe('STAND');
  });
  test('#8 hard 12 vs 2, TC +2 → HIT (basic strategy)', () => {
    expect(getAdvice({ total: 12, soft: false, pair: false, dealer: '2', trueCount: 2 }).label)
      .toBe('HIT');
  });

  // #9 Hard 11 vs A
  test('#9 hard 11 vs A, TC +1 → DOUBLE', () => {
    expect(getAdvice({ total: 11, soft: false, pair: false, dealer: 'a', trueCount: 1 }).label)
      .toBe('DOUBLE');
  });
  test('#9 hard 11 vs A, TC 0 → HIT (basic strategy)', () => {
    expect(getAdvice({ total: 11, soft: false, pair: false, dealer: 'a', trueCount: 0 }).label)
      .toBe('HIT');
  });

  // #10 Hard 9 vs 2
  test('#10 hard 9 vs 2, TC +1 → DOUBLE', () => {
    expect(getAdvice({ total: 9, soft: false, pair: false, dealer: '2', trueCount: 1 }).label)
      .toBe('DOUBLE');
  });
  test('#10 hard 9 vs 2, TC 0 → HIT (basic strategy)', () => {
    expect(getAdvice({ total: 9, soft: false, pair: false, dealer: '2', trueCount: 0 }).label)
      .toBe('HIT');
  });

  // #11 Hard 10 vs A
  test('#11 hard 10 vs A, TC +4 → DOUBLE', () => {
    expect(getAdvice({ total: 10, soft: false, pair: false, dealer: 'a', trueCount: 4 }).label)
      .toBe('DOUBLE');
  });
  test('#11 hard 10 vs A, TC +3 → HIT (basic strategy)', () => {
    expect(getAdvice({ total: 10, soft: false, pair: false, dealer: 'a', trueCount: 3 }).label)
      .toBe('HIT');
  });

  // #12 Hard 9 vs 7
  test('#12 hard 9 vs 7, TC +3 → DOUBLE', () => {
    expect(getAdvice({ total: 9, soft: false, pair: false, dealer: '7', trueCount: 3 }).label)
      .toBe('DOUBLE');
  });
  test('#12 hard 9 vs 7, TC +2 → HIT (basic strategy)', () => {
    expect(getAdvice({ total: 9, soft: false, pair: false, dealer: '7', trueCount: 2 }).label)
      .toBe('HIT');
  });

  // #13 Hard 16 vs 9
  test('#13 hard 16 vs 9, TC +5 → STAND', () => {
    expect(getAdvice({ total: 16, soft: false, pair: false, dealer: '9', trueCount: 5 }).label)
      .toBe('STAND');
  });
  test('#13 hard 16 vs 9, TC +4 → HIT (basic strategy)', () => {
    expect(getAdvice({ total: 16, soft: false, pair: false, dealer: '9', trueCount: 4 }).label)
      .toBe('HIT');
  });

  // #14 Hard 13 vs 2
  test('#14 hard 13 vs 2, TC -1 → HIT', () => {
    expect(getAdvice({ total: 13, soft: false, pair: false, dealer: '2', trueCount: -1 }).label)
      .toBe('HIT');
  });
  test('#14 hard 13 vs 2, TC 0 → STAND (basic strategy)', () => {
    expect(getAdvice({ total: 13, soft: false, pair: false, dealer: '2', trueCount: 0 }).label)
      .toBe('STAND');
  });

  // #15 Hard 12 vs 4
  test('#15 hard 12 vs 4, TC -1 → HIT', () => {
    expect(getAdvice({ total: 12, soft: false, pair: false, dealer: '4', trueCount: -1 }).label)
      .toBe('HIT');
  });
  test('#15 hard 12 vs 4, TC 0 → STAND (basic strategy)', () => {
    expect(getAdvice({ total: 12, soft: false, pair: false, dealer: '4', trueCount: 0 }).label)
      .toBe('STAND');
  });

  // #16 Hard 13 vs 3
  test('#16 hard 13 vs 3, TC -2 → HIT', () => {
    expect(getAdvice({ total: 13, soft: false, pair: false, dealer: '3', trueCount: -2 }).label)
      .toBe('HIT');
  });
  test('#16 hard 13 vs 3, TC -1 → STAND (basic strategy)', () => {
    expect(getAdvice({ total: 13, soft: false, pair: false, dealer: '3', trueCount: -1 }).label)
      .toBe('STAND');
  });

  // #17 Soft 19 (A+8) vs 6
  test('#17 soft 19 vs 6, TC +1 → DOUBLE', () => {
    expect(getAdvice({ total: 19, soft: true, pair: false, dealer: '6', trueCount: 1 }).label)
      .toBe('DOUBLE');
  });
  test('#17 soft 19 vs 6, TC 0 → STAND (basic strategy)', () => {
    expect(getAdvice({ total: 19, soft: true, pair: false, dealer: '6', trueCount: 0 }).label)
      .toBe('STAND');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test -- --testPathPattern=strategy
```

Expected: 36 new failures (index-play describe block), 121 existing tests still pass.

- [ ] **Step 3: Implement index plays in strategy.js**

Replace `src/strategy.js` entirely with:

```js
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
const SOFT = {
  13: ['H',  'H',  'H',  'D',  'D',  'H',  'H',  'H',  'H',  'H'],
  14: ['H',  'H',  'H',  'D',  'D',  'H',  'H',  'H',  'H',  'H'],
  15: ['H',  'H',  'D',  'D',  'D',  'H',  'H',  'H',  'H',  'H'],
  16: ['H',  'H',  'D',  'D',  'D',  'H',  'H',  'H',  'H',  'H'],
  17: ['H',  'D',  'D',  'D',  'D',  'H',  'H',  'H',  'H',  'H'],
  18: ['S',  'Ds', 'Ds', 'Ds', 'Ds', 'S',  'S',  'H',  'H',  'H'],
  19: ['S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S'],
  20: ['S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S'],
};

// Pairs (keyed by card value of one card in the pair)
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

const ACTION_INFO = {
  'H':   { label: 'HIT',            color: '#f59e0b' },
  'S':   { label: 'STAND',          color: '#3b82f6' },
  'D':   { label: 'DOUBLE',         color: '#22c55e' },
  'Ds':  { label: 'DOUBLE',         color: '#22c55e' },
  'R':   { label: 'SURRENDER',      color: '#ef4444' },
  'P':   { label: 'SPLIT',          color: '#22c55e' },
  'INS': { label: 'TAKE INSURANCE', color: '#a855f7' },
};

// Illustrious 18 index plays — Hi-Lo, 6-deck S17 (Schlesinger, Blackjack Attack)
// Evaluated in order; first match wins. Only active when trueCount is a number.
// ctx.dealer and ctx.pair are already normalised (j/q/k → t).
const INDEX_PLAYS = [
  // #1  Insurance: dealer A, TC ≥ +3
  { check: ({ dealer, trueCount }) =>
      dealer === 'a' && trueCount >= 3,
    action: 'INS' },
  // #2  Hard 16 vs T: TC ≥ 0 → Stand (was Surrender)
  { check: ({ total, soft, pair, dealer, trueCount }) =>
      !soft && !pair && total === 16 && dealer === 't' && trueCount >= 0,
    action: 'S' },
  // #3  Hard 15 vs T: TC ≥ +4 → Stand (was Surrender)
  { check: ({ total, soft, pair, dealer, trueCount }) =>
      !soft && !pair && total === 15 && dealer === 't' && trueCount >= 4,
    action: 'S' },
  // #4  T,T vs 5: TC ≥ +5 → Split (was Stand)
  { check: ({ pair, dealer, trueCount }) =>
      pair === 't' && dealer === '5' && trueCount >= 5,
    action: 'P' },
  // #5  T,T vs 6: TC ≥ +4 → Split (was Stand)
  { check: ({ pair, dealer, trueCount }) =>
      pair === 't' && dealer === '6' && trueCount >= 4,
    action: 'P' },
  // #6  Hard 10 vs T: TC ≥ +4 → Double (was Hit)
  { check: ({ total, soft, pair, dealer, trueCount }) =>
      !soft && !pair && total === 10 && dealer === 't' && trueCount >= 4,
    action: 'D' },
  // #7  Hard 12 vs 3: TC ≥ +2 → Stand (was Hit)
  { check: ({ total, soft, pair, dealer, trueCount }) =>
      !soft && !pair && total === 12 && dealer === '3' && trueCount >= 2,
    action: 'S' },
  // #8  Hard 12 vs 2: TC ≥ +3 → Stand (was Hit)
  { check: ({ total, soft, pair, dealer, trueCount }) =>
      !soft && !pair && total === 12 && dealer === '2' && trueCount >= 3,
    action: 'S' },
  // #9  Hard 11 vs A: TC ≥ +1 → Double (was Hit)
  { check: ({ total, soft, pair, dealer, trueCount }) =>
      !soft && !pair && total === 11 && dealer === 'a' && trueCount >= 1,
    action: 'D' },
  // #10 Hard 9 vs 2: TC ≥ +1 → Double (was Hit)
  { check: ({ total, soft, pair, dealer, trueCount }) =>
      !soft && !pair && total === 9 && dealer === '2' && trueCount >= 1,
    action: 'D' },
  // #11 Hard 10 vs A: TC ≥ +4 → Double (was Hit)
  { check: ({ total, soft, pair, dealer, trueCount }) =>
      !soft && !pair && total === 10 && dealer === 'a' && trueCount >= 4,
    action: 'D' },
  // #12 Hard 9 vs 7: TC ≥ +3 → Double (was Hit)
  { check: ({ total, soft, pair, dealer, trueCount }) =>
      !soft && !pair && total === 9 && dealer === '7' && trueCount >= 3,
    action: 'D' },
  // #13 Hard 16 vs 9: TC ≥ +5 → Stand (was Hit)
  { check: ({ total, soft, pair, dealer, trueCount }) =>
      !soft && !pair && total === 16 && dealer === '9' && trueCount >= 5,
    action: 'S' },
  // #14 Hard 13 vs 2: TC ≤ −1 → Hit (was Stand)
  { check: ({ total, soft, pair, dealer, trueCount }) =>
      !soft && !pair && total === 13 && dealer === '2' && trueCount <= -1,
    action: 'H' },
  // #15 Hard 12 vs 4: TC ≤ −1 → Hit (was Stand)
  { check: ({ total, soft, pair, dealer, trueCount }) =>
      !soft && !pair && total === 12 && dealer === '4' && trueCount <= -1,
    action: 'H' },
  // #16 Hard 13 vs 3: TC ≤ −2 → Hit (was Stand)
  { check: ({ total, soft, pair, dealer, trueCount }) =>
      !soft && !pair && total === 13 && dealer === '3' && trueCount <= -2,
    action: 'H' },
  // #17 Soft 19 (A+8) vs 6: TC ≥ +1 → Double (was Stand)
  { check: ({ total, soft, pair, dealer, trueCount }) =>
      soft && !pair && total === 19 && dealer === '6' && trueCount >= 1,
    action: 'D' },
];

function normCard(c) {
  const s = String(c).toLowerCase();
  return ['j', 'q', 'k'].includes(s) ? 't' : s;
}

/**
 * Look up optimal play for 6-deck S17 blackjack. When trueCount is a number,
 * Illustrious 18 index plays override basic strategy where applicable.
 * When trueCount is null/undefined, falls through to pure basic strategy.
 * @param {{ total: number|null, soft: boolean, pair: string|false, dealer: string|null, trueCount?: number|null }} hand
 * @returns {{ action: string, label: string, color: string }|null}
 */
function getAdvice({ total, soft, pair, dealer, trueCount }) {
  if (!dealer) return null;

  const d   = normCard(dealer);
  const col = DEALERS.indexOf(d);
  if (col === -1) return null;

  // Illustrious 18 index plays — only when trueCount is a number
  if (typeof trueCount === 'number') {
    const normPair = pair ? normCard(pair) : false;
    const ctx = { total, soft, pair: normPair, dealer: d, trueCount };
    for (const play of INDEX_PLAYS) {
      if (play.check(ctx)) {
        const info = ACTION_INFO[play.action];
        return { action: play.action, label: info.label, color: info.color };
      }
    }
  }

  // Basic strategy tables (unchanged)
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
    if (total <= 7)        action = 'H';
    else if (total >= 17)  action = 'S';
    else action = HARD[total]?.[col];
  }

  if (!action) return null;
  const info = ACTION_INFO[action];
  if (!info) return null;
  return { action, label: info.label, color: info.color };
}

module.exports = { getAdvice };
```

- [ ] **Step 4: Run all tests to confirm all pass**

```
npm test -- --testPathPattern=strategy
```

Expected: all 157 strategy tests pass (121 existing + 36 new).

- [ ] **Step 5: Commit**

```
git add src/strategy.js test/strategy.test.js
git commit -m "feat: Illustrious 18 index plays in getAdvice (trueCount param)"
```

---

## Task 2: Create sidebets.js module

**Files:**
- Create: `src/sidebets.js`
- Create: `test/sidebets.test.js`

### Background

`getSideBetAdvice` is a pure function — no Electron dependency. It takes `{ trueCount, dealerCard }` and returns an array of `{ name, reason }` objects for each currently favorable side bet. Returns `[]` when none are favorable or trueCount is not a number.

Thresholds (Hi-Lo 6-deck research):
- Insurance: `dealerCard === 'a' && trueCount >= 3`
- Bust It: `trueCount >= 3`
- 21+3: `trueCount >= 8`

- [ ] **Step 1: Write the failing sidebets tests**

Create `test/sidebets.test.js`:

```js
const { getSideBetAdvice } = require('../src/sidebets');

describe('getSideBetAdvice', () => {
  test('TC < 3 → empty array', () => {
    expect(getSideBetAdvice({ trueCount: 2, dealerCard: 'a' })).toEqual([]);
  });

  test('TC 0 → empty array', () => {
    expect(getSideBetAdvice({ trueCount: 0, dealerCard: null })).toEqual([]);
  });

  test('trueCount null → empty array', () => {
    expect(getSideBetAdvice({ trueCount: null, dealerCard: 'a' })).toEqual([]);
  });

  test('trueCount undefined → empty array', () => {
    expect(getSideBetAdvice({ trueCount: undefined, dealerCard: 'a' })).toEqual([]);
  });

  test('TC +3 with dealer non-A → Bust It only (no Insurance)', () => {
    const result = getSideBetAdvice({ trueCount: 3, dealerCard: 't' });
    const names = result.map(b => b.name);
    expect(names).toContain('Bust It');
    expect(names).not.toContain('Insurance');
    expect(names).not.toContain('21+3');
  });

  test('TC +3 with dealer A → Insurance and Bust It', () => {
    const result = getSideBetAdvice({ trueCount: 3, dealerCard: 'a' });
    const names = result.map(b => b.name);
    expect(names).toContain('Insurance');
    expect(names).toContain('Bust It');
    expect(names).not.toContain('21+3');
  });

  test('TC +3 with null dealer → Bust It only', () => {
    const result = getSideBetAdvice({ trueCount: 3, dealerCard: null });
    const names = result.map(b => b.name);
    expect(names).toContain('Bust It');
    expect(names).not.toContain('Insurance');
  });

  test('TC +8 with dealer A → Insurance, Bust It, and 21+3 all shown', () => {
    const result = getSideBetAdvice({ trueCount: 8, dealerCard: 'a' });
    const names = result.map(b => b.name);
    expect(names).toContain('Insurance');
    expect(names).toContain('Bust It');
    expect(names).toContain('21+3');
  });

  test('TC +7 → Bust It only (21+3 not yet triggered)', () => {
    const result = getSideBetAdvice({ trueCount: 7, dealerCard: null });
    const names = result.map(b => b.name);
    expect(names).toContain('Bust It');
    expect(names).not.toContain('21+3');
  });

  test('each returned bet has name and reason properties', () => {
    const result = getSideBetAdvice({ trueCount: 8, dealerCard: 'a' });
    expect(result.length).toBeGreaterThan(0);
    result.forEach(b => {
      expect(typeof b.name).toBe('string');
      expect(typeof b.reason).toBe('string');
    });
  });

  test('Insurance reason mentions TC and dealer A', () => {
    const result = getSideBetAdvice({ trueCount: 3, dealerCard: 'a' });
    const ins = result.find(b => b.name === 'Insurance');
    expect(ins.reason).toMatch(/TC/);
    expect(ins.reason).toMatch(/\+3/);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test -- --testPathPattern=sidebets
```

Expected: all 11 tests fail with "Cannot find module '../src/sidebets'".

- [ ] **Step 3: Implement sidebets.js**

Create `src/sidebets.js`:

```js
'use strict';

/**
 * Returns side bets that are currently favorable based on the Hi-Lo true count.
 * Call this before the hand starts (playerCards.length === 0).
 * Returns an empty array when no bets are favorable or trueCount is not a number.
 *
 * Thresholds (Hi-Lo 6-deck published research):
 *   Insurance  — dealer A + TC ≥ +3  (EV positive above this threshold)
 *   Bust It    — TC ≥ +3             (ten-rich shoe increases dealer bust probability)
 *   21+3       — TC ≥ +8             (poker hand combinations improve in very ten-heavy shoes)
 *
 * @param {{ trueCount: number|null|undefined, dealerCard: string|null }} opts
 * @returns {Array<{ name: string, reason: string }>}
 */
function getSideBetAdvice({ trueCount, dealerCard }) {
  if (typeof trueCount !== 'number') return [];

  const bets = [];

  if (dealerCard === 'a' && trueCount >= 3) {
    bets.push({ name: 'Insurance', reason: 'TC ≥ +3 with dealer A' });
  }

  if (trueCount >= 3) {
    bets.push({ name: 'Bust It', reason: 'TC ≥ +3' });
  }

  if (trueCount >= 8) {
    bets.push({ name: '21+3', reason: 'TC ≥ +8' });
  }

  return bets;
}

module.exports = { getSideBetAdvice };
```

- [ ] **Step 4: Run tests to confirm all pass**

```
npm test -- --testPathPattern=sidebets
```

Expected: all 11 tests pass.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```
npm test
```

Expected: all tests pass (no regressions).

- [ ] **Step 6: Commit**

```
git add src/sidebets.js test/sidebets.test.js
git commit -m "feat: getSideBetAdvice module — Insurance/Bust It/21+3 thresholds"
```

---

## Task 3: Expose getSideBetAdvice in preload.js

**Files:**
- Modify: `src/preload.js`

### Background

`getSideBetAdvice` is pure computation — no IPC round-trip needed. The preload exposes it the same way `getAdvice` is exposed: `require` the module and call it synchronously via contextBridge.

No new tests needed here (covered by the unit tests in Task 2 and the end-to-end rendering in Task 5).

- [ ] **Step 1: Update preload.js**

In `src/preload.js`, add `getSideBetAdvice` to the `contextBridge.exposeInMainWorld` object. The complete updated file:

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
  getSideBetAdvice: (trueCount, dealerCard) => {
    const { getSideBetAdvice } = require('./sidebets');
    return getSideBetAdvice({ trueCount, dealerCard });
  },
});
```

- [ ] **Step 2: Run the full test suite to confirm no regressions**

```
npm test
```

Expected: all tests pass (preload.js has no unit tests; regressions would show up in counter/strategy/sidebets tests).

- [ ] **Step 3: Commit**

```
git add src/preload.js
git commit -m "feat: expose getSideBetAdvice via contextBridge preload"
```

---

## Task 4: Add side-bet block to HTML and CSS

**Files:**
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/style.css`

### Background

Add `#side-bet-block` between `#hand-advice-block` and `.card-input-section` in the expanded view. The block is hidden by default (`hidden` class) and rendered dynamically by `app.js` in Task 5.

The inner `#side-bet-rows` div is populated by JavaScript; no static content needed.

Purple accent: `#a855f7` (distinct from strategy blue `#3b82f6` and count amber `#f59e0b`).

- [ ] **Step 1: Add the side-bet block to index.html**

In `src/renderer/index.html`, locate the line:

```html
      <!-- ── Card input section ── -->
      <div class="card-input-section">
```

Insert the following block **immediately before** that line:

```html
      <!-- ── Side bet block (shown pre-hand when bets are favorable) ── -->
      <div id="side-bet-block" class="side-bet-block hidden">
        <div class="side-bet-header">
          <span class="side-bet-icon">🎰</span>
          <span class="label-xs side-bet-title">Side Bets</span>
        </div>
        <div id="side-bet-rows"></div>
      </div>
```

- [ ] **Step 2: Add side-bet CSS to style.css**

Append to the end of `src/renderer/style.css`:

```css
/* ── Side bet block ── */
.side-bet-block {
  background: #a855f718;
  border: 1px solid #a855f744;
  border-radius: 9px;
  padding: 7px 10px;
  margin-bottom: 6px;
}

.side-bet-header {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 5px;
}

.side-bet-icon {
  font-size: 13px;
}

.side-bet-title {
  color: #a855f7;
}

.side-bet-row {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  color: #a855f7;
  margin-bottom: 3px;
}

.side-bet-row:last-child {
  margin-bottom: 0;
}

.side-bet-reason {
  font-size: 9px;
  font-weight: 400;
  color: #9333ea;
  margin-left: 2px;
}
```

- [ ] **Step 3: Confirm the full test suite still passes**

```
npm test
```

Expected: all tests pass (HTML/CSS changes don't affect Jest unit tests).

- [ ] **Step 4: Commit**

```
git add src/renderer/index.html src/renderer/style.css
git commit -m "feat: add side-bet block element and purple CSS styles"
```

---

## Task 5: Wire up trueCount and renderSideBetAdvice in app.js

**Files:**
- Modify: `src/renderer/app.js`

### Background

Two changes to `app.js`:

1. **Pass `trueCount` to `getAdvice`** — in `renderHandDisplay(s)`, the existing `window.api.getAdvice` call receives a hand object. Add `trueCount: s.trueCount` to that object. `s.trueCount` is always a number (from `counter.getState()`, rounded to 1 decimal).

2. **Add `renderSideBetAdvice(s)`** — new function that calls `window.api.getSideBetAdvice(s.trueCount, s.dealerCard)`. If `playerCards.length > 0` or the result is empty, hide `#side-bet-block`. Otherwise populate `#side-bet-rows` with a row per bet and show the block. Call this from `renderState(s)`.

No new DOM elements need to be queried beyond `#side-bet-block` and `#side-bet-rows`.

- [ ] **Step 1: Add DOM refs for the side-bet block**

In `src/renderer/app.js`, find the existing DOM refs block (lines starting with `const strategyBlock = ...`). Add two new lines immediately after `const reshuffleBtn`:

```js
const sideBetBlock      = document.getElementById('side-bet-block');
const sideBetRowsEl     = document.getElementById('side-bet-rows');
```

- [ ] **Step 2: Pass trueCount to getAdvice in renderHandDisplay**

In `renderHandDisplay(s)`, locate the existing `window.api.getAdvice` call:

```js
    const advice = window.api.getAdvice({
      total:  info.total,
      soft:   info.soft,
      pair:   info.pair,
      dealer: dealerCard,
    });
```

Replace it with:

```js
    const advice = window.api.getAdvice({
      total:     info.total,
      soft:      info.soft,
      pair:      info.pair,
      dealer:    dealerCard,
      trueCount: s.trueCount,
    });
```

- [ ] **Step 3: Add renderSideBetAdvice function**

Add this function after the `renderHandDisplay` function (before `setExpanded`):

```js
function renderSideBetAdvice(s) {
  // Hide once the hand has started
  if (s.playerCards && s.playerCards.length > 0) {
    sideBetBlock.classList.add('hidden');
    return;
  }

  const bets = window.api.getSideBetAdvice(s.trueCount, s.dealerCard);
  if (!bets || bets.length === 0) {
    sideBetBlock.classList.add('hidden');
    return;
  }

  sideBetRowsEl.innerHTML = bets
    .map(b => `<div class="side-bet-row">✅ <span>${b.name}</span><span class="side-bet-reason">${b.reason}</span></div>`)
    .join('');
  sideBetBlock.classList.remove('hidden');
}
```

- [ ] **Step 4: Call renderSideBetAdvice from renderState**

In `renderState(s)`, find the last line of the function:

```js
  // Hand displays + strategy advice
  renderHandDisplay(s);
```

Add a call to `renderSideBetAdvice` immediately after:

```js
  // Hand displays + strategy advice
  renderHandDisplay(s);

  // Side bet advice (pre-hand only)
  renderSideBetAdvice(s);
```

- [ ] **Step 5: Run the full test suite to confirm all pass**

```
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```
git add src/renderer/app.js
git commit -m "feat: pass trueCount to getAdvice; render side-bet block pre-hand"
```

---

## Final check

After all 5 tasks are committed, run the full test suite one last time:

```
npm test
```

Expected output: all tests pass, no failures.

The app can be launched with `npm start` to verify the UI:
- Strategy block shows count-adjusted advice (e.g. Hard 16 vs T + TC ≥ 0 shows STAND instead of SURRENDER)
- Side-bet block appears in purple when TC ≥ +3 and no player cards are entered
- Side-bet block auto-hides once the first player card is entered
- Existing basic strategy advice is unchanged when the count is neutral
