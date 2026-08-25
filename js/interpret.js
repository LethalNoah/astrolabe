/* ============================================================
   INTERPRET — composed meanings, info panels, offline readings
   Styles: 'hellenistic' | 'modern' | 'blended'
   ============================================================ */
(function (g) {
  'use strict';
  const D = g.AstroData;
  const E = g.Engine;

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const pick = (arr, seed) => arr[Math.abs([...String(seed)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7)) % arr.length];
  const signOf = name => D.SIGNS.find(s => s.name === name);

  // ---------- sect roles ----------
  function sectRole(id, isDay) {
    if (isDay) {
      if (id === 'Jupiter') return { role: 'benefic of sect', good: true, note: 'the chart’s most generous helper' };
      if (id === 'Venus') return { role: 'benefic contrary to sect', good: true, note: 'still kind, but quieter in a day chart' };
      if (id === 'Saturn') return { role: 'malefic of sect', good: false, note: 'stern but constructive in a day chart' };
      if (id === 'Mars') return { role: 'malefic contrary to sect', good: false, note: 'the chart’s sharpest edge — Mars runs hot by day' };
      if (id === 'Sun') return { role: 'sect light', good: true, note: 'the leading luminary of this day chart' };
    } else {
      if (id === 'Venus') return { role: 'benefic of sect', good: true, note: 'the chart’s most generous helper' };
      if (id === 'Jupiter') return { role: 'benefic contrary to sect', good: true, note: 'still helpful, but more formal in a night chart' };
      if (id === 'Mars') return { role: 'malefic of sect', good: false, note: 'forceful but usable in a night chart' };
      if (id === 'Saturn') return { role: 'malefic contrary to sect', good: false, note: 'the chart’s coldest weight — Saturn bites at night' };
      if (id === 'Moon') return { role: 'sect light', good: true, note: 'the leading luminary of this night chart' };
    }
    return null;
  }

  // ---------- dignity phrasing ----------
  function dignityPhrase(p, style) {
    const dl = p.dignities.list;
    const heln = style !== 'modern';
    if (dl.includes('Domicile')) return heln ? 'in its own domicile — at home, resourced, able to act on its own terms' : 'strongly placed in a sign it rules';
    if (dl.includes('Exaltation')) return heln ? 'exalted — received like an honored guest, its significations raised up' : 'exalted here, expressing its best qualities easily';
    if (dl.includes('Detriment')) return heln ? 'in exile — working in a foreign court, against its own grain' : 'in detriment, so this energy takes conscious effort to express well';
    if (dl.includes('Fall')) return heln ? 'in its fall — its significations depressed, needing support from allies' : 'in fall, an uphill placement that can mature into hard-won skill';
    if (dl.some(x => x.startsWith('Triplicity'))) return heln ? 'supported by triplicity — comfortable among kin' : 'gently supported by its element';
    if (dl.includes('Own bounds')) return heln ? 'in its own bounds — a small estate, but its own' : 'subtly dignified';
    return heln ? 'peregrine — a traveler in another’s land, taking its condition from its hosts' : null;
  }

  // ---------- planet-in-sign composed sentence ----------
  const FUNCTION_PHRASE = {
    Sun: 'the core identity and will', Moon: 'the emotional life and instincts',
    Mercury: 'the mind and voice', Venus: 'love, taste, and attraction',
    Mars: 'drive and the fighting spirit', Jupiter: 'growth, faith, and fortune',
    Saturn: 'structure, discipline, and time', Uranus: 'the urge to break free',
    Neptune: 'imagination and longing for transcendence', Pluto: 'the deep will to transform',
    Node: 'the direction of development', Lilith: 'the refusal to be tamed',
    Fortune: 'the body and circumstantial luck', Spirit: 'deliberate action and career',
  };

  function planetSignText(p, chart, style) {
    const s = signOf(p.sign);
    const fn = FUNCTION_PHRASE[p.id] || 'this point';
    const kws = s.keywords.slice(0, 3).join(', ');
    const verb = pick(['moves through', 'is clothed in', 'takes on the manner of', 'travels in'], p.id + p.sign);
    let t = `Here ${fn} ${verb} <em>${s.name}</em> — ${kws}. ${s.blurb}`;
    const dig = dignityPhrase(p, style);
    if (dig && !p.isLot) t += ` ${cap(p.id === 'Node' || p.id === 'Lilith' ? 'It is' : capName(p.id) + ' is')} ${dig}.`;
    if (style !== 'modern' && !p.isLot && p.dignities.boundRuler) {
      t += ` Within the bounds of ${p.dignities.boundRuler}, in the decan of ${p.dignities.decanRuler}.`;
    }
    if (p.retro) t += ` Retrograde: its expression turns inward, revisiting rather than advancing.`;
    const sr = style !== 'modern' ? sectRole(p.id, chart.isDay) : null;
    if (sr) t += ` As ${sr.role}, ${sr.note}.`;
    return t;
  }

  function houseText(p, style) {
    const h = D.HOUSES[p.house - 1];
    const hn = style === 'modern' ? `the ${ord(h.n)} house` : `the ${ord(h.n)} house (${h.helln})`;
    return `Placed in ${hn}: ${h.topics.toLowerCase()}.${h.angular ? ' An angular house — this placement acts loudly and visibly in the life.' : ''}`;
  }

  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const capName = id => id;
  const ord = n => n + (['th', 'st', 'nd', 'rd'][((n % 100) - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

  // ---------- aspect composed sentence ----------
  function aspectText(a, style, labels) {
    const t = D.ASPECT[a.type];
    const b1 = D.BODY[a.a] || {}, b2 = D.BODY[a.b] || {};
    const k1 = (FUNCTION_PHRASE[a.a] || a.a), k2 = (FUNCTION_PHRASE[a.b] || a.b);
    const la = labels ? `${labels[0]}’s ${a.a}` : a.a;
    const lb = labels ? `${labels[1]}’s ${a.b}` : a.b;
    let verb;
    switch (a.type) {
      case 'conjunction': verb = pick(['fuses with', 'merges with', 'sits with'], a.a + a.b); break;
      case 'trine': verb = pick(['flows easily with', 'harmonizes with', 'feeds'], a.a + a.b); break;
      case 'sextile': verb = pick(['opens a door to', 'cooperates with'], a.a + a.b); break;
      case 'square': verb = pick(['grinds against', 'clashes with', 'provokes'], a.a + a.b); break;
      case 'opposition': verb = pick(['faces off against', 'pulls against'], a.a + a.b); break;
      case 'quincunx': verb = 'sits blind to'; break;
      default: verb = 'subtly engages';
    }
    let s = `<b>${la} ${t.glyph} ${lb}</b> — ${k1} ${verb} ${k2}`;
    s += ` (orb ${a.orb.toFixed(1)}°${a.applying ? ', applying — the aspect is still building' : ', separating — its perfection lies behind'}).`;
    if (a.exact) s += ' Nearly exact: this is one of the loudest signatures here.';
    return s;
  }

  // ============================================================
  //  EXPLORE PANE — info for a clicked object
  // ============================================================
  function hero(glyph, title, sub, color) {
    return `<div class="xp-hero"><div class="xg" style="color:${color || 'var(--gold)'}">${glyph}</div>
      <div><h2>${esc(title)}</h2><div class="xp-sub">${sub}</div></div></div>`;
  }

  function planetInfoHTML(p, chart, aspects, style) {
    const meta = D.BODY[p.id] || D.LOTS.find(l => l.id === p.id) || {};
    const s = signOf(p.sign);
    let h = hero(p.glyph, meta.name || p.id, `${E.fmtLon(p.lon)} · House ${p.house}${p.retro ? ' · <span style="color:var(--danger)">retrograde</span>' : ''}`, p.color);
    if (meta.keywords) h += `<div class="tagrow">${meta.keywords.map(k => `<span class="tag">${k}</span>`).join('')}</div>`;
    h += `<div class="xp-body">`;
    const helnReal = meta.helln && !meta.helln.startsWith('(');
    if (style !== 'modern' && helnReal) h += `<p><b>Hellenistic:</b> ${meta.helln}</p>`;
    if ((style !== 'hellenistic' || !helnReal) && meta.modern) h += `<p><b>Modern:</b> ${meta.modern}</p>`;
    if (meta.blurb) h += `<p>${meta.blurb}</p>`;
    h += `<p>${planetSignText(p, chart, style)}</p>`;
    h += `<p>${houseText(p, style)}</p>`;
    if (!p.isLot && p.dignities.list.length) {
      h += `<p><b>Dignities:</b> ${p.dignities.list.join(', ')} (score ${p.dignities.score > 0 ? '+' : ''}${p.dignities.score}).</p>`;
    }
    if (Math.abs(p.speed) > 1e-6) {
      h += `<p class="small muted">Daily motion: ${p.speed.toFixed(3)}°/day${p.retro ? ' (retrograde)' : ''}.</p>`;
    }
    const mine = (aspects || []).filter(x => x.a === p.id || x.b === p.id);
    if (mine.length) {
      h += `<h3 class="sec-h" style="margin-top:14px">Aspects</h3>`;
      for (const a of mine) h += `<p>${aspectText(a, style)}</p>`;
    }
    return h + `</div>`;
  }

  function signInfoHTML(name, chart, style) {
    const s = signOf(name);
    const el = D.ELEMENTS[s.element];
    let h = hero(s.glyph, s.name, `${s.element} · ${s.modality} · ruled by ${style === 'modern' ? s.rulerMod : s.rulerTrad}`, el.color);
    h += `<div class="tagrow">${s.keywords.map(k => `<span class="tag">${k}</span>`).join('')}</div><div class="xp-body">`;
    h += `<p>${s.blurb}</p><p>${el.desc}</p><p>${D.MODALITIES[s.modality]}</p>`;
    const ex = Object.entries(D.EXALTATION).find(([, v]) => v.sign === name);
    h += `<dl class="kv"><dt>Traditional ruler</dt><dd>${s.rulerTrad}</dd>`;
    if (s.rulerMod !== s.rulerTrad) h += `<dt>Modern ruler</dt><dd>${s.rulerMod}</dd>`;
    if (ex) h += `<dt>Exaltation of</dt><dd>${ex[0]} (${ex[1].degree}°)</dd>`;
    h += `<dt>Detriment of</dt><dd>${D.DOMICILE[E.OPPOSITE_SIGN(name)]}</dd></dl>`;
    if (chart) {
      const here = chart.planets.filter(p => p.sign === name);
      if (here.length) h += `<p><b>Currently here:</b> ${here.map(p => `${p.glyph} ${p.id} (${E.fmtDeg(p.degInSign)})`).join(', ')}.</p>`;
    }
    return h + `</div>`;
  }

  function houseInfoHTML(n, chart, style) {
    const h1 = D.HOUSES[n - 1];
    let h = hero(n, `${ord(n)} House`, style === 'modern' ? (h1.angular ? 'Angular' : '') : h1.helln, 'var(--gold)');
    h += `<div class="xp-body"><p><b>Topics:</b> ${h1.topics}.</p>`;
    h += `<p>${h1.angular ? 'An angular house: planets here act with maximum force and visibility.' : 'Planets here color these topics of life according to their nature and condition.'}</p>`;
    if (chart) {
      const cusp = chart.cusps[n - 1];
      h += `<p>Cusp at ${E.fmtLon(cusp)} (${chart.houseSystem} houses).</p>`;
      const inside = chart.planets.filter(p => p.house === n);
      if (inside.length) h += `<p><b>Occupants:</b> ${inside.map(p => `${p.glyph} ${p.id}`).join(', ')}.</p>`;
      else h += `<p class="muted">No planets here — its topics are ruled from elsewhere (see the ruler of ${E.SIGN_OF(cusp).name}).</p>`;
    }
    return h + `</div>`;
  }

  function aspectInfoHTML(a, chart, chartB, style, labels) {
    const t = D.ASPECT[a.type];
    let h = hero(t.glyph, t.name, `${a.a} — ${a.b} · orb ${a.orb.toFixed(2)}° · ${a.applying ? 'applying' : 'separating'}`, t.color);
    h += `<div class="xp-body"><p>${t.blurb}</p>`;
    h += `<p>${aspectText(a, style, labels)}</p>`;
    const b1 = D.BODY[a.a], b2 = D.BODY[a.b];
    const sig = b => (style === 'hellenistic' && b.helln && !b.helln.startsWith('(')) ? b.helln : b.modern;
    if (b1 && b2) {
      h += `<p><b>${a.a}:</b> ${sig(b1)}<br><b>${a.b}:</b> ${sig(b2)}</p>`;
    }
    if (style !== 'modern' && t.major && a.type !== 'conjunction') {
      const signA = (chart.planets.find(p => p.id === a.a) || {}).sign;
      const signB = ((chartB || chart).planets.find(p => p.id === a.b) || {}).sign;
      if (signA && signB) {
        const w = sepSigns(signA, signB);
        const cfg = { 2: 'sextile', 3: 'square', 4: 'trine', 6: 'opposition' }[w];
        h += `<p class="small muted">Hellenistic note: by whole sign, ${signA} and ${signB} are ${cfg ? 'configured by ' + cfg : 'in aversion — unable to “see” each other'}.</p>`;
      }
    }
    return h + `</div>`;
  }

  function sepSigns(sa, sb) {
    const ia = D.SIGNS.findIndex(s => s.name === sa), ib = D.SIGNS.findIndex(s => s.name === sb);
    const d = Math.abs(ia - ib);
    return Math.min(d, 12 - d);
  }

  function angleInfoHTML(id, chart, style) {
    const meta = D.ANGLES[id];
    const lon = { Asc: chart.asc, MC: chart.mc, Dsc: chart.dsc, IC: chart.ic }[id];
    const s = E.SIGN_OF(lon);
    let h = hero(meta.glyph, meta.name, E.fmtLon(lon), meta.color);
    h += `<div class="xp-body"><p>${meta.blurb}</p>`;
    h += `<p>With <em>${s.name}</em> here: ${s.blurb}</p>`;
    if (id === 'Asc') {
      const rulerId = style === 'modern' ? s.rulerMod : s.rulerTrad;
      const ruler = chart.planets.find(p => p.id === rulerId);
      if (ruler) h += `<p><b>Ruler of the Ascendant</b> is ${rulerId}, placed at ${E.fmtLon(ruler.lon)} in house ${ruler.house} — the captain steering this chart. ${planetSignText(ruler, chart, style)}</p>`;
    }
    return h + `</div>`;
  }

  function patternInfoHTML(pat, chart, style) {
    let h = hero('✦', pat.name, pat.members.join(' · '), 'var(--gold)');
    h += `<div class="xp-body"><p>${pat.detail}</p>`;
    for (const m of pat.members) {
      const p = chart.planets.find(x => x.id === m);
      if (p) h += `<p><b>${p.glyph} ${m}</b> at ${E.fmtLon(p.lon)} (house ${p.house}).</p>`;
    }
    return h + `</div>`;
  }

  // ============================================================
  //  CHART OVERVIEW (Explore default)
  // ============================================================
  function overviewHTML(chart, aspects, patterns, style) {
    const sun = chart.planets.find(p => p.id === 'Sun');
    const moon = chart.planets.find(p => p.id === 'Moon');
    const ascSign = E.SIGN_OF(chart.asc);
    let h = `<div class="xp-body">`;
    h += `<p>${D.SECT_INFO[chart.sect]}</p>`;
    if (sun) h += `<p><b>☉ Sun</b> at ${E.fmtLon(sun.lon)}, house ${sun.house}.</p>`;
    if (moon) h += `<p><b>☽ Moon</b> at ${E.fmtLon(moon.lon)}, house ${moon.house} — ${moonPhaseName(chart.moonPhaseAngle)}, ${(chart.moonIllum * 100).toFixed(0)}% lit.</p>`;
    h += `<p><b>Ascendant</b> ${E.fmtLon(chart.asc)} · <b>MC</b> ${E.fmtLon(chart.mc)}.</p>`;
    const rulerId = style === 'modern' ? ascSign.rulerMod : ascSign.rulerTrad;
    const ruler = chart.planets.find(p => p.id === rulerId);
    if (ruler) h += `<p>The helm is ${ascSign.name}, steered by <b>${rulerId}</b> in ${ruler.sign} (house ${ruler.house}).</p>`;
    // balance
    const bal = elementBalance(chart);
    h += `<p class="small muted">Element weights — ${bal}.</p>`;
    if (patterns && patterns.length) {
      h += `<h3 class="sec-h">Patterns</h3>`;
      for (const p of patterns) h += `<p><b>${p.name}</b> (${p.members.join(', ')}): ${p.detail}</p>`;
    }
    h += `</div>`;
    return h;
  }

  function elementBalance(chart) {
    const w = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
    for (const p of chart.planets) {
      if (p.isLot || p.id === 'Node' || p.id === 'Lilith') continue;
      const wt = (p.id === 'Sun' || p.id === 'Moon') ? 2 : 1;
      w[p.element] += wt;
    }
    return Object.entries(w).map(([k, v]) => `${k} ${v}`).join(' · ');
  }

  function moonPhaseName(a) {
    if (a < 22.5) return 'New Moon'; if (a < 67.5) return 'waxing crescent';
    if (a < 112.5) return 'First Quarter'; if (a < 157.5) return 'waxing gibbous';
    if (a < 202.5) return 'Full Moon'; if (a < 247.5) return 'waning gibbous';
    if (a < 292.5) return 'Last Quarter'; if (a < 337.5) return 'waning crescent';
    return 'New Moon';
  }

  // ============================================================
  //  OFFLINE COMPOSED READINGS
  // ============================================================
  function readingHTML(kind, ctx) {
    const { chart, aspects, patterns, style } = ctx;
    let h = '';
    const majors = (aspects || []).filter(a => a.major).slice(0, 6);

    if (kind === 'sky') {
      h += `<h3>The Sky at This Moment</h3>`;
      h += `<p>${D.SECT_INFO[chart.sect]}</p>`;
      const moon = chart.planets.find(p => p.id === 'Moon');
      const sun = chart.planets.find(p => p.id === 'Sun');
      if (sun && moon) {
        h += `<p>The <em>Sun in ${sun.sign}</em> sets the season’s tone — ${signOf(sun.sign).keywords.slice(0, 3).join(', ')}. The <em>Moon in ${moon.sign}</em> (${moonPhaseName(chart.moonPhaseAngle)}) gives the mood of the hour: ${signOf(moon.sign).keywords.slice(0, 3).join(', ')}.</p>`;
      }
      const retros = chart.planets.filter(p => p.retro && !p.isLot && p.id !== 'Node' && p.id !== 'Lilith');
      if (retros.length) h += `<p><b>Retrograde now:</b> ${retros.map(p => p.glyph + ' ' + p.id).join(', ')} — their affairs are under review rather than moving forward.</p>`;
      h += `<h3>Loudest Aspects</h3>`;
      for (const a of majors) h += `<p>${aspectText(a, style)}</p>`;
      const slow = (aspects || []).filter(a => ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'].includes(a.a) && ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'].includes(a.b));
      if (slow.length) {
        h += `<h3>The Slow Weather (collective themes)</h3>`;
        for (const a of slow) h += `<p>${aspectText(a, style)}</p>`;
      }
    }

    if (kind === 'natal') {
      const person = ctx.person;
      h += `<h3>${person ? esc(person.name) + '’s Chart' : 'Natal Chart'}</h3>`;
      h += `<p>${D.SECT_INFO[chart.sect]}</p>`;
      const sun = chart.planets.find(p => p.id === 'Sun');
      const moon = chart.planets.find(p => p.id === 'Moon');
      const ascSign = E.SIGN_OF(chart.asc);
      h += `<p>Rising is <em>${ascSign.name}</em>: ${ascSign.blurb}</p>`;
      const rulerId = style === 'modern' ? ascSign.rulerMod : ascSign.rulerTrad;
      const ruler = chart.planets.find(p => p.id === rulerId);
      if (ruler) h += `<p>The chart’s ruler, <b>${rulerId}</b>, ${planetSignText(ruler, chart, style)} ${houseText(ruler, style)}</p>`;
      h += `<h3>The Luminaries</h3>`;
      if (sun) h += `<p><b>☉ Sun in ${sun.sign}</b> (house ${sun.house}): ${planetSignText(sun, chart, style)}</p>`;
      if (moon) h += `<p><b>☽ Moon in ${moon.sign}</b> (house ${moon.house}), born under a ${moonPhaseName(chart.moonPhaseAngle)}: ${planetSignText(moon, chart, style)}</p>`;
      // strongest & weakest
      const scored = chart.planets.filter(p => !p.isLot && D.BODY[p.id] && D.BODY[p.id].classic7);
      const strong = scored.filter(p => p.dignities.score >= 3);
      const weak = scored.filter(p => p.dignities.score <= -3);
      if (strong.length) h += `<p><b>Well-resourced:</b> ${strong.map(p => `${p.glyph} ${p.id} in ${p.sign} (${p.dignities.list.join(', ')})`).join('; ')}.</p>`;
      if (weak.length) h += `<p><b>Hard-working placements:</b> ${weak.map(p => `${p.glyph} ${p.id} in ${p.sign} (${p.dignities.list.join(', ')})`).join('; ')} — these mature through effort.</p>`;
      const angular = chart.planets.filter(p => !p.isLot && [1, 4, 7, 10].includes(p.house) && p.id !== 'Node' && p.id !== 'Lilith');
      if (angular.length) h += `<p><b>Angular (loud) planets:</b> ${angular.map(p => `${p.glyph} ${p.id} in house ${p.house}`).join(', ')} — these dominate the life’s visible action.</p>`;
      if (style !== 'modern' && chart.lots.length) {
        const f = chart.lots.find(l => l.id === 'Fortune'), sp = chart.lots.find(l => l.id === 'Spirit');
        h += `<h3>The Lots</h3>`;
        if (f) h += `<p><b>⊗ Fortune in ${f.sign}</b> (house ${f.house}): the body and circumstantial luck live here.</p>`;
        if (sp) h += `<p><b>Spirit in ${sp.sign}</b> (house ${sp.house}): deliberate action and vocation draw on this place.</p>`;
        // annual profection (age counted to the present day)
        if (ctx.birthDate) {
          const age = Math.max(0, Math.floor((Date.now() - ctx.birthDate.getTime()) / (365.25 * 86400000)));
          const profHouse = (age % 12) + 1;
          const profSignIdx = (D.SIGNS.findIndex(s => s.name === E.SIGN_OF(chart.asc).name) + (age % 12)) % 12;
          const profSign = D.SIGNS[profSignIdx];
          const lord = profSign.rulerTrad;
          h += `<p><b>Annual profection (age ${age}):</b> the year activates house ${profHouse} (${profSign.name}); the lord of the year is <em>${lord}</em> — its natal condition colors the whole year.</p>`;
        }
      }
      h += `<h3>Defining Aspects</h3>`;
      for (const a of majors) h += `<p>${aspectText(a, style)}</p>`;
      if (patterns && patterns.length) {
        h += `<h3>Patterns</h3>`;
        for (const p of patterns) h += `<p><b>${p.name}</b> (${p.members.join(', ')}): ${p.detail}</p>`;
      }
    }

    if (kind === 'synastry') {
      const { personA, personB, crossAspects } = ctx;
      const la = personA ? personA.name : 'A', lb = personB ? personB.name : 'B';
      h += `<h3>${esc(la)} × ${esc(lb)}</h3>`;
      const sunA = chart.planets.find(p => p.id === 'Sun'), sunB = ctx.chartB.planets.find(p => p.id === 'Sun');
      const moonA = chart.planets.find(p => p.id === 'Moon'), moonB = ctx.chartB.planets.find(p => p.id === 'Moon');
      if (sunA && sunB) h += `<p>${esc(la)}’s Sun burns in <em>${sunA.sign}</em> (${signOf(sunA.sign).element}); ${esc(lb)}’s in <em>${sunB.sign}</em> (${signOf(sunB.sign).element}) — ${elementPairNote(signOf(sunA.sign).element, signOf(sunB.sign).element)}</p>`;
      if (moonA && moonB) h += `<p>Their Moons — ${moonA.sign} and ${moonB.sign} — ${elementPairNote(signOf(moonA.sign).element, signOf(moonB.sign).element, true)}</p>`;
      h += `<h3>Strongest Contacts</h3>`;
      const top = (crossAspects || []).slice(0, 8);
      if (!top.length) h += `<p class="muted">No close cross-aspects within orb.</p>`;
      for (const a of top) h += `<p>${aspectText(a, style, [la, lb])}</p>`;
      // B planets in A houses
      h += `<h3>${esc(lb)} in ${esc(la)}’s Houses</h3>`;
      for (const id of ['Sun', 'Moon', 'Venus', 'Mars', 'Saturn']) {
        const pb = ctx.chartB.planets.find(p => p.id === id);
        if (!pb) continue;
        const houseIn = houseOfLon(pb.lon, chart.cusps);
        const hh = D.HOUSES[houseIn - 1];
        h += `<p><b>${pb.glyph} ${id}</b> falls in ${esc(la)}’s ${ord(houseIn)} house — touching ${hh.topics.toLowerCase()}.</p>`;
      }
    }

    if (kind === 'transits') {
      const person = ctx.person;
      const la = person ? person.name : 'the native';
      h += `<h3>Transits for ${esc(la)}</h3>`;
      const top = (ctx.crossAspects || []).filter(a => a.major).slice(0, 8);
      if (!top.length) h += `<p class="muted">No close transit contacts within orb right now.</p>`;
      // group: which natal houses are the slow transits lighting up?
      const skyC = ctx.chartB;
      const slowIds = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
      const lit = [];
      for (const id of slowIds) {
        const t = skyC.planets.find(p => p.id === id);
        if (!t) continue;
        const houseIn = houseOfLon(t.lon, chart.cusps);
        lit.push(`${t.glyph} ${id} moves through the ${ord(houseIn)} house (${D.HOUSES[houseIn - 1].topics.toLowerCase()})`);
      }
      if (lit.length) h += `<p><b>The slow weather in the houses:</b> ${lit.join('; ')}.</p>`;
      h += `<h3>Closest Contacts</h3>`;
      for (const a of top) h += `<p>${aspectText(a, style, [la + '’s natal', 'transiting'])}</p>`;
      const retros = skyC.planets.filter(p => p.retro && !p.isLot && p.id !== 'Node' && p.id !== 'Lilith');
      if (retros.length) h += `<p><b>Retrograde now:</b> ${retros.map(p => p.glyph + ' ' + p.id).join(', ')}.</p>`;
    }

    if (kind === 'period') {
      const { events, from, to } = ctx;
      h += `<h3>${ctx.person ? esc(ctx.person.name) + '’s Weather' : 'Astrological Weather'} · ${fmtDateShort(from)} — ${fmtDateShort(to)}</h3>`;
      if (ctx.person) h += `<p class="small muted">Events marked <b>→ natal</b> are contacts to ${esc(ctx.person.name)}’s birth chart; the rest is the general sky.</p>`;
      if (!events || !events.length) { h += `<p class="muted">No major events found in this window.</p>`; }
      else {
        let lastMonth = '';
        for (const ev of events) {
          const m = ev.time.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
          if (m !== lastMonth) { h += `<h3>${m}</h3>`; lastMonth = m; }
          h += `<p><b>${fmtDateShort(ev.time)}</b> — ${eventGloss(ev, style)}</p>`;
        }
      }
    }

    h += `<p class="sig">Composed offline from the computed chart — for a woven narrative reading, use an AI reading below. For reflection and entertainment.</p>`;
    return h;
  }

  function houseOfLon(lon, cusps) {
    for (let i = 0; i < 12; i++) {
      const a = cusps[i], b = cusps[(i + 1) % 12];
      if (E.norm360(lon - a) < E.norm360(b - a)) return i + 1;
    }
    return 12;
  }

  function elementPairNote(e1, e2, moons) {
    const same = e1 === e2;
    const friendly = (e1 === 'Fire' && e2 === 'Air') || (e1 === 'Air' && e2 === 'Fire') || (e1 === 'Earth' && e2 === 'Water') || (e1 === 'Water' && e2 === 'Earth');
    if (same) return moons ? 'share an element: their instincts and needs speak the same language.' : 'the same element — an easy, familiar recognition between them.';
    if (friendly) return moons ? 'are in friendly elements: different textures, compatible needs.' : 'friendly elements — differences that feed rather than fight each other.';
    return moons ? 'are in uneasy elements: their default moods differ, and each must learn the other’s weather.' : 'elements at cross-purposes — attraction may be strong, but translation is required.';
  }

  function eventGloss(ev, style) {
    if (ev.kind === 'ingress') {
      const sign = ev.text.split(' ').pop();
      const s = signOf(sign);
      return `${ev.text}. ${ev.body}-matters take on ${s ? s.keywords.slice(0, 2).join(', ') : 'a new'} coloring.`;
    }
    if (ev.kind === 'station') {
      return `${ev.text}. ${ev.text.includes('retrograde') ? 'Its affairs turn inward for review.' : 'Forward motion resumes; delayed matters unstick.'}`;
    }
    if (ev.kind === 'aspect') {
      const t = D.ASPECT[ev.type];
      return `${ev.text} perfects — ${t ? t.blurb.split('.')[0].toLowerCase() + '.' : ''}`;
    }
    if (ev.kind === 'transit') {
      const t = D.ASPECT[ev.type];
      const feel = t.harmony === 'hard' ? 'a pressure point — friction that demands a response'
        : t.harmony === 'soft' ? 'a supportive current — help arriving through this channel'
        : 'a potent merging of agendas';
      return `<b>${ev.a} ${t.glyph} → natal ${ev.b}</b>: ${FUNCTION_PHRASE[ev.a] || ev.a} meets ${FUNCTION_PHRASE[ev.b] || ev.b} — ${feel}.`;
    }
    if (ev.kind === 'lunation') {
      const isNew = ev.text.startsWith('New');
      return `${ev.text}. ${isNew ? 'A seed moment: beginnings planted in this sign.' : ev.text.startsWith('Full') ? 'A culmination: what was seeded comes to light.' : 'A turning point in the lunar cycle.'}`;
    }
    return ev.text;
  }

  const fmtDateShort = d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  // ============================================================
  //  STRUCTURED TEXT for AI prompts
  // ============================================================
  function chartToText(chart, label) {
    const L = [];
    L.push(`${label || 'Chart'}: ${chart.date.toISOString().replace('T', ' ').slice(0, 16)} UTC at ${chart.lat.toFixed(2)}°, ${chart.lon.toFixed(2)}°`);
    L.push(`Sect: ${chart.sect} chart. Zodiac: ${chart.zodiac}. Houses: ${chart.houseSystem}.`);
    L.push(`Ascendant ${E.fmtLon(chart.asc)}; MC ${E.fmtLon(chart.mc)}. Moon phase ${moonPhaseName(chart.moonPhaseAngle)} (${(chart.moonIllum * 100).toFixed(0)}% lit).`);
    for (const p of chart.planets) {
      const dig = p.dignities && p.dignities.list.length ? ` [${p.dignities.list.join(', ')}]` : '';
      const bd = p.dignities && p.dignities.boundRuler ? ` (bounds of ${p.dignities.boundRuler})` : '';
      L.push(`${p.id}: ${E.fmtLon(p.lon)}, house ${p.house}${p.retro ? ', retrograde' : ''}${dig}${bd}`);
    }
    for (const l of chart.lots || []) L.push(`Lot of ${l.id}: ${E.fmtLon(l.lon)}, house ${l.house}`);
    return L.join('\n');
  }

  function aspectsToText(aspects, labels) {
    return (aspects || []).map(a =>
      `${labels ? labels[0] + "'s " : ''}${a.a} ${a.type} ${labels ? labels[1] + "'s " : ''}${a.b} (orb ${a.orb.toFixed(1)}°, ${a.applying ? 'applying' : 'separating'})`
    ).join('\n');
  }

  function eventsToText(events) {
    const list = (events || []).slice(0, 220);
    let out = list.map(ev => `${ev.time.toISOString().slice(0, 10)}: ${ev.text}`).join('\n');
    if ((events || []).length > list.length) out += `\n(…${events.length - list.length} further events omitted)`;
    return out;
  }

  g.Interpret = {
    planetInfoHTML, signInfoHTML, houseInfoHTML, aspectInfoHTML, angleInfoHTML, patternInfoHTML,
    overviewHTML, readingHTML, chartToText, aspectsToText, eventsToText,
    aspectText, moonPhaseName, sectRole, ord,
  };
})(typeof window !== 'undefined' ? window : globalThis);
