'use strict';

const EMPTY_PANEL = {
  k: 2,
  stickers: [
    {id:'LEFT_A', warmth:1, sparkle:1},
    {id:'LEFT_B', warmth:2, sparkle:2},
    {id:'LEFT_C', warmth:3, sparkle:1},
  ],
  centres: [
    {id:'HOME',  warmth:1, sparkle:1},
    {id:'EXILE', warmth:9, sparkle:9},
  ],
};

if (typeof module !== 'undefined' && module.exports) { module.exports = { EMPTY_PANEL }; }
if (typeof window !== 'undefined') { window.EMPTY_PANEL = EMPTY_PANEL; }
