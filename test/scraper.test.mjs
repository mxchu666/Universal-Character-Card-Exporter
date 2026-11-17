import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "src", "scraper.js"), "utf8");
const win = {};
new Function("window", src)(win);
const S = win.JAIX.scraper;

test("removes standalone creator attribution without removing nearby prose", () => {
  const input = [
    "**Created by @storyweaver**",
    "",
    "A court historian with a dangerous secret.",
    "",
    "The archive was created by the old gods.",
  ].join("\n");
  assert.equal(
    S.stripAttributionBoilerplate(input, "storyweaver"),
    [
      "A court historian with a dangerous secret.",
      "",
      "The archive was created by the old gods.",
    ].join("\n"),
  );
});

test("matches the source creator name while preserving unrelated bylines", () => {
  assert.equal(S.stripAttributionBoilerplate("Creator: Story Weaver\nGuarded.", "Story Weaver"), "Guarded.");
  assert.equal(S.stripAttributionBoilerplate("Written by: Story Weaver\nGuarded.", "Story Weaver"), "Guarded.");
  assert.equal(S.stripAttributionBoilerplate("By moonlight, the gate opens.", "Story Weaver"), "By moonlight, the gate opens.");
  assert.equal(S.stripAttributionBoilerplate("Created by another person.", "Story Weaver"), "Created by another person.");
});

test("removes an attribution-only HTML paragraph without flattening the rest", () => {
  assert.equal(
    S.stripAttributionBoilerplate(
      "<p><strong>Created by &#64;storyweaver</strong></p><p>A royal historian.</p>",
      "storyweaver",
    ),
    "<p>A royal historian.</p>",
  );
});

test("normalizeCharacter cleans every prompt field but keeps creator metadata", () => {
  const card = S.normalizeCharacter({
    id: "c1",
    name: "Aveline",
    creator_name: "storyweaver",
    description: "Created by @storyweaver\nA royal historian.",
    personality: "Creator: storyweaver\nQuiet and precise.",
    scenario: "Made by storyweaver\nThe archive after midnight.",
    first_message: "Written by storyweaver\nYou are late.",
    first_messages: [
      "Written by storyweaver\nYou are late.",
      "Created by @storyweaver\nThe door is open.",
    ],
    example_dialogs: "Author: storyweaver\n{{char}}: Sit down.",
    scripts: [
      {
        id: "l1",
        type: "lorebook",
        title: "Archive",
        description: "Created by storyweaver\nCourt records.",
      },
    ],
  });

  assert.equal(card.creator, "storyweaver");
  assert.equal(card.fields.description, "A royal historian.");
  assert.equal(card.fields.personality, "Quiet and precise.");
  assert.equal(card.fields.scenario, "The archive after midnight.");
  assert.equal(card.fields.greeting, "You are late.");
  assert.deepEqual(card.fields.altGreetings, ["The door is open."]);
  assert.equal(card.fields.exampleDialogue, "{{char}}: Sit down.");
  assert.equal(card.scriptRefs[0].description, "Court records.");
});

test("normalizeEntry removes attribution from lorebook memory text", () => {
  const entry = S.normalizeEntry(
    {
      keys: [" archive ", "archive", ""],
      name: "Records",
      content: "© storyweaver\nThe west archive is locked after dusk.",
    },
    "storyweaver",
  );
  assert.deepEqual(entry.keys, ["archive"]);
  assert.equal(entry.content, "The west archive is locked after dusk.");
});

test("normalizeCharacter tolerates empty input and removes duplicate values", () => {
  const empty = S.normalizeCharacter(null);
  assert.equal(empty.name, "Imported character");
  assert.deepEqual(empty.tags, []);
  assert.deepEqual(empty.fields.altGreetings, []);

  const card = S.normalizeCharacter({
    name: "Aveline",
    first_message: "Hello.",
    first_messages: ["Hello.", "Come in.", "Come in."],
    tags: [" fantasy ", { name: "court" }],
    custom_tags: ["fantasy", { name: " court " }],
  });
  assert.deepEqual(card.fields.altGreetings, ["Come in."]);
  assert.deepEqual(card.tags, ["fantasy", "court"]);
});

test("readBearer reassembles unpadded base64url session chunks", () => {
  const hadLocalStorage = Object.hasOwn(globalThis, "localStorage");
  const hadDocument = Object.hasOwn(globalThis, "document");
  const oldLocalStorage = globalThis.localStorage;
  const oldDocument = globalThis.document;
  const encoded = Buffer.from(JSON.stringify({ access_token: "token-123" })).toString(
    "base64url",
  );
  const midpoint = Math.floor(encoded.length / 2);
  const values = {
    "sb-preview-auth-token.0": "base64-" + encoded.slice(0, midpoint),
    "sb-preview-auth-token.1": encoded.slice(midpoint),
  };
  globalThis.localStorage = {
    ...values,
    getItem(key) {
      return values[key] || null;
    },
  };
  globalThis.document = { cookie: "" };

  try {
    assert.equal(S.readBearer(), "token-123");
  } finally {
    if (hadLocalStorage) globalThis.localStorage = oldLocalStorage;
    else delete globalThis.localStorage;
    if (hadDocument) globalThis.document = oldDocument;
    else delete globalThis.document;
  }
});

test("recordFromText extracts the character from a Next flight payload", () => {
  const record = {
    id: "b2d5e572-da25-4156-91e6-c20fbdfe1aa7",
    name: "Ayato Hiroshi",
    description: "A cold prince.",
    personality: "Reserved and calculating.",
    scenario: "The winter court.",
    first_message: "You may approach.",
    example_dialogs: "{{char}}: State your business.",
    allow_proxy: true,
    showdefinition: true,
  };
  const wrapper = { pageProps: { character: record } };
  const text = "prefix " + JSON.stringify(wrapper) + " suffix";
  const found = S.recordFromText(text, record.id);
  assert.equal(found.name, "Ayato Hiroshi");
  assert.equal(found.personality, "Reserved and calculating.");
  assert.equal(found.first_message, "You may approach.");
});

test("recordFromText ignores a name-only object", () => {
  const text = '{"name":"Index","items":[1,2,3]}';
  assert.equal(S.recordFromText(text, "abc"), null);
});

test("normalizeCharacter records whether the definition was published", () => {
  const hidden = S.normalizeCharacter({
    id: "c1",
    name: "Aveline",
    description: "A royal historian.",
    showdefinition: false,
  });
  assert.equal(hidden.definitionMeta.showdefinition, false);
  assert.equal(hidden.definitionMeta.hasDefinition, false);

  const shown = S.normalizeCharacter({
    id: "c2",
    name: "Aveline",
    description: "A royal historian.",
    personality: "Quiet.",
    showdefinition: true,
  });
  assert.equal(shown.definitionMeta.showdefinition, true);
  assert.equal(shown.definitionMeta.hasDefinition, true);
  assert.equal(shown.definitionMeta.source, "api");
});

test("normalizeEntry accepts the legacy and world-info key shapes", () => {
  const entry = S.normalizeEntry({
    key: [" archive ", "archive"],
    keysecondary: ["records"],
    entry: "The west archive is locked after dusk.",
    title: "Archive",
    constant: "true",
    enabled: false,
    insertion_order: 4,
    whole_words_only: true,
  }, "storyweaver");
  assert.deepEqual(entry.keys, ["archive"]);
  assert.deepEqual(entry.secondaryKeys, ["records"]);
  assert.equal(entry.content, "The west archive is locked after dusk.");
  assert.equal(entry.comment, "Archive");
  assert.equal(entry.constant, true);
  assert.equal(entry.enabled, false);
  assert.equal(entry.selective, false);
  assert.equal(entry.insertionOrder, 4);
  assert.equal(entry.wholeWords, true);
});

test("scriptPayloads unwinds the double-encoded JanitorAI hydration store", () => {
  const record = {
    id: "b2d5e572-da25-4156-91e6-c20fbdfe1aa7",
    name: "Ayato Hiroshi",
    description: "A cold prince.",
    personality: "Reserved.",
    scenario: "The winter court.",
    first_message: "You may approach.",
    example_dialogs: "{{char}}: State your business.",
    allow_proxy: true,
  };
  const store = { "SJ--a:a-a--characterStore": { character: record } };
  const literal = JSON.stringify(JSON.stringify(store));
  const script = { type: "", textContent: "window.mbxM.push(JSON.parse(" + literal + "));" };
  const oldDocument = Object.hasOwn(globalThis, "document") ? globalThis.document : undefined;
  globalThis.document = {
    querySelectorAll: (selector) => (selector === "script" ? [script] : []),
  };
  try {
    const payloads = S.scriptPayloads();
    assert.equal(payloads.length, 1);
    assert.equal(payloads[0]["SJ--a:a-a--characterStore"].character.name, "Ayato Hiroshi");
    assert.equal(payloads[0]["SJ--a:a-a--characterStore"].character.personality, "Reserved.");
  } finally {
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
  }
});
