// src/assets/make-icon.js
const fs = require('fs');
const path = require('path');

// Minimal valid 16x16 PNG (base64-encoded)
const BASE64_PNG = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAWklEQVQ4T2NkIAIwEqmHgWoGnDt37n9MTAyRJqSkpBClH6sBFy5cYGBkZGQkygAGBgaGy5cvM6AYQEtLIANevHjBgGIALS2BDHjx4gUDigG0tAQy4MWLFwDgFhERL9lwqQAAAABJRU5ErkJggg==';

fs.writeFileSync(
  path.join(__dirname, 'tray.png'),
  Buffer.from(BASE64_PNG, 'base64')
);
console.log('tray.png written');
