'use strict';

const { createController } = require('../js/controller.js');
const { COSMIC_CAFE }  = require('../data/demo.js');

// ---------------------------------------------------------------------------
// Test 20: Validation clearing — creating a controller with an invalid
// collection never leaks state from a prior valid run.
//
// Design choice: createController() THROWS on invalid input (rather than
// returning an error-state controller). This is documented in DESIGN.md §T20.
// The throw means the caller cannot accidentally call step()/runToEnd() on
// a partially-initialised object — there is no partially-initialised object.
// ---------------------------------------------------------------------------
describe('controller - validation clearing (test 20)', function() {

  test('20a - createController throws on invalid collection (k=5, 3 stickers)', function() {
    var invalid = {
      k: 5,
      stickers: [
        { id: 'A', warmth: 1, sparkle: 1 },
        { id: 'B', warmth: 2, sparkle: 2 },
        { id: 'C', warmth: 3, sparkle: 3 },
      ],
      centres: [
        { id: 'C1', warmth: 1, sparkle: 1 },
        { id: 'C2', warmth: 5, sparkle: 5 },
        { id: 'C3', warmth: 9, sparkle: 9 },
        { id: 'C4', warmth: 2, sparkle: 8 },
        { id: 'C5', warmth: 8, sparkle: 2 },
      ],
    };
    expect(function() { createController(invalid); }).toThrow();
  });

  test('20b - prior valid run does not leak into the failed invalid-load attempt', function() {
    // Run a valid collection to completion.
    var good = createController(COSMIC_CAFE);
    good.runToEnd();
    expect(good.iteration).toBe(3);
    expect(good.status).toBe('CONVERGED');

    // Attempting to create a controller from an invalid collection throws.
    // The thrown error must be catchable and must not mutate the prior 'good' object.
    var invalid = { k: 5, stickers: [], centres: [] };
    var threw = false;
    try {
      createController(invalid);
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(true);

    // The prior valid controller is completely unaffected.
    expect(good.iteration).toBe(3);
    expect(good.status).toBe('CONVERGED');
    expect(good.history.length).toBe(3);
  });
});
