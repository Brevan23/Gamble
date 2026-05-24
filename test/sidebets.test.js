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
