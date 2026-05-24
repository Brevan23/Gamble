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
  test('trueCount NaN → hard 16 vs T still SURRENDER (NaN comparisons all false)', () => {
    expect(getAdvice({ total: 16, soft: false, pair: false, dealer: 't', trueCount: NaN }).label)
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
  // Note: insurance (#1) fires for any hand vs dealer A at TC ≥ +3, masking #11 at TC ≥ 4
  test('#11 hard 10 vs A, TC +4 → TAKE INSURANCE (insurance takes priority)', () => {
    expect(getAdvice({ total: 10, soft: false, pair: false, dealer: 'a', trueCount: 4 }).label)
      .toBe('TAKE INSURANCE');
  });
  test('#11 hard 10 vs A, TC +3 → TAKE INSURANCE (insurance takes priority)', () => {
    expect(getAdvice({ total: 10, soft: false, pair: false, dealer: 'a', trueCount: 3 }).label)
      .toBe('TAKE INSURANCE');
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
  test('#13 hard 16 vs 9, TC +4 → SURRENDER (basic strategy)', () => {
    expect(getAdvice({ total: 16, soft: false, pair: false, dealer: '9', trueCount: 4 }).label)
      .toBe('SURRENDER');
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
