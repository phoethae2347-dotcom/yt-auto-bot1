const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {
  buildDescription,
  buildTitle,
  generateContent,
  generateScript,
  getImages,
  getMusic,
  loadAssetManifest,
  loadContentBriefs,
  renderBrief,
} = require("../index");

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "asset-licenses.json"), "utf8"));
manifest.status = "verified";

test("generated script has a hook and meaningful body", () => {
  const script = generateScript();
  assert.ok(script.split("\n")[0].trim().length > 10);
  assert.ok(script.length > 300);
});

test("editorial briefs render different human-style formats", () => {
  const briefs = loadContentBriefs();
  const rendered = briefs.map(brief => renderBrief(brief));
  const uniqueOpenings = new Set(rendered.map(script => script.split("\n\n")[0]));
  assert.ok(briefs.length >= 8);
  assert.equal(uniqueOpenings.size, briefs.length);
  assert.ok(rendered.some(script => script.includes("You could say:")));
  assert.ok(rendered.some(script => script.includes("Dear you,")));
});

test("generated content carries a brief id and format", () => {
  const content = generateContent();
  assert.ok(content.brief.id);
  assert.ok(content.brief.format);
  assert.ok(content.script.includes(content.brief.opening));
});

test("title stays within YouTube's 100-character limit", () => {
  const title = buildTitle("A thoughtful relationship reflection.");
  assert.ok(title.length <= 100);
  assert.match(title, /Relationship Reflection/);
});

test("description contains AI disclosure and viewer-safety note", () => {
  const description = buildDescription("Original commentary.", manifest);
  assert.match(description, /AI-assisted tools/);
  assert.match(description, /not therapy/);
  assert.ok(Buffer.byteLength(description, "utf8") <= 5000);
});

test("asset selection only returns files recorded in the manifest", () => {
  const images = getImages(manifest);
  const music = getMusic(manifest);
  assert.equal(images.length, 4);
  assert.ok(images.every(file => file.startsWith(path.join(__dirname, "..", "licensed-images"))));
  assert.equal(music, null);
});

test("verified manifest validates licensed assets and hashes", () => {
  const loaded = loadAssetManifest();
  assert.equal(loaded.status, "verified");
  assert.equal(loaded.images.length, 8);
  assert.ok(loaded.assetRecords.every(record => record.license.includes("CC0")));
  assert.ok(loaded.assetRecords.every(record => /^[a-f0-9]{64}$/.test(record.sha256)));
});
