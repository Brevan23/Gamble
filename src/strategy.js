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
  'H':  { label: 'HIT',       color: '#f59e0b' },
  'S':  { label: 'STAND',     color: '#3b82f6' },
  'D':  { label: 'DOUBLE',    color: '#22c55e' },
  'Ds': { label: 'DOUBLE',    color: '#22c55e' },
  'R':  { label: 'SURRENDER', color: '#ef4444' },
  'P':  { label: 'SPLIT',     color: '#22c55e' },
};

function normCard(c) {
  const s = String(c).toLowerCase();
  return ['j', 'q', 'k'].includes(s) ? 't' : s;
}

/**
 * Look up basic strategy for 6-deck S17 blackjack.
 * @param {{ total: number|null, soft: boolean, pair: string|false, dealer: string|null }} hand
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
