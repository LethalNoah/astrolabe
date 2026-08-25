/* ============================================================
   API — AI-woven readings via the Anthropic SDK (browser build)
   The offline composed readings work without this; an API key
   (stored locally, sent only to Anthropic) unlocks narrative
   readings. Uses the official @anthropic-ai/sdk bundled in
   js/vendor/anthropic.browser.js (global AnthropicSDK).
   ============================================================ */
(function (g) {
  'use strict';

  const SKEY = 'astrolabe.api.v1';

  function getSettings() {
    try { return Object.assign({ apiKey: '', model: 'claude-opus-5' }, JSON.parse(localStorage.getItem(SKEY) || '{}')); }
    catch { return { apiKey: '', model: 'claude-opus-5' }; }
  }
  function setSettings(s) {
    localStorage.setItem(SKEY, JSON.stringify(Object.assign(getSettings(), s)));
  }

  const MODELS = [
    { id: 'claude-opus-5', label: 'Claude Opus 5 — richest readings' },
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 — fast & capable' },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — quickest, cheapest' },
  ];

  // ---------- prompt construction ----------
  const STYLE_VOICE = {
    hellenistic: `Work as a Hellenistic astrologer in the tradition of Vettius Valens and Dorotheus: whole-sign houses, the seven traditional planets as primary agents, sect (day/night) as a first sorting principle, essential dignity as planetary condition, benefics and malefics, the Lots of Fortune and Spirit, and concrete life-topics rather than psychology. You may note where modern outer planets stand, but treat them as background weather. Speak of what planets *do* and *signify*, not what someone "is like inside."`,
    modern: `Work as a skilled modern psychological astrologer: planets as inner drives and archetypes, signs as styles of expression, houses as arenas of life, aspects as inner dialogues. Use the full ten planets plus the nodes. Growth-oriented, non-deterministic language — the chart describes weather and terrain, not fate.`,
    blended: `Blend Hellenistic technique with modern insight: use sect, dignity, whole-sign topics and the lots to judge planetary *condition and concrete topic*, then translate what that means psychologically in modern language. Let the two traditions check each other, and say when they disagree.`,
  };

  function buildSystem(style) {
    return `You are the resident astrologer inside "Astrolabe", a chart application. The user sees a chart wheel; you receive the exact computed chart data.

${STYLE_VOICE[style] || STYLE_VOICE.blended}

Rules:
- Ground EVERY claim in the data provided. Cite the placement you are reading (e.g. "with Mars in Cancer in the 10th…"). Never invent positions, aspects, or dates not present in the data.
- Weigh what is genuinely loudest in this chart (angular planets, tight aspects, dignified/debilitated planets, sect) rather than walking mechanically through every placement.
- Be specific and vivid, never generic horoscope-column filler. It should feel like this exact chart, not any chart.
- Warm, literate, direct voice. No bullet-point spam; write flowing prose in short sections.
- Format in Markdown: "## " section headings, occasional **bold** for placements. 400-800 words unless asked otherwise.
- Astrology here is a reflective, symbolic language. Do not make medical, legal, or financial predictions; never predict death, disaster, or diagnosis. If the data invites that, reframe toward reflection and agency.`;
  }

  function buildPrompt(kind, ctx) {
    const I = g.Interpret;
    let p = '';
    if (kind === 'natal') {
      p = `Write a natal chart reading${ctx.person ? ` for ${ctx.person.name}` : ''}.${ctx.person && !ctx.person.timeKnown ? ' NOTE: birth time is unknown (chart cast for noon) — do not lean on the Ascendant or houses; say so briefly.' : ''}\n\n${I.chartToText(ctx.chart, 'Natal chart')}\n\nAspects:\n${I.aspectsToText(ctx.aspects)}${ctx.patterns && ctx.patterns.length ? `\n\nPatterns: ${ctx.patterns.map(x => `${x.name} (${x.members.join(', ')})`).join('; ')}` : ''}`;
    } else if (kind === 'sky') {
      p = `Write a reading of the sky at this moment — a "world weather" reading of the current astrology, addressed to anyone alive under this sky. Emphasize the Moon's condition, the day's applying aspects, anything stationing or newly retrograde, and the slow outer-planet weather.\n\n${I.chartToText(ctx.chart, 'The sky now')}\n\nAspects:\n${I.aspectsToText(ctx.aspects)}`;
    } else if (kind === 'synastry') {
      const la = ctx.personA ? ctx.personA.name : 'Person A', lb = ctx.personB ? ctx.personB.name : 'Person B';
      p = `Write a synastry (relationship) reading for ${la} and ${lb}. Consider each person's own chart briefly, then the contacts between them. Be honest about frictions as well as gifts; frictions are workable material, not verdicts.\n\n${I.chartToText(ctx.chart, `${la}'s chart`)}\n\n${I.chartToText(ctx.chartB, `${lb}'s chart`)}\n\nCross-aspects (${la}'s planet → ${lb}'s planet):\n${I.aspectsToText(ctx.crossAspects, [la, lb])}`;
    } else if (kind === 'transits') {
      const la = ctx.person ? ctx.person.name : 'the native';
      p = `Write a transit reading for ${la}: how the current sky is activating the natal chart. Focus on the tightest transit-to-natal contacts, slow transits (Jupiter outward), and what houses of the natal chart are being lit up.\n\n${I.chartToText(ctx.chart, `${la}'s natal chart`)}\n\n${I.chartToText(ctx.chartB, 'The sky now (transits)')}\n\nContacts (natal planet first, transiting planet second):\n${I.aspectsToText(ctx.crossAspects, ['natal', 'transiting'])}`;
    } else if (kind === 'period') {
      if (ctx.person) {
        p = `Write a personal astrological forecast for ${ctx.person.name} covering ${ctx.from.toDateString()} through ${ctx.to.toDateString()}. The events marked "natal" are transiting planets perfecting aspects to ${ctx.person.name}'s birth chart — these are the spine of the forecast; read them against the natal placements they touch (house, dignity, natal aspects). Use the general sky events (ingresses, stations, lunations) as backdrop. Weave everything into a narrative arc — what opens, peaks, and closes — citing dates for the turning points, rather than a date-by-date list.\n\n${I.chartToText(ctx.chart, `${ctx.person.name}'s natal chart`)}\n\nEvents in this window:\n${I.eventsToText(ctx.events)}`;
      } else {
        p = `Write an "astrological weather forecast" for the period ${ctx.from.toDateString()} through ${ctx.to.toDateString()}. Weave the listed events into a narrative arc of the period — what themes open, peak, and close — rather than a date-by-date list. Mention specific dates for the most important moments.\n\nEvents in this window:\n${I.eventsToText(ctx.events)}\n\nSky at the period's start:\n${I.chartToText(ctx.chart, 'Start of period')}`;
      }
    }
    return p;
  }

  // ---------- markdown-lite renderer for the reading pane ----------
  function mdToHtml(md) {
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines = esc(md).split('\n');
    let html = '', inList = false;
    for (const line of lines) {
      const t = line.trim();
      const fmt = s => s
        .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
      if (t.startsWith('### ')) { if (inList) { html += '</ul>'; inList = false; } html += `<h3>${fmt(t.slice(4))}</h3>`; }
      else if (t.startsWith('## ')) { if (inList) { html += '</ul>'; inList = false; } html += `<h3>${fmt(t.slice(3))}</h3>`; }
      else if (t.startsWith('# ')) { if (inList) { html += '</ul>'; inList = false; } html += `<h3>${fmt(t.slice(2))}</h3>`; }
      else if (t.startsWith('- ') || t.startsWith('* ')) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${fmt(t.slice(2))}</li>`; }
      else if (t === '') { if (inList) { html += '</ul>'; inList = false; } }
      else { if (inList) { html += '</ul>'; inList = false; } html += `<p>${fmt(t)}</p>`; }
    }
    if (inList) html += '</ul>';
    return html;
  }

  // ---------- streaming reading ----------
  /**
   * streamReading({kind, style, ctx, onDelta(fullText), onDone(fullText), onError(msg)})
   */
  async function streamReading(opts) {
    const s = getSettings();
    if (!s.apiKey) { opts.onError('No API key set. Add one in Settings → AI readings.'); return; }
    if (typeof g.AnthropicSDK === 'undefined') { opts.onError('AI module not loaded.'); return; }

    const client = new g.AnthropicSDK({ apiKey: s.apiKey, dangerouslyAllowBrowser: true });
    const req = {
      model: s.model,
      max_tokens: 16000,
      system: buildSystem(opts.style),
      messages: [{ role: 'user', content: buildPrompt(opts.kind, opts.ctx) }],
    };

    let full = '';
    try {
      let stream;
      if (s.model.startsWith('claude-opus-5') || s.model.startsWith('claude-fable')) {
        // server-side refusal fallbacks (beta) — reroutes a safety decline instead of dying
        stream = client.beta.messages.stream(Object.assign({}, req, {
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        }));
      } else {
        stream = client.messages.stream(req);
      }
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          full += event.delta.text;
          opts.onDelta(full);
        }
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === 'refusal') {
        opts.onError('The model declined this request' + (final.stop_details && final.stop_details.explanation ? ': ' + final.stop_details.explanation : '.'));
        return;
      }
      opts.onDone(full);
    } catch (err) {
      const A = g.AnthropicSDK;
      let msg = 'Reading failed: ' + (err && err.message ? err.message : err);
      if (A && err instanceof A.AuthenticationError) msg = 'Invalid API key — check it in Settings.';
      else if (A && err instanceof A.RateLimitError) msg = 'Rate limited by the API — wait a moment and try again.';
      else if (A && err instanceof A.APIConnectionError) msg = 'Could not reach the Anthropic API — check your internet connection.';
      opts.onError(msg);
    }
  }

  g.Api = { getSettings, setSettings, MODELS, streamReading, mdToHtml };
})(typeof window !== 'undefined' ? window : globalThis);
