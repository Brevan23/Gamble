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
