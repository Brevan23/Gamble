// test/detector.test.js
// Tests only the pure normaliseToken function.
// detectCards itself requires a real image + Tesseract worker — tested manually.

const { normaliseToken } = require('../src/capture/detector');

describe('normaliseToken', () => {
  test.each([
    ['A',    'a'],
    ['a',    'a'],
    ['Ace',  'a'],
    ['ace',  'a'],
    ['K',    'k'],
    ['King', 'k'],
    ['Q',    'q'],
    ['J',    'j'],
    ['10',   't'],
    ['T',    't'],
    ['t',    't'],
    ['2',    '2'],
    ['3',    '3'],
    ['4',    '4'],
    ['5',    '5'],
    ['6',    '6'],
    ['7',    '7'],
    ['8',    '8'],
    ['9',    '9'],
  ])('normalises "%s" → "%s"', (input, expected) => {
    expect(normaliseToken(input)).toBe(expected);
  });

  test.each(['X', '', 'Z', '11', 'Joker'])('returns null for unrecognised token "%s"', (input) => {
    expect(normaliseToken(input)).toBeNull();
  });
});
