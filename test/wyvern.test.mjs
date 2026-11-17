import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "src", "wyvern.js"), "utf8");
const win = {};
new Function("window", src)(win);
const W = win.JAIX.scraper;

const record = () => ({
  id: "_betNAbaHXWajxVG2jCw6h",
  _id: "_betNAbaHXWajxVG2jCw6h",
  name: "Princess Eveline Marceau",
  avatar: "https://imagedelivery.net/example/public",
  rating: "none",
  tags: ["Female", "Fantasy"],
  community_tags: [{ name: "Royalty" }],
  creator: { uid: "rs9Uom", vanityUrl: "HippoJr", displayName: "HippoJr" },
  description: "A princess with a secret.",
  visual_description: "Silver hair and a green gown.",
  personality: "Proud but kind.",
  scenario: "The palace garden at dusk.",
  first_mes: "*she turns* You're late.",
  alternate_greetings: ["*waits* Finally."],
  greetings: [
    { id: "default", content: "*she turns* You're late." },
    { id: "g2", content: "*laughs* You made it." },
  ],
  mes_example: "<START>\n{{user}}: Hello\n{{char}}: Hello.",
  creator_notes: "A slow-burn royal romance.",
  pre_history_instructions: "Never reveal her private thoughts.",
  post_history_instructions: "",
  character_note: "Speak with formal court diction.",
  system_prompt: "",
  lorebooks: [{ id: "_FjWnd6fXwx4T7eM3XYKHt" }],
});

const book = () => ({
  id: "_FjWnd6fXwx4T7eM3XYKHt",
  name: "The Garden",
  description: "Palace lore",
  entries: [
    {
      entry_id: "r-nL5",
      keys: ["garden", "rose"],
      secondary_keys: ["palace"],
      content: "The garden blooms only at night.",
      comment: "Night garden",
      constant: false,
      enabled: true,
      insertion_order: 3,
      position: "after_char",
      priority: 7,
      case_sensitive: false,
      whole_words_only: true,
      extensions: { depth: 4 },
    },
  ],
});

test("recordFromHtml parses the escaped Next flight payload", () => {
  const payload = record();
  const html = `<html><script>self.__next_f.push(${JSON.stringify([1, JSON.stringify(payload)])})</script></html>`;
  const found = W.recordFromHtml(html);
  assert.equal(found.id, payload.id);
  assert.equal(found.name, payload.name);
  assert.equal(found.first_mes, payload.first_mes);
  assert.equal(found.description, payload.description);
});

test("recordFromHtml keeps newlines inside the record", () => {
  const payload = { ...record(), description: "Line one.\n\nLine two." };
  const html = `<script>self.__next_f.push(${JSON.stringify([1, JSON.stringify(payload)])})</script>`;
  const found = W.recordFromHtml(html);
  assert.equal(found.description, "Line one.\n\nLine two.");
});

test("idFromHtml reads the escaped id when there is no parsed record", () => {
  const html = '<script>self.__next_f.push([1,"{\\"id\\":\\"_betNAbaHXWajxVG2jCw6h\\"}"])</script>';
  assert.equal(W.idFromHtml(html, null), "_betNAbaHXWajxVG2jCw6h");
});

test("normalizeCharacter maps the Wyvern record onto the card shape", () => {
  const card = W.normalizeCharacter(record(), [W.normalizeBook(book(), "Lorebook")]);
  assert.equal(card.name, "Princess Eveline Marceau");
  assert.equal(card.creator, "HippoJr");
  assert.equal(card.avatarUrl, "https://imagedelivery.net/example/public");
  assert.equal(card.fields.description, "A princess with a secret.\n\nSilver hair and a green gown.");
  assert.equal(card.fields.personality, "Proud but kind.");
  assert.equal(card.fields.scenario, "The palace garden at dusk.");
  assert.equal(card.fields.greeting, "*she turns* You're late.");
  assert.deepEqual(card.fields.altGreetings, ["*waits* Finally.", "*laughs* You made it."]);
  assert.match(card.fields.exampleDialogue, /\{\{char\}\}: Hello/);
  assert.equal(card.creatorNotes, "A slow-burn royal romance.");
  assert.equal(card.systemPrompt, "Never reveal her private thoughts.");
  assert.equal(card.postHistoryInstructions, "");
  assert.deepEqual(card.extensions.depth_prompt, {
    prompt: "Speak with formal court diction.",
    depth: 4,
  });
  assert.deepEqual(card.tags, ["Female", "Fantasy", "Royalty"]);
  assert.equal(card.lorebooks.length, 1);
  assert.equal(card.lorebooks[0].entries.length, 1);
});

test("normalizeBook keeps Wyvern's SillyTavern entry fields", () => {
  const normalized = W.normalizeBook(book(), "Lorebook");
  const entry = normalized.entries[0];
  assert.deepEqual(entry.keys, ["garden", "rose"]);
  assert.deepEqual(entry.secondaryKeys, ["palace"]);
  assert.equal(entry.comment, "Night garden");
  assert.equal(entry.insertionOrder, 3);
  assert.equal(entry.position, "after_char");
  assert.equal(entry.priority, 7);
  assert.equal(entry.wholeWords, true);
  assert.deepEqual(entry.extensions, { depth: 4 });
});

test("scanCharacter resolves an id slug through the API and fetches lorebooks", async () => {
  const oldLocation = globalThis.location;
  const oldFetch = globalThis.fetch;
  const oldChrome = globalThis.chrome;
  const calls = [];
  globalThis.location = { pathname: "/profiles/HippoJr/characters/_betNAbaHXWajxVG2jCw6h", href: "https://app.wyvern.chat/profiles/HippoJr/characters/_betNAbaHXWajxVG2jCw6h" };
  globalThis.chrome = undefined;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes("/api/lorebooks/character/")) {
      return new Response(JSON.stringify([book()]), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (String(url).includes("/api/characters/")) {
      return new Response(JSON.stringify(record()), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("not found", { status: 404 });
  };
  try {
    const card = await W.scanCharacter({ deep: true });
    assert.equal(card.name, "Princess Eveline Marceau");
    assert.equal(card.lorebooks.length, 1);
    assert.equal(card.lorebooks[0].name, "The Garden");
    assert.ok(calls.some((url) => url.includes("/api/characters/_betNAbaHXWajxVG2jCw6h")));
    assert.ok(calls.some((url) => url.includes("/api/lorebooks/character/_betNAbaHXWajxVG2jCw6h")));
  } finally {
    if (oldLocation === undefined) delete globalThis.location;
    else globalThis.location = oldLocation;
    globalThis.fetch = oldFetch;
    if (oldChrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = oldChrome;
  }
});

test("currentSlugInfo decodes the creator and slug", () => {
  const old = globalThis.location;
  try {
    globalThis.location = { pathname: "/profiles/HippoJr/characters/eveline" };
    assert.deepEqual(W.currentSlugInfo(), { creator: "HippoJr", slug: "eveline" });
    globalThis.location = { pathname: "/explore" };
    assert.equal(W.currentSlugInfo(), null);
  } finally {
    if (old === undefined) delete globalThis.location;
    else globalThis.location = old;
  }
});
