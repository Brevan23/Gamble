// src/settings.js
'use strict';

const Store = require('electron-store');

const store = new Store({
  name: 'card-counter-settings',
  defaults: {
    totalDecks:  6,
    handAdvice:  true,
    autoExpand:  true,
    opacity:     100,
    position:    null,   // { x, y } — null means default bottom-right
  },
});

module.exports = {
  get:    (key)        => store.get(key),
  set:    (key, value) => store.set(key, value),
  getAll: ()           => store.store,   // returns a plain object copy
};
