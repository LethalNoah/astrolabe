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

  const PROVIDERS = {
    anthropic: {
      label: 'Claude (Anthropic)', short: 'Anthropic',
      keyHint: 'sk-ant-… from console.anthropic.com',
      models: [
        { id: 'claude-opus-5', label: 'Claude Opus 5 — richest readings' },
        { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 — fast & capable' },
        { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — quickest, cheapest' },
      ],
    },
    openai: {
      label: 'ChatGPT (OpenAI)', short: 'OpenAI',
      keyHint: 'sk-… from platform.openai.com',
      models: [
        { id: 'gpt-5.1', label: 'GPT-5.1' },
        { id: 'gpt-5', label: 'GPT-5' },
        { id: 'gpt-4.1', label: 'GPT-4.1' },
      ],
    },
    gemini: {
      label: 'Gemini (Google)', short: 'Google',
      keyHint: 'AIza… from aistudio.google.com',
      models: [
        { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
        { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      ],
    },
  };
  const DEFAULT_MODELS = { anthropic: 'claude-opus-5', openai: 'gpt-5.1', gemini: 'gemini-2.5-pro' };

  function getSettings() {
    let s;
    try { s = JSON.parse(localStorage.getItem(SKEY) || '{}'); } catch { s = {}; }
    const out = {
      provider: PROVIDERS[s.provider] ? s.provider : 'anthropic',
      keys: Object.assign({ anthropic: '', openai: '', gemini: '' }, s.keys),
      models: Object.assign({}, DEFAULT_MODELS, s.models),
    };
    // migrate the old single-provider shape {apiKey, model}
    if (s.apiKey && !out.keys.anthropic) out.keys.anthropic = s.apiKey;
    if (s.model && (!s.models || !s.models.anthropic)) out.models.anthropic = s.model;
    return out;
  }
  function save(s) { localStorage.setItem(SKEY, JSON.stringify(s)); }
  function setProvider(p) { const s = getSettings(); if (PROVIDERS[p]) { s.provider = p; save(s); } }
  function setKey(provider, key) { const s = getSettings(); s.keys[provider] = key; save(s); }
  function setModel(provider, model) { const s = getSettings(); if (model) { s.models[provider] = model; save(s); } }
  function hasKey() { const s = getSettings(); return !!s.keys[s.provider]; }
  function currentModel() { const s = getSettings(); return s.models[s.provider]; }
  function providerLabel() { const s = getSettings(); return PROVIDERS[s.provider].label; }

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

  // people saved without a birth time: the chart is a noon stand-in
  const tkNote = person => person && person.timeKnown === false
    ? `\nNOTE: ${person.name}'s birth time is unknown — their chart is cast for noon. Do not use the Ascendant, houses, sect, or lots for them; treat the Moon's degree as approximate (it may even change sign across the day) and briefly say so.`
    : '';

  function buildPrompt(kind, ctx) {
    const I = g.Interpret;
    let p = '';
    if (kind === 'natal') {
      p = `Write a natal chart reading${ctx.person ? ` for ${ctx.person.name}` : ''}.${tkNote(ctx.person)}\n\n${I.chartToText(ctx.chart, 'Natal chart')}\n\nAspects:\n${I.aspectsToText(ctx.aspects)}${ctx.patterns && ctx.patterns.length ? `\n\nPatterns: ${ctx.patterns.map(x => `${x.name} (${x.members.join(', ')})`).join('; ')}` : ''}`;
    } else if (kind === 'sky') {
      p = `Write a reading of the sky at this moment — a "world weather" reading of the current astrology, addressed to anyone alive under this sky. Emphasize the Moon's condition, the day's applying aspects, anything stationing or newly retrograde, and the slow outer-planet weather.\n\n${I.chartToText(ctx.chart, 'The sky now')}\n\nAspects:\n${I.aspectsToText(ctx.aspects)}`;
    } else if (kind === 'synastry') {
      const la = ctx.personA ? ctx.personA.name : 'Person A', lb = ctx.personB ? ctx.personB.name : 'Person B';
      p = `Write a synastry (relationship) reading for ${la} and ${lb}. Consider each person's own chart briefly, then the contacts between them. Be honest about frictions as well as gifts; frictions are workable material, not verdicts.${tkNote(ctx.personA)}${tkNote(ctx.personB)}\n\n${I.chartToText(ctx.chart, `${la}'s chart`)}\n\n${I.chartToText(ctx.chartB, `${lb}'s chart`)}\n\nCross-aspects (${la}'s planet → ${lb}'s planet):\n${I.aspectsToText(ctx.crossAspects, [la, lb])}`;
    } else if (kind === 'transits') {
      const la = ctx.person ? ctx.person.name : 'the native';
      p = `Write a transit reading for ${la}: how the current sky is activating the natal chart. Focus on the tightest transit-to-natal contacts, slow transits (Jupiter outward), and what houses of the natal chart are being lit up.${tkNote(ctx.person)}\n\n${I.chartToText(ctx.chart, `${la}'s natal chart`)}\n\n${I.chartToText(ctx.chartB, 'The sky now (transits)')}\n\nContacts (natal planet first, transiting planet second):\n${I.aspectsToText(ctx.crossAspects, ['natal', 'transiting'])}`;
    } else if (kind === 'period') {
      if (ctx.person) {
        p = `Write a personal astrological forecast for ${ctx.person.name} covering ${ctx.from.toDateString()} through ${ctx.to.toDateString()}. The events marked "natal" are transiting planets perfecting aspects to ${ctx.person.name}'s birth chart — these are the spine of the forecast; read them against the natal placements they touch (house, dignity, natal aspects). Use the general sky events (ingresses, stations, lunations) as backdrop. Weave everything into a narrative arc — what opens, peaks, and closes — citing dates for the turning points, rather than a date-by-date list.${tkNote(ctx.person)}\n\n${I.chartToText(ctx.chart, `${ctx.person.name}'s natal chart`)}\n\nEvents in this window:\n${I.eventsToText(ctx.events)}`;
      } else {
        p = `Write an "astrological weather forecast" for the period ${ctx.from.toDateString()} through ${ctx.to.toDateString()}. Weave the listed events into a narrative arc of the period — what themes open, peak, and close — rather than a date-by-date list. Mention specific dates for the most important moments.\n\nEvents in this window:\n${I.eventsToText(ctx.events)}\n\nSky at the period's start:\n${I.chartToText(ctx.chart, 'Start of period')}`;
      }
    }
    return p;
  }

  // ---------- data-only context block for chart Q&A ----------
  function contextText(kind, ctx) {
    const I = g.Interpret;
    if (kind === 'natal')
      return `${I.chartToText(ctx.chart, `Natal chart${ctx.person ? ` of ${ctx.person.name}` : ''}`)}\n\nAspects:\n${I.aspectsToText(ctx.aspects)}${ctx.patterns && ctx.patterns.length ? `\nPatterns: ${ctx.patterns.map(x => `${x.name} (${x.members.join(', ')})`).join('; ')}` : ''}${tkNote(ctx.person)}`;
    if (kind === 'sky')
      return `${I.chartToText(ctx.chart, 'The sky at the chosen moment')}\n\nAspects:\n${I.aspectsToText(ctx.aspects)}`;
    if (kind === 'transits')
      return `${I.chartToText(ctx.chart, `${ctx.person ? ctx.person.name + '’s' : 'The'} natal chart`)}\n\n${I.chartToText(ctx.chartB, 'The sky at the chosen moment (transits)')}\n\nContacts (natal planet first, transiting second):\n${I.aspectsToText(ctx.crossAspects, ['natal', 'transiting'])}${tkNote(ctx.person)}`;
    if (kind === 'synastry')
      return `${I.chartToText(ctx.chart, `${ctx.personA.name}'s chart`)}\n\n${I.chartToText(ctx.chartB, `${ctx.personB.name}'s chart`)}\n\nCross-aspects (${ctx.personA.name}'s planet first, ${ctx.personB.name}'s second):\n${I.aspectsToText(ctx.crossAspects, [ctx.personA.name, ctx.personB.name])}${tkNote(ctx.personA)}${tkNote(ctx.personB)}`;
    if (kind === 'period')
      return `Period: ${ctx.from.toDateString()} — ${ctx.to.toDateString()}${ctx.person ? ` (personal context for ${ctx.person.name}; events marked "natal" touch their birth chart)` : ''}\n\n${I.chartToText(ctx.chart, ctx.person ? `${ctx.person.name}'s natal chart` : 'Sky at the period start')}\n\nEvents in the window:\n${I.eventsToText(ctx.events)}${tkNote(ctx.person)}`;
    return '';
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

  // ---------- streaming core (shared by readings and Q&A) ----------
  // Dispatches to the configured provider. Claude is the default and uses the
  // official Anthropic SDK; OpenAI and Gemini use their REST SSE endpoints.
  async function streamCompletion(o) {
    const s = getSettings();
    const key = s.keys[s.provider];
    if (!key) { o.onError(`No ${PROVIDERS[s.provider].label} API key set. Add one in Settings → AI readings.`); return; }
    try {
      if (s.provider === 'openai') return await streamOpenAI(o, key, s.models.openai);
      if (s.provider === 'gemini') return await streamGemini(o, key, s.models.gemini);
      return await streamAnthropic(o, key, s.models.anthropic);
    } catch (err) {
      o.onError(`Request failed (${PROVIDERS[s.provider].short}): ` + (err && err.message ? err.message : err));
    }
  }

  async function streamAnthropic({ system, messages, onDelta, onDone, onError }, key, model) {
    if (typeof g.AnthropicSDK === 'undefined') { onError('AI module not loaded.'); return; }
    const client = new g.AnthropicSDK({ apiKey: key, dangerouslyAllowBrowser: true });
    const req = { model, max_tokens: 16000, system, messages };
    let full = '';
    try {
      let stream;
      if (model.startsWith('claude-opus-5') || model.startsWith('claude-fable')) {
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
          onDelta(full);
        }
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === 'refusal') {
        onError('The model declined this request' + (final.stop_details && final.stop_details.explanation ? ': ' + final.stop_details.explanation : '.'));
        return;
      }
      onDone(full);
    } catch (err) {
      const A = g.AnthropicSDK;
      let msg = 'Request failed: ' + (err && err.message ? err.message : err);
      if (A && err instanceof A.AuthenticationError) msg = 'Invalid API key — check it in Settings.';
      else if (A && err instanceof A.RateLimitError) msg = 'Rate limited by the API — wait a moment and try again.';
      else if (A && err instanceof A.APIConnectionError) msg = 'Could not reach the Anthropic API — check your internet connection.';
      onError(msg);
    }
  }

  // parse a text/event-stream response, calling onData per "data:" payload
  async function readSSE(res, onData) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (line.startsWith('data:')) {
          const payload = line.slice(5).trim();
          if (payload) onData(payload);
        }
      }
    }
  }

  function httpErrMsg(provider, status, body) {
    if (status === 401 || status === 403) return `Invalid ${provider} API key — check it in Settings.`;
    if (status === 404) return `${provider} doesn't recognize that model id — pick another in Settings.`;
    if (status === 429) return `Rate limited by ${provider} — wait a moment and try again.`;
    let detail = '';
    try { const j = JSON.parse(body); detail = (j.error && (j.error.message || j.error.status)) || ''; } catch {}
    return `${provider} error ${status}${detail ? ': ' + detail.slice(0, 160) : ''}`;
  }

  async function streamOpenAI({ system, messages, onDelta, onDone, onError }, key, model) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model, stream: true, max_completion_tokens: 8000,
        messages: [{ role: 'system', content: system }].concat(messages),
      }),
    });
    if (!res.ok) { onError(httpErrMsg('OpenAI', res.status, await res.text().catch(() => ''))); return; }
    let full = '', filtered = false;
    await readSSE(res, data => {
      if (data === '[DONE]') return;
      const j = JSON.parse(data);
      const ch = j.choices && j.choices[0];
      if (!ch) return;
      if (ch.delta && ch.delta.content) { full += ch.delta.content; onDelta(full); }
      if (ch.finish_reason === 'content_filter') filtered = true;
    });
    if (filtered && !full) { onError('The model declined this request.'); return; }
    onDone(full);
  }

  async function streamGemini({ system, messages, onDelta, onDone, onError }, key, model) {
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, // key in a header, never in the URL
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: 8000 },
      }),
    });
    if (!res.ok) { onError(httpErrMsg('Gemini', res.status, await res.text().catch(() => ''))); return; }
    let full = '', blocked = false;
    await readSSE(res, data => {
      const j = JSON.parse(data);
      const cand = j.candidates && j.candidates[0];
      if (cand && cand.content && cand.content.parts) {
        for (const p of cand.content.parts) if (p.text) { full += p.text; onDelta(full); }
      }
      if ((cand && cand.finishReason === 'SAFETY') || (j.promptFeedback && j.promptFeedback.blockReason)) blocked = true;
    });
    if (blocked && !full) { onError('The model declined this request.'); return; }
    onDone(full);
  }

  /**
   * streamReading({kind, style, ctx, onDelta(fullText), onDone(fullText), onError(msg)})
   */
  function streamReading(opts) {
    return streamCompletion({
      system: buildSystem(opts.style),
      messages: [{ role: 'user', content: buildPrompt(opts.kind, opts.ctx) }],
      onDelta: opts.onDelta, onDone: opts.onDone, onError: opts.onError,
    });
  }

  /**
   * streamAsk({question, history: [{q,a}], ctxText, style, onDelta, onDone, onError})
   * ctxText: the chart-context block the conversation is pinned to (from contextText()).
   */
  function streamAsk(opts) {
    const system = buildSystem(opts.style) + `

You are now answering direct questions about the chart context supplied in the first message. Answer the question actually asked — directly and concretely, grounded strictly in that data, citing the placements you are reading (usually 120–350 words unless the question needs more). If the chart context genuinely cannot address the question, say so and name what could (a birth time, a different reading type, a longer period). Never predict death, diagnosis, disaster, or guaranteed outcomes; where a question reaches for certainty, read the pressures and openings the chart actually shows and hand the agency back to the asker.`;
    const messages = [];
    const h = opts.history || [];
    if (h.length) {
      messages.push({ role: 'user', content: `Chart context:\n${opts.ctxText}\n\nQuestion: ${h[0].q}` });
      messages.push({ role: 'assistant', content: h[0].a });
      for (let i = 1; i < h.length; i++) {
        messages.push({ role: 'user', content: h[i].q });
        messages.push({ role: 'assistant', content: h[i].a });
      }
      messages.push({ role: 'user', content: opts.question });
    } else {
      messages.push({ role: 'user', content: `Chart context:\n${opts.ctxText}\n\nQuestion: ${opts.question}` });
    }
    return streamCompletion({ system, messages, onDelta: opts.onDelta, onDone: opts.onDone, onError: opts.onError });
  }

  g.Api = { getSettings, setProvider, setKey, setModel, hasKey, currentModel, providerLabel,
            PROVIDERS, streamReading, streamAsk, contextText, mdToHtml };
})(typeof window !== 'undefined' ? window : globalThis);
