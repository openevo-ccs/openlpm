/* Theory of Schooling Atlas: shows one or several theories of schooling as a flow from super-domains, through the kind of statement,
   to sub-domains, with the links between domains, the reasons given for each proposal and links to entries in the OpenEvo bases.
   <div data-openevo-atlas data-height="760px"></div> plus widgets/core/oew.js and this script, or widgets/theory-of-schooling-atlas.html in a frame.
   Options: data-height, data-narrow-auto, data-theories="name1,name2" (files in atlas/theories/, or full addresses), data-view="flow|links|reasons|table",
   data-select="improvement", data-private-links="hide". A theory is one JSON file in the format described in docs/schooling-atlas-data-format.md. */
(function () {
  'use strict';
  var h = OEW.h, sv = OEW.sv;
  var SCRIPT = document.currentScript;
  var BASE = SCRIPT && SCRIPT.src ? new URL('.', SCRIPT.src).href : new URL('widgets/atlas/', location.href).href;
  var NONE = '_none', NONE_COLOR = '#8a93a0';
  var COLORS = ['#006c66', '#b4410b', '#6b2fb3', '#0a62a8', '#8a6100'];
  var SHAPES = ['●', '■', '◆', '▲', '★'];
  var INK = '#2c3140', MUTED = '#566070';
  var GROUPS = [['concepts', 'Key ideas', 'ConceptBase'], ['theory', 'Theory behind it', 'TheoryBase'], ['literature', 'Further reading', 'LiteratureBase'], ['lessons', 'Lessons and materials', 'TeachingBase']];
  var STATUS = { 'ai-draft': 'Draft written with AI help and not yet checked by an expert', 'illustrative-example': 'Invented example', 'expert-reviewed': 'Checked by an expert', 'author-reviewed': 'Checked by the author' };
  var VIEWS = [['flow', 'Flow'], ['links', 'Links between domains'], ['reasons', 'Reasons'], ['table', 'Table']];
  var ctx = document.createElement('canvas').getContext('2d');

  function getJSON(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }
  function clamp(lo, v, hi) { return Math.max(lo, Math.min(hi, v)); }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  /* greedy word wrap using the measured text width, so labels never run outside their box; a word wider than the box is cut */
  function wrapLines(text, maxW, font) {
    ctx.font = font; var words = String(text).split(/\s+/), out = [], cur = '';
    function fits(s) { return ctx.measureText(s).width <= maxW; }
    words.forEach(function (w) {
      var t = cur ? cur + ' ' + w : w;
      if (fits(t)) { cur = t; return; }
      if (cur) { out.push(cur); cur = ''; }
      while (!fits(w) && w.length > 1) { var i = w.length - 1; while (i > 1 && !fits(w.slice(0, i) + '-')) i--; out.push(w.slice(0, i) + '-'); w = w.slice(i); }
      cur = w;
    });
    if (cur) out.push(cur);
    return out;
  }
  function textBlock(lines, x, y, anchor, cls, fs, lh, fill) {
    var t = sv('text', { x: x, y: y, 'text-anchor': anchor, class: cls || '', 'font-size': fs });
    if (fill) t.setAttribute('fill', fill);
    lines.forEach(function (l, i) { var s = sv('tspan', { x: x, dy: i === 0 ? 0 : lh }); s.textContent = l; t.appendChild(s); });
    return t;
  }

  /* ---------- reading a theory file ---------- */
  function normalize(d, model) {
    if (!d || typeof d !== 'object' || String(d.schema || '').indexOf('openevo-schooling-theory-profile') !== 0 || !Array.isArray(d.elements)) return { error: 'This file is not a theory of schooling in the expected format.' };
    var sup = {}, sub = {}, warnings = [];
    model.supers.forEach(function (x) { sup[x.id] = 1; }); model.subs.forEach(function (x) { sub[x.id] = 1; });
    var t = { id: String(d.id || 'theory-' + Math.random().toString(36).slice(2, 8)), title: String(d.title || 'Untitled theory'), summary: String(d.summary || ''), holder: d.holder || {}, visibility: d.visibility || 'public', license: d.license || '', version: d.version || '', date: d.date || '', theoryRef: d.theoryRef || '', characterizationStatus: d.characterizationStatus || '', provenance: d.provenance || {}, raw: d, elements: [], warrants: [], byId: {}, domainLinks: [] };
    d.elements.forEach(function (e) {
      if (!e || !e.id || !e.statement) return;
      var pl = e.placement || {};
      function clean(list, ok) { return (list || []).map(function (p) { return typeof p === 'string' ? { id: p, strength: 'firm' } : p; }).filter(function (p) { if (p && ok[p.id]) return true; if (p) warnings.push(p.id); return false; }).map(function (p) { return { id: p.id, strength: p.strength === 'single' ? 'single' : 'firm' }; }); }
      var x = { id: String(e.id), key: t.id + '#' + e.id, theory: t, type: e.type || 'proposition', statement: String(e.statement), stance: e.stance || 'own', sup: clean(pl.super, sup), sub: clean(pl.sub, sub), links: e.links || [], source: e.source || '', label: e.label || '', ref: e.ref || '', visibility: e.visibility || d.visibility || 'public', url: e.url || '', reasons: [], reasonFor: [] };
      t.elements.push(x); t.byId[x.id] = x;
    });
    (d.warrants || []).forEach(function (w) {
      var des = t.byId[w.design], basis = (w.basis || []).map(function (b) { return t.byId[b]; }).filter(Boolean);
      if (!des || !basis.length) return;
      var x = { id: String(w.id || 'w' + t.warrants.length), design: des, basis: basis, link: w.link || 'implied', basisKind: w.basisKind || '', note: String(w.note || ''), review: w.review || {}, theory: t };
      t.warrants.push(x); des.reasons.push(x); basis.forEach(function (b) { b.reasonFor.push(x); });
    });
    (d.domainLinks || []).forEach(function (l) {
      var ok = l && (l.scope === 'super' ? sup : l.scope === 'sub' ? sub : null);
      if (ok && ok[l.from] && ok[l.to] && l.from !== l.to) t.domainLinks.push({ scope: l.scope, from: l.from, to: l.to, relation: String(l.relation || ''), directed: !!l.directed, means: String(l.means || ''), theory: t });
    });
    t.warnings = warnings;
    return { theory: t };
  }

  function mount(host, opts) {
    var shell = OEW.shell(host, {
      attr: 'data-openevo-atlas', bodyClass: 'at-body', page: 'theory-of-schooling-atlas.html', scripts: ['atlas/atlas.js'], height: opts.height, narrowAuto: opts.narrowAuto, wide: 1000,
      embedAttrs: host.getAttribute('data-theories') ? 'data-theories="' + host.getAttribute('data-theories') + '"' : '',
      title: 'Theory of Schooling Atlas', subtitle: 'Explore a theory of schooling and how it connects to the OpenEvo bases',
      foot: 'The sorting of each statement into domains, the links between domains, and the links to base entries are first readings that have not yet been checked by the authors or by an expert. Select anything to see more.'
    });
    var panel = shell.panel;
    var view0 = opts.view === 'grid' || opts.view === 'web' ? 'flow' : opts.view;
    var S = { model: null, links: {}, theories: [], view: VIEWS.some(function (v) { return v[0] === view0; }) ? view0 : 'flow', sel: null, query: '', type: '', rows: 150, cards: 30, colorBy: 'domain', show: { shared: true, model: true, theory: true } };
    var root = h('div', { class: 'at-stage' }, [h('p', { class: 'oew-note', text: 'Loading…' })]);
    shell.stage(root);
    var own = null, els = {}, redraw = null;

    var dataAttr = host.hasAttribute('data-theories') ? host.getAttribute('data-theories') : 'openevo-school-improvement,example-community';
    var extra = null; try { extra = new URLSearchParams(location.search).get('theory'); } catch (e) { extra = null; }
    var names = dataAttr.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (extra && /^https:/.test(extra)) names.push(extra);
    var modelUrl = new URL(host.getAttribute('data-model') || 'model-schooling-domains-v1.json', BASE).href;

    /* a page that hosts the atlas can hand it theories: host.dispatchEvent(new CustomEvent('atlas:add-theory', { detail: profileObject })).
       Theories sent before the atlas is ready wait in a queue. The atlas announces itself with an 'atlas:ready' event. */
    var pending = [];
    function feed(detail) {
      var n = normalize(detail, S.model);
      if (n.error) { say(n.error); return; }
      var old = S.theories.filter(function (t) { return t.id === n.theory.id; })[0];
      if (old) S.theories.splice(S.theories.indexOf(old), 1);
      addTheory(n.theory); S.theories.forEach(function (t, i) { t.idx = i; t.color = COLORS[i % COLORS.length]; t.shape = SHAPES[i % SHAPES.length]; }); drawAll();
    }
    host.addEventListener('atlas:add-theory', function (ev) { if (!S.model) pending.push(ev.detail); else feed(ev.detail); });
    Promise.all([getJSON(modelUrl), getJSON(new URL('base-links.json', BASE).href).catch(function () { return { domains: {} }; })]).then(function (r) {
      S.model = r[0]; S.links = r[1].domains || {};
      return Promise.all(names.map(function (n) { var url = /^https?:/.test(n) ? n : new URL('theories/' + n + '.json', BASE).href; return getJSON(url).catch(function () { return null; }); }));
    }).then(function (list) {
      list.forEach(function (d) { if (d) { var n = normalize(d, S.model); if (n.theory) addTheory(n.theory); } });
      build(); drawAll();
      pending.splice(0).forEach(feed);
      host.dispatchEvent(new CustomEvent('atlas:ready', { bubbles: true }));
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (redraw) redraw(); });
      if (opts.select) { var f = findDomain(opts.select); if (f) choose({ type: 'domain', kind: f.kind, id: f.id }); }
    }).catch(function () { root.textContent = ''; root.appendChild(h('p', { class: 'oew-note', text: 'The atlas could not load its data. Reload the page to try again.' })); });

    function addTheory(t) { t.idx = S.theories.length; t.on = true; t.color = COLORS[t.idx % COLORS.length]; t.shape = SHAPES[t.idx % SHAPES.length]; S.theories.push(t); }
    function findDomain(id) { if (S.model.supers.some(function (x) { return x.id === id; })) return { kind: 'super', id: id }; return S.model.subs.some(function (x) { return x.id === id; }) ? { kind: 'sub', id: id } : null; }
    function dom(kind, id) { if (id === NONE) return { id: NONE, name: 'Not placed yet', short: 'Not placed yet', color: NONE_COLOR, means: 'Statements that have not been sorted into a ' + (kind === 'super' ? 'super-domain' : 'sub-domain') + ' in the theories shown.', ask: '' }; return (kind === 'super' ? S.model.supers : S.model.subs).filter(function (x) { return x.id === id; })[0]; }
    function kindOf(id) { return S.model.elementTypes.filter(function (x) { return x.id === id; })[0] || { id: id, name: id, short: id, color: '#566573', means: '' }; }
    function typeName(id) { return kindOf(id).name; }
    function vis() { return S.theories.filter(function (t) { return t.on; }); }
    function elements() { var out = []; vis().forEach(function (t) { out = out.concat(t.elements); }); return out; }
    function has(list, id) { return list.some(function (p) { return p.id === id; }); }
    function inDom(e, kind, id) { var l = kind === 'super' ? e.sup : e.sub; return id === NONE ? l.length === 0 : has(l, id); }
    function inCell(e, sup, sub) { return has(e.sup, sup) && has(e.sub, sub); }
    function part(e, p) { return p.col === 'kind' ? e.type === p.id : inDom(e, p.col, p.id); }
    function matches(e, sel) {
      if (!sel) return true;
      switch (sel.type) {
        case 'domain': return inDom(e, sel.kind, sel.id);
        case 'kind': return e.type === sel.id;
        case 'cell': return inCell(e, sel.sup, sel.sub);
        case 'flow': return sel.parts.every(function (p) { return part(e, p); });
        case 'dlink': return inDom(e, sel.scope, sel.a) && inDom(e, sel.scope, sel.b);
        case 'element': return e === sel.e || sel.e.reasons.some(function (w) { return w.basis.indexOf(e) >= 0; }) || sel.e.reasonFor.some(function (w) { return w.design === e; });
        default: return true;
      }
    }
    function listSel(sel) { return sel && sel.type !== 'element' && sel.type !== 'theory' && sel.type !== 'add'; }
    function short(e, n) { return OEW.sentence(e.statement, n || 90); }

    /* ---------- structure ---------- */
    function build() {
      root.textContent = '';
      var tabs = h('div', { class: 'oew-tabs at-tabs', role: 'tablist', 'aria-label': 'Choose a view' });
      els.tabs = {};
      VIEWS.forEach(function (t) {
        var b = h('button', { type: 'button', role: 'tab', id: shell.uid + '-tab-' + t[0], 'aria-selected': String(t[0] === S.view), text: t[1] });
        b.addEventListener('click', function () { S.view = t[0]; drawAll(); });
        b.addEventListener('keydown', function (ev) {
          var order = VIEWS.map(function (v) { return v[0]; }), i = order.indexOf(S.view);
          if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { ev.preventDefault(); S.view = order[(i + (ev.key === 'ArrowRight' ? 1 : order.length - 1)) % order.length]; drawAll(); els.tabs[S.view].focus(); }
        });
        els.tabs[t[0]] = b; tabs.appendChild(b);
      });
      els.bar = h('div', { class: 'at-theories', role: 'group', 'aria-label': 'Theories shown' });
      els.tools = h('div', { class: 'oew-row at-tools' });
      els.view = h('div', { class: 'at-view', role: 'tabpanel', tabindex: '-1' });
      els.status = h('p', { class: 'oew-note', role: 'status' });
      root.appendChild(tabs); root.appendChild(els.bar); root.appendChild(els.tools); root.appendChild(els.view); root.appendChild(els.status);

      var file = h('input', { type: 'file', accept: 'application/json,.json', class: 'at-file', 'aria-label': 'Open a theory file', hidden: true });
      file.addEventListener('change', function () {
        var f = file.files && file.files[0]; if (!f) return;
        var rd = new FileReader();
        rd.onload = function () {
          var n; try { n = normalize(JSON.parse(rd.result), S.model); } catch (e) { n = { error: 'The file could not be read as JSON.' }; }
          if (n.error) { say(n.error); return; }
          if (S.theories.some(function (t) { return t.id === n.theory.id; })) { say('A theory with this identifier is already open.'); return; }
          addTheory(n.theory); say('Opened “' + n.theory.title + '”. It stays in your browser and is not uploaded.'); choose({ type: 'theory', t: n.theory });
        };
        rd.readAsText(f); file.value = '';
      });
      var openBtn = h('button', { type: 'button', class: 'oew-step ghost', text: 'Open a theory file' }); openBtn.addEventListener('click', function () { file.click(); });
      var addBtn = h('button', { type: 'button', class: 'oew-step', text: 'Add your own statements' }); addBtn.addEventListener('click', function () { choose({ type: 'add' }); });
      els.tools.appendChild(addBtn); els.tools.appendChild(openBtn); els.tools.appendChild(file);
      shell.onReset(function () { S.sel = null; S.query = ''; S.type = ''; drawAll(); });
      if (window.ResizeObserver) { var last = 0, raf = 0; new ResizeObserver(function () { var w = els.view.clientWidth; if (Math.abs(w - last) < 2) return; last = w; cancelAnimationFrame(raf); raf = requestAnimationFrame(function () { if (redraw) redraw(); }); }).observe(els.view); }
    }
    function say(t) { els.status.textContent = t; }

    function drawBar() {
      els.bar.textContent = '';
      S.theories.forEach(function (t) {
        var b = h('button', { type: 'button', class: 'at-theory', 'aria-pressed': String(t.on), style: '--c:' + t.color }, [h('span', { class: 'at-shape', 'aria-hidden': 'true', text: t.shape }), h('span', { class: 'at-tt', text: t.title }), t.visibility === 'lab-only' ? h('span', { class: 'oew-tag lab', text: 'lab only' }) : null]);
        b.addEventListener('click', function () { t.on = !t.on; if (S.sel && S.sel.type === 'element' && S.sel.e.theory === t && !t.on) S.sel = null; drawAll(); });
        var info = h('button', { type: 'button', class: 'at-info', 'aria-label': 'About ' + t.title, text: 'i' });
        info.addEventListener('click', function () { choose({ type: 'theory', t: t }); });
        els.bar.appendChild(h('span', { class: 'at-theory-wrap' }, [b, info]));
      });
    }

    /* ---------- the flow (Sankey style) ---------- */
    function flowModel() {
      var m = S.model, ev = elements(), nodes = { super: {}, kind: {}, sub: {} }, links = {};
      function node(col, id) { return nodes[col][id] || (nodes[col][id] = { key: col + ':' + id, col: col, id: id, w: 0, els: [] }); }
      m.supers.forEach(function (a) { node('super', a.id); }); m.elementTypes.forEach(function (k) { node('kind', k.id); }); m.subs.forEach(function (b) { node('sub', b.id); });
      function addLink(a, b, w, e) {
        var g = S.colorBy === 'theory' ? e.theory.idx : 0, k = a.key + '>' + b.key + '#' + g, l = links[k] || (links[k] = { a: a, b: b, w: 0, els: [], g: g });
        l.w += w; if (l.els.indexOf(e) < 0) l.els.push(e);
      }
      ev.forEach(function (e) {
        var Ss = e.sup.length ? e.sup.map(function (p) { return p.id; }) : [NONE], Bs = e.sub.length ? e.sub.map(function (p) { return p.id; }) : [NONE], w = 1 / (Ss.length * Bs.length), kn = node('kind', e.type);
        if (kn.els.indexOf(e) < 0) kn.els.push(e);
        Ss.forEach(function (s) { var sn = node('super', s); if (sn.els.indexOf(e) < 0) sn.els.push(e); Bs.forEach(function (b) { var bn = node('sub', b); if (bn.els.indexOf(e) < 0) bn.els.push(e); sn.w += w; kn.w += w; bn.w += w; addLink(sn, kn, w, e); addLink(kn, bn, w, e); }); });
      });
      function col(c, order) { return order.map(function (id) { return nodes[c][id]; }).filter(Boolean).filter(function (n) { return n.id !== NONE || n.w > 0; }); }
      return { cols: [col('super', m.supers.map(function (x) { return x.id; }).concat([NONE])), col('kind', m.elementTypes.map(function (x) { return x.id; })), col('sub', m.subs.map(function (x) { return x.id; }).concat([NONE]))], links: Object.keys(links).map(function (k) { return links[k]; }), total: ev.length };
    }
    function colorOf(n) { if (n.col === 'kind') return kindOf(n.id).color; return dom(n.col, n.id).color; }
    function labelOf(n) { return n.col === 'kind' ? kindOf(n.id).short : dom(n.col, n.id).short; }
    function nodeSel(n) { return n.col === 'kind' ? { type: 'kind', id: n.id } : { type: 'domain', kind: n.col, id: n.id }; }

    function viewFlow() {
      var F = flowModel(), host_ = h('div', { class: 'at-flow' }), svg = null, nodeEls = [], linkEls = [];
      if (vis().length > 1) {
        var row = h('div', { class: 'at-ctl', role: 'group', 'aria-label': 'Colour of the ribbons' }, [h('span', { class: 'at-ctl-l', text: 'Colour the ribbons by' })]);
        [['domain', 'Domain'], ['theory', 'Theory']].forEach(function (c) { var b = h('button', { type: 'button', class: 'oew-chip', 'aria-pressed': String(S.colorBy === c[0]), text: c[1] }); b.addEventListener('click', function () { S.colorBy = c[0]; drawAll(); }); row.appendChild(b); });
        els.view.appendChild(row);
      }
      els.view.appendChild(host_);
      els.view.appendChild(h('p', { class: 'at-legend' }, [h('span', { text: 'Ribbon width shows how many statements. A statement placed in several domains is shared out between them. Select a box or a ribbon to see its statements.' })]));
      if (S.theories.length > 1) { var lg = h('p', { class: 'at-legend' }); S.theories.forEach(function (t) { lg.appendChild(h('span', { class: 'at-key' + (t.on ? '' : ' is-off'), style: '--c:' + t.color }, [h('i', { 'aria-hidden': 'true', text: t.shape }), ' ' + t.title + (t.on ? '' : ' (hidden)')])); }); els.view.appendChild(lg); }
      var partial = elements().filter(function (e) { return !(e.sup.length && e.sub.length); }).length;
      if (partial) els.view.appendChild(h('p', { class: 'oew-note', text: partial + ' of the ' + F.total + ' statements are not yet placed on one or both sides. They flow to the grey “Not placed yet” boxes.' }));
      if (!F.total) { host_.appendChild(h('p', { class: 'oew-note', text: 'No statements to show. Turn on a theory above or add your own statements.' })); return; }

      function draw() {
        var W = Math.max(280, Math.floor(host_.clientWidth || els.view.clientWidth || 600)), m = S.model, narrow = W < 520;
        var fs = narrow ? 12 : 13, lh = Math.round(fs * 1.25), font = '600 ' + fs + 'px Roboto, system-ui, sans-serif', subfont = '400 ' + (fs - 1.5) + 'px Roboto, system-ui, sans-serif', bw = narrow ? 10 : 12;
        var Lw = clamp(92, W * .17, 156), Rw = clamp(92, W * .17, 156), Mw = clamp(94, W * .15, 140);
        if (W - Lw - Rw - Mw - 2 * bw < 96) { Lw = Rw = Math.max(70, (W - Mw - 2 * bw - 96) / 2); }
        var gap = Math.max(20, (W - Lw - Rw - Mw - 2 * bw) / 2), xL = Lw, xML = xL + bw + gap, xMR = xML + Mw, xR = W - Rw - bw;
        var hw = Math.min(Lw + bw + gap * .45, W * .34), mw = Math.min(Mw + gap * .9, W * .34);
        var heads = [
          { t: m.flow.superHead, s: m.flow.superSub, x: 6, w: hw - 6, a: 'start' },
          { t: m.flow.kindHead, s: m.flow.kindSub, x: xML + Mw / 2, w: Math.max(Mw, mw), a: 'middle' },
          { t: m.flow.subHead, s: m.flow.subSub, x: W - 6, w: hw - 6, a: 'end' }
        ];
        var hfont = '700 ' + (fs + 1) + 'px Nunito, Roboto, system-ui, sans-serif', hl = 0;
        heads.forEach(function (hd) { hd.tl = wrapLines(hd.t, hd.w - 4, hfont); hd.sl = narrow ? [] : wrapLines(hd.s, hd.w - 4, subfont); hl = Math.max(hl, hd.tl.length * (lh + 1) + hd.sl.length * (lh - 1)); });
        var top = 10 + hl + 14;
        var cols = F.cols, wrapW = [Lw - 10, Mw - 10, Rw - 8];
        cols.forEach(function (c, ci) { c.forEach(function (n) { n.lines = wrapLines(labelOf(n), wrapW[ci], font); n.minH = Math.max(24, n.lines.length * lh + (ci === 1 ? 14 : 8) + (ci !== 1 ? lh : 0)); }); });
        var Ht = clamp(340, W * .62, 600), gapY = narrow ? 8 : 12, k = 40;
        cols.forEach(function (c) { var sw = c.reduce(function (a, n) { return a + n.w; }, 0), sm = c.reduce(function (a, n) { return a + n.minH; }, 0); if (sw > 0) k = Math.min(k, Math.max(.3, (Ht - (c.length - 1) * gapY - sm) / sw)); });
        var colH = cols.map(function (c) { var y = 0; c.forEach(function (n, i) { n.h = Math.max(n.minH, k * n.w); y += n.h + (i ? gapY : 0); }); return y; }), maxH = Math.max.apply(null, colH);
        cols.forEach(function (c, ci) { var y = top + (maxH - colH[ci]) / 2; c.forEach(function (n) { n.y = y; y += n.h + gapY; }); });
        var H = top + maxH + 12;
        F.links.forEach(function (l) { l.t = l.w * k; });
        cols.forEach(function (c) { c.forEach(function (n) {
          n.out = F.links.filter(function (l) { return l.a === n; }).sort(function (p, q) { return p.b.y - q.b.y || p.g - q.g; });
          n.in = F.links.filter(function (l) { return l.b === n; }).sort(function (p, q) { return p.a.y - q.a.y || p.g - q.g; });
          var y = n.y + (n.h - n.out.reduce(function (a, l) { return a + l.t; }, 0)) / 2; n.out.forEach(function (l) { l.y0 = y + l.t / 2; y += l.t; });
          y = n.y + (n.h - n.in.reduce(function (a, l) { return a + l.t; }, 0)) / 2; n.in.forEach(function (l) { l.y1 = y + l.t / 2; y += l.t; });
        }); });
        host_.textContent = ''; nodeEls = []; linkEls = [];
        svg = sv('svg', { class: 'at-flow-svg', viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'group', 'aria-label': 'Flow from super-domains through kinds of statement to sub-domains. The Table view holds the same information as text.' });
        var defs = sv('defs'), gl = sv('g', { class: 'at-ribbons' }), gn = sv('g', { class: 'at-nodes' }), gh = sv('g', { class: 'at-heads' });
        heads.forEach(function (hd) { gh.appendChild(textBlock(hd.tl, hd.x, 10 + lh - 3, hd.a, 'at-h1', fs + 1, lh + 1, INK)); if (hd.sl.length) gh.appendChild(textBlock(hd.sl, hd.x, 10 + hd.tl.length * (lh + 1) + lh - 6, hd.a, 'at-h2', fs - 1.5, lh - 1, MUTED)); });
        F.links.forEach(function (l, i) {
          var leftSide = l.a.col === 'super', xs = leftSide ? xL + bw : xMR, xt = leftSide ? xML : xR, xm = (xs + xt) / 2, c1, c2;
          if (S.colorBy === 'theory') { c1 = c2 = S.theories[l.g].color; } else { c1 = colorOf(l.a); c2 = colorOf(l.b); }
          var gid = shell.uid + '-g' + i;
          defs.appendChild(sv('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: xs, x2: xt, y1: 0, y2: 0 }, [sv('stop', { offset: 0, 'stop-color': c1 }), sv('stop', { offset: 1, 'stop-color': c2 })]));
          var p = sv('path', { class: 'at-rib', d: 'M' + xs + ',' + l.y0 + ' C' + xm + ',' + l.y0 + ' ' + xm + ',' + l.y1 + ' ' + xt + ',' + l.y1, fill: 'none', stroke: 'url(#' + gid + ')', 'stroke-width': Math.max(1.5, l.t) });
          var tt = sv('title'); tt.textContent = labelOf(l.a) + ' to ' + labelOf(l.b) + ': ' + plural(l.els.length, 'statement') + (S.colorBy === 'theory' ? ' (' + S.theories[l.g].title + ')' : ''); p.appendChild(tt);
          var spec = { type: 'flow', parts: [{ col: l.a.col, id: l.a.id }, { col: l.b.col, id: l.b.id }] };
          p.addEventListener('mouseenter', function () { paint(spec); }); p.addEventListener('mouseleave', function () { paint(null); });
          p.addEventListener('click', function () { choose(spec); });
          gl.appendChild(p); linkEls.push({ el: p, l: l });
        });
        cols.forEach(function (c, ci) { c.forEach(function (n) {
          var color = colorOf(n), count = n.els.length, ghost = count === 0, sel = S.sel && ((S.sel.type === 'domain' && n.col === S.sel.kind && n.id === S.sel.id) || (S.sel.type === 'kind' && n.col === 'kind' && n.id === S.sel.id));
          var nm = n.col === 'kind' ? kindOf(n.id).name : dom(n.col, n.id).name;
          var g = sv('g', { class: 'at-nd ' + n.col + (ghost ? ' is-ghost' : '') + (sel ? ' is-sel' : ''), role: 'button', tabindex: '0', 'aria-label': nm + ', ' + plural(count, 'statement'), 'aria-pressed': String(!!sel) });
          var tt = sv('title'); tt.textContent = nm + ': ' + plural(count, 'statement'); g.appendChild(tt);
          if (ci === 1) {
            g.appendChild(sv('rect', { x: xML, y: n.y, width: Mw, height: n.h, rx: 8, fill: ghost ? '#fff' : color, stroke: color, 'stroke-width': ghost ? 1.5 : 0, 'stroke-dasharray': ghost ? '4 3' : null }));
            var ly = n.y + n.h / 2 - ((n.lines.length - 1) * lh) / 2 - (count ? lh * .55 : 0) + fs * .35;
            g.appendChild(textBlock(n.lines, xML + Mw / 2, ly, 'middle', 'at-nt', fs, lh, ghost ? MUTED : '#fff'));
            if (count) g.appendChild(textBlock([String(count)], xML + Mw / 2, ly + (n.lines.length - 1) * lh + lh + 1, 'middle', 'at-nc', fs - 1, lh, '#fff'));
          } else {
            var bx = ci === 0 ? xL : xR;
            g.appendChild(sv('rect', { x: bx, y: n.y, width: bw, height: n.h, rx: 3, fill: ghost ? '#fff' : color, stroke: color, 'stroke-width': ghost ? 1.5 : 0, 'stroke-dasharray': ghost ? '3 2' : null }));
            var ty = n.y + n.h / 2 - ((n.lines.length) * lh) / 2 + fs * .95, tx = ci === 0 ? xL - 7 : xR + bw + 7, an = ci === 0 ? 'end' : 'start';
            g.appendChild(textBlock(n.lines, tx, ty, an, 'at-nt', fs, lh, ghost ? MUTED : INK));
            g.appendChild(textBlock([ghost ? 'none yet' : plural(count, 'statement')], tx, ty + n.lines.length * lh - 1, an, 'at-nc', fs - 1.5, lh, MUTED));
          }
          OEW.press(g, function () { choose(nodeSel(n)); });
          g.addEventListener('mouseenter', function () { paint(nodeSel(n)); }); g.addEventListener('mouseleave', function () { paint(null); });
          g.addEventListener('focus', function () { paint(nodeSel(n)); }); g.addEventListener('blur', function () { paint(null); });
          gn.appendChild(g); nodeEls.push({ el: g, n: n });
        }); });
        svg.appendChild(defs); svg.appendChild(gh); svg.appendChild(gl); svg.appendChild(gn); host_.appendChild(svg);
        paint(null);
      }
      function paint(spec) {
        var s = spec || S.sel; if (!svg) return;
        if (!s || !listSel(s) && s.type !== 'element') { svg.classList.remove('is-tracing'); nodeEls.forEach(function (x) { x.el.classList.remove('is-dim'); }); linkEls.forEach(function (x) { x.el.classList.remove('is-dim', 'is-lit'); }); return; }
        svg.classList.add('is-tracing');
        nodeEls.forEach(function (x) { x.el.classList.toggle('is-dim', !x.n.els.some(function (e) { return matches(e, s); })); });
        linkEls.forEach(function (x) { var on = x.l.els.some(function (e) { return matches(e, s); }); x.el.classList.toggle('is-dim', !on); x.el.classList.toggle('is-lit', on); });
      }
      redraw = draw; draw();
    }

    /* ---------- links between domains ---------- */
    function domainLinkList(scope) {
      var m = S.model, out = [], ev = elements(), key = {};
      function get(a, b) { var k = [a, b].sort().join('|'); return key[k] || (key[k] = { scope: scope, a: a < b ? a : b, b: a < b ? b : a, shared: [], model: [], theory: [] }); }
      ev.forEach(function (e) { var l = (scope === 'super' ? e.sup : e.sub).map(function (p) { return p.id; }); for (var i = 0; i < l.length; i++) for (var j = i + 1; j < l.length; j++) get(l[i], l[j]).shared.push(e); });
      ((m.links || {})[scope] || []).forEach(function (l) { get(l.from, l.to).model.push(l); });
      vis().forEach(function (t) { t.domainLinks.forEach(function (l) { if (l.scope === scope) get(l.from, l.to).theory.push(l); }); });
      Object.keys(key).forEach(function (k) { out.push(key[k]); });
      return out;
    }
    function visibleEdges(scope) {
      return domainLinkList(scope).filter(function (e) { return (S.show.shared && e.shared.length) || (S.show.model && e.model.length) || (S.show.theory && e.theory.length); }).map(function (e) {
        var sh = S.show.shared ? e.shared : [], mo = S.show.model ? e.model : [], th = S.show.theory ? e.theory : [];
        return { scope: e.scope, a: e.a, b: e.b, shared: sh, model: mo, theory: th, directed: mo.some(function (l) { return l.directed; }) || th.some(function (l) { return l.directed; }) };
      });
    }
    function viewLinks() {
      var m = S.model;
      var ctl = h('div', { class: 'at-ctl', role: 'group', 'aria-label': 'Kinds of link to show' }, [h('span', { class: 'at-ctl-l', text: 'Show' })]);
      [['shared', 'Seen together in statements'], ['model', 'Proposed in the model'], ['theory', 'Stated by a theory']].forEach(function (c) { var b = h('button', { type: 'button', class: 'oew-chip', 'aria-pressed': String(S.show[c[0]]), text: c[1] }); b.addEventListener('click', function () { S.show[c[0]] = !S.show[c[0]]; drawAll(); }); ctl.appendChild(b); });
      els.view.appendChild(ctl);
      var wrap = h('div', { class: 'at-dl' }), graphs = [];
      [['super', 'Super-domains', 'How the broad ideas about people and societies relate'], ['sub', 'Sub-domains', 'How the aspects of schooling relate']].forEach(function (sc) {
        var card = h('section', { class: 'at-dl-card' }, [h('h4', { text: sc[1] }), h('p', { class: 'oew-note', text: sc[2] + '.' })]);
        var host_ = h('div', { class: 'at-dl-host' }); card.appendChild(host_); graphs.push({ scope: sc[0], host: host_ }); wrap.appendChild(card);
      });
      els.view.appendChild(wrap);
      els.view.appendChild(h('p', { class: 'at-legend' }, [h('span', { class: 'at-key' }, [h('i', { class: 'at-sw solid', 'aria-hidden': 'true' }), ' Seen together: thickness shows how many statements sit in both domains']), h('span', { class: 'at-key' }, [h('i', { class: 'at-sw dash', 'aria-hidden': 'true' }), ' Proposed in the model: a draft for the authors to confirm']), h('span', { class: 'at-key' }, [h('i', { class: 'at-sw theory', 'aria-hidden': 'true' }), ' Stated by a theory, in that theory’s colour'])]));
      els.view.appendChild(h('p', { class: 'oew-note', text: (m.links && m.links.note) || '' }));
      var listHost = h('div', { class: 'at-dl-lists' }); els.view.appendChild(listHost);

      function describe(it) { var p = []; if (it.shared.length) p.push(plural(it.shared.length, 'shared statement')); it.model.forEach(function (l) { p.push('proposed: ' + l.relation); }); it.theory.forEach(function (l) { p.push(l.theory.title + ': ' + l.relation); }); return p.join('; '); }
      function draw() {
        graphs.forEach(function (g) { drawGraph(g); });
        listHost.textContent = '';
        graphs.forEach(function (g) {
          var items = visibleEdges(g.scope);
          listHost.appendChild(h('h4', { text: (g.scope === 'super' ? 'Super-domain' : 'Sub-domain') + ' links as a list' }));
          var ul = h('ul', { class: 'oew-items' });
          items.forEach(function (it) { var from = it.model[0] ? it.model[0].from : it.a, to = it.model[0] ? it.model[0].to : it.b, b = h('button', { type: 'button', class: 'at-link', text: dom(g.scope, it.directed ? from : it.a).short + (it.directed ? ' to ' : ' and ') + dom(g.scope, it.directed ? to : it.b).short + ': ' + describe(it) }); b.addEventListener('click', function () { choose({ type: 'dlink', scope: g.scope, a: it.a, b: it.b }); }); ul.appendChild(h('li', {}, [b])); });
          if (!items.length) ul.appendChild(h('li', { class: 'oew-note', text: 'No links to show with the current choices.' }));
          listHost.appendChild(ul);
        });
      }
      function drawGraph(g) {
        var scope = g.scope, items = scope === 'super' ? m.supers : m.subs, W = Math.max(260, Math.floor(g.host.clientWidth || 300)), narrow = W < 420, fs = narrow ? 12 : 13, lh = Math.round(fs * 1.25), font = '700 ' + fs + 'px Nunito, Roboto, system-ui, sans-serif';
        var Hh = scope === 'super' ? clamp(320, W * .6, 400) : clamp(300, W * .62, 430), pw = clamp(100, W * .24, 132), cx = W / 2, cy = Hh / 2, Rx = Math.max(40, W / 2 - pw / 2 - 8), Ry = Math.max(40, Hh / 2 - 40), order = ((m.links || {}).layout || {})[scope];
        var pos = {};
        var ring = items.filter(function (x) { return !x.umbrella; }), u = items.filter(function (x) { return x.umbrella; })[0];
        if (order) ring.sort(function (p, q) { return order.indexOf(p.id) - order.indexOf(q.id); });
        if (u) {
          /* an umbrella domain sits on top and the others in a two-by-two block under it */
          pos[u.id] = { x: cx, y: Hh * .13 };
          ring.forEach(function (x, i) { pos[x.id] = { x: W * (i % 2 ? .73 : .27), y: Hh * (i < 2 ? .52 : .88) }; });
        } else ring.forEach(function (x, i) { var a = -Math.PI / 2 + i * 2 * Math.PI / ring.length; pos[x.id] = { x: cx + Rx * Math.cos(a), y: cy + Ry * Math.sin(a) }; });
        var count = {}; items.forEach(function (x) { count[x.id] = elements().filter(function (e) { return inDom(e, scope, x.id); }).length; });
        var svg = sv('svg', { class: 'at-dl-svg', viewBox: '0 0 ' + W + ' ' + Hh, width: W, height: Hh, role: 'group', 'aria-label': (scope === 'super' ? 'Super-domains' : 'Sub-domains') + ' and the links between them. The list below holds the same information as text.' });
        var defs = sv('defs'); svg.appendChild(defs);
        function marker(id, color) { defs.appendChild(sv('marker', { id: id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, [sv('path', { d: 'M0,0 L10,5 L0,10 z', fill: color })])); }
        var mk = shell.uid + '-m-model-' + scope; marker(mk, '#26386b');
        var boxes = {}; items.forEach(function (x) { var bw_ = x.umbrella ? Math.min(W - 20, pw * 2.3) : pw, lines = wrapLines(x.short, bw_ - 16, font); boxes[x.id] = { lines: lines, w: bw_, h: lines.length * lh + lh + 12 }; });
        function trim(p, q, bq) { var dx = p.x - q.x, dy = p.y - q.y, t = Math.min(dx ? (bq.w / 2 + 4) / Math.abs(dx) : 9, dy ? (bq.h / 2 + 4) / Math.abs(dy) : 9); return { x: q.x + dx * t, y: q.y + dy * t }; }
        var gE = sv('g', { class: 'at-edges' }), gN = sv('g', { class: 'at-dnodes' }), edgeEls = [];
        function edge(it, kind, color, width, dash, bend, from, to, directed, marker_) {
          var A = pos[from], B = pos[to]; if (!A || !B) return;
          var p1 = trim(B, A, boxes[from]), p2 = trim(A, B, boxes[to]);
          var mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2, dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / len, ny = dx / len;
          var d = 'M' + p1.x + ',' + p1.y + ' Q' + (mx + nx * bend) + ',' + (my + ny * bend) + ' ' + p2.x + ',' + p2.y;
          var hit = sv('path', { d: d, fill: 'none', stroke: 'transparent', 'stroke-width': Math.max(14, width + 8), class: 'at-hit' });
          var p = sv('path', { d: d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-dasharray': dash, 'stroke-linecap': 'round', class: 'at-edge ' + kind, 'marker-end': directed ? 'url(#' + marker_ + ')' : null });
          var tt = sv('title'); tt.textContent = dom(scope, it.a).short + ' and ' + dom(scope, it.b).short; hit.appendChild(tt);
          hit.addEventListener('click', function () { choose({ type: 'dlink', scope: scope, a: it.a, b: it.b }); });
          hit.addEventListener('mouseenter', function () { edgeEls.forEach(function (x) { x.el.classList.toggle('is-dim', x.it !== it); }); }); hit.addEventListener('mouseleave', function () { edgeEls.forEach(function (x) { x.el.classList.remove('is-dim'); }); });
          gE.appendChild(hit); gE.appendChild(p); edgeEls.push({ el: p, it: it });
        }
        var edges = visibleEdges(scope), top = Math.max.apply(null, [1].concat(edges.map(function (e) { return e.shared.length; })));
        edges.forEach(function (it) {
          if (it.shared.length) edge(it, 'shared', '#0b8f80', 2 + 9 * it.shared.length / top, null, 0, it.a, it.b, false, null);
          it.model.forEach(function (l, i) { edge(it, 'model', '#26386b', 2.2, '6 5', (l.from < l.to ? 1 : -1) * (26 + i * 8), l.from, l.to, l.directed, mk); });
          it.theory.forEach(function (l) { var id = shell.uid + '-m-t' + l.theory.idx + '-' + scope; if (!defs.querySelector('#' + id)) marker(id, l.theory.color); edge(it, 'theory', l.theory.color, 3.2, null, -(l.from < l.to ? 1 : -1) * (26 + 8 * l.theory.idx), l.from, l.to, l.directed, id); });
        });
        svg.appendChild(gE);
        items.forEach(function (x) {
          var P = pos[x.id], b = boxes[x.id], sel = S.sel && ((S.sel.type === 'domain' && S.sel.kind === scope && S.sel.id === x.id) || (S.sel.type === 'dlink' && S.sel.scope === scope && (S.sel.a === x.id || S.sel.b === x.id)));
          var gg = sv('g', { class: 'at-dn2' + (sel ? ' is-sel' : ''), role: 'button', tabindex: '0', 'aria-label': dom(scope, x.id).name + ', ' + plural(count[x.id], 'statement'), 'aria-pressed': String(!!sel) });
          gg.appendChild(sv('rect', { x: P.x - b.w / 2, y: P.y - b.h / 2, width: b.w, height: b.h, rx: 10, fill: '#fff', stroke: x.color, 'stroke-width': sel ? 4 : 2.5 }));
          gg.appendChild(sv('rect', { x: P.x - b.w / 2 + 1.5, y: P.y - b.h / 2 + 1.5, width: 6, height: b.h - 3, rx: 3, fill: x.color }));
          gg.appendChild(textBlock(b.lines, P.x + 3, P.y - b.h / 2 + 7 + fs * .95, 'middle', 'at-nt', fs, lh, INK));
          gg.appendChild(textBlock([plural(count[x.id], 'statement')], P.x + 3, P.y - b.h / 2 + 7 + fs * .95 + b.lines.length * lh, 'middle', 'at-nc', fs - 2, lh, MUTED));
          OEW.press(gg, function () { choose({ type: 'domain', kind: scope, id: x.id }); });
          gN.appendChild(gg);
        });
        svg.appendChild(gN); g.host.textContent = ''; g.host.appendChild(svg);
      }
      redraw = draw; draw();
    }

    /* ---------- reasons ---------- */
    function viewReasons() {
      var list = h('ol', { class: 'at-reasons' }), n = 0, cards = [];
      vis().forEach(function (t) {
        t.warrants.forEach(function (w) {
          if (S.sel && listSel(S.sel) && !matches(w.design, S.sel) && !w.basis.some(function (b) { return matches(b, S.sel); })) return;
          if (S.sel && S.sel.type === 'element' && w.design !== S.sel.e && w.basis.indexOf(S.sel.e) < 0) return;
          n++;
          var d = h('button', { type: 'button', class: 'at-stmt design', style: '--c:' + t.color }, [h('span', { class: 'at-kind', text: typeName(w.design.type) }), h('span', { text: w.design.statement })]);
          d.addEventListener('click', function () { choose({ type: 'element', e: w.design }); });
          var bl = h('ul', { class: 'at-basis' });
          w.basis.forEach(function (b) { var bb = h('button', { type: 'button', class: 'at-stmt', style: '--c:' + t.color }, [h('span', { class: 'at-kind', text: typeName(b.type) + (b.stance === 'attributed' ? ', reported from another author' : '') }), h('span', { text: b.statement })]); bb.addEventListener('click', function () { choose({ type: 'element', e: b }); }); bl.appendChild(h('li', {}, [bb])); });
          cards.push(h('li', { class: 'at-warrant' }, [d, h('p', { class: 'at-because', text: 'The reasons given' + (vis().length > 1 ? ' (' + t.title + ')' : '') + ':' }), bl, w.note ? h('p', { class: 'oew-note', text: w.note }) : null, h('p', { class: 'oew-note', text: (w.link === 'explicit' ? 'The text states this link.' : 'The link is a reading of the text.') + ' ' + (STATUS[(w.review || {}).status] || '') })]));
        });
      });
      cards.slice(0, S.cards).forEach(function (c) { list.appendChild(c); });
      els.view.appendChild(h('p', { class: 'oew-note', text: plural(n, 'proposal') + ' with reasons' + (S.sel ? ' for the current selection' : '') + '. Each card pairs a proposal for teaching or schooling with the statements that make it sensible.' }));
      els.view.appendChild(list);
      if (n > S.cards) { var mb = h('button', { type: 'button', class: 'oew-step ghost', text: 'Show 30 more' }); mb.addEventListener('click', function () { S.cards += 30; drawAll(); }); els.view.appendChild(mb); }
      if (!n) els.view.appendChild(h('p', { class: 'oew-note', text: 'Nothing here for this selection. Clear the selection or turn on another theory.' }));
    }

    /* ---------- table ---------- */
    function viewTable() {
      var q = h('input', { type: 'search', class: 'at-q', value: S.query, 'aria-label': 'Filter statements', placeholder: 'Filter by words' });
      var ty = h('select', { class: 'at-type', 'aria-label': 'Kind of statement' }, [h('option', { value: '', text: 'All kinds' })].concat(S.model.elementTypes.map(function (t) { return h('option', { value: t.id, text: t.name, selected: S.type === t.id ? true : null }); })));
      var tbody = h('tbody'), status = h('p', { class: 'oew-note', role: 'status' }), more = h('button', { type: 'button', class: 'oew-step ghost', text: 'Show 150 more', hidden: true });
      more.addEventListener('click', function () { S.rows += 150; fill(); });
      function fill() {
        tbody.textContent = '';
        var rows = elements().filter(function (e) { return matches(e, listSel(S.sel) ? S.sel : null) && (!S.query || e.statement.toLowerCase().indexOf(S.query.toLowerCase()) >= 0) && (!S.type || e.type === S.type); });
        rows.slice(0, S.rows).forEach(function (e) {
          var b = h('button', { type: 'button', class: 'at-link', text: e.statement }); b.addEventListener('click', function () { choose({ type: 'element', e: e }); });
          var nm = function (l, kind) { return l.length ? l.map(function (p) { return dom(kind, p.id).short + (p.strength === 'single' ? ' (weaker)' : ''); }).join(', ') : 'Not placed yet'; };
          tbody.appendChild(h('tr', {}, [h('td', { 'data-label': 'Statement' }, [b]), h('td', { 'data-label': 'Kind', text: typeName(e.type) }), h('td', { 'data-label': 'Super-domains', text: nm(e.sup, 'super') }), h('td', { 'data-label': 'Sub-domains', text: nm(e.sub, 'sub') }), h('td', { 'data-label': 'Theory', text: e.theory.title })]));
        });
        status.textContent = plural(rows.length, 'statement') + ' match' + (rows.length > S.rows ? '. The first ' + S.rows + ' are listed.' : '.');
        more.hidden = rows.length <= S.rows;
      }
      q.addEventListener('input', function () { S.query = q.value; S.rows = 150; fill(); }); ty.addEventListener('change', function () { S.type = ty.value; S.rows = 150; fill(); });
      var tb = h('table', { class: 'at-table' }, [h('caption', { class: 'at-cap', text: 'All statements in the theories shown' }), h('thead', {}, [h('tr', {}, ['Statement', 'Kind', 'Super-domains', 'Sub-domains', 'Theory'].map(function (t) { return h('th', { scope: 'col', text: t }); }))]), tbody]);
      els.view.appendChild(h('div', { class: 'oew-row' }, [q, ty])); els.view.appendChild(status); els.view.appendChild(h('div', { class: 'at-tablewrap' }, [tb])); els.view.appendChild(more); fill();
    }

    /* ---------- selection and the panel ---------- */
    function choose(sel) { S.sel = sel; drawAll(); shell.reveal(); }
    function drawAll() {
      Object.keys(els.tabs).forEach(function (k) { els.tabs[k].setAttribute('aria-selected', String(k === S.view)); els.tabs[k].tabIndex = k === S.view ? 0 : -1; });
      els.view.setAttribute('aria-labelledby', shell.uid + '-tab-' + S.view);
      drawBar(); els.view.textContent = ''; redraw = null;
      ({ flow: viewFlow, links: viewLinks, reasons: viewReasons, table: viewTable })[S.view]();
      shell.setGroup(S.sel ? 'sel' : 'overview');
      drawPanel();
    }
    function chipsFor(list, kind) { return list.map(function (p) { var d = dom(kind, p.id); return panel.chip(d.short + (p.strength === 'single' ? ' (weaker fit)' : ''), function () { choose({ type: 'domain', kind: kind, id: p.id }); }); }); }
    function stmtList(list, cap) {
      var ul = h('ul', { class: 'oew-items' }), shown = cap ? list.slice(0, cap) : list;
      shown.forEach(function (e) { var b = h('button', { type: 'button', class: 'at-link', text: short(e, 140) }); b.addEventListener('click', function () { choose({ type: 'element', e: e }); }); var li = h('li', {}, [b]); if (vis().length > 1) li.appendChild(h('span', { class: 'oew-tag', style: 'color:' + e.theory.color, text: e.theory.shape + ' ' + e.theory.title })); ul.appendChild(li); });
      if (cap && list.length > cap) ul.appendChild(h('li', { class: 'oew-note', text: 'And ' + (list.length - cap) + ' more. The Table lists all of them.' }));
      return ul;
    }
    function resolve(ref) {
      var r = S.model.resolvers || {}, hit = null;
      Object.keys(r).forEach(function (p) { if (ref.indexOf(p) === 0 && (!hit || p.length > hit.length)) hit = p; });
      if (hit) return r[hit].replace('{id}', ref).replace('{slug}', ref.slice(hit.length));
      return null;
    }
    function isPrivate(ref) { return (S.model.privateBases || []).some(function (p) { return ref.indexOf(p) === 0; }); }
    function baseItems(domId) {
      var d = S.links[domId]; if (!d) return;
      GROUPS.forEach(function (g) {
        var items = (d[g[0]] || []).filter(function (x) { return opts.privateLinks || !x.lab_only; });
        if (!items.length) return;
        panel.heading(g[1] + ' (' + g[2] + ')');
        panel.items(items.map(function (x) { return { label: x.label, href: x.lab_only ? null : x.href, blurb: x.blurb || (x.ref || ''), tags: x.lab_only ? [{ text: 'lab only', cls: 'lab' }] : (x.note ? [{ text: x.note }] : []) }; }));
      });
    }
    function copyBtn(text, label) {
      var b = h('button', { type: 'button', class: 'oew-step ghost', text: label });
      b.addEventListener('click', function () { var ok = false; try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text); ok = true; } } catch (e) { ok = false; } say(ok ? 'Copied.' : 'Select the identifier and copy it: ' + text); });
      return b;
    }
    function download(t) {
      var raw = JSON.stringify(t.raw, null, 2), blob = new Blob([raw], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = t.id.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }
    function relatedDomains(scope, id) {
      var out = {};
      domainLinkList(scope).forEach(function (e) { if (e.a === id || e.b === id) { out[e.a === id ? e.b : e.a] = 1; } });
      return Object.keys(out);
    }

    function drawPanel() {
      panel.clear(); var s = S.sel;
      if (!s) { intro(); return; }
      if (s.type === 'domain') {
        var d = dom(s.kind, s.id), ev = elements().filter(function (e) { return matches(e, s); });
        panel.kicker(s.id === NONE ? 'Not yet placed' : (s.kind === 'super' ? 'Super-domain' : 'Sub-domain')).title(d.name).paras(d.means); if (d.ask) panel.ask('A question for your school:', d.ask);
        panel.heading(plural(ev.length, 'statement') + ' in the theories shown').add(ev.length ? stmtList(ev, 12) : null);
        if (s.id !== NONE) {
          var rel = relatedDomains(s.kind, s.id);
          if (rel.length) { panel.heading('Linked domains'); panel.chips(rel.map(function (o) { return panel.chip(dom(s.kind, o).short, function () { choose({ type: 'dlink', scope: s.kind, a: s.id, b: o }); }); })); }
          baseItems(s.id);
        }
        panel.row([panel.step('Clear selection', function () { S.sel = null; drawAll(); }, true)]);
      } else if (s.type === 'kind') {
        var k = kindOf(s.id), ev0 = elements().filter(function (e) { return matches(e, s); });
        panel.kicker('Kind of statement').title(k.name).paras(k.means); panel.heading(plural(ev0.length, 'statement')).add(ev0.length ? stmtList(ev0, 12) : null);
        panel.row([panel.step('Clear selection', function () { S.sel = null; drawAll(); }, true)]);
      } else if (s.type === 'flow') {
        var names = s.parts.map(function (p) { return p.col === 'kind' ? kindOf(p.id).short : dom(p.col, p.id).short; }), ev1 = elements().filter(function (e) { return matches(e, s); });
        panel.kicker('A flow').title(names[0] + ' to ' + names[1]).paras('Statements that sit in both “' + names[0] + '” and “' + names[1] + '”.');
        panel.heading(plural(ev1.length, 'statement')).add(ev1.length ? stmtList(ev1, 12) : null);
        panel.row(s.parts.map(function (p) { return panel.chip(p.col === 'kind' ? kindOf(p.id).short : dom(p.col, p.id).short, function () { choose(p.col === 'kind' ? { type: 'kind', id: p.id } : { type: 'domain', kind: p.col, id: p.id }); }); }));
      } else if (s.type === 'dlink') { dlinkPanel(s); }
      else if (s.type === 'element') { elementPanel(s.e); }
      else if (s.type === 'theory') { theoryPanel(s.t); }
      else if (s.type === 'add') { addPanel(s); }
    }
    function dlinkPanel(s) {
      var A = dom(s.scope, s.a), B = dom(s.scope, s.b), lo = s.a < s.b ? s.a : s.b, hi = s.a < s.b ? s.b : s.a;
      var e = domainLinkList(s.scope).filter(function (x) { return x.a === lo && x.b === hi; })[0] || { shared: [], model: [], theory: [] };
      panel.kicker('Link between ' + (s.scope === 'super' ? 'super-domains' : 'sub-domains')).title(A.short + ' and ' + B.short);
      if (e.model.length) { panel.heading('Proposed in the model'); e.model.forEach(function (l) { panel.paras(dom(s.scope, l.from).short + (l.directed ? ' → ' : ' ↔ ') + dom(s.scope, l.to).short + ' (' + l.relation + '). ' + l.means); }); panel.note((S.model.links && S.model.links.note) || ''); }
      if (e.theory.length) { panel.heading('Stated by a theory'); e.theory.forEach(function (l) { panel.paras(l.theory.shape + ' ' + l.theory.title + ': ' + dom(s.scope, l.from).short + (l.directed ? ' → ' : ' ↔ ') + dom(s.scope, l.to).short + ' (' + l.relation + '). ' + l.means); }); }
      panel.heading(plural(e.shared.length, 'statement') + ' sit in both'); if (e.shared.length) panel.add(stmtList(e.shared, 12)); else panel.note('No statement in the theories shown sits in both domains.');
      panel.row([panel.chip(A.short, function () { choose({ type: 'domain', kind: s.scope, id: s.a }); }), panel.chip(B.short, function () { choose({ type: 'domain', kind: s.scope, id: s.b }); }), panel.step('Show the links', function () { S.view = 'links'; drawAll(); }, true)]);
    }
    function intro() {
      panel.kicker('How to read this atlas').title('A theory of schooling, sorted and linked');
      if (S.view === 'links') panel.paras(['This view shows how the domains relate to each other. A teal line means statements sit in both domains. A dashed line is a relation proposed in the model, a first draft for the authors to confirm. A coloured line is a link a theory states itself. Select a box or a line to read about it.']);
      else panel.paras(['A theory of schooling is a set of statements about what schools are for, how they work and how they could be better. Each statement flows from the broad ideas about people and societies behind it (left), through what the statement does (middle), to the aspect of schooling it is about (right).', 'Where a statement offers a reason for a teaching or schooling proposal, the reason is kept with it. Each domain connects to entries in the OpenEvo bases.']);
      var ul = h('ul', { class: 'oew-start' });
      [['The flow', 'Select a box or a ribbon', function () { S.view = 'flow'; drawAll(); }], ['Links between domains', 'How the broad ideas and the aspects of schooling relate', function () { S.view = 'links'; drawAll(); }], ['Reasons behind proposals', 'Proposals paired with the statements that support them', function () { S.view = 'reasons'; drawAll(); }], ['Add your own theory', 'Write statements, place them, and download the file', function () { choose({ type: 'add' }); }]].forEach(function (s) { var b = h('button', { type: 'button' }, [h('b', { text: s[0] }), h('span', { text: s[1] })]); b.addEventListener('click', s[2]); ul.appendChild(h('li', {}, [b])); });
      panel.add(ul);
      panel.heading('Theories shown');
      S.theories.forEach(function (t) { panel.add(h('p', { class: 'at-tline' }, [h('span', { style: 'color:' + t.color, 'aria-hidden': 'true', text: t.shape + ' ' }), h('strong', { text: t.title }), ' ' + (t.holder.label ? '(' + t.holder.label + ')' : '')])); });
    }
    function theoryPanel(t) {
      var kind = S.model.holderKinds.filter(function (k) { return k.id === t.holder.kind; })[0];
      panel.kicker(kind ? kind.name : 'Theory of schooling').title(t.title).paras(t.summary || []);
      if (t.visibility !== 'public') panel.note(t.visibility === 'lab-only' ? 'This theory is private to the lab. It is open here from a file on your own computer and has not been uploaded.' : 'This theory exists only in your browser until you download it.');
      var provenance = t.provenance || {};
      panel.heading('Where it comes from').paras([(STATUS[provenance.reviewStatus] || provenance.reviewStatus || 'Review status not recorded') + '.', provenance.note || '']);
      if ((provenance.sources || []).length) panel.add(h('p', { class: 'oew-links' }, provenance.sources.map(function (x) { var u = x.literatureRef ? resolve(x.literatureRef) : null; return u ? OEW.linkEl({ label: x.label, href: u }) : h('span', { class: 'oew-tag', text: x.label }); })));
      panel.heading('Identifiers and licence');
      panel.paras(['Identifier: ' + t.id + (t.theoryRef ? '. Matching TheoryBase record: ' + t.theoryRef : '') + '.', 'Version ' + (t.version || 'not given') + (t.date ? ', ' + t.date : '') + '. Licence: ' + (t.license || 'not given') + '.', plural(t.elements.length, 'statement') + ', ' + plural(t.warrants.length, 'proposal') + ' with reasons and ' + plural(t.domainLinks.length, 'link') + ' between domains.']);
      if (t.warnings.length) panel.note('Some domain names in the file were not recognised and were left out: ' + t.warnings.join(', ') + '.');
      panel.row([copyBtn(t.id, 'Copy identifier'), panel.step('Download as JSON', function () { download(t); }, true), panel.step(t.on ? 'Hide in views' : 'Show in views', function () { t.on = !t.on; drawAll(); }, true)]);
    }
    function elementPanel(e) {
      var t = e.theory;
      panel.kicker(typeName(e.type) + (e.stance === 'attributed' ? ', reported from another author' : '')).title(e.statement);
      panel.add(h('p', { class: 'at-tline' }, [h('span', { style: 'color:' + t.color, 'aria-hidden': 'true', text: t.shape + ' ' }), 'From ', h('strong', { text: t.title })]));
      if (t.visibility !== 'public') panel.note(t.visibility === 'lab-only' ? 'Private to the lab.' : 'Only in your browser.');
      if (e.ref) { var ru = e.url || (isPrivate(e.ref) ? null : resolve(e.ref)); panel.add(h('p', { class: 'at-tline' }, ['Base record: ', ru ? OEW.linkEl({ label: e.ref, href: ru }) : h('span', { text: e.ref }), e.visibility === 'lab-only' ? h('span', { class: 'oew-tag lab', text: 'lab only' }) : null])); }
      panel.heading('Super-domains'); if (e.sup.length) panel.chips(chipsFor(e.sup, 'super')); else panel.note('Not placed yet.');
      panel.heading('Sub-domains'); if (e.sub.length) panel.chips(chipsFor(e.sub, 'sub')); else panel.note('Not placed yet.');
      if (e.reasons.length) {
        panel.heading('Reasons given for this proposal');
        e.reasons.forEach(function (w) { panel.add(stmtList(w.basis)); if (w.note) panel.note(w.note); panel.note((w.link === 'explicit' ? 'The text states this link. ' : 'The link is a reading of the text. ') + (STATUS[(w.review || {}).status] || '')); });
      }
      if (e.reasonFor.length) { panel.heading('Used as a reason for'); panel.add(stmtList(e.reasonFor.map(function (w) { return w.design; }))); }
      var links = (e.links || []).filter(function (l) { return l && l.ref && (opts.privateLinks || !isPrivate(l.ref)); });
      if (links.length) {
        panel.heading('Linked base entries');
        panel.items(links.map(function (l) { var u = resolve(l.ref), priv = isPrivate(l.ref), isClaim = l.ref.indexOf('claim:') === 0; return { label: isClaim ? 'Similar claim in a published paper' : l.ref.replace(/^OE-(SANDBOX-)?[A-Z]+-/, '').replace(/-/g, ' '), href: !priv && u ? u : null, blurb: l.ref + (l.relation ? ' (' + l.relation + (l.score ? ', closeness ' + l.score : '') + ')' : ''), tags: priv ? [{ text: 'lab only', cls: 'lab' }] : [] }; }));
      }
      panel.heading('Identifier'); panel.paras(t.id + '#' + e.id);
      panel.row([copyBtn(t.id + '#' + e.id, 'Copy identifier'), panel.step('About this theory', function () { choose({ type: 'theory', t: t }); }, true), panel.step('Clear selection', function () { S.sel = null; drawAll(); }, true)]);
    }

    /* ---------- adding your own statements ---------- */
    function ensureOwn(kind) {
      if (own) return own;
      own = normalize({ schema: 'openevo-schooling-theory-profile/1', id: 'OE-SCHOOLINGPROFILE-my-theory-' + Date.now().toString(36), title: 'My theory', summary: 'Statements you wrote in this browser. Download the file to keep it.', holder: { kind: kind || 'individual', label: 'You' }, model: S.model.id, visibility: 'local', license: 'CC0-1.0', version: '0.1.0', date: new Date().toISOString().slice(0, 10), characterizationStatus: 'author_stated', provenance: { extractedBy: 'human', reviewStatus: 'author-reviewed', sources: [], note: 'Written by the person who downloads it.' }, elements: [{ id: 'e0', type: 'proposition', statement: 'placeholder', placement: { super: [], sub: [] } }], warrants: [] }, S.model).theory;
      own.elements = []; own.byId = {}; own.raw.elements = []; addTheory(own); return own;
    }
    function addPanel(s) {
      panel.kicker('Your own theory').title('Add a statement');
      panel.paras('Write a statement about schooling in your own words, then say where it belongs. Nothing is sent anywhere. When you have a few, download the file to keep it or share it.');
      var uid = shell.uid + '-add';
      var ta = h('textarea', { id: uid + '-t', rows: 3, class: 'at-ta', maxlength: 400 });
      var type = h('select', { id: uid + '-k', class: 'at-type' }, S.model.elementTypes.map(function (t) { return h('option', { value: t.id, text: t.name }); }));
      var holder = h('select', { id: uid + '-h', class: 'at-type', disabled: own ? true : null }, S.model.holderKinds.filter(function (k) { return k.id === 'individual' || k.id === 'community'; }).map(function (k) { return h('option', { value: k.id, text: k.name }); }));
      function boxes(list, kind, pre) { var fs = h('fieldset', { class: 'at-fs' }, [h('legend', { text: kind === 'super' ? 'Which broad ideas does it draw on?' : 'Which aspect of schooling is it about?' })]); list.forEach(function (d) { var id = uid + '-' + kind + '-' + d.id; var cb = h('input', { type: 'checkbox', id: id, value: d.id, checked: pre === d.id ? true : null }); fs.appendChild(h('label', { for: id, class: 'at-cb' }, [cb, ' ' + d.short])); }); return fs; }
      var fsA = boxes(S.model.supers, 'super', s && s.sup), fsB = boxes(S.model.subs, 'sub', s && s.sub);
      var reasonSel = h('select', { id: uid + '-r', class: 'at-type' }, [h('option', { value: '', text: 'No, it stands alone' })]);
      if (own) own.elements.forEach(function (e) { reasonSel.appendChild(h('option', { value: e.id, text: OEW.sentence(e.statement, 60) })); });
      var msg = h('p', { class: 'oew-note', role: 'alert' });
      var form = h('form', { class: 'at-form', novalidate: true }, [
        h('label', { for: uid + '-t', text: 'Your statement' }), ta,
        h('label', { for: uid + '-k', text: 'What kind of statement is it?' }), type,
        own ? null : h('label', { for: uid + '-h', text: 'Whose theory is this?' }), own ? null : holder,
        fsA, fsB,
        h('label', { for: uid + '-r', text: 'Is it a reason for an earlier statement of yours?' }), reasonSel, msg,
        h('div', { class: 'oew-row' }, [h('button', { type: 'submit', class: 'oew-step', text: 'Add statement' })])
      ]);
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var txt = ta.value.trim(), sup = [], sub = [];
        Array.prototype.forEach.call(fsA.querySelectorAll('input:checked'), function (c) { sup.push({ id: c.value, strength: 'firm' }); });
        Array.prototype.forEach.call(fsB.querySelectorAll('input:checked'), function (c) { sub.push({ id: c.value, strength: 'firm' }); });
        if (!txt) { msg.textContent = 'Write a statement first.'; ta.focus(); return; }
        if (!sup.length || !sub.length) { msg.textContent = 'Choose at least one broad idea and one aspect of schooling.'; return; }
        var t = ensureOwn(holder.value), id = 'e' + (t.elements.length + 1);
        var raw = { id: id, type: type.value, statement: txt, placement: { super: sup, sub: sub }, links: [] };
        var x = { id: id, key: t.id + '#' + id, theory: t, type: raw.type, statement: txt, stance: 'own', sup: sup, sub: sub, links: [], source: '', reasons: [], reasonFor: [] };
        t.elements.push(x); t.byId[id] = x; t.raw.elements.push(raw);
        var r = t.byId[reasonSel.value];
        if (r) {
          var w = { id: 'w' + (t.warrants.length + 1), design: r, basis: [x], link: 'explicit', basisKind: raw.type, note: '', review: { status: 'author-reviewed' } };
          t.warrants.push(w); r.reasons.push(w); x.reasonFor.push(w); (t.raw.warrants = t.raw.warrants || []).push({ id: w.id, design: r.id, basis: [id], link: 'explicit', basisKind: raw.type, note: '', review: w.review });
        }
        t.on = true; say('Added. You now have ' + plural(t.elements.length, 'statement') + ' in “' + t.title + '”.');
        S.sel = { type: 'add' }; drawAll();
        var again = panel.node.querySelector('textarea'); if (again) again.focus();
      });
      panel.add(form);
      if (own && own.elements.length) panel.row([panel.step('Download my theory (JSON)', function () { download(own); }), panel.step('About my theory', function () { choose({ type: 'theory', t: own }); }, true)]);
    }
  }

  OEW.register('data-openevo-atlas', mount, 'atlas/atlas.css');
})();
