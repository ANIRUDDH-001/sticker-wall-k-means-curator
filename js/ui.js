/**
 * ui.js - DOM wiring, Canvas rendering, event handlers.
 *
 * Zero engine/logic code here. All K-Means computation goes through
 * window.KMeansController and window.KMeansEngine.
 *
 * Inspection-panel design note:
 *   Distances shown are computed against the CENTRES USED FOR ASSIGNMENT
 *   in the last iteration (pre-update input centres), not the post-update
 *   current centres. This makes the tie note in iteration 1 correct:
 *   SUNRISE is 11.250 from both NEBULA(2,2) and EMBER(8,5) — the original
 *   centres that drove the assignment — not the updated centres.
 */

'use strict';

(function () {

  /* -------------------------------------------------------------------------
   * Constants
   * ---------------------------------------------------------------------- */
  var PANEL_CFG = [
    { colour: '#3b82f6', letter: 'N', shape: 'circle'   },
    { colour: '#a855f7', letter: 'C', shape: 'triangle' },
    { colour: '#f97316', letter: 'E', shape: 'square'   },
  ];
  var X_MIN = 40, X_MAX = 460, Y_MIN = 40, Y_MAX = 460;
  var HIT_R = 12;
  var EPS   = 1e-12;

  /* -------------------------------------------------------------------------
   * Module-level state
   * ---------------------------------------------------------------------- */
  var ctrl       = null;   // current controller instance
  var stickerHits = [];    // [{id, screenX, screenY, idx}] rebuilt each render

  /* -------------------------------------------------------------------------
   * DOM handles (grabbed in init)
   * ---------------------------------------------------------------------- */
  var canvas, ctx,
      btnLoad, btnStep, btnRun, btnReset, btnApply,
      selSticker, inpW, inpS,
      elIter, elStatus, elSSE,
      elCards, elInspect, elBanner;

  /* -------------------------------------------------------------------------
   * Coordinate helpers
   * ---------------------------------------------------------------------- */
  function toX(w) { return X_MIN + w * (X_MAX - X_MIN) / 10; }
  function toY(s) { return Y_MAX - s * (Y_MAX - Y_MIN) / 10; }
  function fmt(n) { return Number(n).toFixed(3); }

  /* -------------------------------------------------------------------------
   * Canvas draw primitives
   * ---------------------------------------------------------------------- */
  function drawCircle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
  }

  function drawTri(x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.866, y + r * 0.5);
    ctx.lineTo(x - r * 0.866, y + r * 0.5);
    ctx.closePath();
  }

  function drawSq(x, y, r) {
    ctx.beginPath();
    ctx.rect(x - r, y - r, 2 * r, 2 * r);
  }

  function drawDiamond(x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
  }

  /* Hollow X mark for initial centres */
  function drawX(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s);
    ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s);
    ctx.stroke();
  }

  /* -------------------------------------------------------------------------
   * Main render — called after every state change
   * ---------------------------------------------------------------------- */
  function render() {
    if (!ctrl) return;

    var stickers    = ctrl.currentStickers;
    var centres     = ctrl.currentCentres;
    var origCentres = ctrl.originalCentres;
    var history     = ctrl.history;
    var snap        = history.length ? history[history.length - 1] : null;
    var assgn       = snap ? snap.assignments : null;
    var movs        = snap ? snap.movements   : null;

    // -- Clear ----------------------------------------------------------------
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // -- Grid -----------------------------------------------------------------
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth   = 0.5;
    var gi;
    for (gi = 0; gi <= 10; gi++) {
      ctx.beginPath(); ctx.moveTo(toX(gi), Y_MIN); ctx.lineTo(toX(gi), Y_MAX); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X_MIN, toY(gi)); ctx.lineTo(X_MAX, toY(gi)); ctx.stroke();
    }

    // -- Axis tick labels -----------------------------------------------------
    ctx.fillStyle  = '#6b7280';
    ctx.font       = '10px sans-serif';
    ctx.textAlign  = 'center';
    for (gi = 0; gi <= 10; gi++) ctx.fillText(gi, toX(gi), Y_MAX + 14);
    ctx.textAlign = 'right';
    for (gi = 0; gi <= 10; gi++) ctx.fillText(gi, X_MIN - 4, toY(gi) + 4);

    // Axis title: sparkle (rotated)
    ctx.save();
    ctx.translate(11, (Y_MIN + Y_MAX) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.font = '10px sans-serif';
    ctx.fillText('sparkle', 0, 0);
    ctx.restore();
    // Axis title: warmth
    ctx.textAlign = 'center';
    ctx.font = '10px sans-serif';
    ctx.fillText('warmth', (X_MIN + X_MAX) / 2, canvas.height - 1);

    // -- Assignment lines (only after first iteration) -----------------------
    if (assgn) {
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth   = 1;
      stickers.forEach(function (s, i) {
        var cid = assgn[i];
        var c   = centres.find(function (x) { return x.id === cid; });
        if (!c) return;
        ctx.beginPath();
        ctx.moveTo(toX(s.warmth), toY(s.sparkle));
        ctx.lineTo(toX(c.warmth), toY(c.sparkle));
        ctx.stroke();
      });
    }

    // -- Initial centres (hollow X) ------------------------------------------
    origCentres.forEach(function (c) {
      var x = toX(c.warmth), y = toY(c.sparkle);
      ctx.strokeStyle = '#374151';
      ctx.lineWidth   = 2;
      drawX(x, y, 8);
      ctx.fillStyle  = '#374151';
      ctx.font       = '10px sans-serif';
      ctx.textAlign  = 'left';
      ctx.fillText(c.id, x + 11, y - 7);
    });

    // -- Current centres (filled star) ---------------------------------------
    centres.forEach(function (c, i) {
      var cfg = PANEL_CFG[i] || { colour: '#6b7280' };
      var x   = toX(c.warmth), y = toY(c.sparkle);
      ctx.fillStyle  = cfg.colour;
      ctx.font       = 'bold 17px serif';
      ctx.textAlign  = 'center';
      ctx.fillText('\u2605', x, y + 6);  /* ★ */
    });

    // -- Stickers ------------------------------------------------------------
    stickerHits = [];
    stickers.forEach(function (s, i) {
      var x   = toX(s.warmth), y = toY(s.sparkle);
      stickerHits.push({ id: s.id, screenX: x, screenY: y, idx: i });

      var cidx = assgn
        ? centres.findIndex(function (c) { return c.id === assgn[i]; })
        : -1;
      ctx.lineWidth = 1.5;

      if (cidx >= 0) {
        var cfg = PANEL_CFG[cidx] || { colour: '#6b7280', letter: '?', shape: 'circle' };
        ctx.fillStyle   = cfg.colour;
        ctx.strokeStyle = cfg.colour;
        if      (cfg.shape === 'circle')   drawCircle(x, y, 8);
        else if (cfg.shape === 'triangle') drawTri(x, y, 9);
        else if (cfg.shape === 'square')   drawSq(x, y, 7);
        ctx.fill();
        ctx.stroke();
        // Panel letter
        ctx.fillStyle  = '#fff';
        ctx.font       = 'bold 9px sans-serif';
        ctx.textAlign  = 'center';
        ctx.fillText(cfg.letter, x, y + 3);
      } else {
        // Unassigned: grey diamond
        ctx.fillStyle   = '#9ca3af';
        ctx.strokeStyle = '#6b7280';
        drawDiamond(x, y, 7);
        ctx.fill();
        ctx.stroke();
      }

      // Sticker ID label beside the marker
      ctx.fillStyle  = '#111827';
      ctx.font       = '9px sans-serif';
      ctx.textAlign  = 'left';
      ctx.fillText(s.id, x + 10, y - 4);
    });

    // -- Status panel --------------------------------------------------------
    elIter.textContent   = ctrl.iteration;
    elStatus.textContent = ctrl.status;
    elStatus.className   = 'status-pill sp-' +
      ctrl.status.toLowerCase().replace('_', '-');
    elSSE.textContent = snap ? fmt(snap.sse) : '\u2014';

    // -- Panel cards ---------------------------------------------------------
    renderCards(centres, assgn, movs);
  }

  /* -------------------------------------------------------------------------
   * Panel cards
   * ---------------------------------------------------------------------- */
  function renderCards(centres, assgn, movs) {
    elCards.innerHTML = '';
    centres.forEach(function (c, i) {
      var cfg = PANEL_CFG[i] || { colour: '#6b7280', letter: '?' };

      // Members
      var members = [];
      if (assgn) {
        ctrl.currentStickers.forEach(function (s, si) {
          if (assgn[si] === c.id) members.push(s.id);
        });
      }

      // Movement string
      var movStr = '&mdash;';
      if (movs && movs[c.id] !== undefined) {
        if (members.length === 0) {
          // Empty panel: MUST show the retention reason phrase verbatim (PS contract)
          movStr = fmt(0) + ' (retained &mdash; no members assigned)';
        } else {
          movStr = fmt(movs[c.id]);
        }
      }

      // Members string
      var membStr;
      if (!assgn) {
        membStr = '&mdash;';
      } else if (members.length === 0) {
        // Empty panel: MUST show literal text (PS contract)
        membStr = '(none this iteration)';
      } else {
        membStr = members.join(', ');
      }

      var div = document.createElement('div');
      div.className      = 'panel-card';
      div.style.borderColor = cfg.colour;
      div.innerHTML =
        '<div class="card-hd" style="background:' + cfg.colour + '">' +
          '<span class="card-ltr">' + cfg.letter + '</span> ' +
          '<span>' + c.id + '</span>' +
          '<span class="card-co">(' + fmt(c.warmth) + ',\u202F' + fmt(c.sparkle) + ')</span>' +
        '</div>' +
        '<div class="card-bd">' +
          '<div>Movement:\u2002' + movStr + '</div>' +
          '<div>Members:\u2002' + membStr + '</div>' +
        '</div>';
      elCards.appendChild(div);
    });
  }

  /* -------------------------------------------------------------------------
   * Sticker inspection panel
   *
   * IMPORTANT: distances are computed against the CENTRES USED FOR ASSIGNMENT
   * (the input centres of the last iteration), NOT the post-update current
   * centres. This is the only interpretation consistent with smoke-test steps
   * E and G simultaneously:
   *   - Step G (iter 1): assignment used original centres (2,2),(2,8),(8,5)
   *     → SUNRISE d²=11.250 to NEBULA and EMBER → tie visible.
   *   - Step E (iter 3, converged): assignment used history[1].centres;
   *     at convergence those equal current centres → same result either way.
   * ---------------------------------------------------------------------- */
  function inspect(idx) {
    var s    = ctrl.currentStickers[idx];
    var snap = ctrl.history.length ? ctrl.history[ctrl.history.length - 1] : null;
    var assgn = snap ? snap.assignments : null;

    // Centres used for last assignment (pre-update input centres)
    var aCentres;
    if (ctrl.iteration <= 1) {
      aCentres = ctrl.originalCentres;
    } else {
      aCentres = ctrl.history[ctrl.iteration - 2].centres;
    }

    var eng   = window.KMeansEngine;
    var dists = aCentres.map(function (c) {
      return { id: c.id, d2: eng.squaredDistance(s, c) };
    });

    var assignedId = assgn ? assgn[idx] : null;
    var minD2 = dists.reduce(function (m, d) { return Math.min(m, d.d2); }, Infinity);

    // Tie detection: any centre other than the assigned one within EPS of min
    var ties = dists.filter(function (d) {
      return d.id !== assignedId && Math.abs(d.d2 - minD2) <= EPS;
    });

    var distHtml = dists.map(function (d) {
      return '<span class="di"><b>' + d.id + '</b>:\u2009' + fmt(d.d2) + '</span>';
    }).join(' &middot; ');

    var tieHtml = '';
    if (assignedId && ties.length > 0) {
      var tiedIds = ties.map(function (t) { return t.id; }).join(', ');
      tieHtml = '<div class="tie-note">Tied with ' + tiedIds + '; ' +
        assignedId + ' earlier in centre source order.</div>';
    }

    elInspect.innerHTML =
      '<strong>' + s.id + '</strong> (' + fmt(s.warmth) + ', ' + fmt(s.sparkle) + ')' +
      '<div class="dist-row">d\u00B2 \u2192 ' + distHtml + '</div>' +
      (assignedId
        ? '<div>Assigned to: <b>' + assignedId + '</b></div>'
        : '<div>Not yet assigned (iteration 0).</div>') +
      tieHtml;
  }

  /* -------------------------------------------------------------------------
   * Button handlers
   * ---------------------------------------------------------------------- */
  function onLoad() {
    ctrl = window.KMeansController.createController(window.COSMIC_CAFE);

    // Populate sticker dropdown
    selSticker.innerHTML = '';
    ctrl.currentStickers.forEach(function (s) {
      var o = document.createElement('option');
      o.value = s.id;
      o.textContent = s.id;
      selSticker.appendChild(o);
    });
    // Pre-fill inputs for first sticker
    var first = ctrl.currentStickers[0];
    inpW.value = first.warmth;
    inpS.value = first.sparkle;

    btnStep.disabled  = false;
    btnRun.disabled   = false;
    btnReset.disabled = false;
    btnApply.disabled = false;

    clearBanner();
    elInspect.innerHTML = '<em>Click a sticker on the canvas to inspect distances.</em>';
    render();
  }

  function onStep() {
    if (!ctrl) return;
    ctrl.step();
    render();
    syncBtns();
  }

  function onRun() {
    if (!ctrl) return;
    ctrl.runToEnd();
    render();
    syncBtns();
  }

  function onReset() {
    if (!ctrl) return;
    ctrl.reset();
    btnStep.disabled = false;
    btnRun.disabled  = false;
    clearBanner();
    elInspect.innerHTML = '<em>Click a sticker on the canvas to inspect distances.</em>';
    render();
  }

  function onApply() {
    if (!ctrl) return;
    var id = selSticker.value;
    var w  = parseFloat(inpW.value);
    var s  = parseFloat(inpS.value);
    var res = ctrl.editSticker(id, w, s);
    if (!res.ok) {
      showBanner(res.errors.map(function (e) { return e.message; }).join(' | '));
    } else {
      clearBanner();
      btnStep.disabled = false;
      btnRun.disabled  = false;
      elInspect.innerHTML = '<em>Click a sticker on the canvas to inspect distances.</em>';
      render();
    }
  }

  function syncBtns() {
    var done = ctrl.status === 'CONVERGED' || ctrl.status === 'NOT_CONVERGED';
    btnStep.disabled = done;
    btnRun.disabled  = done;
  }

  /* -------------------------------------------------------------------------
   * Canvas click → hit-test stickers (linear scan, 12 px radius)
   * ---------------------------------------------------------------------- */
  function onCanvasClick(e) {
    if (!ctrl) return;
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width  / rect.width;
    var scaleY = canvas.height / rect.height;
    var mx = (e.clientX - rect.left) * scaleX;
    var my = (e.clientY - rect.top)  * scaleY;

    var best = null, bestD = HIT_R + 1;
    stickerHits.forEach(function (h) {
      var dx = mx - h.screenX, dy = my - h.screenY;
      var d  = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) { bestD = d; best = h; }
    });
    if (best) inspect(best.idx);
  }

  /* -------------------------------------------------------------------------
   * Banner helpers
   * ---------------------------------------------------------------------- */
  function showBanner(msg) {
    elBanner.textContent = msg;
    elBanner.classList.remove('hidden');
  }
  function clearBanner() {
    elBanner.textContent = '';
    elBanner.classList.add('hidden');
  }

  /* -------------------------------------------------------------------------
   * DOMContentLoaded — wire everything up
   * ---------------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    canvas    = document.getElementById('mainCanvas');
    ctx       = canvas.getContext('2d');

    btnLoad   = document.getElementById('btnLoad');
    btnStep   = document.getElementById('btnStep');
    btnRun    = document.getElementById('btnRun');
    btnReset  = document.getElementById('btnReset');
    btnApply  = document.getElementById('btnApply');

    selSticker = document.getElementById('selSticker');
    inpW       = document.getElementById('inpW');
    inpS       = document.getElementById('inpS');

    elIter    = document.getElementById('elIter');
    elStatus  = document.getElementById('elStatus');
    elSSE     = document.getElementById('elSSE');
    elCards   = document.getElementById('panelCards');
    elInspect = document.getElementById('inspection');
    elBanner  = document.getElementById('banner');

    btnLoad.addEventListener('click', onLoad);
    btnStep.addEventListener('click', onStep);
    btnRun.addEventListener('click',  onRun);
    btnReset.addEventListener('click', onReset);
    btnApply.addEventListener('click', onApply);
    canvas.addEventListener('click',  onCanvasClick);

    // Auto-fill editor inputs when a different sticker is selected
    selSticker.addEventListener('change', function () {
      if (!ctrl) return;
      var s = ctrl.currentStickers.find(function (st) { return st.id === selSticker.value; });
      if (s) { inpW.value = s.warmth; inpS.value = s.sparkle; }
    });
  });

})();
