// WyvernChat reader.
//
// Wyvern's public API speaks Tavern already: `personality`, `scenario`,
// `first_mes`, `mes_example`, `alternate_greetings`, `creator_notes`,
// `post_history_instructions`, and a lorebook entry shape that is almost
// SillyTavern's (`entry_id`, `keys`, `secondary_keys`, `content`, `constant`,
// `insertion_order`, `position`, `case_sensitive`, `whole_words_only`).
//
// Character URLs are /profiles/<creator>/characters/<slug>, where the slug can
// be the internal id (`_Ytaz4tYBerdx7zPzp14VD`) or a custom name (`eveline`).
// The API only resolves the id, so a custom slug is resolved out of the
// server-rendered page's flight payload first. The payload is also the fallback
// record when the API refuses a read.
(function () {
  "use strict";

  const NS = (window.JAIX = window.JAIX || {});
  const TIMEOUT_MS = 20000;

  const s = (v) => (typeof v === "string" ? v.trim() : "");
  const arrStr = (v) =>
    Array.isArray(v) ? v.map((x) => s(typeof x === "string" ? x : x && x.name)).filter(Boolean) : [];

  function currentSlugInfo() {
    if (typeof location === "undefined") return null;
    const m = location.pathname.match(/\/profiles\/([^/?#]+)\/characters\/([^/?#]+)/i);
    if (!m) return null;
    return { creator: decodeURIComponent(m[1]), slug: decodeURIComponent(m[2]) };
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
          { type: "jaix:fetch", url, method: "GET", headers: { Accept: "application/json" } },
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

  async function pageGet(url, accept) {
    try {
      const res = await fetch(url, {
        credentials: "include",
        headers: { Accept: accept || "application/json" },
      });
      const text = await res.text();
      let body = null;
      try {
        body = JSON.parse(text);
      } catch {}
      return { ok: res.ok, status: res.status, body, text };
    } catch (error) {
      return { ok: false, status: 0, error: "cors-or-network: " + String((error && error.message) || error) };
    }
  }

  async function getJson(url) {
    const viaPage = await pageGet(url);
    if (viaPage && viaPage.ok && viaPage.body) return viaPage;
    const viaWorker = await workerGet(url);
    if (viaWorker && viaWorker.ok && viaWorker.body) return viaWorker;
    return viaPage && viaPage.error ? viaPage : viaWorker;
  }

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

  function usefulRecord(value) {
    return (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (typeof value.name === "string" || typeof value.id === "string") &&
      ("personality" in value || "first_mes" in value || "description" in value)
    );
  }

  // The record is pushed as a JSON string inside the Next.js flight payload:
  // self.__next_f.push([1,"{\"id\":\"_bet...\",\"personality\":\"...\"}"])
  // Parsing the push argument as JSON gives the decoded chunk, so no hand-rolled
  // unescaping is needed and newlines inside the record stay valid JSON escapes.
  function flightPayload(html) {
    const chunks = [];
    const source = String(html || "");
    for (const match of source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
      const body = match[1].trim();
      if (!body) continue;
      if (body.startsWith("self.__next_f.push(")) {
        const arg = body.slice("self.__next_f.push(".length).replace(/\)\s*;?\s*$/, "");
        try {
          const parsed = JSON.parse(arg);
          if (Array.isArray(parsed) && typeof parsed[1] === "string") chunks.push(parsed[1]);
        } catch {}
      } else if (/^application\/(ld\+)?json$/i.test((match[0].match(/type="([^"]+)"/i) || [])[1] || "")) {
        chunks.push(body);
      }
    }
    return chunks.join("\n");
  }

  function recordFromHtml(html) {
    const decoded = flightPayload(html) || String(html || "");
    let at = -1;
    while ((at = decoded.indexOf('{"id":"_', at + 1)) >= 0) {
      const candidate = braceMatch(decoded, at);
      if (!candidate) continue;
      try {
        const parsed = JSON.parse(candidate);
        if (usefulRecord(parsed)) return parsed;
      } catch {}
    }
    // Some payloads are already unescaped.
    at = -1;
    while ((at = decoded.indexOf('{"id":"', at + 1)) >= 0) {
      const candidate = braceMatch(decoded, at);
      if (!candidate) continue;
      try {
        const parsed = JSON.parse(candidate);
        if (usefulRecord(parsed)) return parsed;
      } catch {}
    }
    return null;
  }

  function idFromHtml(html, record) {
    if (record && record.id) return s(record.id);
    const text = String(html || "");
    const escaped = text.match(/\\"id\\":\\"(_[A-Za-z0-9]{8,40})\\"/);
    if (escaped) return escaped[1];
    const plain = text.match(/"id":"(_[A-Za-z0-9]{8,40})"/);
    return plain ? plain[1] : "";
  }

  async function fetchPageHtml() {
    if (typeof location === "undefined") return "";
    const reply = await pageGet(location.href, "text/html");
    if (reply && reply.ok && reply.text) return reply.text;
    const viaWorker = await workerGet(location.href);
    return (viaWorker && viaWorker.ok && viaWorker.text) || "";
  }

  async function fetchCharacterById(id) {
    const reply = await getJson("/api/characters/" + encodeURIComponent(id));
    if (!reply || !reply.ok) return null;
    const body = reply.body;
    if (!body || typeof body !== "object") return null;
    return body.character && typeof body.character === "object" ? body.character : body;
  }

  function normalizeEntry(entry) {
    if (!entry || typeof entry !== "object") return { keys: [], content: "", comment: "" };
    const keys = [...new Set(arrStr(entry.keys).concat(arrStr(entry.key), arrStr(entry.keywords)))];
    const secondary = [
      ...new Set(arrStr(entry.secondary_keys).concat(arrStr(entry.keysecondary))),
    ].filter((key) => !keys.includes(key));
    return {
      keys,
      secondaryKeys: secondary,
      content: s(entry.content) || s(entry.entry) || s(entry.text),
      comment: s(entry.comment) || s(entry.name) || s(entry.title),
      constant: !!entry.constant,
      selective: entry.selective !== false && entry.enabled !== false,
      enabled: entry.enabled !== false,
      insertionOrder: Number.isFinite(entry.insertion_order) ? entry.insertion_order : undefined,
      position: s(entry.position),
      priority: Number.isFinite(entry.priority) ? entry.priority : undefined,
      probability: Number.isFinite(entry.probability) ? entry.probability : undefined,
      caseSensitive: entry.case_sensitive === true,
      wholeWords: entry.whole_words_only === true,
      extensions: entry.extensions && typeof entry.extensions === "object" ? entry.extensions : undefined,
    };
  }

  function normalizeBook(book, fallbackName) {
    if (!book || typeof book !== "object") return null;
    const entries = Array.isArray(book.entries)
      ? book.entries
      : Array.isArray(book.lorebook_entries)
        ? book.lorebook_entries
        : [];
    const clean = entries.map(normalizeEntry).filter((entry) => entry.content);
    if (!clean.length) return null;
    return {
      name: s(book.name) || fallbackName || "Lorebook",
      description: s(book.description),
      entries: clean,
    };
  }

  function creatorFrom(record) {
    const c = record.creator && typeof record.creator === "object" ? record.creator : {};
    return (
      s(c.vanityUrl) ||
      s(c.username) ||
      s(c.displayName) ||
      s(c.name) ||
      s(c.uid) ||
      s(record.creator_uid) ||
      s(record.creator)
    );
  }

  function distinctParagraphs(parts) {
    const seen = new Set();
    return parts
      .map(s)
      .filter(Boolean)
      .filter((part) => {
        const key = part.toLowerCase().replace(/\s+/g, " ").trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .join("\n\n");
  }

  function normalizeCharacter(record, books) {
    record = record && typeof record === "object" ? record : {};
    const greeting = s(record.first_mes) || s(record.first_message);
    // `greetings` is the advanced-greeting list. A `default` entry is the
    // opening message itself, not an alternate, so it is left out.
    const advanced = Array.isArray(record.greetings)
      ? record.greetings
          .filter((item) => item && item.id !== "default")
          .map((item) => s(item.content))
          .filter(Boolean)
      : [];
    const alt = [
      ...new Set(
        (Array.isArray(record.alternate_greetings) ? record.alternate_greetings : [])
          .concat(advanced)
          .map(s)
          .filter(Boolean),
      ),
    ].filter((g) => g !== greeting);
    const characterNote = s(record.character_note);
    const card = {
      id: s(record.id) || s(record._id),
      name: s(record.name) || "Imported character",
      creator: creatorFrom(record),
      avatarUrl: s(record.avatar),
      nsfw: ["mature", "explicit", "nsfw"].includes(String(record.rating || "").toLowerCase()) || !!record.is_nsfw,
      tags: [...new Set([...arrStr(record.tags), ...arrStr(record.community_tags)])],
      fields: {
        description: distinctParagraphs([record.description, record.visual_description]),
        personality: s(record.personality),
        scenario: s(record.scenario),
        greeting,
        altGreetings: alt,
        exampleDialogue: s(record.mes_example),
      },
      creatorNotes: s(record.creator_notes),
      // Wyvern's editor calls `pre_history_instructions` the System Prompt and
      // `post_history_instructions` the Final Instructions; its own V2 export
      // writes them to those two card fields. Follow the site's mapping.
      systemPrompt: s(record.pre_history_instructions) || s(record.system_prompt),
      postHistoryInstructions: s(record.post_history_instructions),
      // The depth prompt has no top-level slot in a V2 card. Wyvern's exporter
      // puts it in `extensions.depth_prompt`; SillyTavern reads it there.
      extensions: characterNote
        ? { depth_prompt: { prompt: characterNote, depth: 4 } }
        : {},
      tagline: s(record.tagline),
      scriptRefs: [],
      lorebooks: (books || []).filter(Boolean),
      failedLorebooks: 0,
      sourceLabel: "WyvernChat card",
    };
    if (!card.fields.personality && !card.fields.scenario && !card.fields.exampleDialogue) {
      card.hint =
        "Wyvern returned this character without its personality, scenario or example block. Only the fields the creator filled in are present.";
    }
    return card;
  }

  async function fetchLorebooks(characterId) {
    if (!characterId) return { books: [], failed: 0 };
    const reply = await getJson("/api/lorebooks/character/" + encodeURIComponent(characterId));
    if (!reply || !reply.ok) return { books: [], failed: 1 };
    const list = Array.isArray(reply.body)
      ? reply.body
      : reply.body && Array.isArray(reply.body.lorebooks)
        ? reply.body.lorebooks
        : reply.body && Array.isArray(reply.body.data)
          ? reply.body.data
          : [];
    const books = [];
    let failed = 0;
    for (const raw of list) {
      const book = normalizeBook(raw, "Lorebook");
      if (book) books.push(book);
      else if (raw && Array.isArray(raw.lorebooks)) {
        for (const inner of raw.lorebooks) {
          const nested = normalizeBook(inner, raw.name || "Lorebook");
          if (nested) books.push(nested);
        }
      } else failed++;
    }
    return { books, failed };
  }

  async function scanCharacter(opts = {}) {
    const info = currentSlugInfo();
    const slug = s(opts.slug) || (info && info.slug) || "";
    if (!slug) {
      const err = new Error("no-character");
      err.friendly =
        "Open a WyvernChat character page first (its URL should look like app.wyvern.chat/profiles/creator/characters/name).";
      throw err;
    }
    const onProgress = typeof opts.onProgress === "function" ? opts.onProgress : null;
    if (onProgress) onProgress("Reading WyvernChat...");

    let record = null;
    let html = "";
    if (/^_[A-Za-z0-9]{8,}$/.test(slug)) {
      record = await fetchCharacterById(slug);
    }
    if (!record) {
      html = await fetchPageHtml();
      const fromHtml = recordFromHtml(html);
      const id = idFromHtml(html, fromHtml);
      if (id && (!fromHtml || fromHtml.id !== id)) record = await fetchCharacterById(id);
      if (!record) record = fromHtml;
    }
    if (!record) {
      const err = new Error("no-character");
      err.friendly =
        "WyvernChat didn't return this character. Reload the profile page, wait for it to finish loading, then scan again. If the character is private, open it while signed in.";
      throw err;
    }

    let books = [];
    let failed = 0;
    if (opts.deep) {
      if (onProgress) onProgress("Fetching lorebooks...");
      const fetched = await fetchLorebooks(s(record.id) || s(record._id));
      books = fetched.books;
      failed = fetched.failed;
      // A record can arrive with full books already attached; use them when the
      // dedicated endpoint returned nothing.
      if (!books.length && Array.isArray(record.lorebooks)) {
        books = record.lorebooks.map((book) => normalizeBook(book, "Lorebook")).filter(Boolean);
      }
    }
    const card = normalizeCharacter(record, books);
    card.failedLorebooks = failed;
    if (failed) {
      card.note =
        failed + (failed === 1 ? " lorebook could not be read." : " lorebooks could not be read.");
    }
    return card;
  }

  NS.scraper = {
    currentSlugInfo,
    recordFromHtml,
    idFromHtml,
    fetchCharacterById,
    fetchLorebooks,
    normalizeCharacter,
    normalizeEntry,
    normalizeBook,
    scanCharacter,
    hint: "Reads WyvernChat's card definition and, on Deep scan, every lorebook attached to the character.",
  };
})();
