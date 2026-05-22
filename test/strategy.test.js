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
