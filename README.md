# ✦ Astrolabe — Living Sky Chart

A self-contained astrology studio that runs entirely in your browser: a real-time geocentric chart wheel you can scrub through time, with a full Hellenistic layer (sect, dignities, lots, whole-sign houses) alongside modern technique, saved birth charts, synastry, transits, and readings — composed offline or woven by Claude.

**No install, no account, no server.** Double-click `index.html` and you're looking at the sky.

---

## Running it

- **Easiest:** double-click `index.html` (everything is bundled locally; internet is only needed for city search, the Google fonts, and AI readings).
- **Dev server (optional):**

```bash
node tools/dev-server.js
```

then open http://localhost:8321.

## The wheel

- **Real geocentric positions** from the [astronomy-engine](https://github.com/cosinekitty/astronomy) ephemeris (accurate to ~1 arcminute for planets over ±1000 years). Nothing is faked or approximated from tables.
- Zodiac ring color-coded by **element** (fire / earth / air / water); aspect lines color-coded by **type** (conjunction gold, trine blue, square/opposition red, sextile teal, minors dashed), with line weight showing orb tightness and a glow on nearly-exact aspects.
- Ascendant on the left, houses drawn from your chosen system, moon phase + sect in the hub, retrograde ℞ flags, degree ticks, collision-avoided glyphs.
- **Hover** anything to preview it; **click** planets, signs, house numbers, aspect lines, or angles to open a full explanation in the Explore tab.
- Detected **aspect patterns** (T-squares, grand trines, yods, stelliums, grand crosses) appear as chips at bottom-left.
- **⬇ PNG** saves the current wheel as an image.

## The time machine

- The chart ticks live in real time. Scrub the bar (±12 h to ±50 y ranges), step by hour/day/month/year, type an exact date & time in any timezone, or play forward/backward at speeds from real-time to a year per second.
- Keyboard: **Space** play/pause · **← / →** step an hour (**Shift** = a day) · **N** jump to now.

## Modes

| Mode | What it shows |
|---|---|
| **Sky** | The sky right now (or any moment) at your location — a mundane/world chart |
| **Natal** | A saved person's birth chart; the time controls let you explore around the birth moment (rectification) |
| **Transits** | Biwheel: the moving sky around a natal chart, with transit-to-natal aspects |
| **Synastry** | Biwheel: two people's charts and the cross-aspects between them |

## Hellenistic layer

Whole-sign houses (default), day/night **sect** with benefic/malefic roles, essential dignities — domicile, exaltation, detriment, fall, **Dorothean triplicities**, **Egyptian bounds**, Chaldean **decans** — traditional rulerships, the **Lots of Fortune and Spirit**, sign-configuration (aversion) notes, applying vs. separating aspects, and **annual profections** in natal readings. Modern layer: outer planets, psychological language, modern rulers, quintiles and other minors. Settings let you choose house system (Whole Sign / Equal / Porphyry / Placidus), tropical or sidereal (Lahiri) zodiac, true or mean node, orb width, and which bodies appear (Classic 7 ↔ full set with Node & Lilith).

## People & readings

- **People tab:** save birthdays under names (date, time, timezone, birthplace with built-in city search). Stored only in your browser's localStorage; **Export/Import** backs them up as JSON. Unknown birth times are handled (noon chart, houses softened).
- **Reading tab:** choose a voice — **Hellenistic**, **Modern**, or **Blended** — and one of five distinct reading types (independent of what the wheel is showing):
  - **This sky** — a world/mundane reading of the moment on the wheel,
  - **Birth chart** — a natal reading, *always cast from the person's saved birth data* no matter where the time controls sit (dignities, patterns, the profected year),
  - **Influences** — the sky at the wheel's current moment applied to a person's natal chart (transit contacts, slow planets moving through their houses),
  - **Period** — a forecast across any window up to a year, for **the world** (ingresses, stations, exact aspects, lunations) or **for a person** (adds every transiting aspect that perfects against their natal chart in the window),
  - **Synastry** — two people compared.
- **Compose** builds a reading instantly and offline from the computed chart.
- **✦ AI reading** sends the chart data to Anthropic's Claude and streams back a woven narrative in your chosen voice. Add your API key in ⚙ Settings (get one at console.anthropic.com). The key lives only in your browser and is sent only to Anthropic. Model choices: Opus 5 (richest), Sonnet 5, Haiku 4.5.

## Privacy & publishing to GitHub

The project folder contains **only code**. Everything personal lives in your browser's localStorage, never in files:

- saved people (`astrolabe.people.v1`)
- your Anthropic API key & model choice (`astrolabe.api.v1`)
- chart location and settings

So pushing this folder to GitHub publishes none of it. Two habits keep it that way: don't save a **People → Export** JSON backup inside the project folder (the included `.gitignore` catches the default filename anyway), and never paste your API key into any file. The app never asks for browser location permission — location is typed or searched by city name only.

## Files

```
index.html            the app shell
css/styles.css        celestial theme
js/astro-data.js      signs, bodies, dignities, aspects, houses, lots
js/engine.js          ephemeris wrapper, houses/angles, aspects, patterns, event scanner
js/wheel.js           SVG wheel renderer (single + biwheel)
js/interpret.js       info panels + offline composed readings
js/people.js          saved people (localStorage)
js/api.js             Claude API readings (official SDK, browser build)
js/app.js             state, time machine, panels, wiring
js/vendor/            astronomy-engine + @anthropic-ai/sdk bundles
tools/dev-server.js   optional static server
```

Charts and readings are for reflection and entertainment.
