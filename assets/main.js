// LLM Price — diverging log-scale bars + vendor scatter, rendered from the source of truth.
(function () {
  'use strict';

  // Bar chart log domain: USD per 1M tokens, $0.01 .. $100 (covers cached-input lows to Fable output high)
  var LOG_MIN = -2;
  var LOG_MAX = 2;
  var TICKS = [0.01, 0.1, 1, 10, 100];

  var VENDOR_COLORS = {
    'Google': '#6ea8fe',
    'OpenAI': '#5fd0a7',
    'Anthropic': '#e8a06a',
    'xAI': '#b48ef0',
    'ByteDance': '#f07f8d',
    'Alibaba': '#8fd35f',
    'Tencent': '#5fc4e8',
    'DeepSeek': '#7d97ff',
    'Zhipu': '#e8d35f',
    'Moonshot': '#f0a8c8',
    'MiniMax': '#c0c8d8'
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

    // fit axes to the data
    var inputs = [], outputs = [];
    models.forEach(function (m) {
      var p = prices[m.display];
      if (!p) return;
      inputs.push(p.input); outputs.push(p.output);
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

    // dots + labels — greedy placement with candidate positions to reduce overlap
    var placed = [];
    var CANDIDATES = [
      { dx: 0, dy: -11 },   // above
      { dx: 0, dy: 18 },    // below
      { dx: 10, dy: -8, anchor: 'start' },   // upper right
      { dx: -10, dy: -8, anchor: 'end' },    // upper left
      { dx: 10, dy: 14, anchor: 'start' },   // lower right
      { dx: -10, dy: 14, anchor: 'end' }     // lower left
    ];
    models.forEach(function (m) {
      var p = prices[m.display];
      if (!p) return;
      var x = sx(p.input), y = sy(p.output);
      var color = VENDOR_COLORS[m.provider] || '#c0c8d8';

      var dot = svgEl('circle', { class: 'sc-dot', cx: x, cy: y, r: 5.5, fill: color });
      dot.appendChild(svgEl('title')).textContent =
        m.display + ' \u2014 input $' + fmt(p.input) + ', output $' + fmt(p.output);
      svg.appendChild(dot);

      // pick the first candidate position that doesn't collide with placed labels
      var est = m.display.length * 5.2; // rough label width in px
      var chosen = CANDIDATES[0];
      for (var c = 0; c < CANDIDATES.length; c++) {
        var cand = CANDIDATES[c];
        var lx = x + cand.dx, ly = y + cand.dy;
        var hit = false;
        for (var q = 0; q < placed.length; q++) {
          if (Math.abs(placed[q].x - lx) < (est + placed[q].w) / 2 && Math.abs(placed[q].y - ly) < 13) {
            hit = true; break;
          }
        }
        if (!hit) { chosen = cand; break; }
      }
      var label = svgEl('text', {
        class: 'sc-label', x: x + chosen.dx, y: y + chosen.dy,
        'text-anchor': chosen.anchor || 'middle'
      });
      label.textContent = m.display;
      svg.appendChild(label);
      placed.push({ x: x + chosen.dx, y: y + chosen.dy, w: est });
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

  function init(models, prices) {
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
    fetch('data/models.json').then(function (r) { return r.json(); }),
    fetch('data/prices.json').then(function (r) { return r.json(); })
  ]).then(function (res) {
    init(res[0].models, res[1].prices);
  }).catch(function (err) {
    console.error('LLM Price: failed to load data', err);
    document.getElementById('rows').textContent = 'Failed to load pricing data.';
  });
})();
