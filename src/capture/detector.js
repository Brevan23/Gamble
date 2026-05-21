// src/capture/detector.js
'use strict';

// Rank token normalisation — maps OCR output to Counter key format
const RANK_MAP = {
  'a': 'a', 'ace': 'a',
  'k': 'k', 'king': 'k',
  'q': 'q', 'queen': 'q',
  'j': 'j', 'jack': 'j',
  '10': 't', 't': 't',
  '2': '2', '3': '3', '4': '4', '5': '5',
  '6': '6', '7': '7', '8': '8', '9': '9',
};

// Pure normalisation — exported for testing
function normaliseToken(token) {
  return RANK_MAP[String(token).toLowerCase().trim()] || null;
}

// Tesseract config — sparse text mode, restrict charset to card rank characters
const TESSERACT_PARAMS = {
  tessedit_char_whitelist: 'AaKkQqJjTt0123456789',
  tessedit_pageseg_mode: '11',   // PSM 11: sparse text, find as many text chunks as possible
};

let worker = null;

async function getWorker() {
  if (!worker) {
    // Lazy-require so this module can be require()'d in Jest without loading Tesseract
    const { createWorker } = require('tesseract.js');
    worker = await createWorker('eng');
    await worker.setParameters(TESSERACT_PARAMS);
  }
  return worker;
}

/**
 * Run OCR on a PNG buffer and return an array of normalised rank strings.
 * May contain duplicates (e.g. ['5','5'] if two 5s are visible).
 * Words with confidence < 60 are discarded.
 *
 * @param {Buffer} imageBuffer  PNG buffer of the captured region
 * @returns {Promise<string[]>} e.g. ['a', 'k', '5']
 */
async function detectCards(imageBuffer) {
  const w = await getWorker();
  const { data } = await w.recognize(imageBuffer);

  const ranks = [];
  for (const word of data.words) {
    if (word.confidence < 60) continue;
    const rank = normaliseToken(word.text);
    if (rank) ranks.push(rank);
  }

  return ranks;
}

/**
 * Terminate the Tesseract worker. Call on app quit.
 */
async function destroyWorker() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}

module.exports = { detectCards, destroyWorker, normaliseToken };
