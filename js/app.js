/* ============================================================
   APP — state, time engine, panels, wiring
   ============================================================ */
(function () {
  'use strict';
  const D = window.AstroData, E = window.Engine, W = window.Wheel, I = window.Interpret;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ---------------- persistent settings ----------------
  const SETKEY = 'astrolabe.settings.v1', LOCKEY = 'astrolabe.loc.v1';
  const DEFAULT_BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Node', 'Lilith'];
  const CLASSIC7 = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

  function loadJSON(key, fallback) {
    try { return Object.assign({}, fallback, JSON.parse(localStorage.getItem(key) || '{}')); }
    catch { return Object.assign({}, fallback); }
  }

  const settings = loadJSON(SETKEY, {
    houseSystem: 'whole', zodiac: 'tropical', nodeType: 'true',
    orbScale: 1, minorAspects: false, showLots: true,
    bodies: DEFAULT_BODIES.slice(),
  });
  const saveSettings = () => localStorage.setItem(SETKEY, JSON.stringify(settings));

  const loc = loadJSON(LOCKEY, { lat: 0, lon: 0, name: '' });
  const saveLoc = () => localStorage.setItem(LOCKEY, JSON.stringify(loc));

  // ---------------- state ----------------
  const state = {
    mode: 'now',
    time: new Date(),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    playing: 0,          // 0 stopped, +1 fwd, -1 rev
    speed: 3600,
    live: true,          // tracking the real clock
    scrubCenter: null,
    personA: null, personB: null,
    selection: null,     // {type, ...}
    readingStyle: localStorage.getItem('astrolabe.style') || 'blended',
    hover: null,
    editingPerson: null,
    periodFrom: null, periodTo: null,
  };

  // computed per frame
  let view = { chart: null, outer: null, aspects: [], patterns: [] };

  // ---------------- chart computation ----------------
  function chartOpts(extra) {
    return Object.assign({
      houseSystem: settings.houseSystem, zodiac: settings.zodiac,
      nodeType: settings.nodeType, bodies: settings.bodies.slice(),
    }, extra);
  }

  function recompute() {
    const aspOpts = { orbScale: settings.orbScale, includeMinor: settings.minorAspects };
    try {
      if (state.mode === 'now') {
        const chart = E.computeChart(state.time, chartOpts({ lat: loc.lat, lon: loc.lon }));
        const aspects = E.findAspects(chart.planets, aspOpts);
        view = { chart, outer: null, aspects, patterns: E.findPatterns(chart.planets, aspects) };
      } else if (state.mode === 'natal') {
        const p = People.get(state.personA);
        if (!p) { view = { chart: null, outer: null, aspects: [], patterns: [] }; return; }
        const chart = E.computeChart(state.time, chartOpts({ lat: p.lat || 0, lon: p.lon || 0 }));
        const aspects = E.findAspects(chart.planets, aspOpts);
        view = { chart, outer: null, aspects, patterns: E.findPatterns(chart.planets, aspects), person: p };
      } else if (state.mode === 'transits') {
        const p = People.get(state.personA);
        if (!p) { view = { chart: null, outer: null, aspects: [], patterns: [] }; return; }
        const natal = People.natalChart(p, chartOpts());
        const sky = E.computeChart(state.time, chartOpts({ lat: p.lat || 0, lon: p.lon || 0 }));
        const cross = E.findAspects(natal.planets, aspOpts, sky.planets); // a = natal (inner), b = transiting (outer)
        view = { chart: natal, outer: { chart: sky, label: 'Transits' }, aspects: cross.map(a => (a.cross = true, a)), patterns: [], person: p };
      } else if (state.mode === 'synastry') {
        const pa = People.get(state.personA), pb = People.get(state.personB);
        if (!pa || !pb) { view = { chart: null, outer: null, aspects: [], patterns: [] }; return; }
        const ca = People.natalChart(pa, chartOpts());
        const cb = People.natalChart(pb, chartOpts());
        const cross = E.findAspects(ca.planets, aspOpts, cb.planets);
        view = { chart: ca, outer: { chart: cb, label: pb.name }, aspects: cross.map(a => (a.cross = true, a)), patterns: [], person: pa, personB: pb };
      }
    } catch (err) {
      console.error('recompute failed', err);
    }
  }

  // ---------------- render ----------------
  const svg = $('wheel');

  function render() {
    if (!view.chart) {
      svg.innerHTML = `<text x="500" y="480" text-anchor="middle" font-size="22" fill="#8b93a7" font-family="Cinzel,serif">Select a person in the People tab</text>
        <text x="500" y="515" text-anchor="middle" font-size="14" fill="#5a6175">This mode needs ${state.mode === 'synastry' ? 'two saved people (slots A and B)' : 'a saved person'}.</text>`;
      renderHud(); renderPositions(); renderAspectsPane();
      return;
    }
    W.render(svg, {
      chart: view.chart, outer: view.outer, aspects: view.aspects,
      showLots: settings.showLots,
    });
    applyHoverStyles();
    renderHud();
    renderPositions();
    renderAspectsPane();
  }

  function renderHud() {
    const mi = $('modeInfo');
    const dtStr = view.chart ? fmtHuman(view.chart.date) : '';
    const titles = {
      now: `<div class="mi-title">The Sky</div><div class="mi-sub">${esc(loc.name || 'Set location')} · ${dtStr}</div>`,
      natal: view.person ? `<div class="mi-title">${esc(view.person.name)}</div><div class="mi-sub">natal · ${dtStr}${view.person.timeKnown === false ? ' · <i>time unknown (noon)</i>' : ''}</div>` : `<div class="mi-title">Natal</div>`,
      transits: view.person ? `<div class="mi-title">Transits · ${esc(view.person.name)}</div><div class="mi-sub">sky ${dtStr} around the natal wheel</div>` : `<div class="mi-title">Transits</div>`,
      synastry: view.person && view.personB ? `<div class="mi-title">${esc(view.person.name)} × ${esc(view.personB.name)}</div><div class="mi-sub">synastry — ${esc(view.personB.name)} outside, ${esc(view.person.name)} inside</div>` : `<div class="mi-title">Synastry</div>`,
    };
    mi.innerHTML = titles[state.mode] || '';
    // patterns
    const ph = $('patternHud');
    ph.innerHTML = (view.patterns || []).slice(0, 4).map((p, i) =>
      `<div class="pat" data-pat="${i}"><b>${p.name}</b> · ${p.members.map(m => (D.BODY[m] || {}).glyph || m).join(' ')}</div>`).join('');
  }

  // ---------------- positions pane ----------------
  function renderPositions() {
    const el = $('tab-positions');
    if (!view.chart) { el.innerHTML = `<p class="muted">No chart.</p>`; return; }
    const c = view.chart;
    let h = `<div class="chart-status">
      <svg class="moon-icon" viewBox="0 0 40 40">${moonIconSvg(20, 20, 16, c.moonPhaseAngle)}</svg>
      <div class="cs-main"><b>${I.moonPhaseName(c.moonPhaseAngle)}</b> · ${(c.moonIllum * 100).toFixed(0)}% lit · <b>${c.isDay ? 'Day' : 'Night'} chart</b><br>
      <span class="muted">Asc ${E.fmtLon(c.asc)} · MC ${E.fmtLon(c.mc)}</span><br>
      <span class="faint small">${esc(c.houseSystem)} houses · ${c.zodiac}${c.zodiac === 'sidereal' ? ` (ayanāṁśa ${c.ayanamsa.toFixed(2)}°)` : ''}</span>${(state.mode === 'natal' || state.mode === 'transits') && view.person && view.person.timeKnown === false ? '<br><span class="faint small">⚠ birth time unknown — cast for noon; Asc, houses &amp; Moon degree are placeholders</span>' : ''}</div>
    </div>`;

    const section = (title, chart, ring) => {
      let s = '';
      for (const p of chart.planets) {
        s += posRow(p, ring);
      }
      if (settings.showLots && chart.lots) for (const l of chart.lots) s += posRow(l, ring);
      return s;
    };
    if (view.outer) {
      h += `<div class="sec-h">${esc(view.outer.label)} <span class="sec-note">outer ring</span></div>` + section(null, view.outer.chart, 'outer');
      h += `<div class="sec-h">${esc(view.person ? view.person.name : 'Natal')} <span class="sec-note">inner ring</span></div>` + section(null, view.chart, 'inner');
    } else {
      h += section(null, view.chart, 'inner');
    }
    h += `<div class="sec-h">Angles</div>`;
    for (const [id, lon] of [['Asc', c.asc], ['MC', c.mc], ['Dsc', c.dsc], ['IC', c.ic]]) {
      h += `<div class="pos-row" data-sel="angle:${id}">
        <span class="pos-glyph" style="color:#eae2c8;font-size:12px;font-family:Inter">${id}</span>
        <span class="pos-name">${D.ANGLES[id].name}</span>
        <span class="pos-lon">${fmtLonHtml(lon)}</span><span></span><span></span></div>`;
    }
    el.innerHTML = h;
  }

  function posRow(p, ring) {
    const digBadges = (p.dignities && p.dignities.list.length)
      ? p.dignities.list.map(d => {
        const cls = ['Domicile', 'Exaltation'].includes(d) ? 'dig-good' : ['Detriment', 'Fall'].includes(d) ? 'dig-bad' : 'dig-mixed';
        const short = { 'Domicile': 'DOM', 'Exaltation': 'EXALT', 'Detriment': 'DETR', 'Fall': 'FALL', 'Triplicity': 'TRIP', 'Triplicity (participating)': 'trip', 'Own bounds': 'BND', 'Own decan': 'DEC' }[d] || d;
        return `<span class="dig-badge ${cls}" title="${d}">${short}</span>`;
      }).join('') : '';
    const sel = state.selection && state.selection.type === 'planet' && state.selection.id === p.id && (state.selection.ring || 'inner') === ring;
    return `<div class="pos-row${sel ? ' sel' : ''}" data-sel="planet:${p.id}" data-ring="${ring}">
      <span class="pos-glyph" style="color:${p.color}">${p.glyph}</span>
      <span class="pos-name">${p.isLot ? 'Lot of ' + p.id : p.id}${p.retro ? '<span class="retro">℞</span>' : ''}</span>
      <span class="pos-lon">${fmtLonHtml(p.lon)}</span>
      <span class="pos-house">${p.house ? 'H' + p.house : ''}</span>
      <span class="pos-dig">${digBadges}</span></div>`;
  }

  function fmtLonHtml(lon) {
    const s = E.SIGN_OF(lon);
    const el = D.ELEMENTS[s.element];
    return `${E.fmtDeg(E.norm360(lon) % 30)}<span class="sg" style="color:${el.color}">${s.glyph}</span>`;
  }

  function moonIconSvg(cx, cy, r, phase) {
    let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#131a30" stroke="rgba(148,163,204,.4)" stroke-width="0.7"/>`;
    if (phase > 2 && phase < 358) {
      const waxing = phase < 180;
      const rx = Math.abs(Math.cos(phase * Math.PI / 180)) * r;
      const gib = phase > 90 && phase < 270;
      const so = waxing ? 1 : 0, si = gib ? (waxing ? 1 : 0) : (waxing ? 0 : 1);
      s += `<path d="M ${cx} ${cy - r} A ${r} ${r} 0 0 ${so} ${cx} ${cy + r} A ${rx} ${r} 0 0 ${si} ${cx} ${cy - r} Z" fill="#dfe4ee" opacity=".92"/>`;
    }
    return s;
  }

  // ---------------- aspects pane ----------------
  function renderAspectsPane() {
    const el = $('tab-aspects');
    if (!view.chart) { el.innerHTML = `<p class="muted">No chart.</p>`; return; }
    const list = view.aspects || [];
    let h = '';
    if (view.outer) h += `<p class="small muted" style="margin-bottom:8px">Cross-aspects — first planet is <b>${esc(view.person ? view.person.name : 'inner wheel')}</b>, second is <b>${state.mode === 'transits' ? 'the transiting sky' : esc(view.outer.label)}</b>.</p>`;
    if (!list.length) h += `<p class="muted">No aspects within orb.${settings.minorAspects ? '' : ' (Minor aspects are off.)'}</p>`;
    const majors = list.filter(a => a.major), minors = list.filter(a => !a.major);
    const row = a => {
      const t = D.ASPECT[a.type];
      const g1 = glyphOf(a.a, view.outer ? 'outerFirst' : null), g2 = glyphOf(a.b, null);
      const sel = state.selection && state.selection.type === 'aspect' && state.selection.key === aspKey(a);
      return `<div class="asp-row${sel ? ' sel' : ''}" data-sel="aspect:${aspKey(a)}">
        <span class="asp-g" style="color:${t.color}">${t.glyph}</span>
        <span class="asp-body"><span class="g" style="color:${g1.color}">${g1.glyph}</span>${a.a}</span>
        <span class="asp-g muted" style="font-size:11px">—</span>
        <span class="asp-body"><span class="g" style="color:${g2.color}">${g2.glyph}</span>${a.b}</span>
        <span class="asp-orb">${a.orb.toFixed(1)}°</span>
        <span class="asp-flag ${a.applying ? 'app' : 'sep2'}">${a.applying ? 'applying' : 'separating'}</span></div>`;
    };
    if (majors.length) { h += `<div class="sec-h">Major aspects</div>` + majors.map(row).join(''); }
    if (minors.length) { h += `<div class="sec-h">Minor aspects</div>` + minors.map(row).join(''); }
    el.innerHTML = h;
  }

  const aspKey = a => `${a.a}|${a.b}|${a.type}`;
  function glyphOf(id) {
    const b = D.BODY[id]; if (b) return b;
    const l = D.LOTS.find(x => x.id === id); if (l) return l;
    return { glyph: '·', color: '#8b93a7' };
  }

  // ---------------- explore pane ----------------
  function renderExplore() {
    const el = $('tab-explore');
    if (!view.chart) { el.innerHTML = `<p class="muted">No chart to explore.</p>`; return; }
    const sel = state.selection;
    const style = state.readingStyle;
    let h = '';
    if (!sel) {
      h = `<div class="xp-hero"><div class="xg">✦</div><div><h2>This Chart</h2><div class="xp-sub">${fmtHuman(view.chart.date)}</div></div></div>`;
      h += I.overviewHTML(view.chart, view.aspects, view.patterns, style);
      h += `<p class="small faint" style="margin-top:10px">Click any planet, sign, house number, aspect line, or angle on the wheel to explore it.</p>`;
    } else if (sel.type === 'planet') {
      const chart = sel.ring === 'outer' && view.outer ? view.outer.chart : view.chart;
      const p = chart.planets.concat(chart.lots || []).find(x => x.id === sel.id);
      if (p) h = I.planetInfoHTML(p, chart, view.outer ? [] : view.aspects, style);
    } else if (sel.type === 'sign') {
      h = I.signInfoHTML(sel.id, view.chart, style);
    } else if (sel.type === 'house') {
      h = I.houseInfoHTML(+sel.id, view.chart, style);
    } else if (sel.type === 'angle') {
      h = I.angleInfoHTML(sel.id, view.chart, style);
    } else if (sel.type === 'aspect') {
      const a = (view.aspects || []).find(x => aspKey(x) === sel.key);
      if (a) {
        const labels = view.outer ? [state.mode === 'transits' ? 'transiting' : (view.outer.label || 'B'), state.mode === 'transits' ? 'natal' : (view.person ? view.person.name : 'A')] : null;
        h = I.aspectInfoHTML(a, view.outer ? view.outer.chart : view.chart, view.outer ? view.chart : null, style, labels);
      }
    } else if (sel.type === 'pattern') {
      const p = view.patterns[sel.idx];
      if (p) h = I.patternInfoHTML(p, view.chart, style);
    }
    el.innerHTML = h || `<p class="muted">Nothing selected.</p>`;
  }

  // ---------------- reading pane ----------------
  const validPid = id => (id && People.get(id)) ? id : null;

  function renderReading() {
    const el = $('tab-reading');
    const people = People.all();
    const canNatal = people.length >= 1, canSyn = people.length >= 2;

    // default the reading type from the current mode, but it's freely changeable
    if (!state.readingType) state.readingType = ({ now: 'sky', natal: 'natal', transits: 'transits', synastry: 'synastry' })[state.mode] || 'sky';
    if (['natal', 'transits'].includes(state.readingType) && !canNatal) state.readingType = 'sky';
    if (state.readingType === 'synastry' && !canSyn) state.readingType = 'sky';
    const rt = state.readingType;

    state.readingPersonA = validPid(state.readingPersonA) || validPid(state.personA) || (people[0] ? people[0].id : null);
    state.readingPersonB = validPid(state.readingPersonB) || validPid(state.personB) ||
      ((people.find(p => p.id !== state.readingPersonA) || {}).id || null);
    if (!state.periodTarget) state.periodTarget = (state.mode !== 'now' && state.readingPersonA) ? state.readingPersonA : 'world';
    if (state.periodTarget !== 'world' && !validPid(state.periodTarget)) state.periodTarget = 'world';

    const TYPES = [
      ['sky', 'This sky', 'A world reading of the moment shown on the wheel', true],
      ['natal', 'Birth chart', 'A natal reading — always cast from the saved birth data, no matter where the wheel is set', canNatal],
      ['transits', 'Influences', 'How the sky at the wheel’s current moment touches a person’s birth chart', canNatal],
      ['period', 'Period', 'A forecast across a stretch of time — for the world or for a person', true],
      ['synastry', 'Synastry', 'Two people’s charts compared', canSyn],
    ];
    const personOptions = sel => people.map(p => `<option value="${p.id}" ${sel === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('');

    let h = `<div class="rd-controls">
      <div class="rd-row"><label>Voice</label>
        <div class="seg" id="styleSeg">
          ${['hellenistic', 'modern', 'blended'].map(s => `<button data-style="${s}" class="${state.readingStyle === s ? 'on gold' : ''}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}
        </div></div>
      <div class="rd-row"><label>Reading</label>
        <div class="seg" id="typeSeg">
          ${TYPES.map(([id, lbl, tip, ok]) => `<button data-type="${id}" title="${tip}"${ok ? '' : ' disabled'} class="${rt === id ? 'on' : ''}">${lbl}</button>`).join('')}
        </div></div>`;

    const nameA = (People.get(state.readingPersonA) || {}).name;
    const nameB = (People.get(state.readingPersonB) || {}).name;
    let caption = '';

    if (rt === 'sky') {
      // "For" lives here too: choosing a person flips this into an Influences reading
      h += `<div class="rd-row"><label>For</label>
        <select id="rdPersonA"><option value="world" selected>The world at large</option>${personOptions(null)}</select></div>`;
      caption = `A general reading of the sky as the wheel shows it — ${esc(fmtHuman(state.time))}. Choose a person above to read this same moment against their birth chart instead.`;
    }
    if (rt === 'natal') {
      h += `<div class="rd-row"><label>For</label><select id="rdPersonA">${personOptions(state.readingPersonA)}</select></div>`;
      caption = `${esc(nameA || 'Their')}'s birth map — the sky at the moment they were born, from the saved birth data. Wherever the wheel is scrubbed to, this reading doesn't move.`;
    }
    if (rt === 'transits') {
      h += `<div class="rd-row"><label>For</label>
        <select id="rdPersonA"><option value="world">The world at large</option>${personOptions(state.readingPersonA)}</select></div>`;
      caption = `${esc(nameA || 'The person')}'s personal “now”: how the sky of ${esc(fmtHuman(state.time))} lands on their birth chart — transit contacts and the houses being lit up.`;
    }
    if (rt === 'synastry') {
      h += `<div class="rd-row"><label>Between</label><select id="rdPersonA">${personOptions(state.readingPersonA)}</select>
        <select id="rdPersonB">${personOptions(state.readingPersonB)}</select></div>`;
      caption = `The contacts between ${esc(nameA || 'A')}'s and ${esc(nameB || 'B')}'s birth charts — where they meet easily and where they grind.`;
    }
    if (rt === 'period') {
      const f = state.periodFrom || toDateInput(new Date());
      const t = state.periodTo || toDateInput(new Date(Date.now() + 14 * 864e5));
      h += `<div class="rd-row"><label>For</label>
        <select id="perTarget"><option value="world"${state.periodTarget === 'world' ? ' selected' : ''}>The world at large</option>${personOptions(state.periodTarget)}</select></div>
      <div class="rd-row"><label>From</label><input type="date" id="perFrom" value="${f}"> <label>To</label><input type="date" id="perTo" value="${t}"></div>`;
      caption = state.periodTarget === 'world'
        ? 'The sky’s story across the window: sign ingresses, retrograde stations, exact aspects, and lunations.'
        : `${esc((People.get(state.periodTarget) || {}).name || 'Their')}'s window: every aspect the moving sky perfects against their birth chart, with the general sky as backdrop.`;
    }
    if (caption) h += `<p class="small faint" style="margin:2px 0 0">${caption}</p>`;

    h += `<div class="rd-row">
      <button class="btn" id="btnCompose">Compose reading</button>
      <button class="btn btn-gold" id="btnAI">✦ AI reading</button>
      <span class="small faint" id="rdStatus"></span>
    </div></div>
    <div class="reading-out" id="readingOut" style="display:none"></div>
    <p class="ai-note">“Compose” builds a reading instantly from the computed chart, fully offline. “AI reading” sends the chart data to Anthropic's Claude (needs an API key in ⚙ Settings) and writes a woven narrative in your chosen voice. Readings are for reflection and entertainment.</p>`;
    el.innerHTML = h;
    // preserve prior reading html
    if (el.dataset.readingHtml) {
      const out = $('readingOut');
      out.innerHTML = el.dataset.readingHtml; out.style.display = 'block';
    }

    el.querySelector('#styleSeg').addEventListener('click', e => {
      const b = e.target.closest('button[data-style]'); if (!b) return;
      state.readingStyle = b.dataset.style;
      localStorage.setItem('astrolabe.style', state.readingStyle);
      renderReading(); renderExplore();
    });
    el.querySelector('#typeSeg').addEventListener('click', e => {
      const b = e.target.closest('button[data-type]'); if (!b || b.disabled) return;
      state.readingType = b.dataset.type; renderReading();
    });
    const selA = el.querySelector('#rdPersonA');
    if (selA) selA.addEventListener('change', () => {
      if (selA.value === 'world') { state.readingType = 'sky'; renderReading(); return; }
      state.readingPersonA = selA.value;
      if (rt === 'sky') state.readingType = 'transits'; // person chosen → personal reading of this moment
      renderReading();
    });
    const selB = el.querySelector('#rdPersonB');
    if (selB) selB.addEventListener('change', () => { state.readingPersonB = selB.value; renderReading(); });
    const pTgt = el.querySelector('#perTarget');
    if (pTgt) pTgt.addEventListener('change', () => { state.periodTarget = pTgt.value; renderReading(); });
    const pf = el.querySelector('#perFrom'), pt = el.querySelector('#perTo');
    if (pf) pf.addEventListener('change', () => state.periodFrom = pf.value);
    if (pt) pt.addEventListener('change', () => state.periodTo = pt.value);

    $('btnCompose').addEventListener('click', () => runReading(false));
    $('btnAI').addEventListener('click', () => runReading(true));
  }

  /**
   * Build a reading context from the READING controls — deliberately
   * independent of the wheel's mode. A "Birth chart" reading always uses
   * the person's saved birth data, even when the wheel is scrubbed to now.
   */
  function buildReadingCtx(kind) {
    const aspOpts = { orbScale: settings.orbScale, includeMinor: settings.minorAspects };
    const ctx = { style: state.readingStyle, nowDate: state.time };
    const pA = People.get(state.readingPersonA);
    const pB = People.get(state.readingPersonB);

    if (kind === 'sky') {
      ctx.chart = E.computeChart(state.time, chartOpts({ lat: loc.lat, lon: loc.lon }));
      ctx.aspects = E.findAspects(ctx.chart.planets, aspOpts);
      ctx.patterns = E.findPatterns(ctx.chart.planets, ctx.aspects);
    } else if (kind === 'natal') {
      if (!pA) return { error: 'Save a person in the People tab first.' };
      ctx.person = pA;
      ctx.birthDate = People.birthUTC(pA);
      ctx.chart = People.natalChart(pA, chartOpts());
      ctx.aspects = E.findAspects(ctx.chart.planets, aspOpts);
      ctx.patterns = E.findPatterns(ctx.chart.planets, ctx.aspects);
    } else if (kind === 'transits') {
      if (!pA) return { error: 'Save a person in the People tab first.' };
      ctx.person = pA;
      ctx.birthDate = People.birthUTC(pA);
      ctx.chart = People.natalChart(pA, chartOpts());
      ctx.chartB = E.computeChart(state.time, chartOpts({ lat: pA.lat || 0, lon: pA.lon || 0 }));
      ctx.crossAspects = E.findAspects(ctx.chart.planets, aspOpts, ctx.chartB.planets);
    } else if (kind === 'synastry') {
      if (!pA || !pB || pA.id === pB.id) return { error: 'Synastry needs two different saved people — pick them above.' };
      ctx.personA = pA; ctx.personB = pB;
      ctx.chart = People.natalChart(pA, chartOpts());
      ctx.chartB = People.natalChart(pB, chartOpts());
      ctx.crossAspects = E.findAspects(ctx.chart.planets, aspOpts, ctx.chartB.planets);
    } else if (kind === 'period') {
      ctx.from = new Date((state.periodFrom || toDateInput(new Date())) + 'T00:00:00Z');
      ctx.to = new Date((state.periodTo || toDateInput(new Date(Date.now() + 14 * 864e5))) + 'T23:59:00Z');
      const target = state.periodTarget !== 'world' ? People.get(state.periodTarget) : null;
      if (target) { ctx.person = target; ctx.birthDate = People.birthUTC(target); }
    }
    return ctx;
  }

  let readingBusy = false;
  async function runReading(useAI) {
    if (readingBusy) return;
    const kind = state.readingType || 'sky';
    const out = $('readingOut'), status = $('rdStatus');
    const ctx = buildReadingCtx(kind);
    out.style.display = 'block';
    if (ctx.error) { out.innerHTML = `<p class="muted">${esc(ctx.error)}</p>`; return; }

    if (kind === 'period') {
      status.textContent = 'scanning ephemeris…';
      await new Promise(r => setTimeout(r, 30)); // let UI paint
      const span = ctx.to - ctx.from;
      if (span <= 0 || span > 366 * 864e5) {
        out.innerHTML = `<p class="muted">Pick a period up to one year long.</p>`; status.textContent = ''; return;
      }
      const scanOpts = {};
      if (ctx.person) {
        // personal forecast: track transiting aspects to the natal chart
        const natal = People.natalChart(ctx.person, chartOpts());
        ctx.chart = natal;
        const timeKnown = ctx.person.timeKnown !== false;
        scanOpts.natalPoints = natal.planets
          .filter(p => !p.isLot && p.id !== 'Lilith')
          .filter(p => timeKnown || p.id !== 'Moon') // noon Moon is ±6° — too vague to time transit hits
          .map(p => ({ id: p.id, lon: p.lon }));
        if (timeKnown) {
          scanOpts.natalPoints.push({ id: 'Asc', lon: natal.asc }, { id: 'MC', lon: natal.mc });
        }
      }
      ctx.events = E.scanEvents(ctx.from, ctx.to, scanOpts);
      // long windows: drop the Moon's sign-ingresses (every 2.5 days) — lunations carry the story
      if (span > 45 * 864e5) ctx.events = ctx.events.filter(ev => !(ev.kind === 'ingress' && ev.body === 'Moon'));
      if (!ctx.person) ctx.chart = E.computeChart(ctx.from, chartOpts({ lat: loc.lat, lon: loc.lon }));
    }

    if (!useAI) {
      const html = I.readingHTML(kind, ctx);
      out.innerHTML = html;
      $('tab-reading').dataset.readingHtml = html;
      $('tab-reading').dataset.hasReading = '1';
      status.textContent = '';
      return;
    }

    // AI reading
    if (!window.Api.getSettings().apiKey) {
      out.innerHTML = `<p>To use AI readings, add your Anthropic API key in the <b>⚙ Settings</b> tab. The key is stored only in this browser and sent only to Anthropic.</p><p class="small muted">You can create a key at console.anthropic.com. Offline “Compose” readings work without one.</p>`;
      return;
    }
    readingBusy = true;
    status.innerHTML = '<span class="spin">✦</span> consulting the stars…';
    out.innerHTML = '';
    window.Api.streamReading({
      kind, style: state.readingStyle, ctx,
      onDelta: text => { out.innerHTML = window.Api.mdToHtml(text); },
      onDone: text => {
        const html = window.Api.mdToHtml(text) + `<p class="sig">Written by ${window.Api.getSettings().model} from the computed chart data · for reflection and entertainment.</p>`;
        out.innerHTML = html;
        $('tab-reading').dataset.readingHtml = html;
        $('tab-reading').dataset.hasReading = '1';
        status.textContent = ''; readingBusy = false;
      },
      onError: msg => { out.innerHTML += `<p style="color:var(--danger)">${esc(msg)}</p>`; status.textContent = ''; readingBusy = false; },
    });
  }

  // ---------------- people pane ----------------
  function renderPeople() {
    const el = $('tab-people');
    const people = People.all();
    let h = `<div class="sec-h">Saved people <span class="sec-note">${people.length} chart${people.length === 1 ? '' : 's'}</span></div>`;
    if (!people.length) h += `<p class="muted small">No one saved yet. Add a birth chart below — it stays in this browser only.</p>`;
    for (const p of people) {
      const sunSign = sunSignOf(p);
      h += `<div class="person-card" data-pid="${p.id}">
        <span class="pc-sun" style="color:${D.ELEMENTS[sunSign.element].color}" title="Sun in ${sunSign.name}">${sunSign.glyph}</span>
        <div class="pc-info">
          <div class="pc-name">${esc(p.name)}${state.personA === p.id ? ' <span class="dig-badge dig-good">A</span>' : ''}${state.personB === p.id ? ' <span class="dig-badge dig-mixed">B</span>' : ''}</div>
          <div class="pc-sub">${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}${p.timeKnown !== false ? ` ${String(p.hh).padStart(2, '0')}:${String(p.mm).padStart(2, '0')}` : ' (time unknown)'}${p.place ? ' · ' + esc(p.place) : ''}</div>
        </div>
        <div class="pc-actions">
          <button class="btn small" data-act="natal" title="Open natal chart">Natal</button>
          <button class="btn small" data-act="setA" title="Use as person A (inner wheel)">A</button>
          <button class="btn small" data-act="setB" title="Use as person B (outer wheel, synastry)">B</button>
          <button class="btn small" data-act="edit" title="Edit">✎</button>
          <button class="btn small danger" data-act="del" title="Delete">✕</button>
        </div></div>`;
    }
    const ep = state.editingPerson || {};
    h += `<div class="sec-h">${ep.id ? 'Edit ' + esc(ep.name || '') : 'Add a person'}</div>
    <div class="pform">
      <label class="full">Name<input type="text" id="pfName" value="${esc(ep.name || '')}" placeholder="Name"></label>
      <label>Birth date<input type="date" id="pfDate" value="${ep.y ? `${String(ep.y).padStart(4, '0')}-${String(ep.mo).padStart(2, '0')}-${String(ep.d).padStart(2, '0')}` : ''}"></label>
      <label>Birth time — blank if unknown <input type="time" id="pfTime" value="${ep.timeKnown === false ? '' : (ep.hh !== undefined ? `${String(ep.hh).padStart(2, '0')}:${String(ep.mm).padStart(2, '0')}` : '')}"></label>
      <label class="full">Timezone of birth<select id="pfTz"></select></label>
      <label class="full">Birthplace search<input type="text" id="pfPlace" value="${esc(ep.place || '')}" placeholder="City (press Enter to search — needs internet)"></label>
      <div class="full loc-results" id="pfResults"></div>
      <label>Latitude<input type="number" id="pfLat" step="0.0001" value="${ep.lat !== undefined ? ep.lat : ''}"></label>
      <label>Longitude<input type="number" id="pfLon" step="0.0001" value="${ep.lon !== undefined ? ep.lon : ''}"></label>
    </div>
    <div class="form-actions">
      <button class="btn btn-gold" id="pfSave">${ep.id ? 'Save changes' : 'Add person'}</button>
      ${ep.id ? '<button class="btn" id="pfCancel">Cancel</button>' : ''}
      <span class="spacer"></span>
      <button class="btn small" id="pfExport" title="Download all saved people as a JSON file">Export</button>
      <button class="btn small" id="pfImport" title="Import people from a JSON file">Import</button>
      <input type="file" id="pfImportFile" accept=".json" style="display:none">
    </div>
    <p class="small faint" style="margin-top:8px">Leave the time blank if unknown — the chart is cast for noon and house-based readings are softened. Everything is stored locally in your browser.</p>`;
    el.innerHTML = h;

    fillTzSelect(el.querySelector('#pfTz'), ep.tz || state.tz);

    el.querySelectorAll('.person-card').forEach(card => {
      card.addEventListener('click', e => {
        const btn = e.target.closest('button[data-act]');
        if (!btn) return;
        const id = card.dataset.pid, act = btn.dataset.act;
        if (act === 'natal') { state.personA = id; switchMode('natal'); }
        else if (act === 'setA') { state.personA = id; afterPersonSlotChange(); }
        else if (act === 'setB') { state.personB = id; afterPersonSlotChange(); }
        else if (act === 'edit') { state.editingPerson = People.get(id); renderPeople(); }
        else if (act === 'del') {
          const p = People.get(id);
          if (confirm(`Delete ${p.name}?`)) {
            People.remove(id);
            if (state.personA === id) state.personA = null;
            if (state.personB === id) state.personB = null;
            renderPeople(); recompute(); render();
          }
        }
      });
    });

    el.querySelector('#pfPlace').addEventListener('keydown', async e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const res = el.querySelector('#pfResults');
      res.innerHTML = '<p class="small muted">searching…</p>';
      const items = await geocode(e.target.value);
      res.innerHTML = items.length ? items.map((r, i) =>
        `<button class="lr" data-i="${i}">${esc(r.label)} <span class="sub">${r.lat.toFixed(2)}, ${r.lon.toFixed(2)}${r.tz ? ' · ' + r.tz : ''}</span></button>`).join('')
        : '<p class="small muted">No results (check spelling / internet). You can enter lat/lon manually.</p>';
      res.querySelectorAll('.lr').forEach(b => b.addEventListener('click', () => {
        const r = items[+b.dataset.i];
        el.querySelector('#pfLat').value = r.lat;
        el.querySelector('#pfLon').value = r.lon;
        el.querySelector('#pfPlace').value = r.label;
        if (r.tz) fillTzSelect(el.querySelector('#pfTz'), r.tz);
        res.innerHTML = '';
      }));
    });

    el.querySelector('#pfSave').addEventListener('click', () => {
      const name = el.querySelector('#pfName').value.trim();
      const dateV = el.querySelector('#pfDate').value;
      if (!name || !dateV) { alert('Name and birth date are required.'); return; }
      const [y, mo, d] = dateV.split('-').map(Number);
      const timeV = el.querySelector('#pfTime').value;
      const timeKnown = !!timeV;
      const [hh, mm] = timeKnown ? timeV.split(':').map(Number) : [12, 0];
      const person = Object.assign({}, state.editingPerson || {}, {
        name, y, mo, d, hh, mm, timeKnown,
        tz: el.querySelector('#pfTz').value,
        lat: parseFloat(el.querySelector('#pfLat').value) || 0,
        lon: parseFloat(el.querySelector('#pfLon').value) || 0,
        place: el.querySelector('#pfPlace').value.trim(),
      });
      People.upsert(person);
      state.editingPerson = null;
      if (!state.personA) state.personA = person.id;
      renderPeople(); recompute(); render();
    });
    const pc = el.querySelector('#pfCancel');
    if (pc) pc.addEventListener('click', () => { state.editingPerson = null; renderPeople(); });

    el.querySelector('#pfExport').addEventListener('click', () => {
      const blob = new Blob([People.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'astrolabe-people.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
    el.querySelector('#pfImport').addEventListener('click', () => el.querySelector('#pfImportFile').click());
    el.querySelector('#pfImportFile').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const r = People.importJSON(await f.text());
        alert(`Imported: ${r.added} added, ${r.updated} updated.`);
        renderPeople();
      } catch (err) { alert('Import failed: ' + err.message); }
    });
  }

  function afterPersonSlotChange() {
    if (state.mode === 'natal' && state.personA) switchMode('natal');
    else { renderPeople(); recompute(); render(); }
  }

  function sunSignOf(p) {
    try {
      const chart = People.natalChart(p, { bodies: ['Sun'], includeLots: false });
      return E.SIGN_OF(chart.planets[0].lon);
    } catch { return D.SIGNS[0]; }
  }

  async function geocode(q) {
    if (!q || !q.trim()) return [];
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=8&language=en&format=json`;
      const r = await fetch(url);
      const j = await r.json();
      return (j.results || []).map(x => ({
        label: [x.name, x.admin1, x.country].filter(Boolean).join(', '),
        lat: x.latitude, lon: x.longitude, tz: x.timezone,
      }));
    } catch { return []; }
  }

  // ---------------- settings pane ----------------
  function renderSettings() {
    const el = $('tab-settings');
    const api = window.Api.getSettings();
    el.innerHTML = `
    <div class="sec-h">Chart</div>
    <div class="set-row"><span>House system<span class="hint">Whole Sign is the Hellenistic standard</span></span>
      <select id="setHouse">
        <option value="whole">Whole Sign</option><option value="equal">Equal</option>
        <option value="porphyry">Porphyry</option><option value="placidus">Placidus</option>
      </select></div>
    <div class="set-row"><span>Zodiac<span class="hint">Tropical (Western) or Sidereal (Lahiri)</span></span>
      <select id="setZodiac"><option value="tropical">Tropical</option><option value="sidereal">Sidereal</option></select></div>
    <div class="set-row"><span>Lunar node<span class="hint">True (osculating) or mean</span></span>
      <select id="setNode"><option value="true">True node</option><option value="mean">Mean node</option></select></div>
    <div class="set-row"><span>Show Lots<span class="hint">Fortune & Spirit (Hellenistic)</span></span>
      <input type="checkbox" id="setLots" ${settings.showLots ? 'checked' : ''}></div>

    <div class="sec-h">Bodies on the wheel</div>
    <div class="body-grid" id="bodyGrid">${DEFAULT_BODIES.map(id => {
      const b = D.BODY[id];
      const on = settings.bodies.includes(id);
      return `<button class="body-chip ${on ? 'on' : 'off'}" data-body="${id}"><span class="g" style="color:${b.color}">${b.glyph}</span>${id}</button>`;
    }).join('')}</div>
    <div class="rd-row">
      <button class="btn small" id="setClassic">Classic 7</button>
      <button class="btn small" id="setModern10">Modern 10</button>
      <button class="btn small" id="setAll">All + points</button>
    </div>

    <div class="sec-h">Aspects</div>
    <div class="set-row"><span>Minor aspects<span class="hint">semi-sextile, semi-square, quintile, sesquiquadrate, quincunx</span></span>
      <input type="checkbox" id="setMinor" ${settings.minorAspects ? 'checked' : ''}></div>
    <div class="set-row"><span>Orb width<span class="hint">×${settings.orbScale.toFixed(2)} of standard orbs</span></span>
      <input type="range" id="setOrb" min="0.4" max="1.6" step="0.05" value="${settings.orbScale}" style="width:140px"></div>

    <div class="sec-h">AI readings</div>
    <div class="set-row"><span>Anthropic API key<span class="hint">stored only in this browser; sent only to Anthropic</span></span></div>
    <input type="password" id="setKey" style="width:100%" placeholder="sk-ant-…" value="${esc(api.apiKey)}">
    <div class="set-row" style="margin-top:6px"><span>Model</span>
      <select id="setModel">${window.Api.MODELS.map(m => `<option value="${m.id}" ${api.model === m.id ? 'selected' : ''}>${m.label}</option>`).join('')}</select></div>
    <p class="small faint">Get a key at console.anthropic.com → API keys. Offline “Compose” readings work without one.</p>

    <div class="sec-h">About</div>
    <p class="small muted">Astrolabe computes real geocentric positions with the astronomy-engine ephemeris (±1 arcminute for planets). Hellenistic layer: whole-sign houses, sect, essential dignities (domicile · exaltation · Dorothean triplicity · Egyptian bounds · decans), Lots of Fortune & Spirit, annual profections. Charts are for reflection and entertainment.</p>`;

    el.querySelector('#setHouse').value = settings.houseSystem;
    el.querySelector('#setZodiac').value = settings.zodiac;
    el.querySelector('#setNode').value = settings.nodeType;

    const upd = fn => { fn(); saveSettings(); syncChips(); recompute(); render(); renderExplore(); };
    el.querySelector('#setHouse').addEventListener('change', e => upd(() => settings.houseSystem = e.target.value));
    el.querySelector('#setZodiac').addEventListener('change', e => upd(() => settings.zodiac = e.target.value));
    el.querySelector('#setNode').addEventListener('change', e => upd(() => settings.nodeType = e.target.value));
    el.querySelector('#setLots').addEventListener('change', e => upd(() => settings.showLots = e.target.checked));
    el.querySelector('#setMinor').addEventListener('change', e => upd(() => settings.minorAspects = e.target.checked));
    el.querySelector('#setOrb').addEventListener('input', e => upd(() => settings.orbScale = parseFloat(e.target.value)));
    el.querySelector('#bodyGrid').addEventListener('click', e => {
      const b = e.target.closest('[data-body]'); if (!b) return;
      const id = b.dataset.body;
      upd(() => {
        if (settings.bodies.includes(id)) settings.bodies = settings.bodies.filter(x => x !== id);
        else settings.bodies = DEFAULT_BODIES.filter(x => settings.bodies.includes(x) || x === id);
      });
      renderSettings();
    });
    el.querySelector('#setClassic').addEventListener('click', () => { upd(() => settings.bodies = CLASSIC7.slice()); renderSettings(); });
    el.querySelector('#setModern10').addEventListener('click', () => { upd(() => settings.bodies = DEFAULT_BODIES.slice(0, 10)); renderSettings(); });
    el.querySelector('#setAll').addEventListener('click', () => { upd(() => settings.bodies = DEFAULT_BODIES.slice()); renderSettings(); });
    el.querySelector('#setKey').addEventListener('change', e => window.Api.setSettings({ apiKey: e.target.value.trim() }));
    el.querySelector('#setModel').addEventListener('change', e => window.Api.setSettings({ model: e.target.value }));
  }

  function syncChips() {
    const isClassic = settings.bodies.length === 7 && CLASSIC7.every(b => settings.bodies.includes(b));
    $('chipClassic').classList.toggle('on', isClassic);
    $('chipMinor').classList.toggle('on', settings.minorAspects);
  }

  // ---------------- tabs ----------------
  const TAB_RENDER = { positions: renderPositions, aspects: renderAspectsPane, explore: renderExplore, reading: renderReading, people: renderPeople, settings: renderSettings };
  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.tabpane').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
    (TAB_RENDER[name] || (() => {}))();
  }
  $('tabBar').addEventListener('click', e => {
    const t = e.target.closest('.tab'); if (t) switchTab(t.dataset.tab);
  });

  // ---------------- modes ----------------
  function switchMode(mode) {
    state.mode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    state.selection = null;
    delete $('tab-reading').dataset.readingHtml;
    delete $('tab-reading').dataset.hasReading;
    // the wheel mode sets the reading tab's default type (still changeable there)
    state.readingType = ({ now: 'sky', natal: 'natal', transits: 'transits', synastry: 'synastry' })[mode] || 'sky';
    state.periodTarget = null;
    if (mode === 'natal' || mode === 'transits' || mode === 'synastry') {
      if (!state.personA) {
        const people = People.all();
        if (people.length) state.personA = people[0].id;
      }
      if (mode === 'synastry' && !state.personB) {
        const people = People.all().filter(p => p.id !== state.personA);
        if (people.length) state.personB = people[0].id;
      }
      const p = People.get(state.personA);
      if (mode === 'natal' && p) {
        setPlaying(0);
        state.time = People.birthUTC(p);
        state.tz = p.tz || state.tz;
        state.scrubCenter = null;
        fillTzSelect($('tzSelect'), state.tz);
        syncDtInput();
      }
      if (mode === 'transits') {
        // transits are about the sky NOW (scrub/play moves it from here)
        state.time = new Date();
        state.live = true;
        setPlaying(1); state.speed = 1; $('speedSel').value = '1';
        state.tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        fillTzSelect($('tzSelect'), state.tz);
        syncDtInput();
      }
      if (!p) switchTab('people');
    }
    recompute(); render(); renderExplore();
    if (document.querySelector('.tab.active').dataset.tab === 'reading') renderReading();
  }
  $('modeNav').addEventListener('click', e => {
    const b = e.target.closest('.mode-btn'); if (b) switchMode(b.dataset.mode);
  });

  // ---------------- time machine ----------------
  function setTime(t, opts) {
    state.time = t;
    state.live = false;
    if (!opts || !opts.silent) syncDtInput();
    recompute(); render();
    if (state.selection) renderExplore();
  }

  function setPlaying(dir) {
    state.playing = dir;
    $('btnPlayFwd').classList.toggle('on', dir === 1);
    $('btnPlayRev').classList.toggle('on', dir === -1);
  }

  $('btnNow').addEventListener('click', () => {
    state.time = new Date(); state.live = true;
    setPlaying(1); state.speed = 1; $('speedSel').value = '1';
    state.scrubCenter = null; $('scrub').value = 0;
    syncDtInput(); recompute(); render();
  });

  document.querySelectorAll('.btn.step').forEach(b => {
    b.addEventListener('click', () => {
      setPlaying(0);
      setTime(new Date(state.time.getTime() + (+b.dataset.step) * 1000));
    });
  });

  $('btnPlayFwd').addEventListener('click', () => { setPlaying(state.playing === 1 ? 0 : 1); state.live = false; });
  $('btnPlayRev').addEventListener('click', () => { setPlaying(state.playing === -1 ? 0 : -1); state.live = false; });
  $('speedSel').addEventListener('change', e => { state.speed = +e.target.value; });

  // scrub
  const scrub = $('scrub');
  let scrubbing = false;
  scrub.addEventListener('input', () => {
    if (!scrubbing) { scrubbing = true; state.scrubCenter = state.time; setPlaying(0); }
    const v = scrub.value / 1000; // -1..1
    const range = +$('scrubRange').value * 1000; // ms
    const off = Math.sign(v) * Math.pow(Math.abs(v), 1.6) * range;
    setTime(new Date(state.scrubCenter.getTime() + off));
  });
  const endScrub = () => {
    if (!scrubbing) return;
    scrubbing = false; state.scrubCenter = null;
    scrub.value = 0;
  };
  scrub.addEventListener('change', endScrub);
  scrub.addEventListener('pointerup', endScrub);

  // datetime input
  function syncDtInput() {
    const inp = $('dtInput');
    if (document.activeElement === inp) return; // don't clobber while the user is typing
    inp.value = toInputValue(state.time, state.tz);
  }
  $('dtInput').addEventListener('change', () => {
    const v = $('dtInput').value; if (!v) return;
    const [dpart, tpart] = v.split('T');
    const [y, mo, d] = dpart.split('-').map(Number);
    const [hh, mm] = tpart.split(':').map(Number);
    setPlaying(0);
    setTime(E.zonedTimeToUTC(y, mo, d, hh, mm, state.tz), { silent: true });
  });
  $('tzSelect').addEventListener('change', e => { state.tz = e.target.value; syncDtInput(); });

  function toInputValue(date, tz) {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    const p = Object.fromEntries(fmt.formatToParts(date).map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
  }
  function toDateInput(date) { return date.toISOString().slice(0, 10); }
  function fmtHuman(date) {
    return new Intl.DateTimeFormat(undefined, { timeZone: state.tz, dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function fillTzSelect(sel, value) {
    const zones = (Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : [state.tz]);
    if (!sel.options.length) {
      sel.innerHTML = zones.map(z => `<option value="${z}">${z.replace(/_/g, ' ')}</option>`).join('');
    }
    sel.value = value;
    if (sel.selectedIndex === -1 && zones.length) sel.value = zones[0];
  }

  // ---------------- animation loop ----------------
  let lastFrame = performance.now(), lastRender = 0;
  function tick(now) {
    const dt = (now - lastFrame) / 1000; lastFrame = now;
    if (state.playing !== 0) {
      if (state.live && state.playing === 1 && state.speed === 1) {
        state.time = new Date();
      } else {
        state.time = new Date(state.time.getTime() + state.playing * state.speed * dt * 1000);
        state.live = false;
      }
      if (now - lastRender > 40) {
        lastRender = now;
        recompute(); render();
        syncDtInput();
      }
    }
    requestAnimationFrame(tick);
  }

  // ---------------- wheel interactions ----------------
  const tooltip = $('tooltip');
  const wrap = $('wheelWrap');

  svg.addEventListener('pointermove', e => {
    const t = e.target.closest('[data-sel]');
    if (t !== hoverEl) {
      hoverEl = t;
      state.hover = t ? parseSel(t) : null;
      applyHoverStyles();
      updateTooltip(t);
    }
    if (!tooltip.hidden) {
      const r = wrap.getBoundingClientRect();
      let x = e.clientX - r.left + 16, y = e.clientY - r.top + 14;
      if (x + 290 > r.width) x = e.clientX - r.left - 296;
      if (y + 120 > r.height) y = e.clientY - r.top - 100;
      tooltip.style.left = x + 'px'; tooltip.style.top = y + 'px';
    }
  });
  let hoverEl = null;
  svg.addEventListener('pointerleave', () => { hoverEl = null; state.hover = null; applyHoverStyles(); tooltip.hidden = true; });
  svg.addEventListener('click', e => {
    const t = e.target.closest('[data-sel]');
    state.selection = t ? parseSel(t) : null;
    renderPositions(); renderAspectsPane();
    switchTab('explore');
  });
  $('patternHud').addEventListener('click', e => {
    const p = e.target.closest('[data-pat]'); if (!p) return;
    state.selection = { type: 'pattern', idx: +p.dataset.pat };
    switchTab('explore');
  });
  // pane row clicks (positions & aspects)
  for (const paneId of ['tab-positions', 'tab-aspects']) {
    $(paneId).addEventListener('click', e => {
      const r = e.target.closest('[data-sel]'); if (!r) return;
      state.selection = parseSel(r);
      renderPositions(); renderAspectsPane();
      switchTab('explore');
    });
  }

  function parseSel(el) {
    const [type, ...rest] = el.dataset.sel.split(':');
    const val = rest.join(':');
    if (type === 'aspect') return { type, key: val };
    if (type === 'planet') return { type, id: val, ring: el.dataset.ring || 'inner' };
    return { type, id: val };
  }

  function applyHoverStyles() {
    const h = state.hover;
    const lines = svg.querySelectorAll('.aspect-line');
    const planets = svg.querySelectorAll('.planet-g');
    if (!h) {
      lines.forEach(l => l.classList.remove('dimmed', 'hl'));
      planets.forEach(p => p.classList.remove('dimmed', 'hl'));
      return;
    }
    if (h.type === 'planet') {
      lines.forEach(l => {
        const involved = l.dataset.a === h.id || l.dataset.b === h.id;
        l.classList.toggle('dimmed', !involved);
        l.classList.toggle('hl', involved);
      });
      planets.forEach(p => p.classList.toggle('hl', p.dataset.sel === 'planet:' + h.id));
    } else if (h.type === 'aspect') {
      const [a, b] = h.key.split('|');
      lines.forEach(l => {
        const isIt = l.dataset.sel === 'aspect:' + h.key;
        l.classList.toggle('dimmed', !isIt);
        l.classList.toggle('hl', isIt);
      });
      planets.forEach(p => p.classList.toggle('hl', p.dataset.sel === 'planet:' + a || p.dataset.sel === 'planet:' + b));
    }
  }

  function updateTooltip(el) {
    if (!el || !view.chart) { tooltip.hidden = true; return; }
    const s = parseSel(el);
    let html = '';
    if (s.type === 'planet') {
      const chart = s.ring === 'outer' && view.outer ? view.outer.chart : view.chart;
      const p = chart.planets.concat(chart.lots || []).find(x => x.id === s.id);
      if (p) {
        const meta = D.BODY[p.id] || {};
        html = `<div class="tt-title">${p.glyph} ${p.isLot ? 'Lot of ' + p.id : p.id}${p.retro ? ' ℞' : ''}</div>
        <div>${E.fmtLon(p.lon)} · House ${p.house}</div>
        ${p.dignities && p.dignities.list.length ? `<div class="tt-sub">${p.dignities.list.join(' · ')}</div>` : ''}
        <div class="tt-sub">${(meta.keywords || []).join(' · ')}</div>`;
      }
    } else if (s.type === 'aspect') {
      const a = (view.aspects || []).find(x => aspKey(x) === s.key);
      if (a) {
        const t = D.ASPECT[a.type];
        html = `<div class="tt-title" style="color:${t.color}">${a.a} ${t.glyph} ${a.b} — ${t.name}</div>
        <div>orb ${a.orb.toFixed(2)}° · ${a.applying ? 'applying' : 'separating'}</div>
        <div class="tt-sub">${t.blurb.split('.')[0]}.</div>`;
      }
    } else if (s.type === 'sign') {
      const sg = D.SIGNS.find(x => x.name === s.id);
      html = `<div class="tt-title" style="color:${D.ELEMENTS[sg.element].color}">${sg.glyph} ${sg.name}</div>
      <div class="tt-sub">${sg.element} · ${sg.modality} · ruled by ${sg.rulerTrad}</div>`;
    } else if (s.type === 'house') {
      const hh = D.HOUSES[+s.id - 1];
      html = `<div class="tt-title">House ${s.id} — ${hh.helln}</div><div class="tt-sub">${hh.topics}</div>`;
    } else if (s.type === 'angle') {
      const m = D.ANGLES[s.id];
      const lon = { Asc: view.chart.asc, MC: view.chart.mc, Dsc: view.chart.dsc, IC: view.chart.ic }[s.id];
      html = `<div class="tt-title">${m.name}</div><div>${E.fmtLon(lon)}</div>`;
    }
    if (html) { tooltip.innerHTML = html; tooltip.hidden = false; }
    else tooltip.hidden = true;
  }

  // ---------------- quick chips ----------------
  $('chipClassic').addEventListener('click', () => {
    const isClassic = settings.bodies.length === 7 && CLASSIC7.every(b => settings.bodies.includes(b));
    settings.bodies = isClassic ? DEFAULT_BODIES.slice() : CLASSIC7.slice();
    saveSettings(); syncChips(); recompute(); render();
  });
  $('chipMinor').addEventListener('click', () => {
    settings.minorAspects = !settings.minorAspects;
    saveSettings(); syncChips(); recompute(); render();
  });

  // ---------------- location modal ----------------
  const locModal = $('locModal');
  $('locBtn').addEventListener('click', () => {
    $('locLat').value = loc.lat; $('locLon').value = loc.lon; $('locName').value = loc.name || '';
    $('locResults').innerHTML = '';
    locModal.hidden = false;
    $('locSearch').focus();
  });
  $('locCancel').addEventListener('click', () => locModal.hidden = true);
  locModal.addEventListener('click', e => { if (e.target === locModal) locModal.hidden = true; });
  async function doLocSearch() {
    const res = $('locResults');
    res.innerHTML = '<p class="small muted">searching…</p>';
    const items = await geocode($('locSearch').value);
    res.innerHTML = items.length ? items.map((r, i) =>
      `<button class="lr" data-i="${i}">${esc(r.label)} <span class="sub">${r.lat.toFixed(2)}, ${r.lon.toFixed(2)}</span></button>`).join('')
      : '<p class="small muted">No results — try another spelling, or enter lat/lon manually.</p>';
    res.querySelectorAll('.lr').forEach(b => b.addEventListener('click', () => {
      const r = items[+b.dataset.i];
      $('locLat').value = r.lat; $('locLon').value = r.lon; $('locName').value = r.label;
    }));
  }
  $('locSearchBtn').addEventListener('click', doLocSearch);
  $('locSearch').addEventListener('keydown', e => { if (e.key === 'Enter') doLocSearch(); });
  $('locApply').addEventListener('click', () => {
    loc.lat = parseFloat($('locLat').value) || 0;
    loc.lon = parseFloat($('locLon').value) || 0;
    loc.name = $('locName').value.trim();
    saveLoc(); updateLocLabel();
    locModal.hidden = true;
    recompute(); render();
  });
  function updateLocLabel() {
    $('locLabel').textContent = loc.name || `${loc.lat.toFixed(2)}°, ${loc.lon.toFixed(2)}°`;
  }

  // ---------------- PNG export ----------------
  $('chipPng').addEventListener('click', () => {
    if (!view.chart) return;
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('font-family', "'Segoe UI Symbol','Segoe UI',sans-serif");
    clone.setAttribute('width', '2000'); clone.setAttribute('height', '2000');
    const src = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = 2000; cv.height = 2000;
      const cx = cv.getContext('2d');
      const grad = cx.createRadialGradient(1000, 1000, 200, 1000, 1000, 1400);
      grad.addColorStop(0, '#0d1220'); grad.addColorStop(1, '#06080f');
      cx.fillStyle = grad; cx.fillRect(0, 0, 2000, 2000);
      cx.drawImage(img, 0, 0, 2000, 2000);
      URL.revokeObjectURL(url);
      cv.toBlob(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const label = state.mode === 'now' ? 'sky' : state.mode;
        a.download = `astrolabe-${label}-${view.chart.date.toISOString().slice(0, 16).replace(/[:T]/g, '-')}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      }, 'image/png');
    };
    img.src = url;
  });

  // ---------------- keyboard shortcuts ----------------
  document.addEventListener('keydown', e => {
    const tag = (document.activeElement || {}).tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === ' ') {
      e.preventDefault();
      setPlaying(state.playing ? 0 : 1); state.live = false;
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const step = e.shiftKey ? 86400 : 3600;
      setPlaying(0);
      setTime(new Date(state.time.getTime() + dir * step * 1000));
    } else if (e.key === 'n' || e.key === 'N') {
      $('btnNow').click();
    }
  });

  // ---------------- star field ----------------
  (function stars() {
    const wrap = $('stars');
    let h = '';
    for (let i = 0; i < 140; i++) {
      const size = Math.random() < 0.85 ? 1 : 2;
      h += `<div class="st" style="left:${(Math.random() * 100).toFixed(2)}%;top:${(Math.random() * 100).toFixed(2)}%;width:${size}px;height:${size}px;animation-delay:${(Math.random() * 4).toFixed(2)}s;animation-duration:${(3 + Math.random() * 4).toFixed(2)}s"></div>`;
    }
    wrap.innerHTML = h;
  })();

  // ---------------- boot ----------------
  fillTzSelect($('tzSelect'), state.tz);
  updateLocLabel();
  syncChips();
  syncDtInput();
  setPlaying(1); state.speed = 1; $('speedSel').value = '1'; state.live = true;
  recompute(); render(); renderExplore();
  requestAnimationFrame(t => { lastFrame = t; requestAnimationFrame(tick); });

  // panel collapse
  $('panelToggle').addEventListener('click', () => {
    const collapsed = $('panel').classList.toggle('collapsed');
    document.body.classList.toggle('panel-collapsed', collapsed);
    $('panelToggle').textContent = collapsed ? '◀' : '▶';
    localStorage.setItem('astrolabe.panel', collapsed ? '1' : '');
  });
  if (localStorage.getItem('astrolabe.panel') === '1') $('panelToggle').click();

  // panel widen (reading comfort)
  $('panelWide').addEventListener('click', () => {
    // widening a collapsed panel brings it back first
    if ($('panel').classList.contains('collapsed')) $('panelToggle').click();
    const wide = document.body.classList.toggle('panel-wide');
    $('panelWide').textContent = wide ? '⇥' : '⇤';
    $('panelWide').title = wide ? 'Back to the narrow panel' : 'Widen the panel for comfortable reading';
    localStorage.setItem('astrolabe.panelWide', wide ? '1' : '');
  });
  if (localStorage.getItem('astrolabe.panelWide') === '1') $('panelWide').click();

  // gentle nudge to set a location on first run (no geolocation — type a city instead)
  if (!localStorage.getItem(LOCKEY)) saveLoc();
})();
