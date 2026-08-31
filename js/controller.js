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

var engineModule = (typeof require !== 'undefined')
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
  var validation = engineModule.validate(collection);
  if (!validation.ok) {
    throw new Error(
      'Invalid collection: ' +
      validation.errors.map(function(e) { return e.message; }).join('; ')
    );
  }

  // Deep-frozen originals - NEVER mutated anywhere in the code path.
  var originalStickers = deepFreeze(deepCopy(collection.stickers));
  var originalCentres  = deepFreeze(deepCopy(collection.centres));

  // Mutable working baseline of the collection.
  var baselineStickers = deepCopy(collection.stickers);
  var baselineCentres  = deepCopy(collection.centres);

  // Active run working copies.
  var currentStickers = deepCopy(baselineStickers);
  var currentCentres  = deepCopy(baselineCentres);

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
    var result = engineModule.runIteration({ stickers: currentStickers, centres: currentCentres });

    currentCentres = result.newCentres;

    var converged = engineModule.isConverged(result.newSignature, prevSignature, iteration);

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
  // reset() - restore working baseline and current arrays from originals.
  // -------------------------------------------------------------------------
  function reset() {
    baselineStickers = deepCopy(originalStickers);
    baselineCentres  = deepCopy(originalCentres);
    currentStickers  = deepCopy(baselineStickers);
    currentCentres   = deepCopy(baselineCentres);
    iteration     = 0;
    status        = 'READY';
    history       = [];
    prevSignature = '';
  }

  // -------------------------------------------------------------------------
  // editSticker(id, warmth, sparkle)
  //   On success: updates baseline & current stickers; restores centres from
  //   baseline; clears run state. originalStickers stays untouched.
  // -------------------------------------------------------------------------
  function editSticker(id, warmth, sparkle) {
    var errors = [];

    var idx = -1;
    for (var i = 0; i < baselineStickers.length; i++) {
      if (baselineStickers[i].id === id) { idx = i; break; }
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
      // Clear stale run state without corrupting baseline
      currentCentres  = deepCopy(baselineCentres);
      currentStickers = deepCopy(baselineStickers);
      iteration     = 0;
      status        = 'READY';
      history       = [];
      prevSignature = '';
      return { ok: false, errors: errors };
    }

    baselineStickers[idx] = { id: id, warmth: warmth, sparkle: sparkle };
    currentStickers       = deepCopy(baselineStickers);
    currentCentres        = deepCopy(baselineCentres);

    iteration    = 0;
    status       = 'READY';
    history      = [];
    prevSignature = '';

    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // editCentre(id, warmth, sparkle)
  //   On success: updates baseline & current centres; clears run state.
  // -------------------------------------------------------------------------
  function editCentre(id, warmth, sparkle) {
    var errors = [];

    var idx = -1;
    for (var i = 0; i < baselineCentres.length; i++) {
      if (baselineCentres[i].id === id) { idx = i; break; }
    }

    if (idx === -1) {
      errors.push({ code: 'CENTRE_NOT_FOUND', message: 'No centre with ID "' + id + '".' });
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
      currentCentres  = deepCopy(baselineCentres);
      currentStickers = deepCopy(baselineStickers);
      iteration     = 0;
      status        = 'READY';
      history       = [];
      prevSignature = '';
      return { ok: false, errors: errors };
    }

    baselineCentres[idx] = { id: id, warmth: warmth, sparkle: sparkle };
    currentCentres       = deepCopy(baselineCentres);
    currentStickers      = deepCopy(baselineStickers);

    iteration    = 0;
    status       = 'READY';
    history      = [];
    prevSignature = '';

    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // addCentre(id, warmth, sparkle)
  //   k from 2 to 4; k <= sticker count; unique non-empty ID; 0..10 coords.
  // -------------------------------------------------------------------------
  function addCentre(id, warmth, sparkle) {
    var errors = [];

    if (baselineCentres.length >= 4) {
      errors.push({ code: 'MAX_CENTRES_EXCEEDED', message: 'Cannot add centre: maximum k is 4.' });
    }
    if (baselineCentres.length + 1 > baselineStickers.length) {
      errors.push({ code: 'K_EXCEEDS_STICKERS', message: 'Cannot add centre: k cannot exceed sticker count.' });
    }
    if (typeof id !== 'string' || id.trim() === '') {
      errors.push({ code: 'EMPTY_ID', message: 'Centre ID must be a non-empty string.' });
    } else if (baselineCentres.some(function(c) { return c.id === id; })) {
      errors.push({ code: 'DUPLICATE_CENTRE_ID', message: 'Centre ID "' + id + '" already exists.' });
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
      currentCentres  = deepCopy(baselineCentres);
      currentStickers = deepCopy(baselineStickers);
      iteration     = 0;
      status        = 'READY';
      history       = [];
      prevSignature = '';
      return { ok: false, errors: errors };
    }

    baselineCentres.push({ id: id, warmth: warmth, sparkle: sparkle });
    currentCentres  = deepCopy(baselineCentres);
    currentStickers = deepCopy(baselineStickers);

    iteration    = 0;
    status       = 'READY';
    history      = [];
    prevSignature = '';

    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // removeCentre(id)
  //   k cannot fall below 2.
  // -------------------------------------------------------------------------
  function removeCentre(id) {
    var errors = [];

    if (baselineCentres.length <= 2) {
      errors.push({ code: 'MIN_CENTRES_REQUIRED', message: 'Cannot remove centre: minimum k is 2.' });
    }

    var idx = -1;
    for (var i = 0; i < baselineCentres.length; i++) {
      if (baselineCentres[i].id === id) { idx = i; break; }
    }
    if (idx === -1) {
      errors.push({ code: 'CENTRE_NOT_FOUND', message: 'No centre with ID "' + id + '".' });
    }

    if (errors.length > 0) {
      currentCentres  = deepCopy(baselineCentres);
      currentStickers = deepCopy(baselineStickers);
      iteration     = 0;
      status        = 'READY';
      history       = [];
      prevSignature = '';
      return { ok: false, errors: errors };
    }

    baselineCentres.splice(idx, 1);
    currentCentres  = deepCopy(baselineCentres);
    currentStickers = deepCopy(baselineStickers);

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
    get baselineStickers() { return baselineStickers; },
    get baselineCentres()  { return baselineCentres; },
    get currentStickers()  { return currentStickers; },
    get currentCentres()   { return currentCentres; },
    get k()                { return baselineCentres.length; },
    get iteration()        { return iteration; },
    get status()           { return status; },
    get history()          { return history; },

    // Methods
    step:         step,
    runToEnd:     runToEnd,
    reset:        reset,
    editSticker:  editSticker,
    editCentre:   editCentre,
    addCentre:    addCentre,
    removeCentre: removeCentre,
  };
}

// ---------------------------------------------------------------------------
// Dual export: Jest (CommonJS require) + browser (window.KMeansController)
// ---------------------------------------------------------------------------
var controllerModule = { createController: createController };

if (typeof module !== 'undefined' && module.exports) { module.exports = controllerModule; }
if (typeof window !== 'undefined') { window.KMeansController = controllerModule; }
