/**
 * ui.js - Cosmic Cafe Edition: DOM wiring, Canvas rendering, direct dragging, and replay.
 *
 * All K-Means computation goes through window.KMeansController and window.KMeansEngine.
 * Visual separation:
 *   1. Assignment lines connect stickers to DECISION CENTRES (pre-update input centres).
 *   2. Centroid drift vectors connect DECISION CENTRES to UPDATED CENTRES.
 *   3. Replay timeline renders immutable historical snapshots without state mutation.
 */

'use strict';

(function () {

  /* -------------------------------------------------------------------------
   * Constants & Visual Configuration
   * ---------------------------------------------------------------------- */
  var PANEL_CFG = [
    { colour: '#38bdf8', letter: 'N', shape: 'circle',   name: 'NEBULA' },
    { colour: '#c084fc', letter: 'C', shape: 'triangle', name: 'COMET'  },
    { colour: '#fb923c', letter: 'E', shape: 'square',   name: 'EMBER'  },
    { colour: '#34d399', letter: 'P', shape: 'diamond',  name: 'PULSAR' },
  ];

  var X_MIN = 45, X_MAX = 515, Y_MIN = 45, Y_MAX = 515;
  var STICKER_R = 9;
  var HIT_R     = 14;
  var EPS       = 1e-12;

  /* -------------------------------------------------------------------------
   * Module-level state
   * ---------------------------------------------------------------------- */
  var ctrl            = null;   // current controller instance
  var viewedIteration = 0;      // active iteration snapshot being viewed (0..ctrl.iteration)
  var selectedSticker = null;   // ID of currently inspected sticker
  var stickerHits     = [];     // [{id, screenX, screenY, idx}]
  var centreHits      = [];     // [{id, screenX, screenY, idx}]
  var isAnimating     = false;  // animation guard

  // Dragging state
  var dragTarget = null;        // { type: 'sticker'|'centre', id, idx, startX, startY, currentX, currentY, hasMoved }

  /* -------------------------------------------------------------------------
   * DOM handles
   * ---------------------------------------------------------------------- */
  var canvas, ctx,
      selScenario, btnLoad, btnStep, btnRun, btnReset, btnFullscreen,
      selSticker, inpW, inpS, btnApply, btnAddSticker, btnRemoveSticker,
      selCentre, inpCW, inpCS, btnApplyCentre, btnAddCentre, btnRemoveCentre,
      modalAddSticker, inpNewStickerId, inpNewStickerW, inpNewStickerS, btnConfirmAddSticker, btnCancelAddSticker,
      modalAddCentre, inpNewCentreId, inpNewCentreW, inpNewCentreS, btnConfirmAddCentre, btnCancelAddCentre,
      timelineBox, timelineNotice, timelinePills,
      elIter, elStatus, elSSE, elSSETrend, elKBadge,
      eventCard, eventTitle, eventDetail,
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
    ctx.moveTo(x, y - r * 1.1);
    ctx.lineTo(x + r * 0.95, y + r * 0.6);
    ctx.lineTo(x - r * 0.95, y + r * 0.6);
    ctx.closePath();
  }

  function drawSq(x, y, r) {
    ctx.beginPath();
    ctx.rect(x - r * 0.85, y - r * 0.85, 1.7 * r, 1.7 * r);
  }

  function drawDiamond(x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.1);
    ctx.lineTo(x + r * 1.1, y);
    ctx.lineTo(x, y + r * 1.1);
    ctx.lineTo(x - r * 1.1, y);
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
    if (dist < 3) return;

    var headlen = 9;
    var angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle   = color;
    ctx.lineWidth   = 2;
    ctx.setLineDash([4, 4]);

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

  /* =========================================================================
   * Grid & Star Field Background
   * ========================================================================= */
  function renderGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Deep space dark background
    ctx.fillStyle = '#080c16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle plotting box
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.fillRect(X_MIN, Y_MIN, X_MAX - X_MIN, Y_MAX - Y_MIN);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth   = 0.75;
    var gi;
    for (gi = 0; gi <= 10; gi++) {
      ctx.beginPath(); ctx.moveTo(toX(gi), Y_MIN); ctx.lineTo(toX(gi), Y_MAX); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X_MIN, toY(gi)); ctx.lineTo(X_MAX, toY(gi)); ctx.stroke();
    }

    // Border of plotting domain
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(X_MIN, Y_MIN, X_MAX - X_MIN, Y_MAX - Y_MIN);

    // Tick labels
    ctx.fillStyle  = '#94a3b8';
    ctx.font       = '11px sans-serif';
    ctx.textAlign  = 'center';
    for (gi = 0; gi <= 10; gi++) ctx.fillText(gi, toX(gi), Y_MAX + 16);
    ctx.textAlign = 'right';
    for (gi = 0; gi <= 10; gi++) ctx.fillText(gi, X_MIN - 6, toY(gi) + 4);

    // Axis titles
    ctx.save();
    ctx.translate(14, (Y_MIN + Y_MAX) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.font = '600 12px sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('sparkle \u2192', 0, 0);
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.font = '600 12px sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('warmth \u2192', (X_MIN + X_MAX) / 2, canvas.height - 4);
  }

  /* =========================================================================
   * Main Render Routine
   * ========================================================================= */
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
      stickers.forEach(function (s, i) {
        var cid = assgn[i];
        var dc  = decisionCentres.find(function (x) { return x.id === cid; });
        if (!dc) return;

        var cidx = decisionCentres.findIndex(function(c) { return c.id === cid; });
        var cfg = PANEL_CFG[cidx] || { colour: '#64748b' };

        ctx.strokeStyle = cfg.colour;
        ctx.globalAlpha = 0.25;
        ctx.lineWidth   = 1.2;
        ctx.beginPath();
        ctx.moveTo(toX(s.warmth), toY(s.sparkle));
        ctx.lineTo(toX(dc.warmth), toY(dc.sparkle));
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      });
    }

    // 2. Centroid drift vectors & distinct vs stable markers
    centreHits = [];

    decisionCentres.forEach(function (dc, i) {
      var uc = updatedCentres.find(function (x) { return x.id === dc.id; });
      var cfg = PANEL_CFG[i] || { colour: '#6b7280' };

      var dcX = toX(dc.warmth), dcY = toY(dc.sparkle);
      var ucX = uc ? toX(uc.warmth) : dcX, ucY = uc ? toY(uc.sparkle) : dcY;
      var distPx = Math.sqrt((ucX - dcX) * (ucX - dcX) + (ucY - dcY) * (ucY - dcY));

      // Record hit target at updated centre (or decision centre if pre-run)
      centreHits.push({ id: dc.id, screenX: ucX, screenY: ucY, idx: i, warmth: uc ? uc.warmth : dc.warmth, sparkle: uc ? uc.sparkle : dc.sparkle });

      if (snap && distPx >= 1.5) {
        // DRIFTING CENTROID: Draw pre-update cross (X), drift arrow, and post-update star
        drawDriftArrow(dcX, dcY, ucX, ucY, cfg.colour);

        // Pre-update decision centre (hollow X)
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth   = 2.0;
        drawX(dcX, dcY, 7);

        ctx.fillStyle  = '#94a3b8';
        ctx.font       = '10px sans-serif';
        ctx.textAlign  = 'left';
        ctx.fillText('Pre: ' + dc.id + ' (' + fmt(dc.warmth) + ',' + fmt(dc.sparkle) + ')', dcX + 9, dcY - 6);

        // Post-update centroid (glowing star)
        ctx.save();
        ctx.shadowColor = cfg.colour;
        ctx.shadowBlur  = 12;
        ctx.fillStyle   = cfg.colour;
        ctx.font        = 'bold 20px serif';
        ctx.textAlign   = 'center';
        ctx.fillText('\u2605', ucX, ucY + 7);
        ctx.restore();

        ctx.fillStyle  = '#f1f5f9';
        ctx.font       = 'bold 10px sans-serif';
        ctx.textAlign  = 'left';
        ctx.fillText(uc.id + ' (' + fmt(uc.warmth) + ',' + fmt(uc.sparkle) + ')', ucX + 11, ucY + 4);
      } else {
        // STABLE / IDENTICAL CENTROID: Draw unified stable star marker (no double-drawing or drift shift)
        ctx.save();
        ctx.shadowColor = cfg.colour;
        ctx.shadowBlur  = 12;
        ctx.fillStyle   = cfg.colour;
        ctx.font        = 'bold 20px serif';
        ctx.textAlign   = 'center';
        ctx.fillText('\u2605', ucX, ucY + 7);
        ctx.restore();

        ctx.fillStyle  = '#cbd5e1';
        ctx.font       = '10px sans-serif';
        ctx.textAlign  = 'left';
        var isConvOrStable = (snap && snap.status === 'CONVERGED') || (snap && distPx < 1.5);
        var label = dc.id + (isConvOrStable ? ' (stable)' : '') + ' (' + fmt(dc.warmth) + ',' + fmt(dc.sparkle) + ')';
        ctx.fillText(label, ucX + 11, ucY + 4);
      }
    });

    // 5. Stickers with smart collision offset
    stickerHits = [];
    stickers.forEach(function (s, i) {
      var x   = toX(s.warmth), y = toY(s.sparkle);
      stickerHits.push({ id: s.id, screenX: x, screenY: y, idx: i, warmth: s.warmth, sparkle: s.sparkle });

      var cidx = assgn
        ? decisionCentres.findIndex(function (c) { return c.id === assgn[i]; })
        : -1;

      var isSelected = (selectedSticker === s.id);

      // Selected halo
      if (isSelected) {
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(x, y, STICKER_R + 6, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();
      }

      ctx.lineWidth = 1.8;
      if (cidx >= 0) {
        var cfg = PANEL_CFG[cidx] || { colour: '#6b7280', letter: decisionCentres[cidx].id.charAt(0), shape: 'circle' };
        var ltr = cfg.letter || decisionCentres[cidx].id.charAt(0);
        ctx.fillStyle   = cfg.colour;
        ctx.strokeStyle = '#ffffff';

        if      (cfg.shape === 'circle')   drawCircle(x, y, STICKER_R);
        else if (cfg.shape === 'triangle') drawTri(x, y, STICKER_R);
        else if (cfg.shape === 'square')   drawSq(x, y, STICKER_R);
        else if (cfg.shape === 'diamond')  drawDiamond(x, y, STICKER_R);

        ctx.fill();
        ctx.stroke();

        ctx.fillStyle  = '#0b0f19';
        ctx.font       = 'bold 9.5px sans-serif';
        ctx.textAlign  = 'center';
        ctx.fillText(ltr, x, y + 3.5);
      } else {
        // Unassigned
        ctx.fillStyle   = '#475569';
        ctx.strokeStyle = '#94a3b8';
        drawDiamond(x, y, 7.5);
        ctx.fill();
        ctx.stroke();
      }

      // Smart label position (offset to avoid close overlap between GALAXY & COSMO)
      var labelX = x + 11;
      var labelY = y - 4;
      if (s.id === 'COSMO') {
        labelX = x - 11;
        ctx.textAlign = 'right';
      } else {
        ctx.textAlign = 'left';
      }

      ctx.fillStyle  = isSelected ? '#38bdf8' : '#e2e8f0';
      ctx.font       = isSelected ? 'bold 10px sans-serif' : '10px sans-serif';
      ctx.fillText(s.id, labelX, labelY);
    });

    // 6. Drag feedback overlay
    if (dragTarget && dragTarget.hasMoved) {
      var dw = Math.round(fromX(dragTarget.currentX) * 10) / 10;
      var ds = Math.round(fromY(dragTarget.currentY) * 10) / 10;
      var dx = toX(dw), dy = toY(ds);

      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(dx, dy, 16, 0, 2 * Math.PI);
      ctx.stroke();

      var coordTxt = dragTarget.id + ': (' + dw.toFixed(1) + ', ' + ds.toFixed(1) + ')';
      ctx.font = 'bold 12px sans-serif';
      var tw = ctx.measureText(coordTxt).width;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.fillRect(dx - tw / 2 - 6, dy - 34, tw + 12, 22);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.strokeRect(dx - tw / 2 - 6, dy - 34, tw + 12, 22);
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(coordTxt, dx, dy - 19);
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
    elKBadge.textContent = 'k = ' + ctrl.k;

    if (viewedIteration > 1 && ctrl.history.length >= viewedIteration) {
      var prevSnap = ctrl.history[viewedIteration - 2];
      var dSSE = snap.sse - prevSnap.sse;
      var sign = dSSE > 0 ? '+' : '';
      elSSETrend.textContent = '(\u0394 ' + sign + fmt(dSSE) + ')';
    } else {
      elSSETrend.textContent = '';
    }

    // 9. Key Event & Stage Story Flow
    renderKeyEvent(ctrl.history, viewedIteration);
    renderStageStory(snap);

    // 10. Panel Cards & Legend
    renderCards(updatedCentres, decisionCentres, assgn, movs, stickers);
    renderLegend(decisionCentres);
  }

  /* =========================================================================
   * Generic Key Event Detector
   * ========================================================================= */
  function renderKeyEvent(history, viewedIter) {
    if (!eventTitle || !eventDetail) return;

    if (!history || history.length === 0 || viewedIter === 0) {
      eventTitle.textContent  = 'Baseline Initialized';
      eventDetail.textContent = 'Stickers and centroids positioned at baseline coordinates. Ready to step.';
      return;
    }

    var snap = history[viewedIter - 1];
    if (!snap) return;

    if (snap.status === 'CONVERGED') {
      eventTitle.textContent  = 'Clustering Converged \u2713';
      eventDetail.textContent = 'Assignment signature matches previous iteration. Centroid coordinates and memberships are stable at SSE = ' + fmt(snap.sse) + '.';
      return;
    }

    if (snap.status === 'NOT_CONVERGED' && snap.iteration >= 20) {
      eventTitle.textContent  = 'Iteration Cap (20) Reached';
      eventDetail.textContent = 'Algorithm terminated upon hitting the 20-iteration limit without signature convergence.';
      return;
    }

    if (viewedIter > 1 && history.length >= viewedIter) {
      var prevSnap = history[viewedIter - 2];
      var reassigned = [];
      snap.stickers.forEach(function (s, i) {
        if (snap.assignments[i] !== prevSnap.assignments[i]) {
          reassigned.push(s.id + ' (' + prevSnap.assignments[i] + ' \u2192 ' + snap.assignments[i] + ')');
        }
      });
      if (reassigned.length > 0) {
        eventTitle.textContent  = 'Cluster Reassignment (' + reassigned.length + ')';
        eventDetail.textContent = reassigned.join(', ') + '. Total SSE shifted to ' + fmt(snap.sse) + '.';
        return;
      }
    }

    // Tie check
    var ties = [];
    var eng = window.KMeansEngine;
    snap.stickers.forEach(function (s, i) {
      var dists = snap.decisionCentres.map(function (c) { return { id: c.id, d2: eng.squaredDistance(s, c) }; });
      var minDist = Math.min.apply(null, dists.map(function (d) { return d.d2; }));
      var tied = dists.filter(function (d) { return Math.abs(d.d2 - minDist) <= EPS; });
      if (tied.length > 1) {
        ties.push(s.id + ' tied between ' + tied.map(function(t){return t.id;}).join(' & ') + ' (d\u00B2=' + fmt(minDist) + ') \u2192 ' + snap.assignments[i] + ' won via source order');
      }
    });

    if (ties.length > 0) {
      eventTitle.textContent  = 'Equidistant Tie Resolved';
      eventDetail.textContent = ties.join('; ') + '.';
      return;
    }

    eventTitle.textContent  = 'Iteration ' + viewedIter + ' Active';
    eventDetail.textContent = 'Assigned stickers to nearest decision centres and recalculated mean centroid coordinates.';
  }

  /* =========================================================================
   * Timeline / Replay
   * ========================================================================= */
  function renderTimeline() {
    if (!timelinePills) return;
    timelinePills.innerHTML = '';

    if (viewedIteration < ctrl.iteration) {
      timelineNotice.textContent = '(Viewing Iteration ' + viewedIteration + ' of ' + ctrl.iteration + ' — Replay)';
    } else {
      timelineNotice.textContent = '';
    }

    var p0 = document.createElement('button');
    p0.className = 'tp-pill' + (viewedIteration === 0 ? ' active' : '');
    p0.textContent = 'Iter 0 (Initial)';
    p0.addEventListener('click', function () {
      viewedIteration = 0;
      render();
    });
    timelinePills.appendChild(p0);

    ctrl.history.forEach(function (h) {
      var it = h.iteration;
      var pill = document.createElement('button');
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

  /* =========================================================================
   * Stage Story Bar
   * ========================================================================= */
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

    var stageHtml = '';
    snap.stages.forEach(function (st) {
      stageHtml += '<div style=\"margin-top:3px;\"><b style=\"color:#38bdf8;\">' + st.stage + '. ' + st.name + ':</b> ' + st.desc + '</div>';
    });
    stageDesc.innerHTML = stageHtml;
  }

  /* =========================================================================
   * Panel Cards
   * ========================================================================= */
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
        membStr = '<span style=\"color:#fde047;\">(none this iteration)</span>';
      } else {
        membStr = members.join(', ');
      }

      var div = document.createElement('div');
      div.className         = 'panel-card';
      div.style.borderColor = cfg.colour;
      div.innerHTML =
        '<div class=\"card-hd\" style=\"background:' + cfg.colour + '22; border-bottom:1px solid ' + cfg.colour + '55;\">' +
          '<span class=\"card-ltr\" style=\"color:' + cfg.colour + ';\">' + ltr + '</span> ' +
          '<span style=\"color:#f8fafc;\">' + c.id + '</span>' +
          '<span class=\"card-co\">(' + fmt(c.warmth) + ',\u202F' + fmt(c.sparkle) + ')</span>' +
        '</div>' +
        '<div class=\"card-bd\">' +
          '<div><b>Movement:</b>\u2002' + movStr + '</div>' +
          '<div><b>Members (' + members.length + '):</b>\u2002' + membStr + '</div>' +
        '</div>';
      elCards.appendChild(div);
    });
  }

  /* =========================================================================
   * Dynamic Legend
   * ========================================================================= */
  function renderLegend(centres) {
    if (!elLegend) return;
    var shapeSymbols = { circle: '&#9679; Circle', triangle: '&#9651; Triangle', square: '&#9632; Square', diamond: '&#9670; Diamond' };
    var html = '';
    centres.forEach(function (c, i) {
      var cfg = PANEL_CFG[i] || { colour: '#6b7280', shape: 'circle', letter: c.id.charAt(0) };
      var sym = shapeSymbols[cfg.shape] || '&#9679; Symbol';
      var ltr = cfg.letter || c.id.charAt(0);
      html += '<span style=\"color:' + cfg.colour + '\">' + sym + ' = ' + c.id + ' (' + ltr + ')</span> ';
    });
    html += '<span>&#9674; grey diamond = unassigned</span> ';
    html += '<span>&#10005; hollow cross = decision centre</span> ';
    html += '<span>&#9733; glowing star = updated centroid</span> ';
    html += '<span>&rarr; dashed line = centroid drift</span>';
    elLegend.innerHTML = html;
  }

  /* =========================================================================
   * Sticker Inspection Panel
   * ========================================================================= */
  function inspect(idx) {
    if (!ctrl) return;

    var snap = (viewedIteration > 0 && ctrl.history.length >= viewedIteration)
      ? ctrl.history[viewedIteration - 1]
      : null;

    var stickers = snap ? snap.stickers : ctrl.currentStickers;
    var s = stickers[idx];
    if (!s) return;

    selectedSticker = s.id;
    selSticker.value = s.id;
    syncStickerInputs();

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
      var wrapStyle = isAssigned ? 'style=\"font-weight:700;color:#38bdf8;background:rgba(56,189,248,0.15);padding:1px 6px;border-radius:4px;\"' : '';
      return '<span class=\"di\" ' + wrapStyle + '><b>' + d.id + '</b>:\u2009' + fmt(d.d2) + '</span>';
    }).join(' &middot; ');

    var tieHtml = '';
    if (assignedId && ties.length > 0) {
      var tiedIds = ties.map(function (t) { return t.id; }).join(', ');
      tieHtml = '<div class=\"tie-note\">Tied with ' + tiedIds + ' (d\u00B2 = ' + fmt(minD2) + '); ' +
        '<b>' + assignedId + '</b> assigned because ' + assignedId + ' is earlier in centre source order.</div>';
    }

    var reassignmentHtml = '';
    if (viewedIteration > 1 && ctrl.history.length >= viewedIteration) {
      var prevSnap = ctrl.history[viewedIteration - 2];
      if (prevSnap && prevSnap.assignments[idx] && prevSnap.assignments[idx] !== assignedId) {
        reassignmentHtml = ' <span style=\"color:#f97316;font-size:11.5px;font-weight:600;\">(\u2190 reassigned from ' + prevSnap.assignments[idx] + ')</span>';
      }
    }

    var headerNote = (viewedIteration > 0)
      ? 'Distances to decision centres (pre-update, Iteration ' + viewedIteration + '):'
      : 'Initial distances to baseline centres:';

    elInspect.innerHTML =
      '<div><strong style=\"color:#f8fafc;font-size:14px;\">' + s.id + '</strong> (' + fmt(s.warmth) + ', ' + fmt(s.sparkle) + ')</div>' +
      '<div style=\"font-size:12px;color:#94a3b8;margin-top:2px;\">' + headerNote + '</div>' +
      '<div class=\"dist-row\">d\u00B2 \u2192 ' + distHtml + '</div>' +
      (assignedId
        ? '<div style=\"margin-top:4px;\">Assigned to: <b style=\"color:#38bdf8;\">' + assignedId + '</b>' + reassignmentHtml + '</div>'
        : '<div style=\"margin-top:4px;\">Not yet assigned (iteration 0).</div>') +
      tieHtml +
      '<div style=\"font-size:11px;color:#64748b;margin-top:6px;\">* Sticker coordinates remain fixed during K-Means iterations.</div>';

    render();
  }

  /* =========================================================================
   * Sync Helpers
   * ========================================================================= */
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
    if (btnAddSticker) btnAddSticker.disabled = !ctrl || ctrl.baselineStickers.length >= 30;
    if (btnRemoveSticker) btnRemoveSticker.disabled = !ctrl || ctrl.baselineStickers.length <= 2;
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
    if (btnAddCentre) btnAddCentre.disabled = !ctrl || ctrl.k >= 4;
    if (btnRemoveCentre) btnRemoveCentre.disabled = !ctrl || ctrl.k <= 2;
  }

  /* =========================================================================
   * Button Handlers
   * ========================================================================= */
  function onLoad() {
    if (isAnimating) return;
    var sc = selScenario.value;
    var collection = (sc === 'empty') ? window.EMPTY_PANEL : window.COSMIC_CAFE;
    ctrl = window.KMeansController.createController(collection);
    viewedIteration = 0;
    selectedSticker = null;

    syncStickerDropdown();
    syncCentreDropdown();

    btnStep.disabled  = false;
    btnRun.disabled   = false;
    btnReset.disabled = false;

    clearBanner();
    elInspect.innerHTML = '<em>Click any sticker on the canvas to inspect squared distances (d&sup2;) and tie-break reasoning.</em>';
    render();
  }

  function onStep() {
    if (!ctrl || isAnimating) return;

    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      ctrl.step();
      viewedIteration = ctrl.iteration;
      render();
      syncBtns();
      return;
    }

    // Smooth step transition animation
    isAnimating = true;
    btnStep.disabled = true;
    btnRun.disabled  = true;

    ctrl.step();
    viewedIteration = ctrl.iteration;
    render();

    setTimeout(function () {
      isAnimating = false;
      syncBtns();
    }, 450);
  }

  function onRun() {
    if (!ctrl || isAnimating) return;
    ctrl.runToEnd();
    viewedIteration = ctrl.iteration;
    render();
    syncBtns();
  }

  function onReset() {
    if (!ctrl) return;
    isAnimating = false;
    ctrl.reset();
    viewedIteration = 0;
    selectedSticker = null;
    syncStickerDropdown();
    syncCentreDropdown();
    btnStep.disabled = false;
    btnRun.disabled  = false;
    clearBanner();
    elInspect.innerHTML = '<em>Click any sticker on the canvas to inspect squared distances (d&sup2;) and tie-break reasoning.</em>';
    render();
  }

  function onApplySticker() {
    if (!ctrl || isAnimating) return;
    var id = selSticker.value;
    var w  = parseFloat(inpW.value);
    var s  = parseFloat(inpS.value);
    var res = ctrl.editSticker(id, w, s);
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

  function onOpenAddStickerModal() {
    if (!ctrl || isAnimating) return;
    if (ctrl.baselineStickers.length >= 30) {
      showBanner('Cannot add sticker: maximum count is 30.');
      return;
    }
    inpNewStickerId.value = 'STICKER_' + (ctrl.baselineStickers.length + 1);
    inpNewStickerW.value = '5.0';
    inpNewStickerS.value = '5.0';
    modalAddSticker.classList.remove('hidden');
    inpNewStickerId.focus();
  }

  function onCloseAddStickerModal() {
    modalAddSticker.classList.add('hidden');
  }

  function onConfirmAddSticker() {
    if (!ctrl || isAnimating) return;
    var id = inpNewStickerId.value.trim();
    var w = parseFloat(inpNewStickerW.value);
    var s = parseFloat(inpNewStickerS.value);

    var res = ctrl.addSticker(id, w, s);
    onCloseAddStickerModal();
    viewedIteration = 0;
    if (!res.ok) {
      showBanner(res.errors.map(function (e) { return e.message; }).join(' | '));
      btnStep.disabled = false;
      btnRun.disabled  = false;
      render();
    } else {
      clearBanner();
      syncStickerDropdown();
      selSticker.value = id;
      syncStickerInputs();
      btnStep.disabled = false;
      btnRun.disabled  = false;
      render();
    }
  }

  function onRemoveSticker() {
    if (!ctrl || isAnimating) return;
    if (ctrl.baselineStickers.length <= 2) {
      showBanner('Cannot remove sticker: minimum count is 2.');
      return;
    }
    if (ctrl.baselineStickers.length - 1 < ctrl.k) {
      showBanner('Cannot remove sticker: sticker count cannot fall below centroid count (k=' + ctrl.k + ').');
      return;
    }
    var id = selSticker.value;
    if (!id) return;
    var res = ctrl.removeSticker(id);
    viewedIteration = 0;
    if (!res.ok) {
      showBanner(res.errors.map(function (e) { return e.message; }).join(' | '));
      btnStep.disabled = false;
      btnRun.disabled  = false;
      render();
    } else {
      clearBanner();
      syncStickerDropdown();
      syncStickerInputs();
      btnStep.disabled = false;
      btnRun.disabled  = false;
      render();
    }
  }

  function onApplyCentre() {
    if (!ctrl || isAnimating) return;
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

  function onOpenAddCentreModal() {
    if (!ctrl || isAnimating) return;
    if (ctrl.k >= 4) {
      showBanner('Cannot add centre: maximum k is 4.');
      return;
    }
    inpNewCentreId.value = 'PANEL_' + (ctrl.k + 1);
    inpNewCentreW.value = '5.0';
    inpNewCentreS.value = '5.0';
    modalAddCentre.classList.remove('hidden');
    inpNewCentreId.focus();
  }

  function onCloseAddCentreModal() {
    modalAddCentre.classList.add('hidden');
  }

  function onConfirmAddCentre() {
    if (!ctrl || isAnimating) return;
    var id = inpNewCentreId.value.trim();
    var w = parseFloat(inpNewCentreW.value);
    var s = parseFloat(inpNewCentreS.value);

    var res = ctrl.addCentre(id, w, s);
    onCloseAddCentreModal();
    viewedIteration = 0;
    if (!res.ok) {
      showBanner(res.errors.map(function (e) { return e.message; }).join(' | '));
      btnStep.disabled = false;
      btnRun.disabled  = false;
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
    if (!ctrl || isAnimating) return;
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
      btnStep.disabled = false;
      btnRun.disabled  = false;
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

  function isFullscreenActive() {
    return !!(document.fullscreenElement ||
              document.webkitFullscreenElement ||
              document.mozFullScreenElement ||
              document.msFullscreenElement ||
              document.body.classList.contains('pseudo-fullscreen'));
  }

  function updateFullscreenBtn(active) {
    if (!btnFullscreen) return;
    if (active) {
      btnFullscreen.innerHTML = '&#x26F6; Exit Fullscreen';
      btnFullscreen.classList.add('active-fullscreen');
    } else {
      btnFullscreen.innerHTML = '&#x26F6; Full Screen';
      btnFullscreen.classList.remove('active-fullscreen');
    }
  }

  function onToggleFullscreen() {
    var doc = document.documentElement;
    var req = doc.requestFullscreen || doc.webkitRequestFullscreen || doc.mozRequestFullScreen || doc.msRequestFullscreen;
    var exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;

    if (!isFullscreenActive()) {
      if (req) {
        try {
          var promise = req.call(doc);
          if (promise && promise.then) {
            promise.then(function() {
              updateFullscreenBtn(true);
            }).catch(function() {
              document.body.classList.add('pseudo-fullscreen');
              updateFullscreenBtn(true);
            });
          } else {
            updateFullscreenBtn(true);
          }
        } catch (err) {
          document.body.classList.add('pseudo-fullscreen');
          updateFullscreenBtn(true);
        }
      } else {
        document.body.classList.add('pseudo-fullscreen');
        updateFullscreenBtn(true);
      }
    } else {
      if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
        if (exit) {
          try {
            var exitPromise = exit.call(document);
            if (exitPromise && exitPromise.catch) {
              exitPromise.catch(function() {});
            }
          } catch (e) {}
        }
      }
      document.body.classList.remove('pseudo-fullscreen');
      updateFullscreenBtn(false);
    }
  }

  function syncBtns() {
    var done = ctrl.status === 'CONVERGED' || ctrl.status === 'NOT_CONVERGED';
    btnStep.disabled = done;
    btnRun.disabled  = done;
  }

  /* =========================================================================
   * Canvas Drag & Drop Direct Manipulation
   * ========================================================================= */
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
    if (!ctrl || isAnimating) return;
    var pos = getCanvasCoords(e);

    var hitCentre = null;
    centreHits.forEach(function (ch) {
      var dx = pos.x - ch.screenX, dy = pos.y - ch.screenY;
      if (Math.sqrt(dx * dx + dy * dy) <= 16) hitCentre = ch;
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
      if (Math.sqrt(dx * dx + dy * dy) <= 16) hover = true;
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

  /* =========================================================================
   * Banner helpers
   * ========================================================================= */
  function showBanner(msg) {
    elBanner.textContent = msg;
    elBanner.classList.remove('hidden');
  }
  function clearBanner() {
    elBanner.textContent = '';
    elBanner.classList.add('hidden');
  }

  /* =========================================================================
   * Initialization & DOM Binding
   * ========================================================================= */
  document.addEventListener('DOMContentLoaded', function () {
    canvas        = document.getElementById('mainCanvas');
    ctx           = canvas.getContext('2d');

    selScenario   = document.getElementById('selScenario');
    btnLoad       = document.getElementById('btnLoad');
    btnStep       = document.getElementById('btnStep');
    btnRun        = document.getElementById('btnRun');
    btnReset      = document.getElementById('btnReset');
    btnFullscreen = document.getElementById('btnFullscreen');

    selSticker       = document.getElementById('selSticker');
    inpW             = document.getElementById('inpW');
    inpS             = document.getElementById('inpS');
    btnApply         = document.getElementById('btnApply');
    btnAddSticker    = document.getElementById('btnAddSticker');
    btnRemoveSticker = document.getElementById('btnRemoveSticker');

    modalAddSticker      = document.getElementById('modalAddSticker');
    inpNewStickerId      = document.getElementById('inpNewStickerId');
    inpNewStickerW       = document.getElementById('inpNewStickerW');
    inpNewStickerS       = document.getElementById('inpNewStickerS');
    btnConfirmAddSticker = document.getElementById('btnConfirmAddSticker');
    btnCancelAddSticker  = document.getElementById('btnCancelAddSticker');

    selCentre       = document.getElementById('selCentre');
    inpCW           = document.getElementById('inpCW');
    inpCS           = document.getElementById('inpCS');
    btnApplyCentre  = document.getElementById('btnApplyCentre');
    btnAddCentre    = document.getElementById('btnAddCentre');
    btnRemoveCentre = document.getElementById('btnRemoveCentre');

    modalAddCentre      = document.getElementById('modalAddCentre');
    inpNewCentreId      = document.getElementById('inpNewCentreId');
    inpNewCentreW       = document.getElementById('inpNewCentreW');
    inpNewCentreS       = document.getElementById('inpNewCentreS');
    btnConfirmAddCentre = document.getElementById('btnConfirmAddCentre');
    btnCancelAddCentre  = document.getElementById('btnCancelAddCentre');

    timelineBox    = document.getElementById('timelineBox');
    timelineNotice = document.getElementById('timelineNotice');
    timelinePills  = document.getElementById('timelinePills');

    elIter      = document.getElementById('elIter');
    elStatus    = document.getElementById('elStatus');
    elSSE       = document.getElementById('elSSE');
    elSSETrend  = document.getElementById('elSSETrend');
    elKBadge    = document.getElementById('elKBadge');

    eventCard   = document.getElementById('eventCard');
    eventTitle  = document.getElementById('eventTitle');
    eventDetail = document.getElementById('eventDetail');

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
    btnFullscreen.addEventListener('click', onToggleFullscreen);
    btnApply.addEventListener('click', onApplySticker);
    if (btnAddSticker) btnAddSticker.addEventListener('click', onOpenAddStickerModal);
    if (btnRemoveSticker) btnRemoveSticker.addEventListener('click', onRemoveSticker);
    if (btnConfirmAddSticker) btnConfirmAddSticker.addEventListener('click', onConfirmAddSticker);
    if (btnCancelAddSticker) btnCancelAddSticker.addEventListener('click', onCloseAddStickerModal);

    btnApplyCentre.addEventListener('click', onApplyCentre);
    if (btnAddCentre) btnAddCentre.addEventListener('click', onOpenAddCentreModal);
    if (btnRemoveCentre) btnRemoveCentre.addEventListener('click', onRemoveCentre);
    if (btnConfirmAddCentre) btnConfirmAddCentre.addEventListener('click', onConfirmAddCentre);
    if (btnCancelAddCentre) btnCancelAddCentre.addEventListener('click', onCloseAddCentreModal);

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);

    canvas.addEventListener('touchstart', onMouseDown, { passive: true });
    canvas.addEventListener('touchmove',  onMouseMove, { passive: true });
    window.addEventListener('touchend',   onMouseUp,   { passive: true });

    selSticker.addEventListener('change', syncStickerInputs);
    selCentre.addEventListener('change',  syncCentreInputs);
    selScenario.addEventListener('change', function () {
      btnLoad.textContent = 'Load ' + (selScenario.value === 'empty' ? 'Empty Panel' : 'Demo');
    });

    // Auto-update button label if user presses ESC to exit fullscreen
    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(function (evt) {
      document.addEventListener(evt, function () {
        var isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
        if (!isFs) document.body.classList.remove('pseudo-fullscreen');
        updateFullscreenBtn(isFs);
      });
    });

    // Auto-load Cosmic Cafe demo on startup for seamless interviewer presentation
    onLoad();
  });

})();

