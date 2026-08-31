'use strict';

const COSMIC_CAFE = {
  k: 3,
  stickers: [
    {id:'FROST',   warmth:1,   sparkle:1},
    {id:'MIST',    warmth:3,   sparkle:2},
    {id:'DAWN',    warmth:1,   sparkle:3},
    {id:'SUNRISE', warmth:5,   sparkle:3.5},
    {id:'AURORA',  warmth:1,   sparkle:9},
    {id:'PULSE',   warmth:3,   sparkle:8},
    {id:'FLARE',   warmth:2,   sparkle:7},
    {id:'GLOW',    warmth:6,   sparkle:4},
    {id:'SPARK',   warmth:7,   sparkle:4},
    {id:'BLAZE',   warmth:6.5, sparkle:3.5},
  ],
  centres: [
    {id:'NEBULA', warmth:2, sparkle:2},
    {id:'COMET',  warmth:2, sparkle:8},
    {id:'EMBER',  warmth:8, sparkle:5},
  ],
};

if (typeof module !== 'undefined' && module.exports) { module.exports = { COSMIC_CAFE }; }
if (typeof window !== 'undefined') { window.COSMIC_CAFE = COSMIC_CAFE; }
