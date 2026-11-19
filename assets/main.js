// LLM Price — diverging log-scale bars + price-space scatter, rendered from the source of truth.
// All chart content comes from data/models.json + data/prices.json; nothing is hard-coded.
(function () {
  'use strict';

  // Bar chart log domain — computed from the data (see computeDomain)
  var LOG_MIN = -2;
  var LOG_MAX = 2;
  var TICKS = [];

  function computeDomain(prices) {
    var vals = [];
    Object.keys(prices).forEach(function (k) {
      var p = prices[k];
      ['input', 'cached_input', 'output'].forEach(function (key) {
        if (p[key] != null) vals.push(p[key]);
      });
    });
    var lo = Math.log10(Math.min.apply(null, vals));
    var hi = Math.log10(Math.max.apply(null, vals));
    LOG_MIN = Math.floor(lo);
    LOG_MAX = Math.max(LOG_MIN + 1, Math.ceil(hi));
    TICKS = [];
    for (var e = LOG_MIN; e <= LOG_MAX; e++) TICKS.push(Math.pow(10, e));
  }

  var VENDOR_COLORS = {
    'Google': '#3F84F3',
    'OpenAI': '#10A37F',
    'Anthropic': '#D97757',
    'xAI': '#8B9BB0',
    'ByteDance': '#AEBEF4',
    'Alibaba': '#684EEF',
    'Tencent': '#0551A8',
    'DeepSeek': '#0017EB',
    'Zhipu': '#8F80DB',
    'Moonshot': '#AC33F2',
    'Xiaomi': '#FF6900',
    'MiniMax': '#F44454'
  };

  function pct(v) {
    if (v == null || v <= 0) return 0;
    var l = Math.log10(v);
    var p = ((l - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100;
    return Math.max(0, Math.min(100, p));
  }

  function fmt(v) {
    if (v == null) return '\u2014';
    if (v >= 100) return v.toFixed(0);
    return v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  }

  function fmtTick(v) {
    return '$' + v;
  }

  function hostOf(u) {
    try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; }
  }

  function el(cls, tag) {
    var n = document.createElement(tag || 'div');
    if (cls) n.className = cls;
    return n;
  }

  // ---------- axis ----------
  function renderAxis() {
    var left = document.getElementById('axis-left');
    var right = document.getElementById('axis-right');
    TICKS.forEach(function (t, i) {
      var p = pct(t);
      var tl = el('axis-tick');
      tl.style.right = p + '%';
      tl.style.transform = 'translateX(50%)';
      if (i === 0) tl.style.transform = 'translateX(0)';                    // innermost: keep clear of center column
      if (i === TICKS.length - 1) tl.style.transform = 'translateX(100%)'; // outermost: keep inside chart pad
      tl.textContent = fmtTick(t);
      left.appendChild(tl);

      var tr = el('axis-tick');
      tr.style.left = p + '%';
      tr.style.transform = 'translateX(-50%)';
      if (i === 0) tr.style.transform = 'translateX(0)';                   // innermost: keep clear of center column
      if (i === TICKS.length - 1) tr.style.transform = 'translateX(-100%)'; // outermost: keep inside chart pad
      tr.textContent = fmtTick(t);
      right.appendChild(tr);
    });
  }

  // ---------- gridlines ----------
  function renderGridlines(rowsEl) {
    ['left', 'right'].forEach(function (side) {
      var zone = el('gl-zone gl-' + side);
      TICKS.forEach(function (t) {
        var line = el('gl-line');
        if (side === 'left') {
          line.style.right = pct(t) + '%';
        } else {
          line.style.left = pct(t) + '%';
        }
        zone.appendChild(line);
      });
      rowsEl.appendChild(zone);
    });
  }

  // ---------- diverging bars ----------
  function renderChart(rowsEl, models, prices) {
    var lastVendor = null;
    models.forEach(function (m) {
      var p = prices[m.display];
      if (!p) return;

      if (m.provider !== lastVendor) {
        var g = el('group-row');
        var gname = el('group-name');
        gname.textContent = m.provider;
        g.appendChild(gname);
        rowsEl.appendChild(g);
        lastVendor = m.provider;
      }

      var row = el('chart-row');

      // left: input (cached embedded as solid segment near center)
      var sideL = el('side side-left');
      var barL = el('bar');
      barL.style.width = pct(p.input) + '%';
      if (p.cached_input != null) {
        var seg = el('cached-seg');
        seg.style.width = (pct(p.cached_input) / pct(p.input) * 100) + '%';
        barL.appendChild(seg);
      }
      var valL = el('val');
      valL.textContent = '$' + fmt(p.input) +
        (p.cached_input != null ? ' ($' + fmt(p.cached_input) + ')' : '');
      barL.appendChild(valL);
      sideL.appendChild(barL);
      row.appendChild(sideL);

      // center: model name
      var center = el('center-label');
      center.textContent = m.display;
      center.title = m.display;
      row.appendChild(center);

      // right: output
      var sideR = el('side side-right');
      var barR = el('bar');
      barR.style.width = pct(p.output) + '%';
      var valR = el('val');
      valR.textContent = '$' + fmt(p.output);
      barR.appendChild(valR);
      sideR.appendChild(barR);
      row.appendChild(sideR);

      rowsEl.appendChild(row);
    });
  }

  // ---------- scatter ----------
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var SC = { w: 760, h: 520, ml: 64, mr: 24, mt: 24, mb: 52 };
  var SX = null, SY = null;

  function svgEl(tag, attrs) {
    var n = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  // data-driven log domain: fit the axis to the points, with padding
  function logDomain(vals) {
    var logs = vals.map(function (v) { return Math.log10(v); });
    var lo = Math.min.apply(null, logs), hi = Math.max.apply(null, logs);
    var pad = Math.max(0.12, (hi - lo) * 0.10);
    return { lo: lo - pad, hi: hi + pad };
  }

  // 1-2-5 ticks inside a log domain, thinned to <= 6
  function niceTicks(lo, hi) {
    var ticks = [];
    for (var e = Math.floor(lo) - 1; e <= Math.ceil(hi) + 1; e++) {
      [1, 2, 5].forEach(function (m) {
        var v = m * Math.pow(10, e);
        var lg = Math.log10(v);
        if (lg >= lo && lg <= hi) ticks.push(v);
      });
    }
    ticks.sort(function (a, b) { return a - b; });
    while (ticks.length > 6) ticks = ticks.filter(function (_, i) { return i % 2 === 0; });
    return ticks;
  }

  function sx(v) {
    var t = (Math.log10(v) - SX.lo) / (SX.hi - SX.lo);
    return SC.ml + t * (SC.w - SC.ml - SC.mr);
  }
  function sy(v) {
    var t = (Math.log10(v) - SY.lo) / (SY.hi - SY.lo);
    return SC.h - SC.mb - t * (SC.h - SC.mt - SC.mb);
  }

  function renderScatter(models, prices) {
    var svg = document.getElementById('scatter');

    // fit axes to the data (cached prices included — tails must stay inside)
    var inputs = [], outputs = [];
    models.forEach(function (m) {
      var p = prices[m.display];
      if (!p) return;
      inputs.push(p.input);
      if (p.cached_input != null) inputs.push(p.cached_input);
      outputs.push(p.output);
    });
    SX = logDomain(inputs); SY = logDomain(outputs);

    // grid + ticks
    niceTicks(SX.lo, SX.hi).forEach(function (t) {
      svg.appendChild(svgEl('line', { class: 'sc-grid', x1: sx(t), y1: SC.mt, x2: sx(t), y2: SC.h - SC.mb }));
      var lab = svgEl('text', { class: 'sc-tick', x: sx(t), y: SC.h - SC.mb + 20, 'text-anchor': 'middle' });
      lab.textContent = fmtTick(t);
      svg.appendChild(lab);
    });
    niceTicks(SY.lo, SY.hi).forEach(function (t) {
      svg.appendChild(svgEl('line', { class: 'sc-grid', x1: SC.ml, y1: sy(t), x2: SC.w - SC.mr, y2: sy(t) }));
      var lab = svgEl('text', { class: 'sc-tick', x: SC.ml - 10, y: sy(t) + 4, 'text-anchor': 'end' });
      lab.textContent = fmtTick(t);
      svg.appendChild(lab);
    });

    // reference line: output = input, clipped to the overlap of both domains
    var dLo = Math.max(SX.lo, SY.lo), dHi = Math.min(SX.hi, SY.hi);
    if (dLo < dHi) {
      var a = Math.pow(10, dLo), b = Math.pow(10, dHi);
      svg.appendChild(svgEl('line', { class: 'sc-ref', x1: sx(a), y1: sy(a), x2: sx(b), y2: sy(b) }));
    }

    // axes frame
    svg.appendChild(svgEl('line', { class: 'sc-axis-line', x1: SC.ml, y1: SC.h - SC.mb, x2: SC.w - SC.mr, y2: SC.h - SC.mb }));
    svg.appendChild(svgEl('line', { class: 'sc-axis-line', x1: SC.ml, y1: SC.mt, x2: SC.ml, y2: SC.h - SC.mb }));

    var xl = svgEl('text', { class: 'sc-axis-label', x: (SC.ml + SC.w - SC.mr) / 2, y: SC.h - 10, 'text-anchor': 'middle' });
    xl.textContent = 'Input price (USD / 1M tokens, log)';
    svg.appendChild(xl);
    var yl = svgEl('text', {
      class: 'sc-axis-label', x: 16, y: (SC.mt + SC.h - SC.mb) / 2,
      'text-anchor': 'middle', transform: 'rotate(-90 16 ' + ((SC.mt + SC.h - SC.mb) / 2) + ')'
    });
    yl.textContent = 'Output price (USD / 1M tokens, log)';
    svg.appendChild(yl);

    // layer order: leaders underneath dots, labels on top
    var leadersG = svgEl('g', { class: 'sc-leaders' });
    var dotsG = svgEl('g', { class: 'sc-dots' });
    var labelsG = svgEl('g', { class: 'sc-labels' });
    svg.appendChild(leadersG);
    svg.appendChild(dotsG);
    svg.appendChild(labelsG);

    var items = [];
    var tails = [];
    var rawPts = [];
    var coordGroups = {};
    models.forEach(function (m) {
      var p = prices[m.display];
      if (!p) return;
      var rx = sx(p.input), ry = sy(p.output);
      var key = rx.toFixed(1) + ',' + ry.toFixed(1);
      if (!coordGroups[key]) coordGroups[key] = [];
      var entry = { m: m, p: p, rx: rx, ry: ry, key: key, idxInGroup: coordGroups[key].length };
      coordGroups[key].push(entry);
      rawPts.push(entry);
    });

    rawPts.forEach(function (entry) {
      var m = entry.m, p = entry.p;
      var groupLen = coordGroups[entry.key].length;
      var shift = groupLen > 1 ? (entry.idxInGroup - (groupLen - 1) / 2) : 0;
      // micro-dodge co-located points so neither dot nor overlapping cache tail is buried
      var x = entry.rx + shift * 3.2;
      var y = entry.ry + shift * 2.4;
      var color = VENDOR_COLORS[m.provider] || '#c0c8d8';

      // tail: cached price (solid tick) .. input price (faded span) —
      // length shows the cache discount; mirrors the butterfly chart's
      // "input faded / cached solid" color language
      if (p.cached_input != null) {
        var xc = sx(p.cached_input);
        tails.push({ x1: Math.min(xc, x), x2: Math.max(xc, x), y: y });
        dotsG.appendChild(svgEl('line', {
          x1: xc, y1: y, x2: x, y2: y,
          stroke: color, 'stroke-opacity': 0.38, 'stroke-width': 3
        }));
        dotsG.appendChild(svgEl('line', {
          x1: xc, y1: y - 4.5, x2: xc, y2: y + 4.5,
          stroke: color, 'stroke-width': 2
        }));
      }

      var dot = svgEl('circle', { class: 'sc-dot', cx: x, cy: y, r: 5.5, fill: color });
      dot.appendChild(svgEl('title')).textContent =
        m.display + ' \u2014 input $' + fmt(p.input) +
        (p.cached_input != null ? ', cached $' + fmt(p.cached_input) : '') +
        ', output $' + fmt(p.output);
      dotsG.appendChild(dot);

      var textEl = svgEl('text', { class: 'sc-label', x: 0, y: 0, 'text-anchor': 'middle' });
      textEl.textContent = m.display;
      labelsG.appendChild(textEl);

      var bb = textEl.getBBox();
      var w = (bb && bb.width > 0) ? bb.width : m.display.length * 5.6;
      var h = (bb && bb.height > 0) ? bb.height : 12;
      var baselineOffset = (bb && bb.height > 0) ? -(bb.y + bb.height / 2) : 3.3;

      items.push({
        display: m.display,
        color: color,
        dx: x,
        dy: y,
        w: w,
        h: h,
        hw: w / 2 + 3,
        hh: h / 2 + 2.5,
        baselineOffset: baselineOffset,
        textEl: textEl,
        cx: x,
        cy: y,
        groupLen: groupLen,
        idxInGroup: entry.idxInGroup,
        shift: shift
      });
    });

    // force-directed label repulsion (ggrepel-style):
    // keeps isolated labels snug to the right of their dot,
    // pushes crowded clusters into clear space, and draws thin leader lines
    var plotL = SC.ml + 4, plotR = SC.w - SC.mr - 4;
    var plotT = SC.mt + 4, plotB = SC.h - SC.mb - 4;

    function clampBox(it) {
      if (it.cx - it.hw < plotL) it.cx = plotL + it.hw;
      if (it.cx + it.hw > plotR) it.cx = plotR - it.hw;
      if (it.cy - it.hh < plotT) it.cy = plotT + it.hh;
      if (it.cy + it.hh > plotB) it.cy = plotB - it.hh;
    }

    // preferred home: to the right of dot (avoids left-extending cache tail),
    // falling back to left if near the right border; align stagger with dot shift so leaders never cross
    items.forEach(function (it) {
      var rightHomeX = it.dx + it.hw + 8.5;
      if (rightHomeX + it.hw <= plotR) {
        it.homeX = rightHomeX;
        it.homeY = it.dy + it.shift * 14;
      } else {
        it.homeX = it.dx - it.hw - 8.5;
        it.homeY = it.dy + it.shift * 14;
      }
      it.cx = it.homeX;
      it.cy = it.homeY;
      clampBox(it);
    });

    var ITERS = 260;
    for (var step = 0; step < ITERS; step++) {
      var alpha = 1 - step / ITERS;
      var forces = items.map(function () { return { fx: 0, fy: 0 }; });

      // 1. label-label repulsion
      for (var i = 0; i < items.length; i++) {
        for (var j = i + 1; j < items.length; j++) {
          var a = items[i], b = items[j];
          var dx = a.cx - b.cx, dy = a.cy - b.cy;
          var ox = (a.hw + b.hw) - Math.abs(dx);
          var oy = (a.hh + b.hh) - Math.abs(dy);
          if (ox > 0 && oy > 0) {
            if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) dy = (i % 2 === 0 ? -1 : 1);
            // push primarily along the axis of shallower normalized penetration
            if (oy / (a.hh + b.hh) <= ox / (a.hw + b.hw)) {
              var sgnY = dy >= 0 ? 1 : -1;
              var pushY = oy * 0.55 + 0.6;
              forces[i].fy += sgnY * pushY;
              forces[j].fy -= sgnY * pushY;
              // horizontal nudge to help vertically sandwiched clusters fan out cleanly
              var sgnX = dx >= 0 ? 1 : -1;
              forces[i].fx += sgnX * 0.55;
              forces[j].fx -= sgnX * 0.55;
            } else {
              var sgnX2 = dx >= 0 ? 1 : -1;
              var pushX = ox * 0.55 + 0.6;
              forces[i].fx += sgnX2 * pushX;
              forces[j].fx -= sgnX2 * pushX;
            }
          }
        }
      }

      // 2. label-dot repulsion (against ALL dots)
      var DOT_PAD = 8;
      for (var i2 = 0; i2 < items.length; i2++) {
        var lab = items[i2];
        for (var k = 0; k < items.length; k++) {
          var dotPt = items[k];
          var ddx = lab.cx - dotPt.dx, ddy = lab.cy - dotPt.dy;
          var dox = (lab.hw + DOT_PAD) - Math.abs(ddx);
          var doy = (lab.hh + DOT_PAD) - Math.abs(ddy);
          if (dox > 0 && doy > 0) {
            if (doy / (lab.hh + DOT_PAD) <= dox / (lab.hw + DOT_PAD)) {
              forces[i2].fy += (ddy >= 0 ? 1 : -1) * (doy * 0.65 + 0.5);
              forces[i2].fx += (ddx >= 0 ? 1 : -1) * 0.35;
            } else {
              forces[i2].fx += (ddx >= 0 ? 1 : -1) * (dox * 0.65 + 0.5);
              // gentle vertical bias so wide labels wedged between two dots don't stall
              forces[i2].fy += (Math.abs(ddy) > 0.5 ? (ddy >= 0 ? 1 : -1) : (i2 % 2 === 0 ? 1 : -1)) * 0.6;
            }
          }
        }
      }

      // 3. soft repulsion away from cache tail lines
      for (var i3 = 0; i3 < items.length; i3++) {
        var lb = items[i3];
        for (var t = 0; t < tails.length; t++) {
          var tl = tails[t];
          if (lb.cx + lb.hw > tl.x1 && lb.cx - lb.hw < tl.x2) {
            var tdy = lb.cy - tl.y;
            var toy = (lb.hh + 2.5) - Math.abs(tdy);
            if (toy > 0) {
              forces[i3].fy += (tdy >= 0 ? 1 : -1) * toy * 0.32 * alpha;
            }
          }
        }
      }

      // 4. gentle spring back toward home (stronger while cooling, weak on overlap)
      for (var i4 = 0; i4 < items.length; i4++) {
        var itm = items[i4];
        var f = forces[i4];
        if (Math.abs(f.fx) < 0.1 && Math.abs(f.fy) < 0.1) {
          f.fx += (itm.homeX - itm.cx) * 0.08;
          f.fy += (itm.homeY - itm.cy) * 0.08;
        } else {
          f.fx += (itm.homeX - itm.cx) * 0.02 * alpha;
          f.fy += (itm.homeY - itm.cy) * 0.02 * alpha;
        }
        // step clamp for stability
        var maxStep = 6 * (0.35 + 0.65 * alpha);
        itm.cx += Math.max(-maxStep, Math.min(maxStep, f.fx));
        itm.cy += Math.max(-maxStep, Math.min(maxStep, f.fy));
        clampBox(itm);
      }
    }

    function countConflicts(idx, cx, cy) {
      var hits = 0;
      for (var m = 0; m < items.length; m++) {
        var o = items[m];
        if (Math.abs(cx - o.dx) < items[idx].hw + 7.5 && Math.abs(cy - o.dy) < items[idx].hh + 7.5) hits++;
        if (m !== idx && Math.abs(cx - o.cx) < items[idx].hw + o.hw && Math.abs(cy - o.cy) < items[idx].hh + o.hh) hits++;
      }
      return hits;
    }

    // final strict projection pass (labels & dots) to guarantee 0 overlap
    for (var pass = 0; pass < 140; pass++) {
      var moved = false;
      for (var pi = 0; pi < items.length; pi++) {
        for (var pj = pi + 1; pj < items.length; pj++) {
          var pa = items[pi], pb = items[pj];
          var pdx = pa.cx - pb.cx, pdy = pa.cy - pb.cy;
          var pox = (pa.hw + pb.hw) - Math.abs(pdx);
          var poy = (pa.hh + pb.hh) - Math.abs(pdy);
          if (pox > 0 && poy > 0) {
            moved = true;
            if (pass < 30 && poy / (pa.hh + pb.hh) <= pox / (pa.hw + pb.hw)) {
              var py = (pdy >= 0 ? 1 : -1) * (poy / 2 + 0.5);
              pa.cy += py; pb.cy -= py;
              var nudgeX = (pdx >= 0 ? 1 : -1) * 1.5;
              pa.cx += nudgeX; pb.cx -= nudgeX;
            } else {
              var px = (pdx >= 0 ? 1 : -1) * (pox / 2 + 0.5);
              pa.cx += px; pb.cx -= px;
            }
            clampBox(pa); clampBox(pb);
          }
        }
        var pl = items[pi];
        for (var pk = 0; pk < items.length; pk++) {
          var pd = items[pk];
          var ddx2 = pl.cx - pd.dx, ddy2 = pl.cy - pd.dy;
          var dox2 = (pl.hw + 7.5) - Math.abs(ddx2);
          var doy2 = (pl.hh + 7.5) - Math.abs(ddy2);
          if (dox2 > 0 && doy2 > 0) {
            moved = true;
            if (pass < 25) {
              if (doy2 <= dox2) pl.cy += (ddy2 >= 0 ? 1 : -1) * (doy2 + 0.5);
              else pl.cx += (ddx2 >= 0 ? 1 : -1) * (dox2 + 0.5);
              clampBox(pl);
            } else {
              // test 4 clear sides around the blocking dot and pick zero/min-conflict position nearest home
              var cands = [
                [pl.cx, pd.dy - pl.hh - 8],
                [pl.cx, pd.dy + pl.hh + 8],
                [pd.dx - pl.hw - 8, pl.cy],
                [pd.dx + pl.hw + 8, pl.cy]
              ];
              var bestScore = Infinity, bestX = pl.cx, bestY = pl.cy;
              for (var ci = 0; ci < cands.length; ci++) {
                var tx = Math.max(plotL + pl.hw, Math.min(plotR - pl.hw, cands[ci][0]));
                var ty = Math.max(plotT + pl.hh, Math.min(plotB - pl.hh, cands[ci][1]));
                var sc = countConflicts(pi, tx, ty) * 1e6 + Math.hypot(tx - pl.homeX, ty - pl.homeY);
                if (sc < bestScore) { bestScore = sc; bestX = tx; bestY = ty; }
              }
              pl.cx = bestX; pl.cy = bestY;
            }
          }
        }
      }
      if (!moved) break;
    }

    // position SVG text elements and draw thin leader lines when displaced
    items.forEach(function (it) {
      it.textEl.setAttribute('x', it.cx.toFixed(1));
      it.textEl.setAttribute('y', (it.cy + it.baselineOffset).toFixed(1));

      // nearest point on tight label box to the dot center
      var boxL = it.cx - it.w / 2 - 2, boxR = it.cx + it.w / 2 + 2;
      var boxT = it.cy - it.h / 2 - 1, boxB = it.cy + it.h / 2 + 1;
      var nx = Math.max(boxL, Math.min(boxR, it.dx));
      var ny = Math.max(boxT, Math.min(boxB, it.dy));
      var vx = nx - it.dx, vy = ny - it.dy;
      var dist = Math.hypot(vx, vy);
      // suppress short stub leaders when a label sits near its home position
      if (dist > 14) {
        var ux = vx / dist, uy = vy / dist;
        leadersG.appendChild(svgEl('line', {
          class: 'sc-leader',
          x1: (it.dx + ux * 6.5).toFixed(1),
          y1: (it.dy + uy * 6.5).toFixed(1),
          x2: nx.toFixed(1),
          y2: ny.toFixed(1),
          stroke: it.color
        }));
      }
    });
  }

  function renderVendorLegend(models) {
    var box = document.getElementById('vendor-legend');
    var seen = [];
    models.forEach(function (m) {
      if (seen.indexOf(m.provider) === -1) seen.push(m.provider);
    });
    seen.forEach(function (v) {
      var s = document.createElement('span');
      var i = document.createElement('i');
      i.style.background = VENDOR_COLORS[v] || '#c0c8d8';
      s.appendChild(i);
      s.appendChild(document.createTextNode(v));
      box.appendChild(s);
    });
  }

  // ---------- table ----------
  function renderTable(tbody, models, prices) {
    models.forEach(function (m) {
      var p = prices[m.display];
      if (!p) return;
      var tr = document.createElement('tr');

      var tdName = document.createElement('td');
      tdName.textContent = m.display;
      tr.appendChild(tdName);

      ['input', 'cached_input', 'output'].forEach(function (key) {
        var td = document.createElement('td');
        td.className = p[key] == null ? 'num dim' : 'num';
        td.textContent = p[key] == null ? '\u2014' : '$' + fmt(p[key]);
        tr.appendChild(td);
      });

      var tdSrc = document.createElement('td');
      var a = document.createElement('a');
      a.href = p.source_url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = hostOf(p.source_url);
      tdSrc.appendChild(a);
      tr.appendChild(tdSrc);

      tbody.appendChild(tr);
    });
  }

  // keep only entries with numeric, positive input & output — a bad scheduled
  // write must degrade gracefully instead of rendering NaN
  function validate(prices) {
    var clean = {};
    Object.keys(prices).forEach(function (k) {
      var p = prices[k];
      var ok = p && typeof p.input === 'number' && p.input > 0
        && typeof p.output === 'number' && p.output > 0
        && (p.cached_input == null || (typeof p.cached_input === 'number' && p.cached_input > 0));
      if (ok) clean[k] = p;
      else console.warn('LLM Price: skipped invalid price entry:', k);
    });
    return clean;
  }

  function init(models, prices) {
    prices = validate(prices);
    computeDomain(prices);
    document.title = 'LLM Price — Official API Pricing of Frontier Models';
    renderAxis();
    var rowsEl = document.getElementById('rows');
    renderGridlines(rowsEl);
    renderChart(rowsEl, models, prices);
    renderScatter(models, prices);
    renderVendorLegend(models);
    renderTable(document.getElementById('table-body'), models, prices);

    var dates = Object.keys(prices).map(function (k) { return prices[k].collected_at; });
    document.getElementById('model-count').textContent = Object.keys(prices).length + ' models';
    document.getElementById('collected-date').textContent = 'collected ' + (dates.sort().pop() || '');
  }

  Promise.all([
    fetch('data/models.json?t=' + Date.now()).then(function (r) { return r.json(); }),
    fetch('data/prices.json?t=' + Date.now()).then(function (r) { return r.json(); })
  ]).then(function (res) {
    init(res[0].models, res[1].prices);
  }).catch(function (err) {
    console.error('LLM Price: failed to load data', err);
    document.getElementById('rows').textContent = 'Failed to load pricing data.';
  });
})();
