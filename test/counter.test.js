const Counter = require('../src/counter');

describe('Counter — initialisation', () => {
  test('starts at zero with default 6 decks', () => {
    const c = new Counter();
    expect(c.runningCount).toBe(0);
    expect(c.cardsSeen).toBe(0);
    expect(c.totalDecks).toBe(6);
  });

  test('accepts custom deck count', () => {
    const c = new Counter(8);
    expect(c.totalDecks).toBe(8);
  });
});

describe('Counter — logCard', () => {
  test.each(['2','3','4','5','6'])('low card "%s" increments count by 1', (key) => {
    const c = new Counter();
    c.logCard(key);
    expect(c.runningCount).toBe(1);
    expect(c.cardsSeen).toBe(1);
  });

  test.each(['7','8','9'])('neutral card "%s" does not change count', (key) => {
    const c = new Counter();
    c.logCard(key);
    expect(c.runningCount).toBe(0);
    expect(c.cardsSeen).toBe(1);
  });

  test.each(['t','j','q','k','a','T','J','Q','K','A'])('high card "%s" decrements count by 1', (key) => {
    const c = new Counter();
    c.logCard(key);
    expect(c.runningCount).toBe(-1);
    expect(c.cardsSeen).toBe(1);
  });
});

describe('Counter — derived values', () => {
  test('decksRemaining decreases as cards are seen', () => {
    const c = new Counter(6);
    for (let i = 0; i < 52; i++) c.logCard('7');
    expect(c.decksRemaining).toBeCloseTo(5.0, 1);
  });

  test('trueCount = runningCount / decksRemaining', () => {
    const c = new Counter(6);
    for (let i = 0; i < 10; i++) c.logCard('2');
    for (let i = 0; i < 52; i++) c.logCard('7');
    expect(c.trueCount).toBeCloseTo(10 / ((312 - 62) / 52), 1);
  });

  test('decksRemaining never goes below 0.5', () => {
    const c = new Counter(1);
    for (let i = 0; i < 60; i++) c.logCard('7');
    expect(c.decksRemaining).toBe(0.5);
  });
});

describe('Counter — betAdvice', () => {
  function forceTC(c, targetTC) {
    for (let i = 0; i < 260; i++) c.logCard('7');
    const needed = Math.round(targetTC * c.decksRemaining);
    for (let i = 0; i < Math.abs(needed); i++) {
      c.logCard(needed >= 0 ? '2' : 't');
    }
  }

  test('TC >= 2 returns level "high"', () => {
    const c = new Counter(6);
    forceTC(c, 2.5);
    expect(c.betAdvice.level).toBe('high');
    expect(c.betAdvice.label).toBe('Raise 2–3×');
  });

  test('TC 1–1.9 returns level "medium"', () => {
    const c = new Counter(6);
    forceTC(c, 1.3);
    expect(c.betAdvice.level).toBe('medium');
    expect(c.betAdvice.label).toBe('Raise slightly');
  });

  test('TC 0–0.9 returns level "neutral"', () => {
    const c = new Counter(6);
    expect(c.betAdvice.level).toBe('neutral');
    expect(c.betAdvice.label).toBe('Table minimum');
  });

  test('TC < 0 returns level "low"', () => {
    const c = new Counter(6);
    forceTC(c, -1.5);
    expect(c.betAdvice.level).toBe('low');
    expect(c.betAdvice.label).toBe('Sit out / minimum');
  });
});

describe('Counter — handAdvice', () => {
  test('returns null when TC is between -1 and +1', () => {
    const c = new Counter(6);
    expect(c.handAdvice).toBeNull();
  });

  test('returns insurance hint at TC >= 3', () => {
    const c = new Counter(6);
    for (let i = 0; i < 260; i++) c.logCard('7');
    for (let i = 0; i < Math.round(3 * c.decksRemaining) + 1; i++) c.logCard('2');
    expect(c.handAdvice).toMatch(/Insurance/);
  });
});

describe('Counter — reset / setDecks', () => {
  test('reset clears runningCount and cardsSeen', () => {
    const c = new Counter();
    c.logCard('2'); c.logCard('5'); c.logCard('k');
    c.reset();
    expect(c.runningCount).toBe(0);
    expect(c.cardsSeen).toBe(0);
  });

  test('setDecks changes totalDecks and resets state', () => {
    const c = new Counter(6);
    c.logCard('2');
    c.setDecks(8);
    expect(c.totalDecks).toBe(8);
    expect(c.runningCount).toBe(0);
    expect(c.cardsSeen).toBe(0);
  });

  test('getState returns a plain object snapshot', () => {
    const c = new Counter(6);
    c.logCard('2');
    const s = c.getState();
    expect(s).toMatchObject({
      runningCount: 1,
      cardsSeen: 1,
      totalDecks: 6,
    });
    expect(typeof s.decksRemaining).toBe('number');
    expect(typeof s.trueCount).toBe('number');
    expect(typeof s.betAdvice).toBe('object');
  });
});
