/**
 * controller.js - Replay controller wrapping the K-Means engine.
 *
 * INVARIANTS:
 *  - originalStickers / originalCentres are deep-frozen and NEVER mutated.
 *  - runToEnd() is a loop calling step() - no separate code path.
 *  - step() increments iteration, then calls engine functions through the
 *    module reference (not destructured locals) so Jest spies work.
 *  - Zero DOM references.
 */

'use strict';

const engine = (typeof require !== 'undefined')
  ? require('./engine.js')
  : (typeof window !== 'undefined' ? window.KMeansEngine : null);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function deepFreeze(obj) {
  if (Array.isArray(obj)) {
    obj.forEach(deepFreeze);
  } else if (obj && typeof obj === 'object') {
    Object.keys(obj).forEach(function(key) { deepFreeze(obj[key]); });
  }
  return Object.freeze(obj);
}

// ---------------------------------------------------------------------------
// createController
// ---------------------------------------------------------------------------
function createController(collection) {
  var validation = engine.validate(collection);
  if (!validation.ok) {
    throw new Error(
      'Invalid collection: ' +
      validation.errors.map(function(e) { return e.message; }).join('; ')
    );
  }

  // Deep-frozen originals - NEVER mutated anywhere in the code path.
  var originalStickers = deepFreeze(deepCopy(collection.stickers));
  var originalCentres  = deepFreeze(deepCopy(collection.centres));

  // Mutable working copies.
  var currentStickers = deepCopy(collection.stickers);
  var currentCentres  = deepCopy(collection.centres);

  var iteration    = 0;
  var status       = 'READY';
  var history      = [];
  var prevSignature = '';

  // -------------------------------------------------------------------------
  // step() - one K-Means iteration
  // -------------------------------------------------------------------------
  function step() {
    if (status === 'CONVERGED' || status === 'NOT_CONVERGED') return;

    iteration += 1;

    // Call through module reference so Jest spies intercept correctly.
    var result = engine.runIteration({ stickers: currentStickers, centres: currentCentres });

    currentCentres = result.newCentres;

    var converged = engine.isConverged(result.newSignature, prevSignature, iteration);

    var newStatus;
    if (converged) {
      newStatus = 'CONVERGED';
    } else if (iteration >= 20) {
      newStatus = 'NOT_CONVERGED';
    } else {
      newStatus = 'RUNNING';
    }

    status        = newStatus;
    prevSignature = result.newSignature;

    history.push({
      iteration:   iteration,
      assignments: result.newAssignments.slice(),
      centres:     deepCopy(result.newCentres),
      sse:         result.sse,
      movements:   deepCopy(result.movements),
      signature:   result.newSignature,
      status:      newStatus,
    });
  }

  // -------------------------------------------------------------------------
  // runToEnd() - loop step() until terminal status or 20-iter cap.
  //              SAME CODE PATH as step(). No separate iteration logic.
  // -------------------------------------------------------------------------
  function runToEnd() {
    while (status !== 'CONVERGED' && status !== 'NOT_CONVERGED') {
      step();
    }
  }

  // -------------------------------------------------------------------------
  // reset() - restore both current arrays from originals; clear state.
  // -------------------------------------------------------------------------
  function reset() {
    currentStickers = deepCopy(originalStickers);
    currentCentres  = deepCopy(originalCentres);
    iteration    = 0;
    status       = 'READY';
    history      = [];
    prevSignature = '';
  }

  // -------------------------------------------------------------------------
  // editSticker(id, warmth, sparkle)
  //   On success: mutates currentStickers[i] ONLY; restores currentCentres
  //   from originalCentres; clears state. originalStickers stays frozen.
  // -------------------------------------------------------------------------
  function editSticker(id, warmth, sparkle) {
    var errors = [];

    var idx = -1;
    for (var i = 0; i < currentStickers.length; i++) {
      if (currentStickers[i].id === id) { idx = i; break; }
    }

    if (idx === -1) {
      errors.push({ code: 'STICKER_NOT_FOUND', message: 'No sticker with ID "' + id + '".' });
    }
    if (!Number.isFinite(warmth) || warmth < 0 || warmth > 10) {
      errors.push({ code: 'INVALID_WARMTH',
        message: 'warmth must be a finite number in [0, 10]; got ' + warmth + '.' });
    }
    if (!Number.isFinite(sparkle) || sparkle < 0 || sparkle > 10) {
      errors.push({ code: 'INVALID_SPARKLE',
        message: 'sparkle must be a finite number in [0, 10]; got ' + sparkle + '.' });
    }

    if (errors.length > 0) {
      return { ok: false, errors: errors };
    }

    // Mutate ONLY currentStickers[idx]. All other stickers stay as-is.
    currentStickers[idx] = { id: id, warmth: warmth, sparkle: sparkle };

    // Restore currentCentres from originalCentres (original centres, not current).
    currentCentres = deepCopy(originalCentres);

    // Clear all run state.
    iteration    = 0;
    status       = 'READY';
    history      = [];
    prevSignature = '';

    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Public interface - getters make properties live (reflect mutations).
  // -------------------------------------------------------------------------
  return {
    // Frozen references - always readable; never writable via the interface.
    originalStickers: originalStickers,
    originalCentres:  originalCentres,

    // Live getters
    get currentStickers() { return currentStickers; },
    get currentCentres()  { return currentCentres; },
    get iteration()       { return iteration; },
    get status()          { return status; },
    get history()         { return history; },

    // Methods
    step:        step,
    runToEnd:    runToEnd,
    reset:       reset,
    editSticker: editSticker,
  };
}

// ---------------------------------------------------------------------------
// Dual export: Jest (CommonJS require) + browser (window.KMeansController)
// ---------------------------------------------------------------------------
var controllerModule = { createController: createController };

if (typeof module !== 'undefined' && module.exports) { module.exports = controllerModule; }
if (typeof window !== 'undefined') { window.KMeansController = controllerModule; }
