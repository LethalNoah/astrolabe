/* ============================================================
   PEOPLE — saved birth data (localStorage) + import/export
   ============================================================ */
(function (g) {
  'use strict';
  const KEY = 'astrolabe.people.v1';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }
  function save(list) { localStorage.setItem(KEY, JSON.stringify(list)); }

  function all() { return load(); }
  function get(id) { return load().find(p => p.id === id) || null; }

  function upsert(person) {
    const list = load();
    if (!person.id) person.id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const i = list.findIndex(p => p.id === person.id);
    if (i >= 0) list[i] = person; else list.push(person);
    save(list);
    return person;
  }

  function remove(id) {
    save(load().filter(p => p.id !== id));
  }

  // birth moment as UTC Date
  function birthUTC(person) {
    const hh = person.timeKnown ? person.hh : 12;
    const mm = person.timeKnown ? person.mm : 0;
    return g.Engine.zonedTimeToUTC(person.y, person.mo, person.d, hh, mm, person.tz || 'UTC');
  }

  function natalChart(person, opts) {
    return g.Engine.computeChart(birthUTC(person), Object.assign({
      lat: person.lat || 0, lon: person.lon || 0,
    }, opts));
  }

  function exportJSON() {
    return JSON.stringify({ app: 'astrolabe', kind: 'people', v: 1, people: load() }, null, 2);
  }

  function importJSON(text) {
    const data = JSON.parse(text);
    const incoming = Array.isArray(data) ? data : data.people;
    if (!Array.isArray(incoming)) throw new Error('Not a people export file');
    const list = load();
    let added = 0, updated = 0;
    for (const p of incoming) {
      if (!p.name || !p.y) continue;
      const i = list.findIndex(x => x.id === p.id);
      if (i >= 0) { list[i] = p; updated++; } else { list.push(p); added++; }
    }
    save(list);
    return { added, updated };
  }

  g.People = { all, get, upsert, remove, birthUTC, natalChart, exportJSON, importJSON };
})(typeof window !== 'undefined' ? window : globalThis);
