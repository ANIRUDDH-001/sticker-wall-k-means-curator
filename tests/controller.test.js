'use strict';

const { createController } = require('../js/controller.js');
const { COSMIC_CAFE }  = require('../data/demo.js');
const { EMPTY_PANEL }  = require('../data/emptyPanel.js');
const engine           = require('../js/engine.js');

// ---------------------------------------------------------------------------
// Test 10: 20-iteration cap
// The spy makes isConverged() always return false so runToEnd() must halt
// by hitting the 20-iteration ceiling, not by converging.
// ---------------------------------------------------------------------------
describe('controller - 20-iteration cap (test 10)', function() {
  test('10 - runToEnd caps at iteration 20, status NOT_CONVERGED, history.length 20', function() {
    var spy = jest.spyOn(engine, 'isConverged').mockReturnValue(false);
    try {
      var c = createController(COSMIC_CAFE);
      c.runToEnd();
      expect(c.iteration).toBe(20);
      expect(c.status).toBe('NOT_CONVERGED');
      expect(c.history.length).toBe(20);
    } finally {
      spy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// Test 15: editSticker semantics
// ---------------------------------------------------------------------------
describe('controller - editSticker (test 15)', function() {
  test('15 - edit clears history, resets iteration, restores centres; original unchanged', function() {
    var c = createController(COSMIC_CAFE);

    // Run one iteration first to produce some state.
    c.step();
    expect(c.history.length).toBe(1);

    var result = c.editSticker('SUNRISE', 0, 3.5);
    expect(result.ok).toBe(true);

    // State reset
    expect(c.history).toEqual([]);
    expect(c.iteration).toBe(0);
    expect(c.status).toBe('READY');

    // currentCentres deep-equals originalCentres
    expect(JSON.stringify(c.currentCentres)).toBe(JSON.stringify(c.originalCentres));

    // originalStickers[3] is SUNRISE with warmth still 5 (frozen, untouched)
    expect(c.originalStickers[3].id).toBe('SUNRISE');
    expect(c.originalStickers[3].warmth).toBe(5);

    // currentStickers[3].warmth is now 0 (the edit)
    expect(c.currentStickers[3].id).toBe('SUNRISE');
    expect(c.currentStickers[3].warmth).toBe(0);
    expect(c.currentStickers[3].sparkle).toBe(3.5);
  });

  test('15b - editSticker with invalid coords returns ok:false, clears stale state, and leaves data uncorrupted', function() {
    var c = createController(COSMIC_CAFE);
    c.step();
    expect(c.iteration).toBe(1);
    expect(c.history.length).toBe(1);

    var result = c.editSticker('SUNRISE', -1, 5);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    // Stale run state must be cleared
    expect(c.iteration).toBe(0);
    expect(c.status).toBe('READY');
    expect(c.history).toEqual([]);
    expect(JSON.stringify(c.currentCentres)).toBe(JSON.stringify(c.originalCentres));

    // Neither current nor original stickers should have invalid coordinates
    expect(c.currentStickers[3].warmth).toBe(5);
    expect(c.originalStickers[3].warmth).toBe(5);
  });

  test('15c - editSticker with non-existent ID returns ok:false and clears stale state', function() {
    var c = createController(COSMIC_CAFE);
    c.step();
    var result = c.editSticker('DOES_NOT_EXIST', 5, 5);
    expect(result.ok).toBe(false);
    expect(result.errors.some(function(e) { return e.code === 'STICKER_NOT_FOUND'; })).toBe(true);
    expect(c.iteration).toBe(0);
    expect(c.history).toEqual([]);
    expect(c.status).toBe('READY');
  });
});

// ---------------------------------------------------------------------------
// Test 16: reset semantics
// ---------------------------------------------------------------------------
describe('controller - reset (test 16)', function() {
  test('16 - reset restores original stickers and centres, clears all state', function() {
    var c = createController(COSMIC_CAFE);
    c.runToEnd();
    expect(c.history.length).toBeGreaterThan(0);

    c.reset();

    expect(JSON.stringify(c.currentStickers)).toBe(JSON.stringify(c.originalStickers));
    expect(JSON.stringify(c.currentCentres)).toBe(JSON.stringify(c.originalCentres));
    expect(c.history).toEqual([]);
    expect(c.iteration).toBe(0);
    expect(c.status).toBe('READY');
  });
});

// ---------------------------------------------------------------------------
// Test 17: Main oracle end-to-end - Cosmic Cafe
// Every value below must match oracle.md §4-5 exactly (within float tolerance).
// ---------------------------------------------------------------------------
describe('controller - Cosmic Cafe oracle end-to-end (test 17)', function() {
  var c17;

  beforeAll(function() {
    c17 = createController(COSMIC_CAFE);
    c17.runToEnd();
  });

  test('17a - converges in exactly 3 iterations with status CONVERGED', function() {
    expect(c17.iteration).toBe(3);
    expect(c17.status).toBe('CONVERGED');
    expect(c17.history.length).toBe(3);
  });

  test('17b - iter-1 SSE = 19.354167', function() {
    expect(c17.history[0].sse).toBeCloseTo(19.354167, 3);
  });

  test('17c - iter-2 SSE = 11.104167', function() {
    expect(c17.history[1].sse).toBeCloseTo(11.104167, 3);
  });

  test('17d - iter-3 SSE = 11.104167 (unchanged from iter 2, converged)', function() {
    expect(c17.history[2].sse).toBeCloseTo(11.104167, 3);
  });

  test('17e - iter-1 NEBULA centre = (2.5, 2.375)', function() {
    var neb = c17.history[0].centres.find(function(x) { return x.id === 'NEBULA'; });
    expect(neb.warmth).toBeCloseTo(2.5, 5);
    expect(neb.sparkle).toBeCloseTo(2.375, 5);
  });

  test('17f - iter-1 EMBER centre = (6.5, 3.833333)', function() {
    var emb = c17.history[0].centres.find(function(x) { return x.id === 'EMBER'; });
    expect(emb.warmth).toBeCloseTo(6.5, 5);
    expect(emb.sparkle).toBeCloseTo(3.8333, 3);
  });

  test('17g - iter-2 NEBULA centre = (1.666667, 2)', function() {
    var neb = c17.history[1].centres.find(function(x) { return x.id === 'NEBULA'; });
    expect(neb.warmth).toBeCloseTo(1.6667, 3);
    expect(neb.sparkle).toBeCloseTo(2, 5);
  });

  test('17h - iter-2 EMBER centre = (6.125, 3.75)', function() {
    var emb = c17.history[1].centres.find(function(x) { return x.id === 'EMBER'; });
    expect(emb.warmth).toBeCloseTo(6.125, 5);
    expect(emb.sparkle).toBeCloseTo(3.75, 5);
  });

  test('17i - iter-3 centres are identical to iter-2 (members unchanged)', function() {
    var s2 = JSON.stringify(c17.history[1].centres);
    var s3 = JSON.stringify(c17.history[2].centres);
    expect(s3).toBe(s2);
  });

  test('17j - iter-1: SUNRISE (index 3) assigned to NEBULA (tie, source order)', function() {
    expect(c17.history[0].assignments[3]).toBe('NEBULA');
  });

  test('17k - iter-2: SUNRISE (index 3) assigned to EMBER (reassignment)', function() {
    expect(c17.history[1].assignments[3]).toBe('EMBER');
  });

  test('17l - iter-1 movements: NEBULA=0.625, COMET=0, EMBER~=1.9003', function() {
    var mov = c17.history[0].movements;
    expect(mov['NEBULA']).toBeCloseTo(0.625, 5);
    expect(mov['COMET']).toBeCloseTo(0, 10);
    expect(mov['EMBER']).toBeCloseTo(1.9003, 3);
  });
});

// ---------------------------------------------------------------------------
// Test 18: Empty-panel oracle
// EXILE gets zero assignments in every iteration; coords must stay (9,9) exactly.
// ---------------------------------------------------------------------------
describe('controller - empty-panel oracle (test 18)', function() {
  var c18;

  beforeAll(function() {
    c18 = createController(EMPTY_PANEL);
    c18.runToEnd();
  });

  test('18a - converges in exactly 2 iterations', function() {
    expect(c18.iteration).toBe(2);
    expect(c18.status).toBe('CONVERGED');
    expect(c18.history.length).toBe(2);
  });

  test('18b - EXILE centre coords are (9, 9) exactly in every iteration', function() {
    c18.history.forEach(function(snap) {
      var exile = snap.centres.find(function(x) { return x.id === 'EXILE'; });
      expect(exile.warmth).toBe(9);
      expect(exile.sparkle).toBe(9);
    });
  });

  test('18c - HOME centre after iter 1 = (2, 1.333333)', function() {
    var home = c18.history[0].centres.find(function(x) { return x.id === 'HOME'; });
    expect(home.warmth).toBeCloseTo(2, 5);
    expect(home.sparkle).toBeCloseTo(1.3333, 3);
  });

  test('18d - all three stickers assigned to HOME in every iteration', function() {
    c18.history.forEach(function(snap) {
      expect(snap.assignments).toEqual(['HOME', 'HOME', 'HOME']);
    });
  });

  test('18e - EXILE movement is exactly 0 in every iteration', function() {
    c18.history.forEach(function(snap) {
      expect(snap.movements['EXILE']).toBe(0);
    });
  });

  test('18f - no NaN or Infinity anywhere in history', function() {
    function containsNonFinite(val) {
      if (typeof val === 'number') return !Number.isFinite(val);
      if (Array.isArray(val)) return val.some(containsNonFinite);
      if (val && typeof val === 'object') return Object.values(val).some(containsNonFinite);
      return false;
    }
    expect(containsNonFinite(c18.history)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 19: step-loop vs runToEnd produce byte-identical history (contract-critical)
// Proves the SAME code path is used for both - no separate iteration logic.
// ---------------------------------------------------------------------------
describe('controller - step-loop vs runToEnd identity (test 19)', function() {
  test('19 - JSON.stringify(step-loop history) === JSON.stringify(runToEnd history)', function() {
    // Path A: runToEnd
    var c1 = createController(COSMIC_CAFE);
    c1.runToEnd();
    var history1 = c1.history;

    // Path B: manual step loop (mirrors runToEnd's while condition exactly)
    var c2 = createController(COSMIC_CAFE);
    while (c2.status !== 'CONVERGED' && c2.status !== 'NOT_CONVERGED') {
      c2.step();
    }
    var history2 = c2.history;

    expect(JSON.stringify(history1)).toBe(JSON.stringify(history2));
  });
});

// ---------------------------------------------------------------------------
// Test 21: Special character IDs work through controller and converge
// ---------------------------------------------------------------------------
describe('controller - special character IDs (test 21)', function() {
  test('21 - arbitrary non-empty string IDs (with pipes, commas, spaces) cluster and converge safely', function() {
    var specialCollection = {
      k: 2,
      stickers: [
        { id: 'Sticker|A, 1', warmth: 1, sparkle: 1 },
        { id: 'Sticker|B, 2', warmth: 2, sparkle: 2 },
        { id: 'Sticker|C, 3', warmth: 8, sparkle: 8 },
        { id: 'Sticker|D, 4', warmth: 9, sparkle: 9 },
      ],
      centres: [
        { id: 'Centre|Alpha, #1', warmth: 0, sparkle: 0 },
        { id: 'Centre|Beta, #2',  warmth: 10, sparkle: 10 },
      ],
    };

    var c = createController(specialCollection);
    c.runToEnd();
    expect(c.status).toBe('CONVERGED');
    expect(c.iteration).toBe(2);
    expect(c.history[0].assignments).toEqual([
      'Centre|Alpha, #1',
      'Centre|Alpha, #1',
      'Centre|Beta, #2',
      'Centre|Beta, #2',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Test 22: 4-centre controller support (k=4)
// ---------------------------------------------------------------------------
describe('controller - 4-centre support (test 22)', function() {
  test('22 - runs k=4 collection with 4 centres through controller', function() {
    var k4Collection = {
      k: 4,
      stickers: [
        { id: 'S_BL', warmth: 1, sparkle: 1 },
        { id: 'S_TL', warmth: 1, sparkle: 9 },
        { id: 'S_BR', warmth: 9, sparkle: 1 },
        { id: 'S_TR', warmth: 9, sparkle: 9 },
      ],
      centres: [
        { id: 'C_BL', warmth: 0, sparkle: 0 },
        { id: 'C_TL', warmth: 0, sparkle: 10 },
        { id: 'C_BR', warmth: 10, sparkle: 0 },
        { id: 'C_TR', warmth: 10, sparkle: 10 },
      ],
    };

    var c = createController(k4Collection);
    c.runToEnd();
    expect(c.status).toBe('CONVERGED');
    expect(c.iteration).toBe(2);
    expect(c.history[0].sse).toBe(0);
    expect(c.history[0].centres.length).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Phase 2: Centroid Editing, Add/Remove Centre, and Baseline Isolation Tests
// ---------------------------------------------------------------------------
describe('controller - centroid editing and dynamic management (Phase 2)', function() {
  test('P2-1: editCentre updates centre coordinates and restarts run state from baseline', function() {
    var c = createController(COSMIC_CAFE);
    c.step();
    expect(c.iteration).toBe(1);

    var res = c.editCentre('NEBULA', 3, 3);
    expect(res.ok).toBe(true);
    expect(c.iteration).toBe(0);
    expect(c.status).toBe('READY');
    expect(c.history).toEqual([]);

    var neb = c.currentCentres.find(function(ct) { return ct.id === 'NEBULA'; });
    expect(neb.warmth).toBe(3);
    expect(neb.sparkle).toBe(3);

    // Original demo centre is untouched
    expect(c.originalCentres[0].id).toBe('NEBULA');
    expect(c.originalCentres[0].warmth).toBe(2);
    expect(c.originalCentres[0].sparkle).toBe(2);
  });

  test('P2-2: editCentre with invalid coordinates or non-existent ID fails and clears stale state', function() {
    var c = createController(COSMIC_CAFE);
    c.step();

    var resBadCoord = c.editCentre('NEBULA', 12, 5);
    expect(resBadCoord.ok).toBe(false);
    expect(resBadCoord.errors.some(function(e) { return e.code === 'INVALID_WARMTH'; })).toBe(true);
    expect(c.iteration).toBe(0);
    expect(c.status).toBe('READY');
    expect(c.history).toEqual([]);

    var resBadId = c.editCentre('UNKNOWN_CENTRE', 5, 5);
    expect(resBadId.ok).toBe(false);
    expect(resBadId.errors.some(function(e) { return e.code === 'CENTRE_NOT_FOUND'; })).toBe(true);
  });

  test('P2-3: addCentre adds a 4th centre (3 -> 4) and resets run state', function() {
    var c = createController(COSMIC_CAFE);
    expect(c.k).toBe(3);

    var res = c.addCentre('PULSAR', 5, 5);
    expect(res.ok).toBe(true);
    expect(c.k).toBe(4);
    expect(c.currentCentres.length).toBe(4);
    expect(c.currentCentres.some(function(ct) { return ct.id === 'PULSAR'; })).toBe(true);
    expect(c.iteration).toBe(0);
    expect(c.status).toBe('READY');
  });

  test('P2-4: addCentre rejects adding a 5th centre beyond max k=4', function() {
    var c = createController(COSMIC_CAFE);
    c.addCentre('CENTRE_4', 5, 5);
    expect(c.k).toBe(4);

    var res = c.addCentre('CENTRE_5', 6, 6);
    expect(res.ok).toBe(false);
    expect(res.errors.some(function(e) { return e.code === 'MAX_CENTRES_EXCEEDED'; })).toBe(true);
    expect(c.k).toBe(4);
  });

  test('P2-5: addCentre rejects duplicate centre ID, empty ID, and invalid coordinates', function() {
    var c = createController(EMPTY_PANEL); // k=2
    var resDupe = c.addCentre('HOME', 5, 5);
    expect(resDupe.ok).toBe(false);
    expect(resDupe.errors.some(function(e) { return e.code === 'DUPLICATE_CENTRE_ID'; })).toBe(true);

    var resEmpty = c.addCentre('   ', 5, 5);
    expect(resEmpty.ok).toBe(false);
    expect(resEmpty.errors.some(function(e) { return e.code === 'EMPTY_ID'; })).toBe(true);

    var resBadCoord = c.addCentre('VALID_ID', -1, 5);
    expect(resBadCoord.ok).toBe(false);
    expect(resBadCoord.errors.some(function(e) { return e.code === 'INVALID_WARMTH'; })).toBe(true);
  });

  test('P2-6: addCentre rejects when centre count would exceed sticker count', function() {
    var tiny = {
      k: 2,
      stickers: [
        { id: 'S1', warmth: 1, sparkle: 1 },
        { id: 'S2', warmth: 2, sparkle: 2 },
      ],
      centres: [
        { id: 'C1', warmth: 1, sparkle: 1 },
        { id: 'C2', warmth: 2, sparkle: 2 },
      ],
    };
    var c = createController(tiny);
    var res = c.addCentre('C3', 5, 5);
    expect(res.ok).toBe(false);
    expect(res.errors.some(function(e) { return e.code === 'K_EXCEEDS_STICKERS'; })).toBe(true);
  });

  test('P2-7: removeCentre removes centre (3 -> 2) and resets run state', function() {
    var c = createController(COSMIC_CAFE);
    expect(c.k).toBe(3);

    var res = c.removeCentre('EMBER');
    expect(res.ok).toBe(true);
    expect(c.k).toBe(2);
    expect(c.currentCentres.length).toBe(2);
    expect(c.currentCentres.some(function(ct) { return ct.id === 'EMBER'; })).toBe(false);
  });

  test('P2-8: removeCentre rejects reducing k below 2', function() {
    var c = createController(EMPTY_PANEL); // k=2
    expect(c.k).toBe(2);

    var res = c.removeCentre('EXILE');
    expect(res.ok).toBe(false);
    expect(res.errors.some(function(e) { return e.code === 'MIN_CENTRES_REQUIRED'; })).toBe(true);
    expect(c.k).toBe(2);
  });

  test('P2-9: Reset restores exact immutable demo baseline after multiple edits, additions, and removals', function() {
    var c = createController(COSMIC_CAFE);

    // Edit sticker
    c.editSticker('SUNRISE', 0, 0);
    // Edit centre
    c.editCentre('NEBULA', 9, 9);
    // Add centre (3 -> 4)
    c.addCentre('FOURTH', 5, 5);
    expect(c.k).toBe(4);

    // Run to end
    c.runToEnd();
    expect(c.iteration).toBeGreaterThan(0);

    // Reset
    c.reset();

    // Must match original demo exactly
    expect(c.k).toBe(3);
    expect(JSON.stringify(c.currentStickers)).toBe(JSON.stringify(c.originalStickers));
    expect(JSON.stringify(c.currentCentres)).toBe(JSON.stringify(c.originalCentres));
    expect(c.iteration).toBe(0);
    expect(c.status).toBe('READY');
    expect(c.history).toEqual([]);
  });

  test('P2-10: Scenario switching produces fully isolated controllers', function() {
    var cDemo = createController(COSMIC_CAFE);
    cDemo.runToEnd();
    expect(cDemo.status).toBe('CONVERGED');
    expect(cDemo.k).toBe(3);

    var cEmpty = createController(EMPTY_PANEL);
    expect(cEmpty.status).toBe('READY');
    expect(cEmpty.iteration).toBe(0);
    expect(cEmpty.k).toBe(2);
    cEmpty.runToEnd();
    expect(cEmpty.status).toBe('CONVERGED');
    expect(cEmpty.iteration).toBe(2);

    // cDemo unaffected
    expect(cDemo.iteration).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Phase 3: Mathematical Truth, Decision Centres vs Updated Centres, & Replay
// ---------------------------------------------------------------------------
describe('controller - mathematical truth and history separation (Phase 3)', function() {
  test('P3-1: history entries record inputCentres / decisionCentres distinct from updatedCentres', function() {
    var c = createController(COSMIC_CAFE);
    c.step();

    var snap = c.history[0];
    expect(snap.inputCentres).toBeDefined();
    expect(snap.decisionCentres).toBeDefined();
    expect(snap.updatedCentres).toBeDefined();
    expect(snap.stickers).toBeDefined();
    expect(snap.stages).toBeDefined();
    expect(snap.stages.length).toBe(4);

    // Iteration 1 decision centres must be the initial centres
    expect(snap.decisionCentres).toEqual(c.originalCentres);

    // Updated centres must be different from initial decision centres
    expect(snap.updatedCentres).not.toEqual(snap.decisionCentres);

    // NEBULA decision centre was (2, 2); updated centre is (2.5, 2.375)
    var nebDecision = snap.decisionCentres.find(function(ct) { return ct.id === 'NEBULA'; });
    var nebUpdated  = snap.updatedCentres.find(function(ct) { return ct.id === 'NEBULA'; });
    expect(nebDecision.warmth).toBe(2);
    expect(nebDecision.sparkle).toBe(2);
    expect(nebUpdated.warmth).toBeCloseTo(2.5, 4);
    expect(nebUpdated.sparkle).toBeCloseTo(2.375, 4);
  });

  test('P3-2: Cosmic Cafe Iteration 1 SUNRISE tie-break uses decision centres (2,2) and (8,5)', function() {
    var c = createController(COSMIC_CAFE);
    c.step();

    var snap = c.history[0];
    var sunrise = snap.stickers.find(function(s) { return s.id === 'SUNRISE'; });
    expect(sunrise.warmth).toBe(5);
    expect(sunrise.sparkle).toBe(3.5);

    var neb = snap.decisionCentres.find(function(ct) { return ct.id === 'NEBULA'; });
    var ember = snap.decisionCentres.find(function(ct) { return ct.id === 'EMBER'; });
    var comet = snap.decisionCentres.find(function(ct) { return ct.id === 'COMET'; });

    var d2Neb = engine.squaredDistance(sunrise, neb);
    var d2Ember = engine.squaredDistance(sunrise, ember);
    var d2Comet = engine.squaredDistance(sunrise, comet);

    // Both NEBULA and EMBER are exactly 11.250 away
    expect(d2Neb).toBeCloseTo(11.25, 6);
    expect(d2Ember).toBeCloseTo(11.25, 6);
    expect(d2Comet).toBeCloseTo(29.25, 6);

    // NEBULA is index 0, EMBER is index 2 -> NEBULA assigned by centre source order
    var sunriseIdx = snap.stickers.findIndex(function(s) { return s.id === 'SUNRISE'; });
    expect(snap.assignments[sunriseIdx]).toBe('NEBULA');
  });

  test('P3-3: Iteration 2 uses Iteration 1 updated centres as its decision centres', function() {
    var c = createController(COSMIC_CAFE);
    c.step(); // Iteration 1
    c.step(); // Iteration 2

    var snap1 = c.history[0];
    var snap2 = c.history[1];

    // Iteration 2's decision centres must match Iteration 1's updated centres
    expect(snap2.decisionCentres).toEqual(snap1.updatedCentres);

    // Iteration 2 SUNRISE is re-evaluated against Iteration 1 updated centres
    var sunrise = snap2.stickers.find(function(s) { return s.id === 'SUNRISE'; });
    var d2Neb2 = engine.squaredDistance(sunrise, snap2.decisionCentres.find(function(ct) { return ct.id === 'NEBULA'; }));
    var d2Ember2 = engine.squaredDistance(sunrise, snap2.decisionCentres.find(function(ct) { return ct.id === 'EMBER'; }));

    // In Iteration 2, SUNRISE is closer to EMBER than NEBULA
    expect(d2Ember2).toBeLessThan(d2Neb2);
    var sunriseIdx = snap2.stickers.findIndex(function(s) { return s.id === 'SUNRISE'; });
    expect(snap2.assignments[sunriseIdx]).toBe('EMBER');
  });

  test('P3-4: Historical snapshots remain immutable during and after full run', function() {
    var c = createController(COSMIC_CAFE);
    c.runToEnd();

    expect(c.history.length).toBe(3);
    var snap1Copy = JSON.stringify(c.history[0]);
    var snap2Copy = JSON.stringify(c.history[1]);
    var snap3Copy = JSON.stringify(c.history[2]);

    // Stepping again after convergence does nothing
    c.step();
    expect(JSON.stringify(c.history[0])).toBe(snap1Copy);
    expect(JSON.stringify(c.history[1])).toBe(snap2Copy);
    expect(JSON.stringify(c.history[2])).toBe(snap3Copy);
  });
});

// ---------------------------------------------------------------------------
// Phase 4: Cosmic Cafe UI Markup, DOM Structure, & Accessibility
// ---------------------------------------------------------------------------
describe('ui markup and accessibility (Phase 4)', function() {
  var fs = require('fs');
  var path = require('path');
  var html;

  beforeAll(function() {
    html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
  });

  test('P4-1: index.html contains all required interactive and display DOM IDs', function() {
    var requiredIds = [
      'mainCanvas', 'selScenario', 'btnLoad', 'btnStep', 'btnRun', 'btnReset', 'btnFullscreen',
      'selSticker', 'inpW', 'inpS', 'btnApply',
      'selCentre', 'inpCW', 'inpCS', 'btnApplyCentre', 'btnAddCentre', 'btnRemoveCentre',
      'timelineBox', 'timelineNotice', 'timelinePills',
      'elIter', 'elStatus', 'elSSE', 'elSSETrend', 'elKBadge',
      'eventCard', 'eventTitle', 'eventDetail',
      'stageBox', 'stageDesc', 'stAssign', 'stUpdate', 'stMeasure', 'stCheck',
      'panelCards', 'inspection', 'banner', 'legend'
    ];

    requiredIds.forEach(function(id) {
      expect(html).toContain('id="' + id + '"');
    });
  });

  test('P4-2: Canvas has size 560x560 for expanded high-DPI workspace', function() {
    expect(html).toContain('width="560"');
    expect(html).toContain('height="560"');
  });

  test('P4-3: Accessibility aria-labels, roles, and live regions are configured', function() {
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Algorithm Timeline"');
    expect(html).toContain('aria-label="Interactive 2D K-Means plot"');
  });

  test('P4-4: Fullscreen toggle button is present in app header', function() {
    expect(html).toContain('id="btnFullscreen"');
    expect(html).toContain('Full Screen');
  });
});




