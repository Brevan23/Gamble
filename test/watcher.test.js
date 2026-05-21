// test/watcher.test.js
const { diffRanks } = require('../src/capture/watcher');

describe('diffRanks — multiset subtraction', () => {
  test('returns empty when nothing new', () => {
    expect(diffRanks(['a', 'k'], ['a', 'k'])).toEqual([]);
  });

  test('returns new card when one added', () => {
    expect(diffRanks(['a', 'k'], ['a', 'k', '5'])).toEqual(['5']);
  });

  test('returns both new cards when two added', () => {
    expect(diffRanks(['a'], ['a', 'k', '5'])).toEqual(['k', '5']);
  });

  test('handles duplicate correctly — one prev, two current', () => {
    expect(diffRanks(['5'], ['5', '5'])).toEqual(['5']);
  });

  test('handles duplicate correctly — two prev, three current', () => {
    expect(diffRanks(['5', '5'], ['5', '5', '5'])).toEqual(['5']);
  });

  test('returns all when prev is empty', () => {
    expect(diffRanks([], ['a', 'k'])).toEqual(['a', 'k']);
  });

  test('returns empty when both empty', () => {
    expect(diffRanks([], [])).toEqual([]);
  });

  test('returns empty when cards removed (hand cleared)', () => {
    expect(diffRanks(['a', 'k', '5'], ['a'])).toEqual([]);
  });

  test('real deal scenario: new card appears mid-hand', () => {
    expect(diffRanks(['a', 'k'], ['a', 'k', '7'])).toEqual(['7']);
  });
});
