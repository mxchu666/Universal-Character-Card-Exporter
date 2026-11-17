// Character.ai reader.
//
// Character.ai gives a signed-in browser a character record only through its own
// API, which needs the page's auth header. The page makes that request itself, so
// `intercept.js` captures the header and the response; this module replays the
// call with the captured token and falls back to whatever the page already
// received. Field mapping follows the verified table in
// https://github.com/taquanta/character-ai-to-crushon-ai-card-exporter (MIT) by
// taquanta, credited in the README.
(function () {
  "use strict";

  const NS = (window.JAIX = window.JAIX || {});
  const H = NS.harvest;
  const TIMEOUT_MS = 15000;

  const OWNED = "https://neo.character.ai/character/v1/get_character";
  const NEO = "https://neo.character.ai/character/v1/get_character_info";
  const PLUS = [
    "https://plus.character.ai/chat/character/info/",
    "https://plus.character.ai/chat/character/",
  ];
  const AVATAR_BASE = "https://characterai.io/i/400/static/avatars/";

  const s = (v) => (typeof v === "string" ? v.trim() : "");

  // /character/<external_id> and the older /chat?char=<external_id> both address
  // the same record.
  function currentCharacterId() {
    if (typeof location === "undefined") return null;
    const path = location.pathname.match(/\/character\/([A-Za-z0-9_-]{6,})/);
    if (path) return path[1];
    const query = new URLSearchParams(location.search);
    return query.get("char") || query.get("characterId") || null;
  }

  // A chat page is /chat/<chatId>, usually with ?char=<external_id>.
  function currentChatId() {
    if (typeof location === "undefined") return null;
    const m = location.pathname.match(/\/chat\/([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : null;
  }

  function readToken() {
    return H ? H.token() : "";
  }

  // The header exactly as the page sent it. The site has shipped `Token <hex>` and
  // `Bearer <jwt>` at different times; rebuilding the scheme from a bare token
  // breaks the moment it changes, and the failure looks like a missing character.
  function readAuthHeader() {
    return H && typeof H.tokenHeader === "function" ? H.tokenHeader() : "";
  }

  function attemptLabel(transport, url) {
    return transport + " " + url.replace(/^https:\/\//, "").replace(/\/$/, "");
  }

  function note(attempts, transport, url, reply, error) {
    attempts.push({
      label: attemptLabel(transport, url),
      status: reply ? reply.status || 0 : 0,
      ok: Boolean(reply && reply.ok),
      error: error ? String(error).slice(0, 80) : "",
    });
  }

  // A 200 with no character in it is the least useful line a report can carry,
  // so it says what the body actually was: an HTML challenge, an error envelope,
  // or a shape the unwrapper does not know.
  function whyEmpty(reply) {
    if (!reply) return "no reply";
    if (reply.error) return reply.error;
    if (!reply.ok) return "http " + (reply.status || 0);
    if (reply.body && typeof reply.body === "object") {
      const keys = Object.keys(reply.body).slice(0, 4).join(",");
      return "200, no character in body (" + (keys || "empty object") + ")";
    }
    const text = String(reply.text || "").trim();
    if (/^</.test(text)) return "200, html page instead of json";
    return "200, no character in body";
  }

  // First transport: the page's own context. It carries the site's cookies and
  // runs under the origin the API already allows, which is what the site itself
  // does. Cross-origin, so it only works if the API sends CORS headers — and when
  // it does, it is the request least likely to be refused.
  async function pageFetch(url, auth, body) {
    try {
      const headers = { "Content-Type": "application/json", Accept: "application/json" };
      if (auth) headers.Authorization = auth;
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
      return { ok: res.ok, status: res.status, body: parsed, text };
    } catch (error) {
      return { ok: false, status: 0, error: String(error), blocked: "cors-or-network" };
    }
  }

  // Second transport: the service worker. Not subject to CORS, and the site's
  // Cloudflare cookies ride along only because `credentials: "include"` is set —
  // without them a request from the worker looks like a bot and gets a 403.
  function backgroundFetch(url, auth, body) {
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
        // A malformed header (empty token) makes fetch throw before it leaves, so
        // the header is only attached when there is a token to attach.
        const headers = { "Content-Type": "application/json", Accept: "application/json" };
        if (auth) headers.Authorization = auth;
        chrome.runtime.sendMessage(
          {
            type: "jaix:fetch",
            url,
            method: "POST",
            body: JSON.stringify(body),
            headers,
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
      } catch {
        return finish(null);
      }
      setTimeout(() => finish({ ok: false, status: 0, error: "worker timeout" }), TIMEOUT_MS);
    });
  }

  // The neo endpoint answers `{character: {...}}`; the plus endpoints answer the
  // record at the top level. Both are normalised to one object.
  function unwrap(body) {
    if (!body || typeof body !== "object") return null;
    const inner = body.character;
    if (inner && typeof inner === "object" && !Array.isArray(inner) && Object.keys(inner).length) return inner;
    if (body.external_id || body.participant__name) return body;
    if (body.name && (body.description || body.greeting || body.title)) return body;
    return null;
  }

  async function fetchCharacter(id) {
    const auth = readAuthHeader() || (readToken() ? "Token " + readToken() : "");
    const attempts = [];
    // `get_character` is the stronger endpoint: it includes the definition, but
    // only for a character the signed-in account owns. `get_character_info`
    // answers for anyone and strips the definition. Try the strong one first
    // when there is a token, and fall through to the public one when it returns
    // an empty character for someone else's bot.
    const urls = auth ? [OWNED, NEO, ...PLUS] : [NEO, ...PLUS];
    for (const url of urls) {
      const body = url === OWNED ? { external_id: id } : { external_id: id, lang: "en" };
      for (const transport of ["page", "worker"]) {
        const reply =
          transport === "page"
            ? await pageFetch(url, auth, body)
            : await backgroundFetch(url, auth, body);
        note(attempts, transport, url, reply, whyEmpty(reply));
        const parsed = reply && reply.ok ? unwrap(reply.body) : null;
        if (parsed) return { character: parsed, attempts };
      }
    }
    // Cookie-only last try: if the site moved the session back onto cookies, the
    // header is not what it wants, and an empty Authorization is the right request.
    if (auth) {
      const reply = await pageFetch(NEO, "", { external_id: id, lang: "en" });
      note(attempts, "page(cookie)", NEO, reply, whyEmpty(reply));
      const parsed = reply && reply.ok ? unwrap(reply.body) : null;
      if (parsed) return { character: parsed, attempts };
    }
    return { character: null, attempts };
  }

  // Last resort: the character page itself, read through the worker with cookies.
  // A cold load is server-rendered, so the record exists in the page's own flight
  // data even when no API call was ever made from this tab.
  function backgroundGet(url) {
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
          { type: "jaix:fetch", url, method: "GET", credentials: "include" },
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
      } catch {
        return finish(null);
      }
      setTimeout(() => finish({ ok: false, status: 0, error: "worker timeout" }), TIMEOUT_MS);
    });
  }

  async function pageHtmlCharacter(id) {
    const url = "https://character.ai/character/" + encodeURIComponent(id);
    const reply = await backgroundGet(url);
    if (!reply || !reply.ok) return null;
    const text = s(reply.text) || (reply.body ? JSON.stringify(reply.body) : "");
    if (!text) return null;
    return H ? H.bestCharacter(H.embeddedObjects(text, KEYS, 8), KEYS) : null;
  }

  // Chat export uses the same auth header as the character read. The turns
  // endpoint is CORS-refused from the page in some builds, so the worker is the
  // first transport here, exactly as it is for the character POST.
  function backgroundGetAuth(url, auth) {
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
            headers: { Accept: "application/json", ...(auth ? { Authorization: auth } : {}) },
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

  async function pageGetAuth(url, auth) {
    try {
      const headers = { Accept: "application/json" };
      if (auth) headers.Authorization = auth;
      const res = await fetch(url, { credentials: "include", headers });
      const text = await res.text();
      let body = null;
      try {
        body = JSON.parse(text);
      } catch {}
      return { ok: res.ok, status: res.status, body, text };
    } catch (error) {
      return { ok: false, status: 0, error: String(error) };
    }
  }

  async function getJsonAuth(url, auth) {
    const viaWorker = await backgroundGetAuth(url, auth);
    if (viaWorker && viaWorker.ok && viaWorker.body) return viaWorker;
    const viaPage = await pageGetAuth(url, auth);
    if (viaPage && viaPage.ok && viaPage.body) return viaPage;
    return viaWorker && viaWorker.error ? viaWorker : viaPage;
  }

  // What the page itself already loaded. Same scoring as the other readers: the
  // object carrying the most known field names wins.
  const KEYS = [
    "name",
    "title",
    "description",
    "greeting",
    "definition",
    "external_id",
    "avatar_file_name",
    "participant__name",
  ];

  function harvested(id) {
    if (!H) return null;
    const found = H.bestCharacter(H.roots(KEYS), KEYS);
    if (!found) return null;
    if (id && found.external_id && found.external_id !== id) return null;
    return found;
  }

  function avatarUrl(c) {
    const file = s(c.avatar_file_name);
    if (file) return AVATAR_BASE + encodeURIComponent(file);
    return s(c.avatar_url) || s(c.avatar);
  }

  function normalizeCharacter(c) {
    const record = c && typeof c === "object" ? c : {};
    const name = s(record.name) || s(record.participant__name) || "Imported character";
    const title = s(record.title);
    const about = s(record.description);
    const definition = s(record.definition);
    // The title is the creator's one-line tagline; it has no field of its own, so
    // it rides on top of the About text the way the site displays it.
    const description = [title, about].filter(Boolean).join("\n\n");
    const greeting = s(record.greeting) || s(record.first_message) || s(record.first_mes);
    const alt = [
      ...new Set(
        (Array.isArray(record.alternate_greetings) ? record.alternate_greetings : [])
          .concat(Array.isArray(record.greetings) ? record.greetings : [])
          .map(s)
          .filter(Boolean),
      ),
    ].filter((message) => message !== greeting);
    const tags = [
      ...new Set(
        (Array.isArray(record.categories) ? record.categories : [])
          .concat(Array.isArray(record.tags) ? record.tags : [])
          .map((tag) => s(typeof tag === "string" ? tag : tag && (tag.name || tag.title)))
          .filter(Boolean),
      ),
    ];

    const card = {
      id: s(record.external_id) || s(record.id) || currentCharacterId() || "",
      name,
      creator: s(record.user__username) || s(record.creator) || "",
      avatarUrl: avatarUrl(record),
      nsfw: false,
      tags,
      fields: {
        description,
        personality: "",
        scenario: "",
        greeting,
        altGreetings: alt,
        // Character.ai's `definition` is free text the creator writes for the
        // model. It is the only place example dialogue appears, so it lands in
        // the example block rather than being thrown away.
        exampleDialogue: definition,
      },
      creatorNotes: s(record.creator_notes),
      systemPrompt: "",
      postHistoryInstructions: "",
      scriptRefs: [],
      lorebooks: [],
      failedLorebooks: 0,
      sourceLabel: "Character.AI card",
    };

    if (!definition) {
      card.hint =
        "Character.ai withholds this character's Definition unless its creator set Definition Visibility to public, so the example dialogue block is empty. Everything else is the record the site publishes.";
    }
    return card;
  }

  async function scanCharacter(opts = {}) {
    const id = s(opts.id) || currentCharacterId();
    if (!id) {
      const err = new Error("no-character");
      err.friendly =
        "Open a Character.ai character page first (its URL should look like character.ai/character/...).";
      throw err;
    }
    const onProgress = typeof opts.onProgress === "function" ? opts.onProgress : null;
    if (onProgress) onProgress("Reading Character.ai...");

    let record = null;
    let attempts = [];
    const auth = readAuthHeader();
    if (auth || readToken()) {
      const reply = await fetchCharacter(id);
      record = reply.character;
      attempts = reply.attempts;
    }
    if (!record) record = harvested(id);
    if (!record) {
      if (onProgress) onProgress("Reading the page record...");
      record = await pageHtmlCharacter(id);
    }
    if (!record) {
      const err = new Error("no-character");
      const trail = attempts.length
        ? " Tried: " + attempts.map((a) => a.label + " → " + (a.error || a.status || "no answer")).join("; ") + "."
        : "";
      err.friendly = auth || readToken()
        ? "Character.ai didn't return this character, and its page didn't carry the record either." + trail + " Reload the page, wait for it to finish loading, then scan again."
        : "Character.ai didn't hand over its sign-in token. Reload the character page (the extension reads the token from the page's own request) and scan again.";
      err.attempts = attempts;
      throw err;
    }
    return normalizeCharacter(record);
  }

  // ---- Chat export (the CAI Tools "save chat" feature) ---------------------
  //
  // The turns endpoint answers {turns:[...], meta:{next_token}}. Turns arrive
  // newest-first and each one carries a set of candidate replies; the primary
  // candidate is the one that was actually shown in the chat.

  function turnCandidates(turn) {
    if (!turn || typeof turn !== "object") return [];
    if (Array.isArray(turn.candidates)) return turn.candidates;
    if (turn.candidates && typeof turn.candidates === "object") return Object.values(turn.candidates);
    return [];
  }

  function turnText(turn) {
    const candidates = turnCandidates(turn);
    const primary =
      candidates.find((candidate) => candidate && candidate.candidate_id === turn.primary_candidate_id) ||
      candidates[0];
    return s(primary && (primary.text || primary.candidate_text || primary.value));
  }

  function sendDate(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return new Date(value > 1e12 ? value : value * 1000).toISOString();
    }
    const text = s(value);
    if (!text) return new Date().toISOString();
    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : text;
  }

  function simplifyTurns(turns) {
    const rows = [];
    const list = Array.isArray(turns) ? turns : [];
    for (const turn of list) {
      if (!turn || typeof turn !== "object") continue;
      const text = turnText(turn);
      if (!text) continue;
      const author = turn.author && typeof turn.author === "object" ? turn.author : {};
      rows.push({
        turn_id: s(turn.turn_key && turn.turn_key.turn_id) || s(turn.turn_id) || s(turn.id),
        name: s(author.name) || s(author.display_name) || (author.is_human ? "You" : ""),
        is_user: author.is_human === true || turn.is_human === true,
        send_date: sendDate(turn.create_time || turn.created_at || turn.update_time),
        mes: text,
      });
    }
    // The API returns newest first. Sorting by create_time is exact when the
    // timestamps are present; otherwise the only reliable order is the reverse
    // of the response.
    const allDated = rows.every((row) => /^\d{4}-\d{2}-\d{2}T/.test(row.send_date));
    if (allDated) rows.sort((a, b) => Date.parse(a.send_date) - Date.parse(b.send_date));
    else rows.reverse();
    return rows;
  }

  async function fetchAllTurns(chatId, auth, onProgress) {
    const base = "https://neo.character.ai/turns/" + encodeURIComponent(chatId) + "/";
    const turns = [];
    let nextToken = "";
    let pages = 0;
    do {
      const url = nextToken ? base + "?next_token=" + encodeURIComponent(nextToken) : base;
      const reply = await getJsonAuth(url, auth);
      if (!reply || !reply.ok) {
        const status = reply && reply.status;
        const err = new Error(status ? "http-" + status : "no-reply");
        err.status = status || 0;
        err.friendly =
          status === 401 || status === 403
            ? "Character.ai rejected the chat read (HTTP " + status + "). Reload the chat while signed in and try again."
            : "Character.ai didn't return this chat. Reload the chat page and try again.";
        throw err;
      }
      const body = reply.body || {};
      const batch = Array.isArray(body.turns) ? body.turns : [];
      turns.push(...batch);
      nextToken = s(body.meta && body.meta.next_token) || s(body.next_token);
      pages++;
      if (onProgress) onProgress("Reading chat... " + turns.length + " turns");
    } while (nextToken && pages < 60 && turns.length < 5000);
    return turns;
  }

  function chatSlug(name) {
    return (
      String(name || "chat")
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "") || "chat"
    );
  }

  function chatFiles(chatId, characterName, messages) {
    const base = chatSlug(characterName) + ".chat";
    const withNames = messages.map((message) => ({
      ...message,
      name: message.is_user ? "You" : message.name || characterName || "Character",
    }));
    // SillyTavern chat files open with one metadata line, then one message per
    // line. CAI Tools writes the same header, and a reader that expects it
    // otherwise treats the first message as the header and drops it.
    const header = JSON.stringify({
      user_name: "You",
      character_name: characterName || "Character",
      create_date: Date.now(),
    });
    const jsonl = [
      header,
      ...withNames.map((message) =>
        JSON.stringify({
          name: message.name,
          is_user: message.is_user,
          is_system: false,
          is_name: true,
          send_date: message.send_date,
          mes: message.mes,
          extra: { cai_turn_id: message.turn_id },
        }),
      ),
    ].join("\n");
    const json = JSON.stringify(
      {
        chat_id: chatId,
        character: characterName,
        exported_at: new Date().toISOString(),
        source: "character.ai",
        messages: withNames,
      },
      null,
      2,
    );
    const markdown = [
      "# " + (characterName || "Chat"),
      "",
      ...withNames.map(
        (message) =>
          "**" + message.name + ":**\n\n" + message.mes.replace(/\n/g, "\n\n") + "\n",
      ),
    ].join("\n");
    const definition = [
      "<START>",
      ...withNames.map(
        (message) => (message.is_user ? "{{user}}: " : "{{char}}: ") + message.mes.trim(),
      ),
    ].join("\n");
    // Text-generation-webui takes pairs of [user, character] messages. CAI Tools
    // drops whatever precedes the first user turn and merges repeats so the
    // array always starts on a user message.
    const merged = [];
    for (const message of withNames) {
      const last = merged[merged.length - 1];
      if (last && last.is_user === message.is_user) last.mes += "\n\n" + message.mes;
      else merged.push({ is_user: message.is_user, mes: message.mes });
    }
    const firstUser = merged.findIndex((message) => message.is_user);
    const pairs = [];
    for (let i = Math.max(0, firstUser); i + 1 < merged.length; i += 2) {
      pairs.push([merged[i].mes, merged[i + 1].mes]);
    }
    const ooba = JSON.stringify(
      { internal: pairs, visible: pairs, data: pairs, data_visible: pairs },
      null,
      2,
    );
    return [
      { name: base + ".jsonl", data: jsonl, mime: "application/jsonl" },
      { name: base + ".json", data: json, mime: "application/json" },
      { name: base + ".md", data: markdown, mime: "text/markdown" },
      { name: base + ".txt", data: definition, mime: "text/plain" },
      { name: base + ".ooba.json", data: ooba, mime: "application/json" },
    ];
  }

  async function exportChat(opts = {}) {
    const chatId = s(opts.chatId) || currentChatId();
    if (!chatId) {
      const err = new Error("no-chat");
      err.friendly =
        "Open a Character.ai chat first (its URL should look like character.ai/chat/...), then save the chat.";
      throw err;
    }
    const auth = readAuthHeader() || (readToken() ? "Token " + readToken() : "");
    if (!auth) {
      const err = new Error("no-token");
      err.friendly =
        "Character.ai didn't hand over its sign-in token. Reload the chat page (the extension reads the token from the page's own request) and try again.";
      throw err;
    }
    const onProgress = typeof opts.onProgress === "function" ? opts.onProgress : null;
    if (onProgress) onProgress("Reading chat...");
    const turns = await fetchAllTurns(chatId, auth, onProgress);
    const messages = simplifyTurns(turns);
    if (!messages.length) {
      const err = new Error("empty-chat");
      err.friendly = "This chat has no messages to save yet.";
      throw err;
    }
    const characterName = s(opts.characterName) || s(opts.card && opts.card.name) || "Character";
    return { chatId, messages, files: chatFiles(chatId, characterName, messages) };
  }

  NS.scraper = {
    currentCharacterId,
    currentChatId,
    readToken,
    readAuthHeader,
    fetchCharacter,
    fetchAllTurns,
    simplifyTurns,
    chatFiles,
    exportChat,
    harvested,
    pageHtmlCharacter,
    normalizeCharacter,
    scanCharacter,
    hint: "Reads the Character.ai record the page itself loads: name, tagline, About text, greeting, and the Definition when the creator made it public. On a chat page, Save chat exports the conversation as JSONL, JSON, Markdown and example dialogue.",
  };
})();
