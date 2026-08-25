/* ============================================================
   WHEEL — SVG chart renderer
   Renders single wheels and biwheels (natal+transits / synastry).
   Pure renderer: emits data-sel attributes; app.js wires events.
   ============================================================ */
(function (g) {
  'use strict';
  const D = g.AstroData;
  const E = g.Engine;

  const CX = 500, CY = 500;
  const DEG = Math.PI / 180;

  // radii — single wheel
  const R = {
    signOut: 480, signIn: 421, tickIn: 407,
    planet: 366, planetDeg: 328, ptick: 407, ptickIn: 396,
    houseNum: 312, aspect: 296, hub: 52,
  };
  // radii — biwheel
  const RB = {
    signOut: 480, signIn: 421, tickIn: 407,
    outerPlanet: 377, outerDeg: 345, divider: 330,
    planet: 291, planetDeg: 253, houseNum: 237, aspect: 222, hub: 50,
  };

  function pt(lonToAngle, lon, r) {
    const a = lonToAngle(lon) * DEG;
    return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
  }
  const f1 = x => x.toFixed(1);

  // spread overlapping display angles while preserving order
  function declump(items, minSep) {
    if (items.length < 2) return;
    const n = items.length;
    const s = items.map((it, i) => ({ i, a: it.dispLon }));
    s.sort((x, y) => x.a - y.a);
    for (let iter = 0; iter < 80; iter++) {
      let moved = false;
      for (let k = 0; k < n; k++) {
        const cur = s[k], nxt = s[(k + 1) % n];
        let gap = nxt.a - cur.a; if (k === n - 1) gap += 360;
        if (gap < minSep - 1e-4) {
          const push = (minSep - gap) / 2;
          cur.a -= push; nxt.a += push;
          if (k === n - 1) { if (nxt.a >= 360) nxt.a -= 360; }
          moved = true;
        }
      }
      // renormalize ordering drift
      if (!moved) break;
    }
    for (const e of s) items[e.i].dispLon = E.norm360(e.a);
  }

  function moonPhasePath(cx, cy, r, phase) {
    // phase: 0 new, 90 first quarter, 180 full, 270 last quarter
    const waxing = phase < 180;
    const rx = Math.abs(Math.cos(phase * DEG)) * r;
    const gibbous = (phase > 90 && phase < 270);
    // lit side: waxing -> right, waning -> left (N hemisphere convention)
    const sweepOuter = waxing ? 1 : 0;
    const sweepInner = gibbous ? (waxing ? 1 : 0) : (waxing ? 0 : 1);
    return `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${sweepOuter} ${cx} ${cy + r} A ${rx} ${r} 0 0 ${sweepInner} ${cx} ${cy - r} Z`;
  }

  /**
   * model: { chart, outer:{chart,label}|null, aspects:[], selection, showHouses, showAngles, showLots }
   */
  function render(svg, model) {
    const c = model.chart;
    const bi = !!model.outer;
    const RR = bi ? RB : R;
    const asc = c.asc;
    const lonToAngle = lon => 180 + (lon - asc); // math-angle (CCW, y-up)
    const P = (lon, r) => pt(lonToAngle, lon, r);
    const out = [];

    out.push(`<defs>
      <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="3.2" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <radialGradient id="hubGrad" cx="42%" cy="38%">
        <stop offset="0%" stop-color="#1b2340"/><stop offset="100%" stop-color="#0b0f1e"/>
      </radialGradient>
      <radialGradient id="wheelBg" cx="50%" cy="50%">
        <stop offset="72%" stop-color="rgba(10,14,27,0.0)"/>
        <stop offset="100%" stop-color="rgba(24,32,60,0.35)"/>
      </radialGradient>
    </defs>`);

    // backdrop disc
    out.push(`<circle cx="${CX}" cy="${CY}" r="${RR.signOut}" fill="url(#wheelBg)" stroke="none"/>`);

    // ---- zodiac sign band ----
    for (let i = 0; i < 12; i++) {
      const s = D.SIGNS[i];
      const el = D.ELEMENTS[s.element];
      const a0 = i * 30, a1 = a0 + 30;
      const [x0o, y0o] = P(a0, RR.signOut), [x1o, y1o] = P(a1, RR.signOut);
      const [x0i, y0i] = P(a0, RR.signIn), [x1i, y1i] = P(a1, RR.signIn);
      out.push(`<path class="sign-seg" data-sel="sign:${s.name}" d="M ${f1(x0o)} ${f1(y0o)} A ${RR.signOut} ${RR.signOut} 0 0 0 ${f1(x1o)} ${f1(y1o)} L ${f1(x1i)} ${f1(y1i)} A ${RR.signIn} ${RR.signIn} 0 0 1 ${f1(x0i)} ${f1(y0i)} Z" fill="${el.soft}" stroke="rgba(148,163,204,0.22)" stroke-width="0.8"/>`);
      const [gx, gy] = P(a0 + 15, (RR.signOut + RR.signIn) / 2);
      out.push(`<text class="sign-glyph" data-sel="sign:${s.name}" x="${f1(gx)}" y="${f1(gy)}" font-size="30" fill="${el.color}" text-anchor="middle" dominant-baseline="central">${s.glyph}</text>`);
    }

    // ---- degree ticks ----
    const tickParts = [];
    for (let d = 0; d < 360; d++) {
      const len = d % 10 === 0 ? 13 : d % 5 === 0 ? 9 : 5;
      const [x1, y1] = P(d, RR.signIn);
      const [x2, y2] = P(d, RR.signIn - len);
      tickParts.push(`M ${f1(x1)} ${f1(y1)} L ${f1(x2)} ${f1(y2)}`);
    }
    out.push(`<path d="${tickParts.join(' ')}" stroke="rgba(148,163,204,0.35)" stroke-width="0.7" fill="none"/>`);

    // ---- circles ----
    out.push(`<circle cx="${CX}" cy="${CY}" r="${RR.signOut}" fill="none" stroke="rgba(232,201,106,0.35)" stroke-width="1.4"/>`);
    out.push(`<circle cx="${CX}" cy="${CY}" r="${RR.signIn}" fill="none" stroke="rgba(232,201,106,0.28)" stroke-width="1"/>`);
    out.push(`<circle cx="${CX}" cy="${CY}" r="${RR.aspect}" fill="rgba(8,11,22,0.45)" stroke="rgba(148,163,204,0.28)" stroke-width="1"/>`);
    if (bi) out.push(`<circle cx="${CX}" cy="${CY}" r="${RB.divider}" fill="none" stroke="rgba(148,163,204,0.22)" stroke-width="0.9" stroke-dasharray="3 4"/>`);

    // ---- houses ----
    if (model.showHouses !== false && c.cusps) {
      for (let i = 0; i < 12; i++) {
        const cusp = c.cusps[i];
        const isAxis = i === 0 || i === 3 || i === 6 || i === 9;
        const [x1, y1] = P(cusp, RR.aspect);
        const [x2, y2] = P(cusp, RR.signIn);
        out.push(`<line class="house-line" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${isAxis ? 'rgba(232,201,106,0.55)' : 'rgba(148,163,204,0.22)'}" stroke-width="${isAxis ? 2 : 0.9}"/>`);
        // house number at mid-house
        const next = c.cusps[(i + 1) % 12];
        const mid = cusp + E.norm360(next - cusp) / 2;
        const [nx, ny] = P(mid, RR.houseNum);
        out.push(`<text class="house-num" data-sel="house:${i + 1}" x="${f1(nx)}" y="${f1(ny)}" font-size="15" fill="rgba(139,147,167,0.75)" text-anchor="middle" dominant-baseline="central">${i + 1}</text>`);
      }
    }

    // ---- angle labels (Asc/MC/Dsc/IC) ----
    if (model.showAngles !== false) {
      const angles = [['Asc', c.asc], ['MC', c.mc], ['Dsc', c.dsc], ['IC', c.ic]];
      for (const [id, lon] of angles) {
        const [ax, ay] = P(lon, RR.signIn - 26);
        out.push(`<text class="angle-label" data-sel="angle:${id}" x="${f1(ax)}" y="${f1(ay)}" font-size="13" fill="${id === 'Asc' || id === 'MC' ? '#e8c96a' : 'rgba(154,161,179,0.8)'}" text-anchor="middle" dominant-baseline="central" style="cursor:pointer">${id.toUpperCase()}</text>`);
        // arrowhead on Asc
        if (id === 'Asc' || id === 'MC') {
          const [tx, ty] = P(lon, RR.signIn - 5);
          const aTan = (lonToAngle(lon) + 90) * DEG;
          const dx = Math.cos(aTan) * 5, dy = -Math.sin(aTan) * 5;
          const [bx, by] = P(lon, RR.signIn - 16);
          out.push(`<path d="M ${f1(tx)} ${f1(ty)} L ${f1(bx + dx)} ${f1(by + dy)} L ${f1(bx - dx)} ${f1(by - dy)} Z" fill="#e8c96a" opacity="0.9"/>`);
        }
      }
    }

    // ---- aspect chords ----
    const rA = RR.aspect;
    const orbMax = 9;
    for (const a of (model.aspects || [])) {
      const p1 = findPoint(model, a.a, a.crossA || (a.cross ? 'inner' : null));
      const p2 = findPoint(model, a.b, a.cross ? 'outer' : null);
      if (!p1 || !p2) continue;
      const [x1, y1] = P(p1.lon, rA), [x2, y2] = P(p2.lon, rA);
      const tight = Math.max(0, 1 - a.orb / orbMax);
      const w = 0.8 + tight * 2.4;
      const op = 0.28 + tight * 0.62;
      const dash = a.major ? '' : ` stroke-dasharray="5 4"`;
      const glow = a.exact ? ` filter="url(#glow)"` : '';
      out.push(`<line class="aspect-line" data-sel="aspect:${a.a}|${a.b}|${a.type}" data-a="${a.a}" data-b="${a.b}" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${a.color}" stroke-width="${f1(w)}" opacity="${op.toFixed(2)}"${dash}${glow}/>`);
      // wider invisible twin for easy hover/click
      out.push(`<line data-sel="aspect:${a.a}|${a.b}|${a.type}" data-a="${a.a}" data-b="${a.b}" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="rgba(0,0,0,0)" stroke-width="10" style="cursor:pointer"/>`);
    }

    // ---- planets ----
    drawPlanets(out, P, lonToAngle, planetList(c, model), RR.planet, RR.planetDeg, RR.signIn, RR.tickIn, bi ? 8.5 : 7, 'inner', bi ? 22 : 26);
    if (bi) {
      drawPlanets(out, P, lonToAngle, planetList(model.outer.chart, model), RB.outerPlanet, RB.outerDeg, RR.signIn, RR.tickIn, 7.5, 'outer', 22);
    }

    // ---- hub: moon phase + sect ----
    const hub = RR.hub;
    out.push(`<circle cx="${CX}" cy="${CY}" r="${hub + 12}" fill="url(#hubGrad)" stroke="rgba(232,201,106,0.3)" stroke-width="1"/>`);
    const mr = hub - 16;
    out.push(`<circle cx="${CX}" cy="${CY - 8}" r="${mr}" fill="#141a30" stroke="rgba(148,163,204,0.35)" stroke-width="0.8"/>`);
    const ph = c.moonPhaseAngle;
    if (ph > 2 && ph < 358) {
      out.push(`<path d="${moonPhasePath(CX, CY - 8, mr, ph)}" fill="#dfe4ee" opacity="0.92"/>`);
    } else {
      out.push(`<circle cx="${CX}" cy="${CY - 8}" r="${mr}" fill="#141a30"/>`);
    }
    const sectGlyph = c.isDay ? '☉' : '☽';
    out.push(`<text x="${CX}" y="${CY + hub - 9}" font-size="11" fill="#8b93a7" text-anchor="middle" font-family="Inter,sans-serif" letter-spacing="1">${sectGlyph} ${c.isDay ? 'DAY' : 'NIGHT'}</text>`);

    svg.innerHTML = out.join('');
  }

  function planetList(chart, model) {
    const list = chart.planets.slice();
    if (model.showLots !== false && chart.lots) list.push(...chart.lots);
    return list;
  }

  function findPoint(model, id, ring) {
    if (ring === 'outer' && model.outer) {
      return planetList(model.outer.chart, model).find(p => p.id === id);
    }
    return planetList(model.chart, model).find(p => p.id === id);
  }

  function drawPlanets(out, P, lonToAngle, planets, rGlyph, rDeg, rTickOut, rTickIn, minSep, ring, glyphSize) {
    const items = planets.map(p => ({ p, dispLon: p.lon }));
    declump(items, minSep);
    for (const it of items) {
      const p = it.p;
      // exact-degree tick
      const [tx1, ty1] = P(p.lon, rTickOut);
      const [tx2, ty2] = P(p.lon, rTickIn);
      out.push(`<line x1="${f1(tx1)}" y1="${f1(ty1)}" x2="${f1(tx2)}" y2="${f1(ty2)}" stroke="${p.color}" stroke-width="1.6" opacity="0.9"/>`);
      // connector from tick toward glyph if nudged
      const [gx, gy] = P(it.dispLon, rGlyph);
      const [cx2, cy2] = P(p.lon, rTickIn - 4);
      const [cx1, cy1] = P(it.dispLon, rGlyph + glyphSize * 0.72);
      out.push(`<line x1="${f1(cx1)}" y1="${f1(cy1)}" x2="${f1(cx2)}" y2="${f1(cy2)}" stroke="${p.color}" stroke-width="0.6" opacity="0.4"/>`);
      // glyph
      const retro = p.retro ? `<text x="${f1(gx + glyphSize * 0.62)}" y="${f1(gy - glyphSize * 0.5)}" font-size="${glyphSize * 0.42}" fill="#e05555" text-anchor="middle" font-weight="600">℞</text>` : '';
      const degTxt = `${Math.floor(p.degInSign)}°${String(Math.floor((p.degInSign % 1) * 60)).padStart(2, '0')}`;
      const [dx, dy] = P(it.dispLon, rDeg);
      out.push(`<g class="planet-g" data-sel="planet:${p.id}" data-ring="${ring}">` +
        `<circle cx="${f1(gx)}" cy="${f1(gy)}" r="${glyphSize * 0.78}" fill="rgba(8,11,22,0.01)"/>` +
        `<text class="pg" x="${f1(gx)}" y="${f1(gy)}" font-size="${glyphSize}" fill="${p.color}" text-anchor="middle" dominant-baseline="central">${p.glyph}</text>` +
        retro +
        `<text class="pdeg" x="${f1(dx)}" y="${f1(dy)}" font-size="${glyphSize * 0.42}" fill="rgba(200,206,222,0.75)" text-anchor="middle" dominant-baseline="central">${degTxt}</text>` +
        `</g>`);
    }
  }

  g.Wheel = { render };
})(typeof window !== 'undefined' ? window : globalThis);
