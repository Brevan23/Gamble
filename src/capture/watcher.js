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
