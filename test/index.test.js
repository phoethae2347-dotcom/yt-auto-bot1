const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {
  buildDescription,
  buildTitle,
  generateScript,
  getImages,
  getMusic,
  loadAssetManifest,
} = require("../index");

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "asset-licenses.json"), "utf8"));
manifest.status = "verified";

test("generated script has a hook and meaningful body", () => {
  const script = generateScript();
  assert.ok(script.split("\n")[0].trim().length > 10);
  assert.ok(script.length > 300);
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
  assert.ok(images.every(file => file.startsWith(path.join(__dirname, "..", "images"))));
  assert.ok(music.startsWith(path.join(__dirname, "..", "music")));
});

test("unverified manifest blocks publishing", () => {
  assert.throws(() => loadAssetManifest(), /not verified/);
});
