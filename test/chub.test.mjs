import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "src", "chub.js"), "utf8");
const win = {};
new Function("window", src)(win);
const C = win.JAIX.scraper;

const node = () => ({
  id: 161246,
  name: "Hermione Granger",
  fullPath: "misterblue/hermione-granger-fdf038e3",
  description: "Creator's notes go here.",
  tagline: "The brilliant witch friend of Harry Potter.",
  topics: ["Books", "Harry Potter", "Books"],
  nsfw_image: false,
  rating: 1,
  related_lorebooks: [4439443, -1],
  definition: {
    name: "Hermione Granger",
    description: "Creator's notes go here.",
    personality: "Hermione is a Muggle-born witch attending Hogwarts.",
    tavern_personality: "Loyal, studious and fiercely brave.",
    scenario: "",
    first_message: "*leans forward* Hello.",
    alternate_greetings: ["*waves* Hi.", "*leans forward* Hello."],
    example_dialogs: "<START>\n{{user}}: Hi\n{{char}}: Hello.",
    system_prompt: "Stay in character.",
    post_history_instructions: "Keep replies short.",
    avatar: "https://avatars.charhub.io/avatars/shimlockholmes/hermione-granger-fdf038e3/avatar.webp",
    embedded_lorebook: {
      name: "Hogwarts",
      description: "School lore",
      entries: [
        {
          keys: ["hogwarts", "school"],
          secondary_keys: ["castle"],
          name: "Hogwarts",
          content: "A castle school.",
          constant: false,
          selective: true,
          enabled: true,
          insertion_order: 2,
          position: "before_char",
          priority: 5,
          probability: 100,
          case_sensitive: true,
          extensions: { depth: 4 },
        },
      ],
    },
    extensions: { chub: { related_lorebooks: [4439443] } },
  },
});

test("normalizeCharacter maps the Chub definition onto the card shape", () => {
  const record = node();
  const card = C.normalizeCharacter(record, record.definition);
  assert.equal(card.name, "Hermione Granger");
  assert.equal(card.creator, "misterblue");
  assert.equal(card.avatarUrl, "https://avatars.charhub.io/avatars/shimlockholmes/hermione-granger-fdf038e3/avatar.webp");
  assert.equal(card.fields.description, "Creator's notes go here.");
  assert.match(card.fields.personality, /Muggle-born witch/);
  assert.match(card.fields.personality, /Loyal, studious/);
  assert.equal(card.fields.greeting, "*leans forward* Hello.");
  assert.deepEqual(card.fields.altGreetings, ["*waves* Hi."]);
  assert.match(card.fields.exampleDialogue, /\{\{user\}\}: Hi/);
  assert.equal(card.systemPrompt, "Stay in character.");
  assert.equal(card.postHistoryInstructions, "Keep replies short.");
  assert.deepEqual(card.tags, ["Books", "Harry Potter"]);
  assert.equal(card.sourceLabel, "Chub.ai card");
});

test("combinePersonality drops an exact echo of the long personality", () => {
  const record = node();
  const summary = record.definition.tavern_personality;
  record.definition.personality = summary + "\n\nMore detail.";
  const card = C.normalizeCharacter(record, record.definition);
  assert.equal(card.fields.personality, summary + "\n\nMore detail.");
});

test("normalizeEntry keeps Chub's SillyTavern fields", () => {
  const entry = C.normalizeEntry(node().definition.embedded_lorebook.entries[0]);
  assert.deepEqual(entry.keys, ["hogwarts", "school"]);
  assert.deepEqual(entry.secondaryKeys, ["castle"]);
  assert.equal(entry.content, "A castle school.");
  assert.equal(entry.comment, "Hogwarts");
  assert.equal(entry.insertionOrder, 2);
  assert.equal(entry.position, "before_char");
  assert.equal(entry.priority, 5);
  assert.equal(entry.caseSensitive, true);
  assert.deepEqual(entry.extensions, { depth: 4 });
});

test("lorebookFromNode reads the embedded book out of a lorebook reply", () => {
  const book = C.lorebookFromNode({
    node: {
      id: 4439443,
      name: "Aetharis Lore",
      definition: {
        embedded_lorebook: {
          name: "Aetharis Lore",
          entries: [{ keys: ["aether"], content: "The sundered realm.", name: "Aetharis" }],
        },
      },
    },
  });
  assert.equal(book.name, "Aetharis Lore");
  assert.equal(book.entries.length, 1);
  assert.equal(book.entries[0].content, "The sundered realm.");
});

test("currentFullPath accepts creator/slug, numeric ids, and Venus paths", () => {
  const old = globalThis.location;
  try {
    globalThis.location = { pathname: "/characters/misterblue/hermione-granger-fdf038e3" };
    assert.equal(C.currentFullPath(), "misterblue/hermione-granger-fdf038e3");
    globalThis.location = { pathname: "/characters/161246/some-name" };
    assert.equal(C.currentFullPath(), "161246/some-name");
    globalThis.location = { pathname: "/characters/161246" };
    assert.equal(C.currentFullPath(), "161246");
    globalThis.location = { pathname: "/" };
    assert.equal(C.currentFullPath(), null);
  } finally {
    if (old === undefined) delete globalThis.location;
    else globalThis.location = old;
  }
});
