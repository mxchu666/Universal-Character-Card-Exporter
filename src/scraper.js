(function () {
  "use strict";

  const NS = (window.JAIX = window.JAIX || {});

  const AVATAR_BASE = "https://ella.janitorai.com/bot-avatars";
  const TIMEOUT_MS = 20000;

  function currentCharacterId() {
    const m = location.pathname.match(/\/characters\/([0-9a-f-]{8,})/i);
    return m ? m[1] : null;
  }

  function readBearer() {
    for (const raw of sessionBlobs()) {
      const token = extractAccessToken(raw);
      if (token) return token;
    }
    return null;
  }

  function sessionBlobs() {
    const blobs = [];

    try {
      for (const parts of groupTokenKeys(Object.keys(localStorage))) {
        blobs.push(parts.map((k) => localStorage.getItem(k) || "").join(""));
      }
    } catch {}

    try {
      const jar = {};
      for (const c of (document.cookie || "").split(";")) {
        const i = c.indexOf("=");
        if (i < 0) continue;
        jar[c.slice(0, i).trim()] = c.slice(i + 1).trim();
      }
      for (const parts of groupTokenKeys(Object.keys(jar))) {
        let raw = parts.map((k) => jar[k] || "").join("");
        try {
          raw = decodeURIComponent(raw);
        } catch {}
        blobs.push(raw);
      }
    } catch {}

    return blobs;
  }

  function groupTokenKeys(keys) {
    const groups = {};
    for (const k of keys) {
      if (!/^sb-.*-auth-token(\.\d+)?$/.test(k)) continue;
      const base = k.replace(/\.\d+$/, "");
      (groups[base] = groups[base] || []).push(k);
    }
    const chunkIndex = (k) => {
      const m = k.match(/\.(\d+)$/);
      return m ? parseInt(m[1], 10) : -1;
    };
    return Object.keys(groups).map((base) =>
      groups[base].sort((a, b) => chunkIndex(a) - chunkIndex(b)),
    );
  }

  function extractAccessToken(raw) {
    if (!raw) return null;
    let text = raw;
    if (text.startsWith("base64-")) text = decodeBase64(text.slice(7));
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return null;
    }
    if (Array.isArray(data) && typeof data[0] === "string") return data[0];
    if (data && typeof data.access_token === "string") return data.access_token;
    if (data && data.currentSession && typeof data.currentSession.access_token === "string") {
      return data.currentSession.access_token;
    }
    return null;
  }

  function decodeBase64(value) {
    try {
      const normalized = value.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
      const bin = atob(padded);
      return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    } catch {
      return "";
    }
  }

  function workerGet(url) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      try {
        if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
          return finish(null);
        }
        chrome.runtime.sendMessage(
          {
            type: "jaix:fetch",
            url,
            method: "GET",
            headers: { Accept: "application/json" },
            credentials: "include",
          },
          (reply) => {
            const failure = chrome.runtime.lastError;
            if (failure) {
              const raw = String(failure.message || "unknown");
              const plain = /context invalidated|Receiving end does not exist|message port closed/i.test(raw)
                ? "extension reloaded - reload this tab"
                : raw;
              return finish({ ok: false, status: 0, error: "runtime: " + plain });
            }
            finish(reply || { ok: false, status: 0, error: "worker sent no reply" });
          },
        );
      } catch (error) {
        return finish({ ok: false, status: 0, error: String((error && error.message) || error) });
      }
      setTimeout(() => finish({ ok: false, status: 0, error: "worker timeout" }), TIMEOUT_MS);
    });
  }

  async function fetchJson(url) {
    const headers = { Accept: "application/json" };
    const bearer = readBearer();
    if (bearer) headers.Authorization = "Bearer " + bearer;
    let status = 0;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          headers,
          credentials: "include",
          signal: ctrl.signal,
        });
        status = res.status;
        const body = await res.text();
        if (!res.ok) {
          const err = new Error("HTTP " + res.status);
          err.status = res.status;
          throw err;
        }
        try {
          return JSON.parse(body);
        } catch {
          const err = new Error("non-json");
          err.status = res.status;
          throw err;
        }
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      // A network refusal is the one case the worker can still answer: it is not
      // CORS-bound and it carries the same cookies under the host permission.
      // An HTTP status (401/403/404) is a real answer and is not retried.
      if (error && error.status) throw error;
      const viaWorker = await workerGet(url);
      if (viaWorker && viaWorker.ok && viaWorker.body) return viaWorker.body;
      if (viaWorker && viaWorker.error) {
        const err = new Error(viaWorker.error);
        err.status = viaWorker.status || status || 0;
        throw err;
      }
      throw error;
    }
  }

  const s = (v) => (typeof v === "string" ? v.trim() : "");
  const arrStr = (v) =>
    Array.isArray(v) ? v.map(s).filter(Boolean) : [];

  function stripAttributionBoilerplate(value, creator) {
    const text = s(value);
    if (!text) return "";
    return text
      .replace(/(<br\s*\/?>|<\/(?:p|div|li|h[1-6])\s*>)/gi, "$1\n")
      .split(/\r?\n/)
      .filter((line) => !isAttributionLine(line, creator))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function isAttributionLine(line, creator) {
    const plain = String(line || "")
      .trim()
      .replace(/<[^>]*>/g, " ")
      .replace(/(?:&nbsp;|&#160;)/gi, " ")
      .replace(/(?:&commat;|&#64;)/gi, "@")
      .replace(/^(?:>\s*|[-*#]\s*)+/, "")
      .replace(/[*_~`]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!plain || plain.length > 120) return false;

    const match =
      plain.match(
        /^(?:(?:this\s+)?(?:character|bot|card)\s+)?(?:created|made|written)\s+by\s*:?\s+(.+)$/i,
      ) ||
      plain.match(/^(?:creator|author)\s*:\s*(.+)$/i) ||
      plain.match(/^by\s+(@\S+|https?:\/\/\S+|\[[^\]]+\]\([^)]+\))$/i) ||
      plain.match(/^©\s*(.+)$/);
    if (!match) return false;

    const target = match[1].trim();
    if (/^@[\p{L}\p{N}_.-]+$/u.test(target)) return true;
    if (/^https?:\/\/\S+$/i.test(target)) return true;
    if (/^\[[^\]]+\]\([^)]+\)$/.test(target)) return true;

    const targetKey = identityKey(target);
    const creatorKey = identityKey(creator);
    return !!creatorKey && (
      targetKey === creatorKey ||
      targetKey === creatorKey + "onjanitorai"
    );
  }

  function identityKey(value) {
    return s(value)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "");
  }

  function tagNames(v) {
    if (!Array.isArray(v)) return [];
    return v
      .map((t) => s(typeof t === "string" ? t : t && t.name))
      .filter(Boolean);
  }

  function absAvatar(v) {
    const a = s(v);
    if (!a) return "";
    if (/^https?:\/\//i.test(a)) return a;
    return AVATAR_BASE + "/" + a.replace(/^\/+/, "");
  }

  function normalizeCharacter(data) {
    data = data && typeof data === "object" ? data : {};
    const creator = s(data.creator_name);
    const clean = (value) => stripAttributionBoilerplate(value, creator);
    const firstMsgs = arrStr(data.first_messages).map(clean).filter(Boolean);
    const firstMessage = clean(data.first_message);
    const greeting = firstMessage || firstMsgs[0] || "";
    const altGreetings = [
      ...new Set(
        (firstMessage ? firstMsgs : firstMsgs.slice(1)).filter(
          (message) => message !== greeting,
        ),
      ),
    ];
    const fields = {
      description: clean(data.description),
      personality: clean(data.personality),
      scenario: clean(data.scenario),
      greeting,
      altGreetings,
      exampleDialogue: clean(data.example_dialogs),
    };
    const hasDefinition = Boolean(fields.personality || fields.scenario || fields.exampleDialogue);
    return {
      id: s(data.id),
      name: s(data.name) || "Imported character",
      creator,
      avatarUrl: absAvatar(data.avatar),
      nsfw: !!data.is_nsfw,
      tags: [...new Set([...tagNames(data.tags), ...tagNames(data.custom_tags)])],
      fields,
      definitionMeta: {
        showdefinition: data.showdefinition,
        override: data.showDefinitionOverride,
        hasDefinition,
        source: hasDefinition ? "api" : "",
      },
      scriptRefs: (Array.isArray(data.scripts) ? data.scripts : [])
        .filter((x) => x && x.type === "lorebook" && typeof x.id === "string")
        .map((x) => ({ id: x.id, title: s(x.title), description: clean(x.description) })),
      lorebooks: [],
      failedLorebooks: 0,
      sourceLabel: "JanitorAI card",
    };
  }

  // ---- Definition recovery -------------------------------------------------
  //
  // The API is the first source. When it returns the public summary only, the
  // page still sometimes carries the record in its server-rendered flight data
  // or renders the definition panel. Both are read without asking the site for
  // anything it did not already send.

  function braceMatch(text, start) {
    if (text[start] !== "{") return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
    return null;
  }

  function looksLikeCharacter(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    if (typeof value.name !== "string") return false;
    let hits = 0;
    for (const key of ["description", "personality", "scenario", "first_message", "example_dialogs", "first_messages"]) {
      if (typeof value[key] === "string" && value[key].trim()) hits++;
    }
    return hits > 0;
  }

  // Next.js pushes its RSC payload as JSON-encoded JS strings:
  //   self.__next_f.push([1,"{\"id\":\"...\",\"personality\":\"...\"}"])
  // Parsing that argument as JSON gives the decoded chunk, which can then be
  // brace-matched and parsed as the record itself. No hand-rolled unescaping.
  function flightPayload() {
    const chunks = [];
    try {
      for (const script of document.querySelectorAll("script")) {
        const text = (script.textContent || "").trim();
        if (!text) continue;
        if (text.startsWith("self.__next_f.push(")) {
          const arg = text.slice("self.__next_f.push(".length).replace(/\)\s*;?\s*$/, "");
          try {
            const parsed = JSON.parse(arg);
            if (Array.isArray(parsed) && typeof parsed[1] === "string") chunks.push(parsed[1]);
          } catch {}
        } else if (/^application\/(ld\+)?json$/i.test(script.type || "")) {
          chunks.push(text);
        }
      }
    } catch {}
    return chunks.join("\n");
  }

  function recordFromText(text, id) {
    if (!text) return null;
    const needles = [];
    if (id) needles.push('{"id":"' + id + '"');
    needles.push('{"allow_proxy"', '{"id":"');
    let best = null;
    for (const needle of needles) {
      let at = -1;
      let tries = 0;
      while ((at = text.indexOf(needle, at + 1)) >= 0 && tries < 40) {
        tries++;
        const candidate = braceMatch(text, at);
        if (!candidate) continue;
        try {
          const parsed = JSON.parse(candidate);
          if (!looksLikeCharacter(parsed)) continue;
          if (id && parsed.id && parsed.id !== id) continue;
          const score = ["personality", "scenario", "example_dialogs", "first_message", "first_messages"].filter(
            (key) => typeof parsed[key] === "string" && parsed[key].trim(),
          ).length;
          if (!best || score > best.score) best = { record: parsed, score };
        } catch {}
      }
      if (best) return best.record;
    }
    return best ? best.record : null;
  }

  function deepFindCharacter(root, id) {
    const seen = new Set();
    let best = null;
    const visit = (value, depth) => {
      if (!value || depth > 7 || seen.has(value)) return;
      if (typeof value !== "object") return;
      seen.add(value);
      if (!Array.isArray(value) && looksLikeCharacter(value)) {
        const score =
          ["personality", "scenario", "example_dialogs", "first_message"].filter(
            (key) => typeof value[key] === "string" && value[key].trim(),
          ).length + (id && value.id === id ? 2 : 0);
        if (score > 0 && (!best || score > best.score)) best = { record: value, score };
      }
      const values = Array.isArray(value) ? value.slice(0, 400) : Object.values(value).slice(0, 400);
      for (const child of values) visit(child, depth + 1);
    };
    try {
      visit(root, 0);
    } catch {}
    return best ? best.record : null;
  }

  // JanitorAI's Vite app hydrates its stores from inline scripts shaped like
  //   window.mbxM.push(JSON.parse("{\"SJ--a:a-a--characterStore\":{...}}"));
  // The argument is a JSON *string literal* that itself contains a JSON
  // document. Parsing it twice is exact and avoids hand-rolled unescaping.
  function scriptPayloads() {
    const out = [];
    try {
      for (const script of document.querySelectorAll("script")) {
        const text = (script.textContent || "").trim();
        if (!text) continue;
        if (/^application\/(ld\+)?json$/i.test(script.type || "")) {
          try {
            out.push(JSON.parse(text));
          } catch {}
          continue;
        }
        const re = /JSON\.parse\(\s*("(?:[^"\\]|\\.)*")\s*\)/g;
        let match;
        let count = 0;
        while ((match = re.exec(text)) && count < 20) {
          count++;
          try {
            out.push(JSON.parse(JSON.parse(match[1])));
          } catch {}
        }
      }
    } catch {}
    return out;
  }

  function pageRecord(id) {
    try {
      if (typeof window !== "undefined") {
        for (const root of [window.__NEXT_DATA__, window.__NUXT__, window.__APOLLO_STATE__, window.__INITIAL_STATE__]) {
          if (!root) continue;
          const found = deepFindCharacter(root, id);
          if (found) return found;
        }
      }
    } catch {}
    // The hydration store is the first and best copy: the SPA keeps one record
    // in it, including whatever the server rendered for this session.
    for (const payload of scriptPayloads()) {
      const found = deepFindCharacter(payload, id);
      if (found) return found;
    }
    const text = flightPayload();
    const fromFlight = recordFromText(text, id);
    if (fromFlight) return fromFlight;
    try {
      return recordFromText(document.documentElement.innerHTML, id);
    } catch {
      return null;
    }
  }

  function definitionFromPage(creator) {
    const labels = {
      personality: /^(personality|persona)$/i,
      scenario: /^(scenario|setting|context)$/i,
      exampleDialogue: /^(example dialogues?|example dialogs?|example messages?)$/i,
      greeting: /^(first message|greeting|initial message)$/i,
    };
    const out = {};
    let candidates;
    try {
      candidates = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,strong,b,dt,summary,span,div,p")];
    } catch {
      return out;
    }
    for (const el of candidates) {
      const label = (el.textContent || "").trim();
      if (!label || label.length > 40) continue;
      let key = "";
      for (const [name, re] of Object.entries(labels)) {
        if (re.test(label)) {
          key = name;
          break;
        }
      }
      if (!key || out[key]) continue;
      // Prefer the definition panel; a sidebar label would otherwise leak the
      // whole navigation into a prompt field.
      const scope = el.closest('main,article,[class*="definition" i],[class*="character" i]');
      if (!scope) continue;
      let body = "";
      const sibling = el.nextElementSibling;
      if (sibling) body = sibling.innerText || sibling.textContent || "";
      if ((body || "").trim().length < 30 && el.parentElement) {
        body = (el.parentElement.innerText || el.parentElement.textContent || "").replace(label, "");
      }
      body = stripAttributionBoilerplate(body, creator)
        .replace(/^\s*[:：-]\s*/, "")
        .trim();
      if (body.length < 30 || body.length > 30000) continue;
      if (/^(personality|scenario|example dialogues?|first message)\b/i.test(body)) continue;
      out[key] = body;
    }
    return out;
  }

  function collectScriptRefs(data, creator) {
    const refs = new Map();
    const add = (id, title, description) => {
      const clean = s(id);
      if (!/^[0-9a-f-]{8,}$/i.test(clean)) return;
      if (!refs.has(clean)) {
        refs.set(clean, {
          id: clean,
          title: s(title) || "Lorebook",
          description: stripAttributionBoilerplate(description, creator),
        });
      }
    };
    const raw = data && data.scripts;
    const list = Array.isArray(raw) ? raw : typeof raw === "string" ? (() => {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })() : [];
    for (const item of list) {
      if (item && item.type !== "lorebook") continue;
      add(item && item.id, item && item.title, item && item.description);
    }
    try {
      for (const anchor of document.querySelectorAll('a[href*="/scripts/"]')) {
        const m = (anchor.getAttribute("href") || "").match(/\/scripts\/([0-9a-f-]{8,})/i);
        if (m) add(m[1], (anchor.textContent || "").trim(), "");
      }
      for (const entry of performance.getEntriesByType("resource")) {
        const m = String(entry.name || "").match(/\/hampter\/script\/([0-9a-f-]{8,})/i);
        if (m) add(m[1], "", "");
      }
    } catch {}
    const text = flightPayload();
    if (text) {
      let at = -1;
      let tries = 0;
      while ((at = text.indexOf('"type":"lorebook"', at + 1)) >= 0 && tries++ < 40) {
        const slice = text.slice(Math.max(0, at - 400), at + 400);
        const id = (slice.match(/"id":"([0-9a-f-]{8,})"/i) || [])[1];
        const title = (slice.match(/"title":"([^"]{0,120})"/) || [])[1];
        if (id) add(id, title, "");
      }
    }
    return [...refs.values()];
  }

  async function fetchScript(ref, creator) {
    const data = await fetchJson(
      "/hampter/script/" + encodeURIComponent(ref.id),
    );
    let payload = data && (data.script ?? data.lorebook ?? data);
    if (payload && typeof payload === "object" && !Array.isArray(payload) && Array.isArray(payload.entries)) {
      payload = payload.entries;
    } else if (payload && typeof payload === "object" && !Array.isArray(payload) && Array.isArray(payload.entries_list)) {
      payload = payload.entries_list;
    }
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        throw new Error("invalid-script");
      }
    }
    if (payload && typeof payload === "object" && !Array.isArray(payload) && payload.entries) {
      payload = payload.entries;
    }
    if (!Array.isArray(payload)) payload = [];
    const bookName =
      s(ref.title) ||
      s(data && data.title) ||
      s(data && data.name) ||
      "Lorebook";
    const bookDescription =
      s(ref.description) || s(data && data.description);
    return {
      name: bookName,
      description: stripAttributionBoilerplate(bookDescription, creator),
      entries: payload.map((entry) => normalizeEntry(entry, creator)).filter((e) => e.content),
    };
  }

  function normalizeEntry(e, creator) {
    if (!e || typeof e !== "object") return { keys: [], content: "", comment: "" };
    const keys = [
      ...new Set(
        arrStr(e.keys)
          .concat(arrStr(e.key), arrStr(e.keywords), arrStr(e.triggers))
          .filter((key) => key !== "*"),
      ),
    ];
    const secondary = [
      ...new Set(arrStr(e.secondary_keys).concat(arrStr(e.keysecondary))),
    ].filter((key) => !keys.includes(key));
    const enabled = e.enabled !== false && e.disabled !== true;
    return {
      keys: keys.length ? keys : secondary,
      secondaryKeys: keys.length ? secondary : [],
      content: stripAttributionBoilerplate(
        s(e.content) || s(e.entry) || s(e.text) || s(e.value),
        creator,
      ),
      comment: s(e.name) || s(e.comment) || s(e.title),
      constant: !!e.constant || e.constant === "true",
      selective: e.selective !== false && enabled,
      enabled,
      insertionOrder: Number.isFinite(e.insertion_order) ? e.insertion_order : undefined,
      position: s(e.position),
      priority: Number.isFinite(e.priority) ? e.priority : undefined,
      probability: Number.isFinite(e.probability) ? e.probability : undefined,
      caseSensitive: e.case_sensitive === true,
      wholeWords: e.whole_words_only === true || e.match_whole_words === true,
      extensions: e.extensions && typeof e.extensions === "object" ? e.extensions : undefined,
    };
  }

  async function scanCharacter(opts = {}) {
    const id = opts.id || currentCharacterId();
    if (!id) {
      const err = new Error("no-character");
      err.friendly =
        "Open a character page first (its URL should look like janitorai.com/characters/...).";
      throw err;
    }
    const onProgress = typeof opts.onProgress === "function" ? opts.onProgress : null;
    if (onProgress) onProgress("Fetching character...");
    let data;
    try {
      data = await fetchJson("/hampter/characters/" + encodeURIComponent(id));
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        e.friendly =
          "JanitorAI rejected the request. Make sure you're signed in and can view this character, then reload the page and try again.";
      } else if (e.status === 404) {
        e.friendly = "That character couldn't be found (it may be private or deleted).";
      } else {
        e.friendly = "Couldn't reach JanitorAI just now. Reload the page and try again.";
      }
      throw e;
    }
    const card = normalizeCharacter(data);

    // The API is the source of truth when it carries the definition. When it
    // returns only the summary, the same record may still be in the page's
    // server-rendered payload, and the definition panel may be on screen.
    let page = null;
    const needsDefinition = !card.fields.personality && !card.fields.scenario && !card.fields.exampleDialogue;
    if (needsDefinition) {
      page = pageRecord(id);
      if (page) {
        const merged = normalizeCharacter(page);
        for (const key of ["description", "personality", "scenario", "greeting", "exampleDialogue"]) {
          if (!card.fields[key] && merged.fields[key]) card.fields[key] = merged.fields[key];
        }
        if (!card.fields.altGreetings.length && merged.fields.altGreetings.length) {
          card.fields.altGreetings = merged.fields.altGreetings;
        }
        if (!card.avatarUrl && merged.avatarUrl) card.avatarUrl = merged.avatarUrl;
        if (!card.tags.length && merged.tags.length) card.tags = merged.tags;
      }
      if (!card.fields.personality && !card.fields.scenario && !card.fields.exampleDialogue) {
        const fromDom = definitionFromPage(card.creator);
        for (const key of ["personality", "scenario", "exampleDialogue", "greeting"]) {
          if (!card.fields[key] && fromDom[key]) card.fields[key] = fromDom[key];
        }
        if (Object.keys(fromDom).length) card.definitionMeta.source = "page";
      } else if (page) {
        card.definitionMeta.source = "page-payload";
      }
    }

    card.definitionMeta.hasDefinition = Boolean(
      card.fields.personality || card.fields.scenario || card.fields.exampleDialogue,
    );

    // A creator can hide the definition. That is a property of the character,
    // not a failed read, and the panel should say which one it is.
    if (!card.definitionMeta.hasDefinition) {
      if (card.definitionMeta.showdefinition === false) {
        card.hint =
          "The creator turned Definition Visibility off for this character, so JanitorAI does not publish its personality, scenario or example dialogue. The description, greeting and lorebooks are still exported.";
      } else if (card.definitionMeta.showdefinition === true) {
        card.hint =
          "JanitorAI marks this definition as public, but this read came back without it. Reload the character page while signed in and scan again; the site strips definition fields from requests it does not recognise as a signed-in reader.";
      } else {
        card.hint =
          "JanitorAI returned only the public summary for this character. Sign in, reload the page, and scan again to read the definition.";
      }
    }

    const refs = collectScriptRefs(
      { ...data, scripts: (data && data.scripts) || (page && page.scripts) },
      card.creator,
    );
    card.scriptRefs = refs;

    if (opts.deep && refs.length) {
      let done = 0;
      const failedNames = [];
      for (const ref of refs) {
        if (onProgress) {
          onProgress("Fetching lorebook " + ++done + "/" + refs.length + "...");
        }
        try {
          const book = await fetchScript(ref, card.creator);
          if (book.entries.length) card.lorebooks.push(book);
          else failedNames.push(ref.title || "Lorebook");
        } catch {
          card.failedLorebooks++;
          failedNames.push(ref.title || "Lorebook");
        }
      }
      if (failedNames.length && !card.hint) {
        card.note =
          failedNames.length +
          (failedNames.length === 1 ? " lorebook could not be read: " : " lorebooks could not be read: ") +
          failedNames.slice(0, 3).join(", ") +
          (failedNames.length > 3 ? "..." : "") +
          ".";
      }
    } else if (opts.deep && !refs.length) {
      card.note = "No lorebooks are attached to this character.";
    }
    return card;
  }

  NS.scraper = {
    currentCharacterId,
    readBearer,
    scanCharacter,
    normalizeCharacter,
    normalizeEntry,
    fetchScript,
    collectScriptRefs,
    definitionFromPage,
    pageRecord,
    recordFromText,
    flightPayload,
    scriptPayloads,
    stripAttributionBoilerplate,
  };
})();
