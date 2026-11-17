// Chub.ai / Venus.chub.ai reader.
//
// Chub is a card-first site: the public record already speaks Tavern. The API
// answers one object for a character and one for each lorebook it links to, and
// the `definition` block uses the same field names a V2 card does. This reader
// therefore renames almost nothing; it normalises the lorebook entries (Chub
// stores them inside `embedded_lorebook`) and deduplicates a linked book when
// the same entries are already embedded in the character.
//
// The character endpoint is not CORS-enabled (measured: no
// Access-Control-Allow-Origin from chub.ai), so the extension worker performs
// the read under the manifest host permission. The lorebook endpoint does send
// `*`, which is why either transport can be used there.
(function () {
  "use strict";

  const NS = (window.JAIX = window.JAIX || {});
  const TIMEOUT_MS = 20000;
  const API = "https://api.chub.ai";

  const s = (v) => (typeof v === "string" ? v.trim() : "");
  const arrStr = (v) =>
    Array.isArray(v) ? v.map((x) => s(typeof x === "string" ? x : x && x.name)).filter(Boolean) : [];

  // /characters/<creator>/<slug>, /characters/<id>/<slug>, and the numeric-id
  // form /characters/<id> all address the same record. Venus.chub.ai serves the
  // same SPA and the same paths, so one reader covers both hosts.
  function currentFullPath() {
    if (typeof location === "undefined") return null;
    const m = location.pathname.match(/\/characters\/([^/?#]+)(?:\/([^/?#]+))?/i);
    if (!m) return null;
    return m[2] ? m[1] + "/" + m[2] : m[1];
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
            headers: { Accept: "application/json", "Content-Type": "application/json" },
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

  async function pageGet(url) {
    try {
      const res = await fetch(url, {
        credentials: "include",
        headers: { Accept: "application/json" },
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

  // Worker first: the character endpoint has no CORS headers. The page request
  // is kept as a fallback for the day Chub adds them, and because the lorebook
  // endpoint already allows the page origin.
  async function getJson(url) {
    const viaWorker = await workerGet(url);
    if (viaWorker && viaWorker.ok && viaWorker.body) return viaWorker;
    const viaPage = await pageGet(url);
    if (viaPage && viaPage.ok && viaPage.body) return viaPage;
    return viaWorker && viaWorker.error ? viaWorker : viaPage;
  }

  function normalizeEntry(entry) {
    if (!entry || typeof entry !== "object") return { keys: [], content: "", comment: "" };
    const keys = [
      ...new Set(arrStr(entry.keys).concat(arrStr(entry.key), arrStr(entry.keywords))),
    ];
    const secondary = [
      ...new Set(arrStr(entry.secondary_keys).concat(arrStr(entry.keysecondary))),
    ].filter((key) => !keys.includes(key));
    return {
      keys,
      secondaryKeys: secondary,
      content: s(entry.content) || s(entry.entry) || s(entry.text),
      comment: s(entry.comment) || s(entry.name) || s(entry.title),
      constant: !!entry.constant,
      selective: entry.selective !== false,
      enabled: entry.enabled !== false,
      insertionOrder: Number.isFinite(entry.insertion_order) ? entry.insertion_order : undefined,
      position: s(entry.position),
      priority: Number.isFinite(entry.priority) ? entry.priority : undefined,
      probability: Number.isFinite(entry.probability) ? entry.probability : undefined,
      caseSensitive: entry.case_sensitive === true,
      extensions: entry.extensions && typeof entry.extensions === "object" ? entry.extensions : undefined,
    };
  }

  function bookFrom(container, fallbackName) {
    if (!container) return null;
    const entries = Array.isArray(container.entries) ? container.entries : [];
    const clean = entries.map(normalizeEntry).filter((entry) => entry.content);
    if (!clean.length) return null;
    return {
      name: s(container.name) || fallbackName || "Lorebook",
      description: s(container.description),
      entries: clean,
    };
  }

  function lorebookFromNode(payload, fallbackName) {
    if (!payload || typeof payload !== "object") return null;
    const node = payload.node || payload.character || payload.data || payload;
    const def = node.definition && typeof node.definition === "object" ? node.definition : node;
    return (
      bookFrom(def.embedded_lorebook, node.name || fallbackName) ||
      bookFrom(def, node.name || fallbackName) ||
      bookFrom(node.embedded_lorebook, node.name || fallbackName)
    );
  }

  function entrySignature(book) {
    return (book.entries || [])
      .map((entry) => (entry.keys || []).join(",") + "\u0000" + entry.content)
      .join("\u0001");
  }

  async function fetchRelatedLorebooks(node, def, embedded, onProgress) {
    const ids = [
      ...new Set(
        [
          ...(Array.isArray(node.related_lorebooks) ? node.related_lorebooks : []),
          ...(Array.isArray(def.extensions && def.extensions.chub && def.extensions.chub.related_lorebooks)
            ? def.extensions.chub.related_lorebooks
            : []),
        ]
          .map((id) => (id && typeof id === "object" ? id.id : id))
          .filter((id) => Number(id) > 0),
      ),
    ];
    const books = [];
    let failed = 0;
    let done = 0;
    for (const id of ids) {
      if (onProgress) onProgress("Fetching lorebook " + ++done + "/" + ids.length + "...");
      const reply = await getJson(API + "/api/lorebooks/" + encodeURIComponent(id) + "?full=true");
      const book = reply && reply.ok ? lorebookFromNode(reply.body, "Lorebook " + id) : null;
      if (!book) {
        failed++;
        continue;
      }
      if (embedded && entrySignature(book) === entrySignature(embedded)) continue;
      books.push(book);
    }
    return { books, failed };
  }

  function creatorFrom(node) {
    const fullPath = s(node.fullPath) || s(node.full_path);
    if (fullPath.includes("/")) return fullPath.split("/")[0];
    if (node.creator && typeof node.creator === "object") {
      return s(node.creator.username) || s(node.creator.name) || s(node.creator.display_name);
    }
    return s(node.creatorId) || s(node.creator_id);
  }

  function combinePersonality(def) {
    const parts = [s(def.personality)];
    const summary = s(def.tavern_personality);
    // Chub stores a short "tavern personality" beside the long personality
    // text. It is complementary in every record sampled, but a fork can repeat
    // the same paragraph, so an exact echo is dropped rather than exported twice.
    if (summary && !parts[0].toLowerCase().includes(summary.toLowerCase())) parts.push(summary);
    return parts.filter(Boolean).join("\n\n");
  }

  function normalizeCharacter(node, def, options = {}) {
    node = node && typeof node === "object" ? node : {};
    def = def && typeof def === "object" ? def : node;
    const description = s(def.description) || s(node.description);
    const greeting = s(def.first_message) || s(def.first_mes);
    const alt = Array.isArray(def.alternate_greetings) ? def.alternate_greetings.map(s).filter(Boolean) : [];
    const card = {
      id: s(node.fullPath) || String(node.id || ""),
      name: s(def.name) || s(node.name) || "Imported character",
      creator: creatorFrom(node),
      avatarUrl: s(def.avatar) || s(node.avatar_url) || s(node.avatar),
      nsfw: !!node.nsfw_image || node.rating === "explicit",
      tags: [...new Set(arrStr(node.topics))],
      fields: {
        description,
        personality: combinePersonality(def),
        scenario: s(def.scenario),
        greeting,
        altGreetings: alt.filter((g) => g !== greeting),
        exampleDialogue: s(def.example_dialogs) || s(def.mes_example),
      },
      creatorNotes: "",
      systemPrompt: s(def.system_prompt),
      postHistoryInstructions: s(def.post_history_instructions),
      tagline: s(node.tagline),
      scriptRefs: [],
      lorebooks: [],
      failedLorebooks: 0,
      sourceLabel: options.venus ? "Venus.chub.ai card" : "Chub.ai card",
    };
    if (!description && !card.fields.personality && !card.fields.scenario && !greeting) {
      card.hint =
        "This Chub listing publishes no card definition. The site shows only its tagline and topics, so there is nothing more to copy.";
    } else if (!card.fields.personality && !card.fields.exampleDialogue && !card.fields.scenario) {
      card.hint =
        "Chub returned this character without a personality, scenario or example block. Only the fields the creator filled in are present.";
    }
    return card;
  }

  async function fetchCharacter(fullPath) {
    const url = API + "/api/characters/" + encodeURIComponent(fullPath).replace(/%2F/g, "/") + "?full=true";
    const reply = await getJson(url);
    if (!reply) {
      const err = new Error("no-reply");
      err.friendly = "The extension couldn't reach Chub. Reload the page and try again.";
      throw err;
    }
    if (!reply.ok) {
      const err = new Error("http-" + (reply.status || 0));
      err.status = reply.status || 0;
      if (reply.status === 404) {
        err.friendly = "Chub couldn't find that character. It may be private, deleted, or the URL is not a character page.";
      } else if (reply.status === 401 || reply.status === 403) {
        err.friendly =
          "Chub rejected the read (HTTP " +
          reply.status +
          "). Make sure you're signed in and can open this character, then reload the page.";
      } else {
        err.friendly = "Chub answered HTTP " + (reply.status || 0) + ". Reload the page and try again.";
      }
      throw err;
    }
    const node = reply.body && (reply.body.node || reply.body.character || reply.body.data);
    if (!node || typeof node !== "object") {
      const err = new Error("no-character");
      err.friendly =
        "Chub answered without a character record. The listing may be private or the page may still be loading.";
      throw err;
    }
    return node;
  }

  async function scanCharacter(opts = {}) {
    const fullPath = s(opts.fullPath) || currentFullPath();
    if (!fullPath) {
      const err = new Error("no-character");
      err.friendly =
        "Open a Chub character page first (its URL should look like chub.ai/characters/creator/name).";
      throw err;
    }
    const onProgress = typeof opts.onProgress === "function" ? opts.onProgress : null;
    if (onProgress) onProgress("Reading Chub...");
    const node = await fetchCharacter(fullPath);
    const def = node.definition && typeof node.definition === "object" ? node.definition : node;
    const card = normalizeCharacter(node, def, { venus: /(^|\.)venus\.chub\.ai$/i.test(location.hostname) });

    if (opts.deep) {
      const embedded = bookFrom(def.embedded_lorebook, card.name + " lorebook");
      if (embedded) card.lorebooks.push(embedded);
      const related = await fetchRelatedLorebooks(node, def, embedded, onProgress);
      card.lorebooks.push(...related.books);
      card.failedLorebooks = related.failed;
      if (related.failed) {
        card.note =
          related.failed +
          (related.failed === 1 ? " linked lorebook could not be read." : " linked lorebooks could not be read.");
      }
    }
    return card;
  }

  NS.scraper = {
    currentFullPath,
    fetchCharacter,
    normalizeCharacter,
    normalizeEntry,
    lorebookFromNode,
    scanCharacter,
    hint: "Reads Chub's public card definition and, on Deep scan, the embedded and linked lorebooks. Works on Chub.ai and Venus.chub.ai.",
  };
})();
