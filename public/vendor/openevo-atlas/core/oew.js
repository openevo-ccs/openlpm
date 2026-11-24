/* OpenEvo widget kit. Shared by the embeddable models in widgets/.
   A widget script calls OEW.register('data-openevo-name', function (host, options) { ... }) and builds its diagram with
   OEW.shell(host, config), which supplies the title bar (reset, embed, full screen), the detail panel, the embed dialog
   and the footnote. Pages use a widget with <div data-openevo-name data-height="720px"></div>, or load its page in an iframe. */
(function () {
  'use strict';

  var SCRIPT = document.currentScript;
  var CORE_BASE = SCRIPT && SCRIPT.src ? new URL('.', SCRIPT.src).href : new URL('widgets/core/', location.href).href;
  var WIDGETS = new URL('../', CORE_BASE).href;
  var SITE = new URL('../', WIDGETS).href;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var EMBEDDED = window.top !== window.self;
  var registry = {};
  var counter = 0;

  /* ---------- helpers ---------- */
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k]; if (v === null || v === undefined || v === false) return;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function sv(tag, attrs, kids) {
    var e = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function icon(paths) { return sv('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }, paths.map(function (d) { return sv('path', { d: d }); })); }
  function press(node, fn) {
    node.addEventListener('click', fn);
    node.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
  }
  function reducedMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function sentence(t, n) {
    t = String(t || '').replace(/\s+/g, ' ').trim();
    var m = t.match(/^.{20,}?[.!?](\s|$)/);
    var s = m ? m[0].trim() : t;
    return n && s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s;
  }
  function linkEl(l, cls) {
    var ext = /^https?:/.test(l.href);
    var a = h('a', { href: ext ? l.href : new URL(l.href, SITE).href, class: cls || 'oew-link', text: l.label + (ext ? ' ↗' : '') });
    if (ext || EMBEDDED) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  }
  function ensureCss(url) {
    var name = url.split('/').pop();
    if (document.querySelector('link[href*="' + name + '"]')) return;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = url; document.head.appendChild(l);
  }
  function param(name) { try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; } }

  /* ---------- the detail panel ---------- */
  function makePanel(node) {
    var P = {
      node: node,
      clear: function () { node.textContent = ''; return P; },
      add: function (x) { if (x) node.appendChild(x); return P; },
      kicker: function (t) { return P.add(h('p', { class: 'oew-kicker', text: t })); },
      title: function (t) { return P.add(h('h3', { text: t })); },
      heading: function (t) { return P.add(h('h4', { text: t })); },
      paras: function (t) { (Array.isArray(t) ? t : [t]).forEach(function (x) { if (x) P.add(h('p', { text: x })); }); return P; },
      note: function (t) { return P.add(h('p', { class: 'oew-note', text: t })); },
      ask: function (label, t) { return t ? P.add(h('p', { class: 'oew-ask' }, [h('strong', { text: label + ' ' }), t])) : P; },
      links: function (ls) { if (!ls || !ls.length) return P; var p = h('p', { class: 'oew-links' }); ls.forEach(function (l) { p.appendChild(linkEl(l)); }); return P.add(p); },
      row: function (kids, label) { return P.add(h('div', { class: 'oew-row', role: label ? 'group' : null, 'aria-label': label }, kids)); },
      step: function (text, fn, ghost) { var b = h('button', { type: 'button', class: 'oew-step' + (ghost ? ' ghost' : ''), text: text }); b.addEventListener('click', fn); return b; },
      chip: function (text, fn, pressed) { var b = h('button', { type: 'button', class: 'oew-chip', 'aria-pressed': pressed === undefined ? null : String(!!pressed), text: text }); b.addEventListener('click', fn); return b; },
      chips: function (list) { var ul = h('ul', { class: 'oew-chips' }); list.forEach(function (c) { ul.appendChild(h('li', {}, [c])); }); return P.add(ul); },
      /* a list of linked items with a one-line description each */
      items: function (list) {
        var ul = h('ul', { class: 'oew-items' });
        list.forEach(function (x) {
          var name = x.href ? linkEl({ label: x.label, href: x.href }, 'oew-item-link') : h('span', { class: 'oew-item-name', text: x.label });
          var li = h('li', {}, [name]);
          (x.tags || []).forEach(function (t) { li.appendChild(h('span', { class: 'oew-tag' + (t.cls ? ' ' + t.cls : ''), text: t.text })); });
          if (x.blurb) li.appendChild(h('span', { class: 'oew-blurb', text: x.blurb }));
          ul.appendChild(li);
        });
        return P.add(ul);
      },
      /* Back / Next / End controls for a guided tour */
      tourBar: function (at, total, go, end) {
        if (at < 0) return P;
        var back = P.step('Back', function () { go(at - 1); }, true), next = P.step(at === total - 1 ? 'Finish' : 'Next', function () { if (at === total - 1) end(); else go(at + 1); }), stop = P.step('End tour', end, true);
        back.disabled = at === 0;
        return P.row([h('span', { class: 'oew-note', text: 'Tour, step ' + (at + 1) + ' of ' + total }), back, next, stop]);
      }
    };
    return P;
  }

  /* ---------- the shell: title bar, panel, full screen and embed dialog ---------- */
  function shell(host, cfg) {
    var uid = 'oew' + (++counter);
    host.textContent = '';
    host.classList.add('oew');
    if (cfg.height) {
      host.style.setProperty('--oew-h', cfg.height);
      if (cfg.narrowAuto && window.ResizeObserver) {
        new ResizeObserver(function () { host.style.setProperty('--oew-h', host.clientWidth >= (cfg.wide || 860) ? cfg.height : 'auto'); }).observe(host);
      }
    }
    var panelNode = h('aside', { class: 'oew-panel', 'aria-live': 'polite', tabindex: '-1' });
    var panel = makePanel(panelNode);
    var fullText = h('span', { text: 'Full screen' });
    var fullBtn = h('button', { type: 'button', class: 'oew-btn', 'aria-pressed': 'false' }, [icon(['M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5']), fullText]);
    var resetBtn = h('button', { type: 'button', class: 'oew-btn' }, [icon(['M4 12a8 8 0 1 0 3-6.2', 'M4 4v5h5']), h('span', { text: 'Reset' })]);
    var embedBtn = h('button', { type: 'button', class: 'oew-btn' }, [icon(['M8 8l-4 4 4 4', 'M16 8l4 4-4 4', 'M14 5l-4 14']), h('span', { text: 'Embed' })]);
    var actions = h('div', { class: 'oew-actions' }, (cfg.buttons || []).concat([resetBtn, embedBtn, fullBtn]));
    var bar = h('div', { class: 'oew-bar' }, [h('div', { class: 'oew-title' }, [h('strong', { text: cfg.title }), h('span', { text: cfg.subtitle || '' })]), actions]);
    var body = h('div', { class: 'oew-body ' + (cfg.bodyClass || '') });
    var inner = h('div', { class: 'oew-in', 'data-group': 'overview' }, [bar, body, cfg.foot ? h('p', { class: 'oew-foot', text: cfg.foot }) : null]);
    host.appendChild(inner);

    /* the diagram goes first, the panel last */
    var api = {
      host: host, inner: inner, body: body, panel: panel, uid: uid, bar: bar, actions: actions,
      stage: function () { for (var i = 0; i < arguments.length; i++) if (arguments[i]) body.appendChild(arguments[i]); body.appendChild(panelNode); return api; },
      setGroup: function (g) { inner.setAttribute('data-group', g); },
      isNarrow: function () { return host.clientWidth < (cfg.stack || cfg.wide || 860); },
      reveal: function () {
        if (!api.isNarrow()) return;
        panelNode.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
      },
      onReset: function (fn) { resetBtn.addEventListener('click', fn); },
      linkEl: linkEl
    };

    /* full screen: the browser's mode where allowed, otherwise a fixed overlay */
    var cssFull = false;
    function isFull() { return document.fullscreenElement === host || cssFull; }
    function paintFull() { var on = isFull(); fullBtn.setAttribute('aria-pressed', String(on)); fullText.textContent = on ? 'Exit full screen' : 'Full screen'; }
    function setCssFull(on) { cssFull = on; host.classList.toggle('is-expanded', on); document.documentElement.style.overflow = on ? 'hidden' : ''; paintFull(); }
    fullBtn.addEventListener('click', function () {
      if (isFull()) { if (document.fullscreenElement === host && document.exitFullscreen) document.exitFullscreen(); else setCssFull(false); }
      else if (host.requestFullscreen && document.fullscreenEnabled) host.requestFullscreen().catch(function () { setCssFull(true); });
      else setCssFull(true);
    });
    document.addEventListener('fullscreenchange', paintFull);

    /* embed dialog */
    var page = new URL(cfg.page, WIDGETS).href;
    var pageUrl = page + (cfg.embedQuery ? '?' + cfg.embedQuery : '');
    var scripts = ['core/oew.js'].concat(cfg.scripts || []).map(function (s) { return '<script src="' + new URL(s, WIDGETS).href + '"></' + 'script>'; }).join('\n');
    var frameCode = '<iframe src="' + pageUrl + '" title="' + cfg.title + '" width="100%" height="' + (cfg.embedHeight || 780) + '" style="border:0;max-width:100%" loading="lazy" allowfullscreen></iframe>';
    var scriptCode = '<div ' + cfg.attr + (cfg.embedAttrs ? ' ' + cfg.embedAttrs : '') + ' data-height="' + (cfg.embedHeight || 780) + 'px"></div>\n' + scripts;
    var status = h('span', { class: 'oew-note', role: 'status' });
    function codeBlock(title, note, code) {
      var ta = h('textarea', { readonly: true, 'aria-label': title + ' code' }); ta.value = code;
      var cp = h('button', { type: 'button', class: 'oew-step', text: 'Copy' });
      cp.addEventListener('click', function () {
        ta.select();
        var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(function () { status.textContent = 'Copied.'; }, function () { status.textContent = ok ? 'Copied.' : 'Select the text and copy it.'; });
        else status.textContent = ok ? 'Copied.' : 'Select the text and copy it.';
      });
      return h('div', {}, [h('h4', { text: title }), h('p', { class: 'oew-note', text: note }), ta, h('div', { class: 'oew-row' }, [cp])]);
    }
    var close = h('button', { type: 'button', class: 'oew-step ghost', text: 'Close' });
    var dialog = h('div', { class: 'oew-embed', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Embed this model' }, [
      h('div', { class: 'oew-embed-card' }, [
        h('h3', { text: 'Embed this model on another website' }),
        codeBlock('Frame (simplest)', 'Shows the model in a frame that keeps its own styling. Works in most website builders.', frameCode),
        codeBlock('Script (blends into your page)', 'Draws the model directly into your page. It brings its own styles.', scriptCode),
        h('p', { class: 'oew-note', text: 'These addresses point to this preview server, so they work for people who can reach it. Replace them with the public address when the site goes live.' }),
        h('div', { class: 'oew-row' }, [status, close])
      ])
    ]);
    function openEmbed() { dialog.hidden = false; status.textContent = ''; close.focus(); }
    function closeEmbed() { dialog.hidden = true; embedBtn.focus(); }
    close.addEventListener('click', closeEmbed);
    dialog.addEventListener('click', function (e) { if (e.target === dialog) closeEmbed(); });
    dialog.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); closeEmbed(); } });
    embedBtn.addEventListener('click', openEmbed);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && cssFull && dialog.hidden) setCssFull(false); });
    host.appendChild(dialog);
    return api;
  }

  /* ---------- registration and mounting ---------- */
  function readOptions(host) {
    return {
      height: host.getAttribute('data-height'), narrowAuto: host.hasAttribute('data-narrow-auto'), select: host.getAttribute('data-select'),
      privateLinks: (host.getAttribute('data-private-links') || param('private') || 'show') !== 'hide'
    };
  }
  function mountAll(attr) {
    Array.prototype.forEach.call(document.querySelectorAll('[' + attr + ']'), function (host) {
      if (host.getAttribute('data-ready')) return;
      host.setAttribute('data-ready', '1');
      registry[attr](host, readOptions(host));
    });
  }
  function register(attr, fn, css) {
    registry[attr] = fn;
    ensureCss(new URL('core/oew.css', WIDGETS).href);
    if (css) ensureCss(new URL(css, WIDGETS).href);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mountAll(attr); }); else mountAll(attr);
  }

  window.OEW = { h: h, sv: sv, icon: icon, press: press, sentence: sentence, linkEl: linkEl, shell: shell, register: register, reducedMotion: reducedMotion, widgetsBase: WIDGETS, siteBase: SITE };
})();
