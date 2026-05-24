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

    // Only count cards that are not dealer cards
    if (target !== 'dealer') {
      if (LOW.has(k))       this.runningCount += 1;
      else if (HIGH.has(k)) this.runningCount -= 1;
    }
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
