const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildDescription,
  buildTitle,
  generateContent,
  generateScript,
  loadContentBriefs,
  renderBrief,
} = require("../index");
const {
  candidateFromPage,
  loadImageSourcePolicy,
  selectFreshCandidates,
} = require("../image-source");

const assets = {
  credits: "Fresh CC0 visual credits are recorded in .runtime/current-assets.json.",
};

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

test("generated content carries a brief id, format, and lesson", () => {
  const content = generateContent();
  assert.ok(content.brief.id);
  assert.ok(content.brief.format);
  assert.ok(content.brief.lesson.length >= 12);
  assert.ok(content.script.includes(content.brief.opening));
  assert.ok(content.script.includes(content.brief.lesson));
});

test("every brief teaches one practical idea and gives one action", () => {
  const briefs = loadContentBriefs();
  assert.ok(briefs.every(brief => brief.lesson.length >= 12));
  assert.ok(briefs.every(brief => brief.action.length >= 12));
  assert.ok(briefs.every(brief => brief.question.length >= 12));
});

test("title stays within YouTube's 100-character limit", () => {
  const title = buildTitle("A thoughtful relationship reflection.");
  assert.ok(title.length <= 100);
  assert.match(title, /Relationship Reflection/);
});

test("description contains AI disclosure and viewer-safety note", () => {
  const description = buildDescription("Original commentary.", assets);
  assert.match(description, /AI-assisted tools/);
  assert.match(description, /not therapy/);
  assert.ok(Buffer.byteLength(description, "utf8") <= 5000);
});

test("dynamic policy allows only the intended Openverse CC0 source", () => {
  const policy = loadImageSourcePolicy();
  assert.equal(policy.status, "dynamic");
  assert.equal(policy.source, "Openverse");
  assert.deepEqual(policy.allowedLicenses, ["cc0"]);
  assert.ok(policy.searchQueries.length >= 8);
});

test("candidate filter rejects non-CC0 and identifiable-person titles", () => {
  const page = {
    id: "ov-42",
    title: "Quiet forest landscape",
    license: "cc0",
    license_url: "https://creativecommons.org/publicdomain/zero/1.0/",
    creator: "Creator A",
    source: "flickr",
    foreign_landing_url: "https://www.flickr.com/photos/example/42",
    url: "https://live.staticflickr.com/example.jpg",
    thumbnail: "https://live.staticflickr.com/example-thumb.jpg",
    width: 1280,
    height: 900,
  };
  assert.equal(candidateFromPage(page, "forest").license, "CC0 1.0 Universal Public Domain Dedication");
  assert.equal(candidateFromPage({ ...page, title: "Portrait person" }, "forest"), null);
  assert.equal(candidateFromPage({ ...page, license: "by" }, "forest"), null);
});

test("rotation excludes previously used image IDs and prefers fresh creators", () => {
  const candidates = [1, 2, 3, 4, 5].map((id, index) => ({ id: String(id), creator: `Creator ${index}`, title: `Image ${id}` }));
  const selected = selectFreshCandidates(candidates, ["1"], 4);
  assert.equal(selected.length, 4);
  assert.ok(selected.every(candidate => candidate.id !== "1"));
  assert.equal(new Set(selected.map(candidate => candidate.creator)).size, 4);
});
