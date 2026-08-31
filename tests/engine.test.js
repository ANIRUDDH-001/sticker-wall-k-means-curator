'use strict';

const engine = require('../js/engine.js');
const {
  validate,
  squaredDistance,
  assign,
  updateCentres,
  totalSquaredError,
  signature,
  runIteration,
  isConverged,
} = engine;

// ---------------------------------------------------------------------------
// Test 1: squaredDistance
// ---------------------------------------------------------------------------
describe('squaredDistance', function() {
  test('1 - (0,0) to (3,4) = 25', function() {
    expect(squaredDistance({ warmth: 0, sparkle: 0 }, { warmth: 3, sparkle: 4 })).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// Tests 2, 3a, 3b: Tie-break rule
// ---------------------------------------------------------------------------
describe('assign - tie-break', function() {
  test('2 - exact tie: earlier centre (source order) wins', function() {
    const stickers = [{ id: 'S1', warmth: 5, sparkle: 5 }];
    // A: d^2 = (5-2)^2 + (5-1)^2 = 9+16 = 25
    // B: d^2 = (5-8)^2 + (5-9)^2 = 9+16 = 25
    const centres = [
      { id: 'A', warmth: 2, sparkle: 1 },
      { id: 'B', warmth: 8, sparkle: 9 },
    ];
    expect(assign(stickers, centres)[0]).toBe('A');
  });

  test('3a - difference of 0.5e-12 (within EPS): still tied, earlier centre wins', function() {
    const stickers = [{ id: 'S1', warmth: 0, sparkle: 0 }];
    // A at (10,0): d^2 = 100
    // B at (sqrt(100 - 0.5e-12), 0): d^2 = 100 - 0.5e-12  (diff < EPS=1e-12)
    const xB = Math.sqrt(100 - 0.5e-12);
    const centres = [
      { id: 'A', warmth: 10, sparkle: 0 },
      { id: 'B', warmth: xB, sparkle: 0 },
    ];
    expect(assign(stickers, centres)[0]).toBe('A');
  });

  test('3b - difference of 2e-12 (outside EPS): closer centre wins', function() {
    const stickers = [{ id: 'S1', warmth: 0, sparkle: 0 }];
    // A at (10,0): d^2 = 100
    // B at (sqrt(100 - 2e-12), 0): d^2 = 100 - 2e-12  (diff > EPS=1e-12)
    const xB = Math.sqrt(100 - 2e-12);
    const centres = [
      { id: 'A', warmth: 10, sparkle: 0 },
      { id: 'B', warmth: xB, sparkle: 0 },
    ];
    expect(assign(stickers, centres)[0]).toBe('B');
  });
});

// ---------------------------------------------------------------------------
// Test 4: updateCentres
// ---------------------------------------------------------------------------
describe('updateCentres', function() {
  test('4 - two stickers (2,4) and (4,6) in one panel -> centre (3,5)', function() {
    const stickers = [
      { id: 'P', warmth: 2, sparkle: 4 },
      { id: 'Q', warmth: 4, sparkle: 6 },
    ];
    const assignments = ['X', 'X'];
    const prevCentres = [{ id: 'X', warmth: 0, sparkle: 0 }];
    const result = updateCentres(stickers, assignments, prevCentres);
    expect(result[0].warmth).toBe(3);
    expect(result[0].sparkle).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Test 5: two-iteration reassignment
// ---------------------------------------------------------------------------
describe('runIteration - reassignment across iterations', function() {
  test('5 - sticker B reassigns from C1->C2 between iteration 1 and 2', function() {
    // Hand-worked collection (all values pre-verified):
    //
    //   A(0,0), B(5,5), C(7,7)
    //   C1=(0,0), C2=(10,10)
    //
    // Iteration 1 - assign:
    //   A: d^2->C1=0,   d^2->C2=200  => C1
    //   B: d^2->C1=50,  d^2->C2=50   => TIE -> C1 (earlier wins)
    //   C: d^2->C1=98,  d^2->C2=18   => C2
    //
    // Iteration 1 - update:
    //   C1 = mean(A,B) = (2.5, 2.5)
    //   C2 = mean(C)   = (7,   7)
    //
    // Iteration 2 - assign:
    //   B: d^2->C1(2.5,2.5) = 12.5
    //      d^2->C2(7,7)     =  8    => diff=4.5 >> 1e-12 => B REASSIGNS to C2

    const stickers = [
      { id: 'A', warmth: 0, sparkle: 0 },
      { id: 'B', warmth: 5, sparkle: 5 },
      { id: 'C', warmth: 7, sparkle: 7 },
    ];
    const centres = [
      { id: 'C1', warmth: 0,  sparkle: 0 },
      { id: 'C2', warmth: 10, sparkle: 10 },
    ];

    const r1 = runIteration({ stickers, centres });
    expect(r1.newAssignments[0]).toBe('C1'); // A -> C1
    expect(r1.newAssignments[1]).toBe('C1'); // B -> C1 (tie, earlier wins)
    expect(r1.newAssignments[2]).toBe('C2'); // C -> C2

    const updC1 = r1.newCentres.find(c => c.id === 'C1');
    const updC2 = r1.newCentres.find(c => c.id === 'C2');
    expect(updC1.warmth).toBe(2.5);
    expect(updC1.sparkle).toBe(2.5);
    expect(updC2.warmth).toBe(7);
    expect(updC2.sparkle).toBe(7);

    const r2 = runIteration({ stickers, centres: r1.newCentres });
    expect(r2.newAssignments[0]).toBe('C1'); // A stays C1
    expect(r2.newAssignments[1]).toBe('C2'); // B REASSIGNS to C2
    expect(r2.newAssignments[2]).toBe('C2'); // C stays C2
  });
});

// ---------------------------------------------------------------------------
// Test 6: Empty panel retention
// ---------------------------------------------------------------------------
describe('updateCentres - empty panel', function() {
  test('6 - empty panel retains previous coords exactly; no NaN', function() {
    const stickers = [
      { id: 'A', warmth: 1, sparkle: 1 },
      { id: 'B', warmth: 2, sparkle: 2 },
    ];
    const assignments = ['X', 'X']; // Y gets nothing
    const prevCentres = [
      { id: 'X', warmth: 1, sparkle: 1 },
      { id: 'Y', warmth: 9, sparkle: 9 },
    ];
    const result = updateCentres(stickers, assignments, prevCentres);
    const Y = result.find(c => c.id === 'Y');
    expect(Y.warmth).toBe(9);
    expect(Y.sparkle).toBe(9);
    expect(Number.isFinite(Y.warmth)).toBe(true);
    expect(Number.isFinite(Y.sparkle)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 7: totalSquaredError
// ---------------------------------------------------------------------------
describe('totalSquaredError', function() {
  test('7 - hand-worked 2-sticker case: SSE = 2 + 25 = 27', function() {
    // S1(0,0) -> C1(1,1): d^2 = 1+1 = 2
    // S2(3,4) -> C2(0,0): d^2 = 9+16 = 25
    const stickers = [
      { id: 'S1', warmth: 0, sparkle: 0 },
      { id: 'S2', warmth: 3, sparkle: 4 },
    ];
    const assignments = ['C1', 'C2'];
    const centres = [
      { id: 'C1', warmth: 1, sparkle: 1 },
      { id: 'C2', warmth: 0, sparkle: 0 },
    ];
    expect(totalSquaredError(stickers, assignments, centres)).toBe(27);
  });
});

// ---------------------------------------------------------------------------
// Test 8: signature
// ---------------------------------------------------------------------------
// Test 8: signature
// ---------------------------------------------------------------------------
describe('signature', function() {
  test('8 - identical assignments produce identical signature strings', function() {
    const a1 = ['A', 'B', 'A'];
    const a2 = ['A', 'B', 'A'];
    expect(signature(a1)).toBe(signature(a2));
    expect(signature(a1)).toBe(JSON.stringify(['A', 'B', 'A']));
  });

  test('8b - signature is collision-safe for IDs containing delimiters or special characters', function() {
    const a1 = ['A|B', 'C'];
    const a2 = ['A', 'B|C'];
    expect(signature(a1)).not.toBe(signature(a2));

    const a3 = ['A,B', 'C'];
    const a4 = ['A', 'B,C'];
    expect(signature(a3)).not.toBe(signature(a4));
  });
});

// ---------------------------------------------------------------------------
// Test 9: isConverged
// ---------------------------------------------------------------------------
describe('isConverged', function() {
  test('9a - isConverged(sig, sig, 0) === false (first-iteration guard)', function() {
    expect(isConverged(JSON.stringify(['A', 'B']), JSON.stringify(['A', 'B']), 0)).toBe(false);
  });

  test('9b - isConverged(sig, sig, 1) === true', function() {
    expect(isConverged(JSON.stringify(['A', 'B']), JSON.stringify(['A', 'B']), 1)).toBe(true);
  });

  test('9c - isConverged("A|B", "A|C", 1) === false', function() {
    expect(isConverged(JSON.stringify(['A', 'B']), JSON.stringify(['A', 'C']), 1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests 11-14 + comprehensive validation audit: validate
// ---------------------------------------------------------------------------
describe('validate', function() {
  test('11 - k=1 returns ok:false with INVALID_K error', function() {
    const result = validate({
      k: 1,
      stickers: [
        { id: 'A', warmth: 1, sparkle: 1 },
        { id: 'B', warmth: 2, sparkle: 2 },
      ],
      centres: [{ id: 'C1', warmth: 1, sparkle: 1 }],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.code === 'INVALID_K')).toBe(true);
  });

  test('11b - k=5 returns ok:false with INVALID_K error', function() {
    const stickers = Array.from({ length: 6 }, function(_, i) {
      return { id: 'S' + i, warmth: i, sparkle: i };
    });
    const centres = Array.from({ length: 5 }, function(_, i) {
      return { id: 'C' + i, warmth: i, sparkle: i };
    });
    const result = validate({ k: 5, stickers, centres });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.code === 'INVALID_K')).toBe(true);
  });

  test('11c - sticker count < 2 (1 sticker) returns ok:false with STICKER_COUNT error', function() {
    const result = validate({
      k: 2,
      stickers: [{ id: 'A', warmth: 1, sparkle: 1 }],
      centres: [
        { id: 'C1', warmth: 1, sparkle: 1 },
        { id: 'C2', warmth: 9, sparkle: 9 },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.code === 'STICKER_COUNT')).toBe(true);
  });

  test('11d - sticker count > 30 (31 stickers) returns ok:false with STICKER_COUNT error', function() {
    const stickers = Array.from({ length: 31 }, function(_, i) {
      return { id: 'S' + i, warmth: 1, sparkle: 1 };
    });
    const centres = [
      { id: 'C1', warmth: 1, sparkle: 1 },
      { id: 'C2', warmth: 9, sparkle: 9 },
    ];
    const result = validate({ k: 2, stickers, centres });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.code === 'STICKER_COUNT')).toBe(true);
  });

  test('11e - k > sticker count (k=3, 2 stickers) returns ok:false with K_EXCEEDS_STICKERS error', function() {
    const result = validate({
      k: 3,
      stickers: [
        { id: 'A', warmth: 1, sparkle: 1 },
        { id: 'B', warmth: 2, sparkle: 2 },
      ],
      centres: [
        { id: 'C1', warmth: 1, sparkle: 1 },
        { id: 'C2', warmth: 5, sparkle: 5 },
        { id: 'C3', warmth: 9, sparkle: 9 },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.code === 'K_EXCEEDS_STICKERS')).toBe(true);
  });

  test('11f - centre count does not match k (k=3, 2 centres) returns ok:false with CENTRE_COUNT_MISMATCH error', function() {
    const result = validate({
      k: 3,
      stickers: [
        { id: 'A', warmth: 1, sparkle: 1 },
        { id: 'B', warmth: 2, sparkle: 2 },
        { id: 'C', warmth: 3, sparkle: 3 },
      ],
      centres: [
        { id: 'C1', warmth: 1, sparkle: 1 },
        { id: 'C2', warmth: 9, sparkle: 9 },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.code === 'CENTRE_COUNT_MISMATCH')).toBe(true);
  });

  test('12 - warmth=10.5 returns ok:false with offending sticker ID in error', function() {
    const result = validate({
      k: 2,
      stickers: [
        { id: 'BAD', warmth: 10.5, sparkle: 5 },
        { id: 'OK',  warmth: 5,    sparkle: 5 },
      ],
      centres: [
        { id: 'C1', warmth: 1, sparkle: 1 },
        { id: 'C2', warmth: 9, sparkle: 9 },
      ],
    });
    expect(result.ok).toBe(false);
    const err = result.errors.find(e => e.code === 'COORD_OUT_OF_RANGE');
    expect(err).toBeDefined();
    expect(err.ref).toBe('BAD');
  });

  test('12b - centre coordinate out of range (sparkle=-0.1) returns ok:false with offending centre ID', function() {
    const result = validate({
      k: 2,
      stickers: [
        { id: 'S1', warmth: 1, sparkle: 1 },
        { id: 'S2', warmth: 2, sparkle: 2 },
      ],
      centres: [
        { id: 'C1', warmth: 1, sparkle: -0.1 },
        { id: 'C2', warmth: 9, sparkle: 9 },
      ],
    });
    expect(result.ok).toBe(false);
    const err = result.errors.find(e => e.code === 'COORD_OUT_OF_RANGE');
    expect(err).toBeDefined();
    expect(err.ref).toBe('C1');
  });

  test('13 - duplicate sticker ID returns ok:false with DUPLICATE_STICKER_ID error', function() {
    const result = validate({
      k: 2,
      stickers: [
        { id: 'DUPE', warmth: 1, sparkle: 1 },
        { id: 'DUPE', warmth: 2, sparkle: 2 },
      ],
      centres: [
        { id: 'C1', warmth: 1, sparkle: 1 },
        { id: 'C2', warmth: 9, sparkle: 9 },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.code === 'DUPLICATE_STICKER_ID')).toBe(true);
  });

  test('13b - duplicate centre ID returns ok:false with DUPLICATE_CENTRE_ID error', function() {
    const result = validate({
      k: 2,
      stickers: [
        { id: 'S1', warmth: 1, sparkle: 1 },
        { id: 'S2', warmth: 2, sparkle: 2 },
      ],
      centres: [
        { id: 'DUPE_C', warmth: 1, sparkle: 1 },
        { id: 'DUPE_C', warmth: 9, sparkle: 9 },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.code === 'DUPLICATE_CENTRE_ID')).toBe(true);
  });

  test('13c - empty sticker ID (empty string or whitespace) returns ok:false with EMPTY_ID error', function() {
    const result = validate({
      k: 2,
      stickers: [
        { id: '', warmth: 1, sparkle: 1 },
        { id: '  ', warmth: 2, sparkle: 2 },
      ],
      centres: [
        { id: 'C1', warmth: 1, sparkle: 1 },
        { id: 'C2', warmth: 9, sparkle: 9 },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.code === 'EMPTY_ID')).toBe(true);
  });

  test('13d - empty centre ID returns ok:false with EMPTY_ID error', function() {
    const result = validate({
      k: 2,
      stickers: [
        { id: 'S1', warmth: 1, sparkle: 1 },
        { id: 'S2', warmth: 2, sparkle: 2 },
      ],
      centres: [
        { id: '', warmth: 1, sparkle: 1 },
        { id: 'C2', warmth: 9, sparkle: 9 },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.code === 'EMPTY_ID')).toBe(true);
  });

  test('14a - NaN coordinate returns ok:false with NON_FINITE_COORD error', function() {
    const result = validate({
      k: 2,
      stickers: [
        { id: 'NAN_STICKER', warmth: NaN, sparkle: 1 },
        { id: 'OK', warmth: 1, sparkle: 1 },
      ],
      centres: [
        { id: 'C1', warmth: 1, sparkle: 1 },
        { id: 'C2', warmth: 9, sparkle: 9 },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.code === 'NON_FINITE_COORD')).toBe(true);
  });

  test('14b - Infinity coordinate returns ok:false with NON_FINITE_COORD error', function() {
    const result = validate({
      k: 2,
      stickers: [
        { id: 'INF_STICKER', warmth: Infinity, sparkle: 1 },
        { id: 'OK', warmth: 1, sparkle: 1 },
      ],
      centres: [
        { id: 'C1', warmth: 1, sparkle: 1 },
        { id: 'C2', warmth: 9, sparkle: 9 },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.code === 'NON_FINITE_COORD')).toBe(true);
  });

  test('14c - non-number centre coordinate (string or null) returns ok:false with NON_FINITE_COORD error', function() {
    const result = validate({
      k: 2,
      stickers: [
        { id: 'S1', warmth: 1, sparkle: 1 },
        { id: 'S2', warmth: 2, sparkle: 2 },
      ],
      centres: [
        { id: 'C1', warmth: 'bad', sparkle: 1 },
        { id: 'C2', warmth: 9, sparkle: null },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.code === 'NON_FINITE_COORD')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration Test A: PS built-in example (button/star/flame/heart/sun)
// ---------------------------------------------------------------------------
describe('Integration A - PS built-in example (mint/coral)', function() {
  const stickers = [
    { id: 'button', warmth: 0, sparkle: 0 },
    { id: 'star',   warmth: 5, sparkle: 5 },
    { id: 'flame',  warmth: 6, sparkle: 5 },
    { id: 'heart',  warmth: 5, sparkle: 6 },
    { id: 'sun',    warmth: 9, sparkle: 9 },
  ];
  const centres = [
    { id: 'mint',  warmth: 0,  sparkle: 0 },
    { id: 'coral', warmth: 10, sparkle: 10 },
  ];

  test('iteration 1: star->mint (tie), mint=(2.5,2.5), coral~=(6.6667,6.6667), sse~=42.333', function() {
    const r1 = runIteration({ stickers, centres });

    // star(5,5): d^2 to mint(0,0)=50, d^2 to coral(10,10)=50 -> tie -> mint (earlier)
    expect(r1.newAssignments[1]).toBe('mint');

    // mint = mean(button,star) = (2.5, 2.5)
    const mint = r1.newCentres.find(c => c.id === 'mint');
    expect(mint.warmth).toBe(2.5);
    expect(mint.sparkle).toBe(2.5);

    // coral = mean(flame,heart,sun) = ((6+5+9)/3, (5+6+9)/3) = (20/3, 20/3)
    const coral = r1.newCentres.find(c => c.id === 'coral');
    expect(coral.warmth).toBeCloseTo(6.6667, 3);
    expect(coral.sparkle).toBeCloseTo(6.6667, 3);

    // SSE (distances to UPDATED centres after iter 1) ~= 42.333
    expect(r1.sse).toBeCloseTo(42.333, 1);
  });

  test('iteration 2: star->coral, mint=(0,0), coral=(6.25,6.25), sse=21.5', function() {
    const r1 = runIteration({ stickers, centres });
    const r2 = runIteration({ stickers, centres: r1.newCentres });

    // star now reassigns to coral
    expect(r2.newAssignments[1]).toBe('coral');

    // mint = only button -> (0, 0)
    const mint = r2.newCentres.find(c => c.id === 'mint');
    expect(mint.warmth).toBe(0);
    expect(mint.sparkle).toBe(0);

    // coral = mean(star,flame,heart,sun) = (25/4, 25/4) = (6.25, 6.25)
    const coral = r2.newCentres.find(c => c.id === 'coral');
    expect(coral.warmth).toBe(6.25);
    expect(coral.sparkle).toBe(6.25);

    expect(r2.sse).toBeCloseTo(21.5, 5);
  });
});

// ---------------------------------------------------------------------------
// Integration Test B: 4-centre generic engine support (k=4)
// ---------------------------------------------------------------------------
describe('Integration B - 4-centre generic engine support (k=4)', function() {
  test('runs k=4 collection with 4 corners correctly', function() {
    const stickers = [
      { id: 'BL', warmth: 1, sparkle: 1 },
      { id: 'TL', warmth: 1, sparkle: 9 },
      { id: 'BR', warmth: 9, sparkle: 1 },
      { id: 'TR', warmth: 9, sparkle: 9 },
    ];
    const centres = [
      { id: 'C_BL', warmth: 0, sparkle: 0 },
      { id: 'C_TL', warmth: 0, sparkle: 10 },
      { id: 'C_BR', warmth: 10, sparkle: 0 },
      { id: 'C_TR', warmth: 10, sparkle: 10 },
    ];

    const val = validate({ k: 4, stickers, centres });
    expect(val.ok).toBe(true);

    const r1 = runIteration({ stickers, centres });
    expect(r1.newAssignments).toEqual(['C_BL', 'C_TL', 'C_BR', 'C_TR']);
    expect(r1.newCentres.find(c => c.id === 'C_BL')).toEqual({ id: 'C_BL', warmth: 1, sparkle: 1 });
    expect(r1.newCentres.find(c => c.id === 'C_TL')).toEqual({ id: 'C_TL', warmth: 1, sparkle: 9 });
    expect(r1.newCentres.find(c => c.id === 'C_BR')).toEqual({ id: 'C_BR', warmth: 9, sparkle: 1 });
    expect(r1.newCentres.find(c => c.id === 'C_TR')).toEqual({ id: 'C_TR', warmth: 9, sparkle: 9 });
    expect(r1.sse).toBe(0);
  });
});

