// LLM Price — render chart and table from the single source of truth.
(function () {
  'use strict';

  // Log scale domain: USD per 1M tokens, 10^-2 .. 10^2
  var LOG_MIN = -2;
  var LOG_MAX = 2;
  var TICKS = [0.01, 0.1, 1, 10, 100];

  function pct(v) {
    if (v == null || v <= 0) return 0;
    var l = Math.log10(v);
    var p = ((l - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100;
    return Math.max(0.6, Math.min(100, p));
  }

  function fmt(v) {
    if (v == null) return '\u2014';
    if (v >= 100) return v.toFixed(0);
    return v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  }

  function hostOf(u) {
    try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; }
  }

  function renderAxis(axis) {
    var scale = document.createElement('div');
    scale.className = 'axis-scale';
    TICKS.forEach(function (t, i) {
      var tick = document.createElement('span');
      tick.className = 'axis-tick';
      tick.style.left = pct(t) + '%';
      if (i === 0) tick.style.transform = 'translateX(0)';
      if (i === TICKS.length - 1) tick.style.transform = 'translateX(-100%)';
      tick.textContent = '$' + t;
      scale.appendChild(tick);
    });
    axis.appendChild(scale);
  }

  function makeBar(cls, v) {
    var bar = document.createElement('div');
    bar.className = 'bar ' + cls;
    bar.style.width = pct(v) + '%';
    var val = document.createElement('span');
    val.className = 'val';
    val.textContent = '$' + fmt(v);
    bar.appendChild(val);
    return bar;
  }

  function renderChart(rowsEl, models, prices) {
    models.forEach(function (m) {
      var p = prices[m.display];
      var row = document.createElement('div');
      row.className = 'chart-row';

      var name = document.createElement('div');
      name.className = 'model-name';
      name.textContent = m.display;
      name.title = m.display;
      row.appendChild(name);

      var bars = document.createElement('div');
      bars.className = 'bars';
      if (p) {
        bars.appendChild(makeBar('b-input', p.input));
        if (p.cached_input != null) bars.appendChild(makeBar('b-cached', p.cached_input));
        bars.appendChild(makeBar('b-output', p.output));
      }
      row.appendChild(bars);
      rowsEl.appendChild(row);
    });
  }

  function renderTable(tbody, models, prices) {
    models.forEach(function (m) {
      var p = prices[m.display];
      if (!p) return;
      var tr = document.createElement('tr');

      var tdName = document.createElement('td');
      tdName.textContent = m.display;
      tr.appendChild(tdName);

      [['input', 'num'], ['cached_input', 'num'], ['output', 'num']].forEach(function (pair) {
        var key = pair[0];
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
    renderAxis(document.getElementById('axis'));
    renderChart(document.getElementById('rows'), models, prices);
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
