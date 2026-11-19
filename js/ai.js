/* Command Deck · AI link
   Replaces the claude.ai "sample" capability with a direct call to the Claude Messages
   API from this device, using the owner's own API key (kept in this browser's storage
   and sent only to api.anthropic.com). Same calling shape the page already used:
     const fn = DeckAI.sampler();           // null when no key is set
     const res = await fn(messages, { system, signal, onText, tools });
   Tools are { name, description, inputSchema, execute(input) }. */
(function () {
  "use strict";
  const ENDPOINT = "https://api.anthropic.com/v1/messages";
  const KEY = "deck.apiKey", MODEL = "deck.model";
  const MODELS = [
    { id: "claude-opus-5-5", label: "Claude Opus 5.5 (smartest)" },
    { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (balanced)" },
    { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (fastest, cheapest)" }
  ];
  const DEFAULT_MODEL = "claude-opus-5-5";
  // Server-side refusal fallback is offered for Opus 5.5 and Sonnet 5.5, not Haiku 5.5.
  const FALLBACK_OK = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);
  const MAX_TOOL_ROUNDS = 6;

  const store = {
    get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : ""; } catch (e) { return ""; } },
    set(k, v) { try { if (v) localStorage.setItem(k, JSON.stringify(v)); else localStorage.removeItem(k); } catch (e) {} }
  };
  const getKey = () => String(store.get(KEY) || "").trim();
  const getModel = () => { const m = store.get(MODEL); return MODELS.some(x => x.id === m) ? m : DEFAULT_MODEL; };

  function fail(code, message, text) { const e = new Error(message || code); e.code = code; if (text) e.text = text; return e; }

  async function readSSE(res, onEvent, signal) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      if (signal && signal.aborted) { try { reader.cancel(); } catch (e) {} throw fail("cancelled"); }
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
        let data = "";
        chunk.split("\n").forEach(line => { if (line.startsWith("data:")) data += line.slice(5).trimStart(); });
        if (data) { let ev; try { ev = JSON.parse(data); } catch (e) { continue; } onEvent(ev); }
      }
    }
  }

  // One streamed request. Returns { content, stop_reason }.
  async function streamOnce(body, key, signal, onDelta) {
    const headers = {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    };
    if (body.fallbacks) headers["anthropic-beta"] = "server-side-fallback-2026-07-01";
    let res;
    try { res = await fetch(ENDPOINT, { method: "POST", headers, body: JSON.stringify(body), signal }); }
    catch (e) { throw fail(signal && signal.aborted ? "cancelled" : (navigator.onLine === false ? "offline" : "network"), e.message); }
    if (!res.ok) {
      let msg = ""; try { const j = await res.json(); msg = (j && j.error && j.error.message) || ""; } catch (e) {}
      if (res.status === 401 || res.status === 403) throw fail("bad_key", msg);
      if (res.status === 429) throw fail("rate_limited", msg);
      if (res.status === 529 || res.status >= 500) throw fail("overloaded", msg);
      if (res.status === 400 && /too long|too many tokens/i.test(msg)) throw fail("prompt_too_large", msg);
      if (res.status === 400 && /credit|billing/i.test(msg)) throw fail("billing", msg);
      throw fail("bad_request", msg);
    }
    const blocks = []; let stop = null, errEv = null;
    await readSSE(res, ev => {
      switch (ev.type) {
        case "content_block_start": {
          const b = JSON.parse(JSON.stringify(ev.content_block || {}));
          if (b.type === "tool_use") { b._json = ""; b.input = {}; }
          blocks[ev.index] = b; break;
        }
        case "content_block_delta": {
          const b = blocks[ev.index], d = ev.delta || {}; if (!b) break;
          if (d.type === "text_delta") { b.text = (b.text || "") + d.text; onDelta(d.text); }
          else if (d.type === "input_json_delta") b._json += d.partial_json || "";
          else if (d.type === "thinking_delta") b.thinking = (b.thinking || "") + d.thinking;
          else if (d.type === "signature_delta") b.signature = (b.signature || "") + d.signature;
          break;
        }
        case "message_delta": if (ev.delta && ev.delta.stop_reason) stop = ev.delta.stop_reason; break;
        case "error": errEv = ev.error || {}; break;
      }
    }, signal);
    if (errEv) throw fail(errEv.type === "overloaded_error" ? "overloaded" : "network", errEv.message);
    return { content: blocks.filter(Boolean), stop_reason: stop };
  }

  function validate(input, schema) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return "Input must be a JSON object.";
    const props = (schema && schema.properties) || {};
    for (const r of (schema && schema.required) || []) if (input[r] == null) return "Missing required field: " + r;
    for (const k of Object.keys(input)) {
      const p = props[k]; if (!p || input[k] == null) continue;
      const t = Array.isArray(input[k]) ? "array" : typeof input[k];
      if (p.type && p.type !== t && !(p.type === "number" && t === "number")) return "Field " + k + " should be " + p.type + ".";
      if (p.enum && !p.enum.includes(input[k])) return "Field " + k + " must be one of " + p.enum.join(", ") + ".";
    }
    return null;
  }

  function sampler() {
    const key = getKey();
    if (!key) return null;
    const fn = async (messages, opts) => {
      opts = opts || {};
      const model = getModel();
      const tools = (opts.tools || []).map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema, eager_input_streaming: true }));
      const convo = messages.map(m => ({ role: m.role, content: m.content }));
      let spoken = "";
      const onDelta = t => { spoken += t; if (opts.onText) opts.onText({ text: spoken }); };
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const body = {
          model, max_tokens: 4096, stream: true,
          system: opts.system || undefined,
          messages: convo,
          output_config: { effort: "low" }
        };
        if (tools.length) body.tools = tools;
        if (FALLBACK_OK.has(model)) body.fallbacks = "default";
        if (spoken && !/\s$/.test(spoken)) onDelta(" ");
        let out;
        try { out = await streamOnce(body, key, opts.signal, onDelta); }
        catch (e) { if (e.code === "cancelled") e.text = spoken.trim(); throw e; }
        if (out.stop_reason === "refusal") throw fail("refused", "refused", spoken.trim());
        const toolUses = out.content.filter(b => b.type === "tool_use");
        // Echo the assistant turn back unchanged (thinking blocks included), minus our scratch field.
        const assistant = out.content.map(b => {
          if (b.type !== "tool_use") return b;
          let input = {}; try { input = b._json ? JSON.parse(b._json) : {}; } catch (e) { b._bad = true; }
          b.input = input; const c = Object.assign({}, b); delete c._json; delete c._bad; return c;
        });
        if (out.stop_reason !== "tool_use" || !toolUses.length) return { text: spoken.trim(), model };
        convo.push({ role: "assistant", content: assistant });
        const results = [];
        for (const b of toolUses) {
          const tool = (opts.tools || []).find(t => t.name === b.name);
          let content, isErr = false;
          const problem = !tool ? "Unknown tool " + b.name : b._bad ? "The tool input was not valid JSON." : validate(b.input, tool.inputSchema);
          if (problem) { content = problem; isErr = true; }
          else {
            try { content = JSON.stringify(await tool.execute(b.input)); }
            catch (e) { content = String((e && e.message) || e); isErr = true; }
          }
          results.push({ type: "tool_result", tool_use_id: b.id, content, is_error: isErr || undefined });
        }
        convo.push({ role: "user", content: results });
      }
      return { text: spoken.trim(), model };
    };
    fn.limits = async () => ({ tools: true });
    return fn;
  }

  window.DeckAI = {
    MODELS, DEFAULT_MODEL,
    sampler, hasKey: () => !!getKey(),
    getModel, setModel: m => store.set(MODEL, m),
    setKey: k => store.set(KEY, String(k || "").trim()),
    clearKey: () => store.set(KEY, ""),
    maskedKey: () => { const k = getKey(); return k ? k.slice(0, 7) + "…" + k.slice(-4) : ""; }
  };
})();
