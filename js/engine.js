/**
 * engine.js — Pure K-Means engine for the Sticker Wall K-Means Curator.
 *
 * RULES (do not violate):
 *  - Zero DOM references. Node-require-able and browser-window-attachable.
 *  - All comparisons use unrounded full-precision floats.
 *  - Tie-break: earlier centre in source order wins (EPS = 1e-12).
 *  - Empty panel: previous centre coordinates preserved exactly. No NaN.
 *  - Signature: centre IDs joined in sticker source order, separated by "|".
 *  - runIteration: Assign -> Update -> Measure only. No convergence check.
 *  - isConverged: iteration 0 always returns false.
 *  - All returned values are new objects; inputs are never mutated.
 */

'use strict';

const EPS = 1e-12;

// ---------------------------------------------------------------------------
// validate
// ---------------------------------------------------------------------------
function validate(collection) {
  const errors = [];

  if (!collection || typeof collection !== 'object') {
    errors.push({ code: 'INVALID_INPUT', message: 'Collection must be an object.' });
    return { ok: false, errors };
  }

  const { k, stickers, centres } = collection;

  // Validate k
  if (!Number.isInteger(k) || k < 2 || k > 4) {
    errors.push({ code: 'INVALID_K', message: 'k must be an integer between 2 and 4 inclusive; got ' + k + '.' });
  }

  // Validate stickers array
  if (!Array.isArray(stickers)) {
    errors.push({ code: 'INVALID_STICKERS', message: 'stickers must be an array.' });
    return { ok: errors.length === 0, errors };
  }

  if (stickers.length < 2 || stickers.length > 30) {
    errors.push({ code: 'STICKER_COUNT', message: 'sticker count must be 2-30; got ' + stickers.length + '.' });
  }

  if (Number.isInteger(k) && k >= 2 && k <= 4 && stickers.length < k) {
    errors.push({ code: 'K_EXCEEDS_STICKERS', message: 'k (' + k + ') exceeds sticker count (' + stickers.length + ').' });
  }

  // Validate each sticker
  const seenStickerIds = new Set();
  for (const s of stickers) {
    if (!s || typeof s !== 'object') {
      errors.push({ code: 'INVALID_STICKER', message: 'Each sticker must be an object.' });
      continue;
    }
    if (typeof s.id !== 'string' || s.id.trim() === '') {
      errors.push({ code: 'EMPTY_ID', message: 'Sticker ID must be a non-empty string.', ref: String(s.id) });
    } else if (seenStickerIds.has(s.id)) {
      errors.push({ code: 'DUPLICATE_STICKER_ID', message: 'Duplicate sticker ID: "' + s.id + '".', ref: s.id });
    } else {
      seenStickerIds.add(s.id);
    }
    for (const coord of ['warmth', 'sparkle']) {
      const v = s[coord];
      if (!Number.isFinite(v)) {
        errors.push({ code: 'NON_FINITE_COORD', message: 'Sticker "' + s.id + '" has non-finite ' + coord + ': ' + v + '.', ref: s.id });
      } else if (v < 0 || v > 10) {
        errors.push({ code: 'COORD_OUT_OF_RANGE', message: 'Sticker "' + s.id + '" has ' + coord + ' outside [0,10]: ' + v + '.', ref: s.id });
      }
    }
  }

  // Validate centres array
  if (!Array.isArray(centres)) {
    errors.push({ code: 'INVALID_CENTRES', message: 'centres must be an array.' });
    return { ok: errors.length === 0, errors };
  }

  if (Number.isInteger(k) && k >= 2 && k <= 4 && centres.length !== k) {
    errors.push({ code: 'CENTRE_COUNT_MISMATCH', message: 'centre count must equal k (' + k + '); got ' + centres.length + '.' });
  }

  const seenCentreIds = new Set();
  for (const c of centres) {
    if (!c || typeof c !== 'object') {
      errors.push({ code: 'INVALID_CENTRE', message: 'Each centre must be an object.' });
      continue;
    }
    if (typeof c.id !== 'string' || c.id.trim() === '') {
      errors.push({ code: 'EMPTY_ID', message: 'Centre ID must be a non-empty string.', ref: String(c.id) });
    } else if (seenCentreIds.has(c.id)) {
      errors.push({ code: 'DUPLICATE_CENTRE_ID', message: 'Duplicate centre ID: "' + c.id + '".', ref: c.id });
    } else {
      seenCentreIds.add(c.id);
    }
    for (const coord of ['warmth', 'sparkle']) {
      const v = c[coord];
      if (!Number.isFinite(v)) {
        errors.push({ code: 'NON_FINITE_COORD', message: 'Centre "' + c.id + '" has non-finite ' + coord + ': ' + v + '.', ref: c.id });
      } else if (v < 0 || v > 10) {
        errors.push({ code: 'COORD_OUT_OF_RANGE', message: 'Centre "' + c.id + '" has ' + coord + ' outside [0,10]: ' + v + '.', ref: c.id });
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// squaredDistance
// ---------------------------------------------------------------------------
function squaredDistance(a, b) {
  const dw = a.warmth - b.warmth;
  const ds = a.sparkle - b.sparkle;
  return dw * dw + ds * ds;
}

// ---------------------------------------------------------------------------
// assign
// ---------------------------------------------------------------------------
function assign(stickers, centres) {
  return stickers.map(function(sticker) {
    let bestId = centres[0].id;
    let bestDistance = squaredDistance(sticker, centres[0]);

    for (let i = 1; i < centres.length; i++) {
      const d = squaredDistance(sticker, centres[i]);
      // Only replace best if new distance is MEANINGFULLY smaller (> EPS).
      // Ties (difference <= EPS) keep the earlier centre in source order.
      if (bestDistance - d > EPS) {
        bestId = centres[i].id;
        bestDistance = d;
      }
    }

    return bestId;
  });
}

// ---------------------------------------------------------------------------
// updateCentres
// ---------------------------------------------------------------------------
function updateCentres(stickers, assignments, prevCentres) {
  return prevCentres.map(function(centre) {
    const members = [];
    for (let i = 0; i < stickers.length; i++) {
      if (assignments[i] === centre.id) {
        members.push(stickers[i]);
      }
    }

    if (members.length === 0) {
      // Empty panel: retain previous coordinates exactly. No NaN. No division.
      return { id: centre.id, warmth: centre.warmth, sparkle: centre.sparkle };
    }

    let sumW = 0;
    let sumS = 0;
    for (const m of members) {
      sumW += m.warmth;
      sumS += m.sparkle;
    }

    return {
      id: centre.id,
      warmth: sumW / members.length,
      sparkle: sumS / members.length,
    };
  });
}

// ---------------------------------------------------------------------------
// totalSquaredError
// ---------------------------------------------------------------------------
function totalSquaredError(stickers, assignments, centres) {
  const centreMap = {};
  for (const c of centres) {
    centreMap[c.id] = c;
  }

  let sse = 0;
  for (let i = 0; i < stickers.length; i++) {
    const centre = centreMap[assignments[i]];
    sse += squaredDistance(stickers[i], centre);
  }
  return sse;
}

// ---------------------------------------------------------------------------
// signature
// ---------------------------------------------------------------------------
function signature(assignments) {
  return assignments.join('|');
}

// ---------------------------------------------------------------------------
// runIteration
// ---------------------------------------------------------------------------
function runIteration(state) {
  const { stickers, centres } = state;

  // Stage 1: Assign
  const newAssignments = assign(stickers, centres);

  // Stage 2: Update
  const newCentres = updateCentres(stickers, newAssignments, centres);

  // Stage 3: Measure
  const sse = totalSquaredError(stickers, newAssignments, newCentres);

  // Movements (Euclidean, display-only — computed here so controller needn't)
  const movements = {};
  for (let i = 0; i < centres.length; i++) {
    const old = centres[i];
    const nw = newCentres[i];
    const dw = nw.warmth - old.warmth;
    const ds = nw.sparkle - old.sparkle;
    movements[old.id] = Math.sqrt(dw * dw + ds * ds);
  }

  const newSignature = signature(newAssignments);

  return { newCentres, newAssignments, sse, movements, newSignature };
}

// ---------------------------------------------------------------------------
// isConverged
// ---------------------------------------------------------------------------
function isConverged(currentSig, prevSig, iteration) {
  if (iteration === 0) return false;
  return currentSig === prevSig;
}

// ---------------------------------------------------------------------------
// Dual export: Jest (CommonJS require) + browser (window.KMeansEngine)
// ---------------------------------------------------------------------------
const engine = {
  validate,
  squaredDistance,
  assign,
  updateCentres,
  totalSquaredError,
  signature,
  runIteration,
  isConverged,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = engine;
}
if (typeof window !== 'undefined') {
  window.KMeansEngine = engine;
}
