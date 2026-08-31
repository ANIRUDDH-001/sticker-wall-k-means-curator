/**
 * ui.js - DOM wiring, Canvas rendering, direct map dragging, centroid editing.
 *
 * All K-Means computation goes through window.KMeansController and window.KMeansEngine.
 * Direct dragging completes via the shared ctrl.editSticker / ctrl.editCentre paths.
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
    { colour: '#10b981', letter: 'P', shape: 'diamond'  },
  ];
  var X_MIN = 40, X_MAX = 460, Y_MIN = 40, Y_MAX = 460;
  var STICKER_R = 8;
  var HIT_R     = 12;
  var EPS       = 1e-12;

  /* -------------------------------------------------------------------------
   * Module-level state
   * ---------------------------------------------------------------------- */
  var ctrl            = null;   // current controller instance
  var viewedIteration = 0;      // active iteration snapshot being viewed (0..ctrl.iteration)
  var stickerHits     = [];     // [{id, screenX, screenY, idx}]
  var centreHits      = [];     // [{id, screenX, screenY, idx}]

  // Dragging state
  var dragTarget = null;        // { type: 'sticker'|'centre', id, idx, startX, startY, currentX, currentY, hasMoved }

  /* -------------------------------------------------------------------------
   * DOM handles
   * ---------------------------------------------------------------------- */
  var canvas, ctx,
      selScenario, btnLoad, btnStep, btnRun, btnReset,
      selSticker, inpW, inpS, btnApply,
      selCentre, inpCW, inpCS, btnApplyCentre, btnAddCentre, btnRemoveCentre,
      timelineBox, timelineNotice, timelinePills,
      elIter, elStatus, elSSE, elSSETrend,
      stageBox, stageDesc, stAssign, stUpdate, stMeasure, stCheck,
      elCards, elInspect, elBanner, elLegend;

  /* -------------------------------------------------------------------------
   * Coordinate helpers
   * ---------------------------------------------------------------------- */
  function toX(w) { return X_MIN + w * (X_MAX - X_MIN) / 10; }
  function toY(s) { return Y_MAX - s * (Y_MAX - Y_MIN) / 10; }
  function fromX(x) { return Math.max(0, Math.min(10, (x - X_MIN) / (X_MAX - X_MIN) * 10)); }
  function fromY(y) { return Math.max(0, Math.min(10, (Y_MAX - y) / (Y_MAX - Y_MIN) * 10)); }
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

  /* Hollow X mark for initial / decision centres */
  function drawX(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s);
    ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s);
    ctx.stroke();
  }

  /* Centroid drift arrow from decision centre to updated centre */
  function drawDriftArrow(fromX, fromY, toX, toY, color) {
    var dx = toX - fromX;
    var dy = toY - fromY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 2) return;

    var headlen = 8;
    var angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle   = color;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([3, 3]);

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function renderGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth   = 0.5;
    var gi;
    for (gi = 0; gi <= 10; gi++) {
      ctx.beginPath(); ctx.moveTo(toX(gi), Y_MIN); ctx.lineTo(toX(gi), Y_MAX); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X_MIN, toY(gi)); ctx.lineTo(X_MAX, toY(gi)); ctx.stroke();
    }

    ctx.fillStyle  = '#6b7280';
    ctx.font       = '10px sans-serif';
    ctx.textAlign  = 'center';
    for (gi = 0; gi <= 10; gi++) ctx.fillText(gi, toX(gi), Y_MAX + 14);
    ctx.textAlign = 'right';
    for (gi = 0; gi <= 10; gi++) ctx.fillText(gi, X_MIN - 4, toY(gi) + 4);

    // Axis title: sparkle
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
  }

  /* -------------------------------------------------------------------------
   * Main render — renders the snapshot for viewedIteration
   * ---------------------------------------------------------------------- */
  function render() {
    if (!ctrl) {
      renderGrid();
      return;
    }

    renderGrid();

    var snap = (viewedIteration > 0 && ctrl.history.length >= viewedIteration)
      ? ctrl.history[viewedIteration - 1]
      : null;

    var stickers        = snap ? snap.stickers : ctrl.currentStickers;
    var decisionCentres = snap ? snap.decisionCentres : ctrl.baselineCentres;
    var updatedCentres  = snap ? snap.updatedCentres  : ctrl.currentCentres;
    var assgn           = snap ? snap.assignments     : null;
    var movs            = snap ? snap.movements       : null;

    // 1. Assignment lines: connect stickers to DECISION CENTRES
    if (assgn) {
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth   = 1;
      stickers.forEach(function (s, i) {
        var cid = assgn[i];
        var dc  = decisionCentres.find(function (x) { return x.id === cid; });
        if (!dc) return;
        ctx.beginPath();
        ctx.moveTo(toX(s.warmth), toY(s.sparkle));
        ctx.lineTo(toX(dc.warmth), toY(dc.sparkle));
        ctx.stroke();
      });
    }

    // 2. Centroid drift vectors: DECISION CENTRES -> UPDATED CENTRES
    if (snap) {
      decisionCentres.forEach(function (dc, i) {
        var uc = updatedCentres.find(function (x) { return x.id === dc.id; });
        if (uc) {
          var cfg = PANEL_CFG[i] || { colour: '#6b7280' };
          drawDriftArrow(toX(dc.warmth), toY(dc.sparkle), toX(uc.warmth), toY(uc.sparkle), cfg.colour);
        }
      });
    }

    // 3. Decision centres (hollow X)
    centreHits = [];
    decisionCentres.forEach(function (c, i) {
      var x = toX(c.warmth), y = toY(c.sparkle);
      centreHits.push({ id: c.id, screenX: x, screenY: y, idx: i, warmth: c.warmth, sparkle: c.sparkle });
      ctx.strokeStyle = '#374151';
      ctx.lineWidth   = 2;
      drawX(x, y, 7);
      ctx.fillStyle  = '#374151';
      ctx.font       = '10px sans-serif';
      ctx.textAlign  = 'left';
      var label = (snap ? 'Pre: ' : '') + c.id;
      ctx.fillText(label, x + 10, y - 6);
    });

    // 4. Updated centres (filled star)
    if (snap || ctrl.iteration > 0) {
      updatedCentres.forEach(function (c, i) {
        var cfg = PANEL_CFG[i] || { colour: '#6b7280' };
        var x   = toX(c.warmth), y = toY(c.sparkle);
        ctx.fillStyle  = cfg.colour;
        ctx.font       = 'bold 17px serif';
        ctx.textAlign  = 'center';
        ctx.fillText('\u2605', x, y + 6);
      });
    }

    // 5. Stickers
    stickerHits = [];
    stickers.forEach(function (s, i) {
      var x   = toX(s.warmth), y = toY(s.sparkle);
      stickerHits.push({ id: s.id, screenX: x, screenY: y, idx: i, warmth: s.warmth, sparkle: s.sparkle });

      var cidx = assgn
        ? decisionCentres.findIndex(function (c) { return c.id === assgn[i]; })
        : -1;
      ctx.lineWidth = 1.5;

      if (cidx >= 0) {
        var cfg = PANEL_CFG[cidx] || { colour: '#6b7280', letter: decisionCentres[cidx].id.charAt(0), shape: 'circle' };
        var ltr = cfg.letter || decisionCentres[cidx].id.charAt(0);
        ctx.fillStyle   = cfg.colour;
        ctx.strokeStyle = cfg.colour;
        if      (cfg.shape === 'circle')   drawCircle(x, y, STICKER_R);
        else if (cfg.shape === 'triangle') drawTri(x, y, STICKER_R + 1);
        else if (cfg.shape === 'square')   drawSq(x, y, STICKER_R - 1);
        else if (cfg.shape === 'diamond')  drawDiamond(x, y, STICKER_R);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle  = '#fff';
        ctx.font       = 'bold 9px sans-serif';
        ctx.textAlign  = 'center';
        ctx.fillText(ltr, x, y + 3);
      } else {
        ctx.fillStyle   = '#9ca3af';
        ctx.strokeStyle = '#6b7280';
        drawDiamond(x, y, 7);
        ctx.fill();
        ctx.stroke();
      }

      ctx.fillStyle  = '#111827';
      ctx.font       = '9px sans-serif';
      ctx.textAlign  = 'left';
      ctx.fillText(s.id, x + 10, y - 4);
    });

    // 6. Drag feedback overlay
    if (dragTarget && dragTarget.hasMoved) {
      var dw = Math.round(fromX(dragTarget.currentX) * 10) / 10;
      var ds = Math.round(fromY(dragTarget.currentY) * 10) / 10;
      var dx = toX(dw), dy = toY(ds);

      ctx.save();
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(dx, dy, 14, 0, 2 * Math.PI);
      ctx.stroke();

      var coordTxt = dragTarget.id + ': (' + dw.toFixed(1) + ', ' + ds.toFixed(1) + ')';
      ctx.font = 'bold 11px sans-serif';
      var tw = ctx.measureText(coordTxt).width;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(dx - tw / 2 - 4, dy - 30, tw + 8, 18);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(coordTxt, dx, dy - 17);
      ctx.restore();
    }

    // 7. Timeline Replay Bar
    renderTimeline();

    // 8. Status & SSE Metrics
    var displayStatus = snap ? snap.status : ctrl.status;
    elIter.textContent   = viewedIteration;
    elStatus.textContent = displayStatus;
    elStatus.className   = 'status-pill sp-' + displayStatus.toLowerCase().replace('_', '-');
    elSSE.textContent    = snap ? fmt(snap.sse) : '\u2014';

    if (viewedIteration > 1 && ctrl.history.length >= viewedIteration) {
      var prevSnap = ctrl.history[viewedIteration - 2];
      var dSSE = snap.sse - prevSnap.sse;
      var sign = dSSE > 0 ? '+' : '';
      elSSETrend.textContent = '(\u0394 ' + sign + fmt(dSSE) + ')';
    } else {
      elSSETrend.textContent = '';
    }

    // 9. Stage Story Flow
    renderStageStory(snap);

    // 10. Panel cards & Dynamic Legend
    renderCards(updatedCentres, decisionCentres, assgn, movs, stickers);
    renderLegend(decisionCentres);
  }

  /* -------------------------------------------------------------------------
   * Timeline / Replay Bar
   * ---------------------------------------------------------------------- */
  function renderTimeline() {
    if (!timelinePills) return;
    timelinePills.innerHTML = '';

    if (viewedIteration < ctrl.iteration) {
      timelineNotice.textContent = '(Viewing Iteration ' + viewedIteration + ' of ' + ctrl.iteration + ' — Replay)';
    } else {
      timelineNotice.textContent = '';
    }

    var p0 = document.createElement('span');
    p0.className = 'tp-pill' + (viewedIteration === 0 ? ' active' : '');
    p0.textContent = 'Iter 0 (Initial)';
    p0.addEventListener('click', function () {
      viewedIteration = 0;
      render();
    });
    timelinePills.appendChild(p0);

    ctrl.history.forEach(function (h, idx) {
      var it = h.iteration;
      var pill = document.createElement('span');
      var isConv = h.status === 'CONVERGED';
      pill.className = 'tp-pill' +
        (isConv ? ' converged-pill' : '') +
        (viewedIteration === it ? ' active' : '');
      pill.textContent = 'Iter ' + it + (isConv ? ' \u2713' : '');
      pill.addEventListener('click', function () {
        viewedIteration = it;
        render();
      });
      timelinePills.appendChild(pill);
    });
  }

  /* -------------------------------------------------------------------------
   * Stage Story Bar
   * ---------------------------------------------------------------------- */
  function renderStageStory(snap) {
    if (!stageDesc) return;

    if (!snap) {
      stAssign.className  = 'stage-step';
      stUpdate.className  = 'stage-step';
      stMeasure.className = 'stage-step';
      stCheck.className   = 'stage-step';
      stageDesc.innerHTML = '<em>Initial baseline state. Next Step will execute Stage 1 (Assign) against initial decision centres.</em>';
      return;
    }

    stAssign.className  = 'stage-step active-stage';
    stUpdate.className  = 'stage-step active-stage';
    stMeasure.className = 'stage-step active-stage';
    stCheck.className   = 'stage-step active-stage';

    var stageHtml = '<div><strong>Iteration ' + snap.iteration + ' Stages:</strong></div>';
    snap.stages.forEach(function (st) {
      stageHtml += '<div style="margin-top:2px;"><b>' + st.stage + '. ' + st.name + ':</b> ' + st.desc + '</div>';
    });
    stageDesc.innerHTML = stageHtml;
  }

  /* -------------------------------------------------------------------------
   * Panel cards
   * ---------------------------------------------------------------------- */
  function renderCards(updatedCentres, decisionCentres, assgn, movs, stickers) {
    elCards.innerHTML = '';
    updatedCentres.forEach(function (c, i) {
      var cfg = PANEL_CFG[i] || { colour: '#6b7280', letter: c.id.charAt(0) };
      var ltr = cfg.letter || c.id.charAt(0);

      var members = [];
      if (assgn) {
        stickers.forEach(function (s, si) {
          if (assgn[si] === c.id) members.push(s.id);
        });
      }

      var movStr = '&mdash;';
      if (movs && movs[c.id] !== undefined) {
        if (members.length === 0) {
          movStr = fmt(0) + ' (retained &mdash; no members assigned)';
        } else {
          movStr = fmt(movs[c.id]);
        }
      }

      var membStr;
      if (!assgn) {
        membStr = '&mdash;';
      } else if (members.length === 0) {
        membStr = '(none this iteration)';
      } else {
        membStr = members.join(', ');
      }

      var div = document.createElement('div');
      div.className         = 'panel-card';
      div.style.borderColor = cfg.colour;
      div.innerHTML =
        '<div class="card-hd" style="background:' + cfg.colour + '">' +
          '<span class="card-ltr">' + ltr + '</span> ' +
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
   * Dynamic Legend
   * ---------------------------------------------------------------------- */
  function renderLegend(centres) {
    if (!elLegend) return;
    var shapeSymbols = { circle: '&#9679; Circle', triangle: '&#9651; Triangle', square: '&#9632; Square', diamond: '&#9670; Diamond' };
    var html = '';
    centres.forEach(function (c, i) {
      var cfg = PANEL_CFG[i] || { colour: '#6b7280', shape: 'circle', letter: c.id.charAt(0) };
      var sym = shapeSymbols[cfg.shape] || '&#9679; Symbol';
      var ltr = cfg.letter || c.id.charAt(0);
      html += '<span style="color:' + cfg.colour + '">' + sym + ' = ' + c.id + ' (' + ltr + ')</span> ';
    });
    html += '<span>&#9674; grey diamond = unassigned</span> ';
    html += '<span>&#10005; hollow cross = decision centre</span> ';
    html += '<span>&#9733; filled star = updated centre</span> ';
    html += '<span>&rarr; dashed line = centroid drift</span>';
    elLegend.innerHTML = html;
  }

  /* -------------------------------------------------------------------------
   * Sticker inspection panel — mathematically truthful against DECISION CENTRES
   * ---------------------------------------------------------------------- */
  function inspect(idx) {
    if (!ctrl) return;

    var snap = (viewedIteration > 0 && ctrl.history.length >= viewedIteration)
      ? ctrl.history[viewedIteration - 1]
      : null;

    var stickers = snap ? snap.stickers : ctrl.currentStickers;
    var s = stickers[idx];
    if (!s) return;

    var decisionCentres = snap ? snap.decisionCentres : ctrl.baselineCentres;
    var assgn           = snap ? snap.assignments     : null;

    var eng   = window.KMeansEngine;
    var dists = decisionCentres.map(function (c) {
      return { id: c.id, d2: eng.squaredDistance(s, c) };
    });

    var assignedId = assgn ? assgn[idx] : null;
    var minD2 = dists.reduce(function (m, d) { return Math.min(m, d.d2); }, Infinity);

    var ties = dists.filter(function (d) {
      return d.id !== assignedId && Math.abs(d.d2 - minD2) <= EPS;
    });

    var distHtml = dists.map(function (d) {
      var isAssigned = (d.id === assignedId);
      var wrapStyle = isAssigned ? 'style="font-weight:700;color:#1d4ed8;"' : '';
      return '<span class="di" ' + wrapStyle + '><b>' + d.id + '</b>:\u2009' + fmt(d.d2) + '</span>';
    }).join(' &middot; ');

    var tieHtml = '';
    if (assignedId && ties.length > 0) {
      var tiedIds = ties.map(function (t) { return t.id; }).join(', ');
      tieHtml = '<div class="tie-note">Tied with ' + tiedIds + ' (d\u00B2 = ' + fmt(minD2) + '); ' +
        '<b>' + assignedId + '</b> assigned because ' + assignedId + ' is earlier in centre source order.</div>';
    }

    var headerNote = (viewedIteration > 0)
      ? 'Assignment distances &mdash; centres before update (Iteration ' + viewedIteration + '):'
      : 'Initial distances &mdash; baseline centres:';

    elInspect.innerHTML =
      '<div><strong>' + s.id + '</strong> (' + fmt(s.warmth) + ', ' + fmt(s.sparkle) + ')</div>' +
      '<div style="font-size:12px;color:#4b5563;margin-top:2px;">' + headerNote + '</div>' +
      '<div class="dist-row">d\u00B2 \u2192 ' + distHtml + '</div>' +
      (assignedId
        ? '<div>Assigned to: <b>' + assignedId + '</b></div>'
        : '<div>Not yet assigned (iteration 0).</div>') +
      tieHtml;
  }

  /* -------------------------------------------------------------------------
   * Synchronization helpers
   * ---------------------------------------------------------------------- */
  function syncStickerDropdown() {
    selSticker.innerHTML = '';
    ctrl.baselineStickers.forEach(function (s) {
      var o = document.createElement('option');
      o.value = s.id;
      o.textContent = s.id;
      selSticker.appendChild(o);
    });
    syncStickerInputs();
  }

  function syncStickerInputs() {
    if (!ctrl) return;
    var s = ctrl.baselineStickers.find(function (st) { return st.id === selSticker.value; });
    if (s) {
      inpW.value = s.warmth;
      inpS.value = s.sparkle;
      inpW.disabled = false;
      inpS.disabled = false;
      btnApply.disabled = false;
    } else {
      inpW.disabled = true;
      inpS.disabled = true;
      btnApply.disabled = true;
    }
  }

  function syncCentreDropdown() {
    selCentre.innerHTML = '';
    ctrl.baselineCentres.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.id;
      selCentre.appendChild(o);
    });
    syncCentreInputs();
  }

  function syncCentreInputs() {
    if (!ctrl) return;
    var c = ctrl.baselineCentres.find(function (ct) { return ct.id === selCentre.value; });
    if (c) {
      inpCW.value = c.warmth;
      inpCS.value = c.sparkle;
      inpCW.disabled = false;
      inpCS.disabled = false;
      btnApplyCentre.disabled = false;
    } else {
      inpCW.disabled = true;
      inpCS.disabled = true;
      btnApplyCentre.disabled = true;
    }
    btnAddCentre.disabled = ctrl.k >= 4;
    btnRemoveCentre.disabled = ctrl.k <= 2;
  }

  /* -------------------------------------------------------------------------
   * Button handlers
   * ---------------------------------------------------------------------- */
  function onLoad() {
    var sc = selScenario.value;
    var collection = (sc === 'empty') ? window.EMPTY_PANEL : window.COSMIC_CAFE;
    ctrl = window.KMeansController.createController(collection);
    viewedIteration = 0;

    syncStickerDropdown();
    syncCentreDropdown();

    btnStep.disabled  = false;
    btnRun.disabled   = false;
    btnReset.disabled = false;

    clearBanner();
    elInspect.innerHTML = '<em>Click a sticker on the canvas to inspect distances.</em>';
    render();
  }

  function onStep() {
    if (!ctrl) return;
    ctrl.step();
    viewedIteration = ctrl.iteration;
    render();
    syncBtns();
  }

  function onRun() {
    if (!ctrl) return;
    ctrl.runToEnd();
    viewedIteration = ctrl.iteration;
    render();
    syncBtns();
  }

  function onReset() {
    if (!ctrl) return;
    ctrl.reset();
    viewedIteration = 0;
    syncStickerDropdown();
    syncCentreDropdown();
    btnStep.disabled = false;
    btnRun.disabled  = false;
    clearBanner();
    elInspect.innerHTML = '<em>Click a sticker on the canvas to inspect distances.</em>';
    render();
  }

  function onApplySticker() {
    if (!ctrl) return;
    var id = selSticker.value;
    var w  = parseFloat(inpW.value);
    var s  = parseFloat(inpS.value);
    var res = ctrl.editSticker(id, w, s);
    viewedIteration = 0;
    if (!res.ok) {
      showBanner(res.errors.map(function (e) { return e.message; }).join(' | '));
      btnStep.disabled = false;
      btnRun.disabled  = false;
      elInspect.innerHTML = '<em>Click a sticker on the canvas to inspect distances.</em>';
      render();
    } else {
      clearBanner();
      btnStep.disabled = false;
      btnRun.disabled  = false;
      elInspect.innerHTML = '<em>Click a sticker on the canvas to inspect distances.</em>';
      render();
    }
  }

  function onApplyCentre() {
    if (!ctrl) return;
    var id = selCentre.value;
    var w  = parseFloat(inpCW.value);
    var s  = parseFloat(inpCS.value);
    var res = ctrl.editCentre(id, w, s);
    viewedIteration = 0;
    if (!res.ok) {
      showBanner(res.errors.map(function (e) { return e.message; }).join(' | '));
      btnStep.disabled = false;
      btnRun.disabled  = false;
      render();
    } else {
      clearBanner();
      btnStep.disabled = false;
      btnRun.disabled  = false;
      render();
    }
  }

  function onAddCentre() {
    if (!ctrl) return;
    if (ctrl.k >= 4) {
      showBanner('Cannot add centre: maximum k is 4.');
      return;
    }
    var defaultId = 'PANEL_' + (ctrl.k + 1);
    var id = window.prompt ? window.prompt('Enter new centroid ID (2-30 chars):', defaultId) : defaultId;
    if (!id) return;
    id = id.trim();
    var res = ctrl.addCentre(id, 5, 5);
    viewedIteration = 0;
    if (!res.ok) {
      showBanner(res.errors.map(function (e) { return e.message; }).join(' | '));
      render();
    } else {
      clearBanner();
      syncCentreDropdown();
      selCentre.value = id;
      syncCentreInputs();
      btnStep.disabled = false;
      btnRun.disabled  = false;
      render();
    }
  }

  function onRemoveCentre() {
    if (!ctrl) return;
    if (ctrl.k <= 2) {
      showBanner('Cannot remove centre: minimum k is 2.');
      return;
    }
    var id = selCentre.value;
    if (!id) return;
    var res = ctrl.removeCentre(id);
    viewedIteration = 0;
    if (!res.ok) {
      showBanner(res.errors.map(function (e) { return e.message; }).join(' | '));
      render();
    } else {
      clearBanner();
      syncCentreDropdown();
      syncCentreInputs();
      btnStep.disabled = false;
      btnRun.disabled  = false;
      render();
    }
  }

  function syncBtns() {
    var done = ctrl.status === 'CONVERGED' || ctrl.status === 'NOT_CONVERGED';
    btnStep.disabled = done;
    btnRun.disabled  = done;
  }

  /* -------------------------------------------------------------------------
   * Canvas Drag & Drop Direct Manipulation
   * ---------------------------------------------------------------------- */
  function getCanvasCoords(e) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width  / rect.width;
    var scaleY = canvas.height / rect.height;
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top)  * scaleY,
    };
  }

  function onMouseDown(e) {
    if (!ctrl) return;
    var pos = getCanvasCoords(e);

    var hitCentre = null;
    centreHits.forEach(function (ch) {
      var dx = pos.x - ch.screenX, dy = pos.y - ch.screenY;
      if (Math.sqrt(dx * dx + dy * dy) <= 14) hitCentre = ch;
    });

    if (hitCentre) {
      dragTarget = {
        type: 'centre',
        id: hitCentre.id,
        idx: hitCentre.idx,
        startX: pos.x,
        startY: pos.y,
        currentX: pos.x,
        currentY: pos.y,
        hasMoved: false,
      };
      selCentre.value = hitCentre.id;
      syncCentreInputs();
      canvas.style.cursor = 'grabbing';
      return;
    }

    var hitSticker = null;
    stickerHits.forEach(function (sh) {
      var dx = pos.x - sh.screenX, dy = pos.y - sh.screenY;
      if (Math.sqrt(dx * dx + dy * dy) <= HIT_R) hitSticker = sh;
    });

    if (hitSticker) {
      dragTarget = {
        type: 'sticker',
        id: hitSticker.id,
        idx: hitSticker.idx,
        startX: pos.x,
        startY: pos.y,
        currentX: pos.x,
        currentY: pos.y,
        hasMoved: false,
      };
      selSticker.value = hitSticker.id;
      syncStickerInputs();
      canvas.style.cursor = 'grabbing';
    }
  }

  function onMouseMove(e) {
    if (!ctrl) return;
    var pos = getCanvasCoords(e);

    if (dragTarget) {
      var moveDist = Math.sqrt(Math.pow(pos.x - dragTarget.startX, 2) + Math.pow(pos.y - dragTarget.startY, 2));
      if (moveDist > 3) dragTarget.hasMoved = true;
      dragTarget.currentX = pos.x;
      dragTarget.currentY = pos.y;

      var dw = Math.round(fromX(pos.x) * 10) / 10;
      var ds = Math.round(fromY(pos.y) * 10) / 10;

      if (dragTarget.type === 'sticker') {
        inpW.value = dw;
        inpS.value = ds;
      } else {
        inpCW.value = dw;
        inpCS.value = ds;
      }

      render();
      return;
    }

    var hover = false;
    centreHits.forEach(function (ch) {
      var dx = pos.x - ch.screenX, dy = pos.y - ch.screenY;
      if (Math.sqrt(dx * dx + dy * dy) <= 14) hover = true;
    });
    stickerHits.forEach(function (sh) {
      var dx = pos.x - sh.screenX, dy = pos.y - sh.screenY;
      if (Math.sqrt(dx * dx + dy * dy) <= HIT_R) hover = true;
    });
    canvas.style.cursor = hover ? 'grab' : 'crosshair';
  }

  function onMouseUp(e) {
    if (!dragTarget) return;

    if (!dragTarget.hasMoved) {
      if (dragTarget.type === 'sticker') {
        inspect(dragTarget.idx);
      }
    } else {
      var pos = getCanvasCoords(e.changedTouches ? e.changedTouches[0] : e);
      var w = Math.round(fromX(pos.x) * 10) / 10;
      var s = Math.round(fromY(pos.y) * 10) / 10;

      if (dragTarget.type === 'sticker') {
        ctrl.editSticker(dragTarget.id, w, s);
      } else if (dragTarget.type === 'centre') {
        ctrl.editCentre(dragTarget.id, w, s);
      }
      viewedIteration = 0;
      btnStep.disabled = false;
      btnRun.disabled  = false;
      clearBanner();
    }

    dragTarget = null;
    canvas.style.cursor = 'crosshair';
    render();
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
    canvas      = document.getElementById('mainCanvas');
    ctx         = canvas.getContext('2d');

    selScenario = document.getElementById('selScenario');
    btnLoad     = document.getElementById('btnLoad');
    btnStep     = document.getElementById('btnStep');
    btnRun      = document.getElementById('btnRun');
    btnReset    = document.getElementById('btnReset');

    selSticker  = document.getElementById('selSticker');
    inpW        = document.getElementById('inpW');
    inpS        = document.getElementById('inpS');
    btnApply    = document.getElementById('btnApply');

    selCentre       = document.getElementById('selCentre');
    inpCW           = document.getElementById('inpCW');
    inpCS           = document.getElementById('inpCS');
    btnApplyCentre  = document.getElementById('btnApplyCentre');
    btnAddCentre    = document.getElementById('btnAddCentre');
    btnRemoveCentre = document.getElementById('btnRemoveCentre');

    timelineBox    = document.getElementById('timelineBox');
    timelineNotice = document.getElementById('timelineNotice');
    timelinePills  = document.getElementById('timelinePills');

    elIter      = document.getElementById('elIter');
    elStatus    = document.getElementById('elStatus');
    elSSE       = document.getElementById('elSSE');
    elSSETrend  = document.getElementById('elSSETrend');

    stageBox    = document.getElementById('stageBox');
    stageDesc   = document.getElementById('stageDesc');
    stAssign    = document.getElementById('stAssign');
    stUpdate    = document.getElementById('stUpdate');
    stMeasure   = document.getElementById('stMeasure');
    stCheck     = document.getElementById('stCheck');

    elCards     = document.getElementById('panelCards');
    elInspect   = document.getElementById('inspection');
    elBanner    = document.getElementById('banner');
    elLegend    = document.getElementById('legend');

    renderGrid();

    btnLoad.addEventListener('click', onLoad);
    btnStep.addEventListener('click', onStep);
    btnRun.addEventListener('click',  onRun);
    btnReset.addEventListener('click', onReset);
    btnApply.addEventListener('click', onApplySticker);

    btnApplyCentre.addEventListener('click', onApplyCentre);
    btnAddCentre.addEventListener('click', onAddCentre);
    btnRemoveCentre.addEventListener('click', onRemoveCentre);

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);

    // Touch support
    canvas.addEventListener('touchstart', onMouseDown, { passive: true });
    canvas.addEventListener('touchmove',  onMouseMove, { passive: true });
    window.addEventListener('touchend',   onMouseUp,   { passive: true });

    selSticker.addEventListener('change', syncStickerInputs);
    selCentre.addEventListener('change',  syncCentreInputs);
    selScenario.addEventListener('change', function () {
      btnLoad.textContent = 'Load ' + (selScenario.value === 'empty' ? 'Empty Panel' : 'Demo');
    });
  });

})();

