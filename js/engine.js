/* ============================================================
   ENGINE — astronomical + astrological calculation core
   Requires: astronomy-engine (global Astronomy), astro-data.js
   ============================================================ */
(function (g) {
  'use strict';
  const A = g.Astronomy;
  const D = g.AstroData;

  const DEG = Math.PI / 180;
  const norm360 = x => ((x % 360) + 360) % 360;
  // signed shortest difference a-b in (-180, 180]
  const angDiff = (a, b) => { let d = norm360(a - b); if (d > 180) d -= 360; return d; };
  // separation 0..180
  const sep = (a, b) => Math.abs(angDiff(a, b));

  // ---------- obliquity (mean, IAU 1980 — plenty for chart work) ----------
  function obliquity(date) {
    const T = (date.getTime() / 86400000 - 10957.5) / 36525; // centuries since J2000
    return 23.4392911111 - (46.8150 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600;
  }

  // ---------- ecliptic longitude helpers ----------
  function eclipticLon(body, date) {
    const v = A.GeoVector(A.Body[body], date, true);
    const e = A.Ecliptic(v);
    return { lon: norm360(e.elon), lat: e.elat };
  }

  // Mean lunar node (Meeus)
  function meanNodeLon(date) {
    const T = (date.getTime() / 86400000 - 10957.5) / 36525;
    return norm360(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + T * T * T / 467441);
  }

  // True (osculating) lunar node from instantaneous orbital plane
  function trueNodeLon(date) {
    const h = 1800000; // ±30 min
    const p = t => {
      const m = A.EclipticGeoMoon(new Date(t));
      const cl = Math.cos(m.lat * DEG);
      return [m.dist * cl * Math.cos(m.lon * DEG), m.dist * cl * Math.sin(m.lon * DEG), m.dist * Math.sin(m.lat * DEG)];
    };
    const r1 = p(date.getTime() - h), r2 = p(date.getTime() + h);
    const r = [(r1[0] + r2[0]) / 2, (r1[1] + r2[1]) / 2, (r1[2] + r2[2]) / 2];
    const v = [r2[0] - r1[0], r2[1] - r1[1], r2[2] - r1[2]];
    const n = [r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0]]; // orbit normal
    // ascending node direction = z-hat cross n
    const u = [-n[1], n[0], 0];
    return norm360(Math.atan2(u[1], u[0]) / DEG);
  }

  // Black Moon Lilith — mean lunar apogee (Meeus perigee + 180)
  function meanLilithLon(date) {
    const T = (date.getTime() / 86400000 - 10957.5) / 36525;
    const perigee = 83.3532465 + 4069.0137287 * T - 0.0103200 * T * T - T * T * T / 80053;
    return norm360(perigee + 180);
  }

  // ---------- sidereal ayanamsa (Lahiri, linear approx) ----------
  function ayanamsaLahiri(date) {
    const yrs = (date.getTime() / 86400000 - 10957.5) / 365.25;
    return 23.85675 + (50.2888 / 3600) * yrs;
  }

  // ---------- angles & houses ----------
  function ramcDeg(date, lonEast) {
    return norm360(A.SiderealTime(date) * 15 + lonEast);
  }

  function ascendant(ramc, latGeo, eps) {
    const ra = ramc * DEG, f = latGeo * DEG, e = eps * DEG;
    const asc = Math.atan2(Math.cos(ra), -(Math.sin(ra) * Math.cos(e) + Math.tan(f) * Math.sin(e)));
    return norm360(asc / DEG);
  }

  function midheaven(ramc, eps) {
    const ra = ramc * DEG, e = eps * DEG;
    let mc = Math.atan2(Math.sin(ra), Math.cos(ra) * Math.cos(e)) / DEG;
    return norm360(mc);
  }

  // ecliptic longitude -> RA/dec of the ecliptic point
  function lonToRaDec(lam, eps) {
    const l = lam * DEG, e = eps * DEG;
    const ra = Math.atan2(Math.sin(l) * Math.cos(e), Math.cos(l)) / DEG;
    const dec = Math.asin(Math.sin(e) * Math.sin(l)) / DEG;
    return { ra: norm360(ra), dec };
  }
  // RA (of a point ON the ecliptic) -> ecliptic longitude
  function raToLon(ra, eps) {
    const r = ra * DEG, e = eps * DEG;
    return norm360(Math.atan2(Math.sin(r), Math.cos(r) * Math.cos(e)) / DEG);
  }

  function housesWholeSign(asc) {
    const start = Math.floor(asc / 30) * 30;
    return Array.from({ length: 12 }, (_, i) => norm360(start + 30 * i));
  }
  function housesEqual(asc) {
    return Array.from({ length: 12 }, (_, i) => norm360(asc + 30 * i));
  }
  function housesPorphyry(asc, mc) {
    const c = new Array(12);
    c[0] = asc; c[9] = mc;
    const q4 = norm360(asc - mc);            // MC -> Asc arc (houses 10-12)
    c[10] = norm360(mc + q4 / 3);
    c[11] = norm360(mc + 2 * q4 / 3);
    const ic = norm360(mc + 180), dsc = norm360(asc + 180);
    const q1 = norm360(ic - asc);            // Asc -> IC arc (houses 1-3)
    c[1] = norm360(asc + q1 / 3);
    c[2] = norm360(asc + 2 * q1 / 3);
    c[3] = ic; c[6] = dsc;
    for (let i = 4; i <= 5; i++) c[i] = norm360(c[i + 6] - 180);
    for (let i = 7; i <= 8; i++) c[i] = norm360(c[i - 6] + 180);
    return c;
  }
  // Placidus via semi-arc iteration; returns null above polar circles
  function housesPlacidus(ramc, latGeo, eps, asc, mc) {
    const f = latGeo * DEG;
    function cuspFor(offset, frac, nocturnal) {
      let ra = norm360(ramc + offset);
      for (let i = 0; i < 30; i++) {
        const lam = raToLon(ra, eps);
        const dec = Math.asin(Math.sin(eps * DEG) * Math.sin(lam * DEG));
        const x = -Math.tan(f) * Math.tan(dec);
        if (x < -1 || x > 1) return null;    // circumpolar — Placidus undefined
        const sa = Math.acos(x) / DEG;       // semi-diurnal arc
        const target = nocturnal ? norm360(ramc + 180 - frac * (180 - sa))
                                 : norm360(ramc + frac * sa);
        if (sep(target, ra) < 1e-7) { ra = target; break; }
        ra = target;
      }
      return raToLon(ra, eps);
    }
    const c11 = cuspFor(30, 1 / 3, false);
    const c12 = cuspFor(60, 2 / 3, false);
    const c2 = cuspFor(120, 2 / 3, true);
    const c3 = cuspFor(150, 1 / 3, true);
    if ([c11, c12, c2, c3].some(v => v === null)) return null;
    const c = new Array(12);
    c[0] = asc; c[1] = c2; c[2] = c3;
    c[3] = norm360(mc + 180); c[4] = norm360(c11 + 180); c[5] = norm360(c12 + 180);
    c[6] = norm360(asc + 180); c[7] = norm360(c2 + 180); c[8] = norm360(c3 + 180);
    c[9] = mc; c[10] = c11; c[11] = c12;
    return c;
  }

  function houseOf(lon, cusps) {
    for (let i = 0; i < 12; i++) {
      const a = cusps[i], b = cusps[(i + 1) % 12];
      const span = norm360(b - a);
      if (norm360(lon - a) < span) return i + 1;
    }
    return 12;
  }

  // ---------- dignities ----------
  const SIGN_OF = lon => D.SIGNS[Math.floor(norm360(lon) / 30)];
  const OPPOSITE_SIGN = name => {
    const i = D.SIGNS.findIndex(s => s.name === name);
    return D.SIGNS[(i + 6) % 12].name;
  };

  function dignitiesFor(bodyId, lon, isDay) {
    const sign = SIGN_OF(lon), deg = norm360(lon) % 30;
    const out = { list: [], score: 0 };
    if (D.DOMICILE[sign.name] === bodyId) { out.list.push('Domicile'); out.score += 5; }
    if (D.DOMICILE[OPPOSITE_SIGN(sign.name)] === bodyId) { out.list.push('Detriment'); out.score -= 5; }
    const ex = D.EXALTATION[bodyId];
    if (ex) {
      if (ex.sign === sign.name) { out.list.push('Exaltation'); out.score += 4; }
      if (OPPOSITE_SIGN(ex.sign) === sign.name) { out.list.push('Fall'); out.score -= 4; }
    }
    const trip = D.TRIPLICITY[sign.element];
    if (trip && (isDay ? trip[0] : trip[1]) === bodyId) { out.list.push('Triplicity'); out.score += 3; }
    else if (trip && trip[2] === bodyId) { out.list.push('Triplicity (participating)'); out.score += 1; }
    const bounds = D.BOUNDS[sign.name];
    let boundRuler = null;
    for (const [end, ruler] of bounds) { if (deg < end) { boundRuler = ruler; break; } }
    if (boundRuler === bodyId) { out.list.push('Own bounds'); out.score += 2; }
    const decanRuler = D.CHALDEAN[Math.floor(norm360(lon) / 10) % 7];
    if (decanRuler === bodyId) { out.list.push('Own decan'); out.score += 1; }
    out.boundRuler = boundRuler;
    out.decanRuler = decanRuler;
    return out;
  }

  // ---------- sun altitude / sect ----------
  function sunAltitude(date, latGeo, lonEast) {
    const obs = new A.Observer(latGeo, lonEast, 0);
    const eq = A.Equator(A.Body.Sun, date, obs, true, true);
    const hor = A.Horizon(date, obs, eq.ra, eq.dec, '');
    return hor.altitude;
  }

  // ---------- main chart computation ----------
  const CALC_BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

  function bodyLon(id, date, nodeType) {
    if (id === 'Node') return nodeType === 'mean' ? { lon: meanNodeLon(date), lat: 0 } : { lon: trueNodeLon(date), lat: 0 };
    if (id === 'Lilith') return { lon: meanLilithLon(date), lat: 0 };
    if (id === 'Moon') { const m = A.EclipticGeoMoon(date); return { lon: norm360(m.lon), lat: m.lat }; }
    return eclipticLon(id, date);
  }

  /**
   * computeChart(date, opts) -> chart object
   * opts: { lat, lon, houseSystem: 'whole'|'equal'|'porphyry'|'placidus',
   *         bodies: [ids], nodeType: 'true'|'mean', zodiac: 'tropical'|'sidereal',
   *         includeAngles: bool, includeLots: bool }
   */
  function computeChart(date, opts) {
    const o = Object.assign({ lat: 0, lon: 0, houseSystem: 'whole', nodeType: 'true',
                              zodiac: 'tropical', includeAngles: true, includeLots: true }, opts);
    const bodies = o.bodies || CALC_BODIES.concat(['Node', 'Lilith']);
    const eps = obliquity(date);
    const ay = o.zodiac === 'sidereal' ? ayanamsaLahiri(date) : 0;
    const Z = lon => norm360(lon - ay);

    const ramc = ramcDeg(date, o.lon);
    const ascTrop = ascendant(ramc, o.lat, eps);
    const mcTrop = midheaven(ramc, eps);
    const asc = Z(ascTrop), mc = Z(mcTrop);

    const sunAlt = sunAltitude(date, o.lat, o.lon);
    const isDay = sunAlt > 0;

    // houses computed in tropical frame then shifted (whole-sign recomputed from shifted asc)
    let cusps, houseSystemUsed = o.houseSystem;
    if (o.houseSystem === 'placidus') {
      const pc = housesPlacidus(ramc, o.lat, eps, ascTrop, mcTrop);
      if (pc) cusps = pc.map(Z);
      else { cusps = housesPorphyry(ascTrop, mcTrop).map(Z); houseSystemUsed = 'porphyry (Placidus undefined at this latitude)'; }
    } else if (o.houseSystem === 'porphyry') cusps = housesPorphyry(ascTrop, mcTrop).map(Z);
    else if (o.houseSystem === 'equal') cusps = housesEqual(asc);
    else cusps = housesWholeSign(asc);

    // planets with speeds (central difference ±1h)
    const dtMs = 3600000;
    const dPast = new Date(date.getTime() - dtMs), dFut = new Date(date.getTime() + dtMs);
    const planets = bodies.map(id => {
      const now = bodyLon(id, date, o.nodeType);
      const p1 = bodyLon(id, dPast, o.nodeType).lon;
      const p2 = bodyLon(id, dFut, o.nodeType).lon;
      const speed = angDiff(p2, p1) / (2 * dtMs / 86400000); // deg/day
      const lonZ = Z(now.lon);
      const sign = SIGN_OF(lonZ);
      const meta = D.BODY[id] || {};
      return {
        id, glyph: meta.glyph, color: meta.color,
        lon: lonZ, lat: now.lat, speed,
        retro: speed < 0 && id !== 'Node',
        sign: sign.name, signGlyph: sign.glyph, element: sign.element,
        degInSign: lonZ % 30,
        house: houseOf(lonZ, cusps),
        dignities: dignitiesFor(id, lonZ, isDay),
      };
    });

    // lots
    const lots = [];
    if (o.includeLots) {
      const sun = planets.find(p => p.id === 'Sun'), moon = planets.find(p => p.id === 'Moon');
      if (sun && moon) {
        const fortune = isDay ? norm360(asc + moon.lon - sun.lon) : norm360(asc + sun.lon - moon.lon);
        const spirit = isDay ? norm360(asc + sun.lon - moon.lon) : norm360(asc + moon.lon - sun.lon);
        for (const [id, lon] of [['Fortune', fortune], ['Spirit', spirit]]) {
          const meta = D.LOTS.find(l => l.id === id);
          const sign = SIGN_OF(lon);
          lots.push({ id, glyph: meta.glyph, color: meta.color, lon, lat: 0, speed: 0, retro: false,
                      sign: sign.name, signGlyph: sign.glyph, element: sign.element,
                      degInSign: lon % 30, house: houseOf(lon, cusps), isLot: true });
        }
      }
    }

    const moonPhaseAngle = A.MoonPhase(date); // 0=new 90=first qtr 180=full 270=last
    const moonIllum = A.Illumination(A.Body.Moon, date).phase_fraction;

    return {
      date: new Date(date), lat: o.lat, lon: o.lon,
      zodiac: o.zodiac, ayanamsa: ay,
      eps, ramc, asc, mc, dsc: norm360(asc + 180), ic: norm360(mc + 180),
      isDay, sunAlt, sect: isDay ? 'day' : 'night',
      houseSystem: houseSystemUsed, cusps,
      planets, lots,
      moonPhaseAngle, moonIllum,
    };
  }

  // ---------- aspects ----------
  const DEFAULT_ORBS = { conjunction: 8, opposition: 8, trine: 7, square: 7, sextile: 5,
                         semisextile: 2.5, semisquare: 2.5, quintile: 2, sesquiquadrate: 2.5, quincunx: 3 };

  /**
   * findAspects(list, opts) — aspects within one set of points.
   * findAspects(listA, opts, listB) — cross-aspects between two sets (synastry/transits).
   */
  function findAspects(list, opts, listB) {
    const o = Object.assign({ orbScale: 1, includeMinor: false, includeLots: false }, opts);
    const pts = list.filter(p => o.includeLots || !p.isLot);
    const ptsB = listB ? listB.filter(p => o.includeLots || !p.isLot) : null;
    const results = [];
    const types = D.ASPECT_TYPES.filter(t => t.major || o.includeMinor);

    const pairs = [];
    if (ptsB) {
      for (const a of pts) for (const b of ptsB) pairs.push([a, b]);
    } else {
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++) pairs.push([pts[i], pts[j]]);
    }

    for (const [p1, p2] of pairs) {
      const s = sep(p1.lon, p2.lon);
      for (const t of types) {
        let orb = (DEFAULT_ORBS[t.id] || 3) * o.orbScale;
        if (t.major && (p1.id === 'Sun' || p1.id === 'Moon' || p2.id === 'Sun' || p2.id === 'Moon')) orb += 1.5;
        const off = Math.abs(s - t.angle);
        if (off <= orb) {
          // applying? project both forward 1 hour by speed
          const f1 = p1.lon + (p1.speed || 0) / 24, f2 = p2.lon + (p2.speed || 0) / 24;
          const offNext = Math.abs(sep(f1, f2) - t.angle);
          results.push({
            a: p1.id, b: p2.id, type: t.id, angle: t.angle, glyph: t.glyph,
            color: t.color, major: t.major, harmony: t.harmony,
            orb: off, exact: off < 0.5,
            applying: offNext < off - 1e-9,
            cross: !!ptsB,
          });
          break; // one aspect type max per pair
        }
      }
    }
    results.sort((x, y) => x.orb - y.orb);
    return results;
  }

  // ---------- aspect patterns ----------
  function findPatterns(planets, aspects) {
    const pat = [];
    const has = (a, b, type) => aspects.some(x => x.type === type &&
      ((x.a === a && x.b === b) || (x.a === b && x.b === a)));
    const ids = planets.filter(p => !p.isLot && p.id !== 'Lilith').map(p => p.id);

    // Stellium: 3+ in same sign
    const bySign = {};
    for (const p of planets.filter(p => !p.isLot && p.id !== 'Node' && p.id !== 'Lilith'))
      (bySign[p.sign] = bySign[p.sign] || []).push(p.id);
    for (const [sign, members] of Object.entries(bySign))
      if (members.length >= 3) pat.push({ name: 'Stellium', members, detail: `${members.length} bodies gathered in ${sign} — a concentrated emphasis that dominates the chart.` });

    // Grand Trine
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) for (let k = j + 1; k < ids.length; k++)
      if (has(ids[i], ids[j], 'trine') && has(ids[j], ids[k], 'trine') && has(ids[i], ids[k], 'trine'))
        pat.push({ name: 'Grand Trine', members: [ids[i], ids[j], ids[k]], detail: 'A closed triangle of flowing trines — a self-contained circuit of talent and ease.' });

    // T-Square & Grand Cross
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      if (!has(ids[i], ids[j], 'opposition')) continue;
      for (const k of ids) {
        if (k === ids[i] || k === ids[j]) continue;
        if (has(ids[i], k, 'square') && has(ids[j], k, 'square')) {
          let isCross = false;
          for (const m of ids) {
            if ([ids[i], ids[j], k].includes(m)) continue;
            if (has(k, m, 'opposition') && has(ids[i], m, 'square') && has(ids[j], m, 'square')) {
              pat.push({ name: 'Grand Cross', members: [ids[i], ids[j], k, m], detail: 'Four bodies locked in mutual squares and oppositions — relentless dynamic tension, enormous drive.' });
              isCross = true; break;
            }
          }
          if (!isCross) pat.push({ name: 'T-Square', members: [ids[i], ids[j], k], detail: `An opposition funneled through ${k} at the apex — the pressure point where the tension demands action.` });
        }
      }
    }

    // Yod
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      if (!has(ids[i], ids[j], 'sextile')) continue;
      for (const k of ids) {
        if (k === ids[i] || k === ids[j]) continue;
        if (has(ids[i], k, 'quincunx') && has(ids[j], k, 'quincunx'))
          pat.push({ name: 'Yod', members: [ids[i], ids[j], k], detail: `The “finger of fate” pointing at ${k} — a strange, insistent calling that requires adjustment.` });
      }
    }

    // dedupe by name+sorted members
    const seen = new Set();
    return pat.filter(p => {
      const key = p.name + [...p.members].sort().join(',');
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }

  // ---------- time zone helpers ----------
  function zoneOffsetMinutes(date, timeZone) {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
    const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day,
                           parts.hour === '24' ? 0 : +parts.hour, +parts.minute, +parts.second);
    return (asUTC - date.getTime()) / 60000;
  }

  // wall-clock time in an IANA zone -> UTC Date
  function zonedTimeToUTC(y, mo, d, hh, mm, timeZone) {
    let guess = Date.UTC(y, mo - 1, d, hh, mm, 0);
    for (let i = 0; i < 3; i++) {
      const off = zoneOffsetMinutes(new Date(guess), timeZone);
      const next = Date.UTC(y, mo - 1, d, hh, mm, 0) - off * 60000;
      if (next === guess) break;
      guess = next;
    }
    return new Date(guess);
  }

  // ---------- event scanning (for period readings / timeline) ----------
  const SCAN_BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

  function refine(fn, t1, t2, iterations) {
    // bisection on sign change of fn (fn returns signed value)
    let a = t1, b = t2, fa = fn(a);
    for (let i = 0; i < (iterations || 25); i++) {
      const m = (a + b) / 2, fm = fn(m);
      if (fa * fm <= 0) b = m; else { a = m; fa = fm; }
    }
    return new Date((a + b) / 2);
  }

  /**
   * scanEvents(start, end, opts) -> [{time, kind, text, ...}]
   * kinds: ingress, station, aspect, lunation, transit
   * opts: { bodies, includeMoonAspects:false, natalPoints: [{id, lon}], onProgress }
   * natalPoints: fixed chart points — emits transiting-planet aspects to them
   */
  function scanEvents(start, end, opts) {
    const o = Object.assign({ bodies: SCAN_BODIES, includeMoonAspects: false, natalPoints: [] }, opts);
    const events = [];
    const t0 = start.getTime(), t1 = end.getTime();
    const stepMs = 6 * 3600000;
    const bodies = o.bodies.filter(b => SCAN_BODIES.includes(b));
    const lonAt = (id, t) => bodyLon(id, new Date(t), 'true').lon;

    // state samples
    let prev = {};
    for (const id of bodies) {
      const l = lonAt(id, t0);
      const l2 = lonAt(id, t0 + 60000);
      prev[id] = { lon: l, sign: Math.floor(l / 30), speed: angDiff(l2, l) };
    }
    const aspectTypes = D.ASPECT_TYPES.filter(t => t.major);
    const pairKey = (a, b) => a < b ? a + '|' + b : b + '|' + a;
    let prevOff = {}; // pairKey|angle -> signed offset

    for (let t = t0 + stepMs; t <= t1 + stepMs; t += stepMs) {
      const cur = {};
      for (const id of bodies) {
        const l = lonAt(id, t);
        const l2 = lonAt(id, t + 60000);
        cur[id] = { lon: l, sign: Math.floor(l / 30), speed: angDiff(l2, l) };

        // ingress
        if (cur[id].sign !== prev[id].sign && sep(l, prev[id].lon) < 90) {
          const targetSign = cur[id].sign;
          const exact = refine(x => {
            const lx = lonAt(id, x);
            return angDiff(lx, targetSign * 30);
          }, t - stepMs, t);
          if (exact >= start && exact <= end) {
            const s = D.SIGNS[targetSign].name;
            const rx = cur[id].speed < 0;
            events.push({ time: exact, kind: 'ingress', body: id,
              text: `${id} ${rx ? 're-enters (retrograde)' : 'enters'} ${s}` });
          }
        }
        // station
        if (id !== 'Sun' && id !== 'Moon' && Math.sign(cur[id].speed) !== Math.sign(prev[id].speed)) {
          const exact = refine(x => {
            const la = lonAt(id, x - 1800000), lb = lonAt(id, x + 1800000);
            return angDiff(lb, la);
          }, t - stepMs, t);
          if (exact >= start && exact <= end) {
            const dir = cur[id].speed < 0 ? 'retrograde' : 'direct';
            events.push({ time: exact, kind: 'station', body: id, text: `${id} stations ${dir}` });
          }
        }
      }
      // transits to fixed natal points (Moon excluded — too fast to be forecast weather)
      for (const id of bodies) {
        if (id === 'Moon') continue;
        for (const np of o.natalPoints) {
          const sNow = sep(cur[id].lon, np.lon);
          for (const at of aspectTypes) {
            const key = 'T|' + id + '|' + np.id + '|' + at.angle;
            const offNow = sNow - at.angle;
            const offPrev = prevOff[key];
            if (offPrev !== undefined && Math.sign(offNow) !== Math.sign(offPrev) && Math.abs(offNow) < 15 && Math.abs(offPrev) < 15) {
              const exact = refine(x => sep(lonAt(id, x), np.lon) - at.angle, t - stepMs, t);
              if (exact >= start && exact <= end)
                events.push({ time: exact, kind: 'transit', a: id, b: np.id, type: at.id,
                  text: `${id} ${at.name.toLowerCase()} natal ${np.id}` });
            }
            prevOff[key] = offNow;
          }
        }
      }
      // aspects (perfections)
      for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j];
        if (!o.includeMoonAspects && (a === 'Moon' || b === 'Moon')) continue;
        const sNow = sep(cur[a].lon, cur[b].lon);
        for (const at of aspectTypes) {
          const key = pairKey(a, b) + '|' + at.angle;
          const offNow = sNow - at.angle;
          const offPrev = prevOff[key];
          if (offPrev !== undefined && Math.sign(offNow) !== Math.sign(offPrev) && Math.abs(offNow) < 15 && Math.abs(offPrev) < 15) {
            const exact = refine(x => sep(lonAt(a, x), lonAt(b, x)) - at.angle, t - stepMs, t);
            if (exact >= start && exact <= end)
              events.push({ time: exact, kind: 'aspect', a, b, type: at.id,
                text: `${a} ${at.name.toLowerCase()} ${b}` });
          }
          prevOff[key] = offNow;
        }
      }
      prev = cur;
      if (o.onProgress) o.onProgress((t - t0) / (t1 - t0));
    }

    // lunations via astronomy-engine's quarter search
    let q = A.SearchMoonQuarter(start);
    const qNames = ['New Moon', 'First Quarter', 'Full Moon', 'Last Quarter'];
    while (q && q.time.date <= end) {
      const lon = bodyLon('Moon', q.time.date, 'true').lon;
      const s = SIGN_OF(lon);
      events.push({ time: q.time.date, kind: 'lunation', quarter: q.quarter,
        text: `${qNames[q.quarter]} in ${s.name} (${fmtDeg(lon % 30)} ${s.glyph})` });
      q = A.NextMoonQuarter(q);
    }

    events.sort((x, y) => x.time - y.time);
    return events;
  }

  // ---------- formatting ----------
  function fmtDeg(x) {
    const d = Math.floor(x), m = Math.floor((x - d) * 60);
    return `${d}°${String(m).padStart(2, '0')}′`;
  }
  function fmtLon(lon) {
    const s = SIGN_OF(lon);
    return `${fmtDeg(norm360(lon) % 30)} ${s.glyph} ${s.name}`;
  }

  g.Engine = { computeChart, findAspects, findPatterns, scanEvents,
               zonedTimeToUTC, zoneOffsetMinutes,
               norm360, angDiff, sep, fmtDeg, fmtLon, SIGN_OF, OPPOSITE_SIGN,
               obliquity, ayanamsaLahiri, DEFAULT_ORBS, CALC_BODIES };
})(typeof window !== 'undefined' ? window : globalThis);
