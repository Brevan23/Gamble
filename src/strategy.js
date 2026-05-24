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
  13: ['H',  'H',  'H',  'D',  'D',  'H',  'H',  'H',  'H',  'H'], // A+2
  14: ['H',  'H',  'H',  'D',  'D',  'H',  'H',  'H',  'H',  'H'], // A+3
  15: ['H',  'H',  'D',  'D',  'D',  'H',  'H',  'H',  'H',  'H'], // A+4
  16: ['H',  'H',  'D',  'D',  'D',  'H',  'H',  'H',  'H',  'H'], // A+5
  17: ['H',  'D',  'D',  'D',  'D',  'H',  'H',  'H',  'H',  'H'], // A+6
  18: ['S',  'Ds', 'Ds', 'Ds', 'Ds', 'S',  'S',  'H',  'H',  'H'], // A+7
  19: ['S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S'], // A+8
  20: ['S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S',  'S'], // A+9
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
  // #1  Insurance: dealer A, TC ≥ +3 → Take insurance (any hand)
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
