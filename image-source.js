require("dotenv").config();

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");

const ROOT = __dirname;
const POLICY_PATH = path.join(ROOT, "asset-licenses.json");
const HISTORY_PATH = path.join(ROOT, "state", "image-history.json");
const RUNTIME_DIR = path.join(ROOT, ".runtime");
const RUNTIME_IMAGE_DIR = path.join(RUNTIME_DIR, "images");
const API_URL = process.env.WIKIMEDIA_API_URL || "https://commons.wikimedia.org/w/api.php";
const USER_AGENT = process.env.WIKIMEDIA_USER_AGENT || "yt-auto-bot1/1.0 (licensed image downloader; contact channel owner)";
const CC0_LICENSE = "CC0 1.0 Universal Public Domain Dedication";

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function stripHtml(value = "") {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function loadImageSourcePolicy() {
  if (!fs.existsSync(POLICY_PATH)) throw new Error("asset-licenses.json is missing");
  const policy = JSON.parse(fs.readFileSync(POLICY_PATH, "utf8"));
  if (policy.status !== "dynamic") throw new Error("asset-licenses.json must use dynamic source mode");
  if (policy.source !== "Wikimedia Commons") throw new Error("Only Wikimedia Commons source mode is enabled");
  if (!policy.allowedLicenses?.includes(CC0_LICENSE)) {
    throw new Error("Dynamic source policy must allow CC0 only");
  }
  if (!Array.isArray(policy.searchQueries) || policy.searchQueries.length < 4) {
    throw new Error("Dynamic source policy needs at least four search queries");
  }
  return policy;
}

function loadHistory() {
  ensureDir(path.dirname(HISTORY_PATH));
  if (!fs.existsSync(HISTORY_PATH)) return { version: 1, used: [], lastRun: null };
  const history = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8"));
  return {
    version: 1,
    used: Array.isArray(history.used) ? history.used : [],
    lastRun: history.lastRun || null,
  };
}

function saveHistory(history) {
  ensureDir(path.dirname(HISTORY_PATH));
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + "\n");
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function getMeta(info, key) {
  return stripHtml(info?.extmetadata?.[key]?.value || "");
}

function cleanDownloadUrl(value) {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value;
  }
}

function candidateFromPage(page, query) {
  const info = page.imageinfo?.[0];
  if (!info || !String(info.mime || "").startsWith("image/")) return null;

  const title = page.title || "";
  const lowerTitle = title.toLowerCase();
  const excludedWords = ["portrait", "selfie", "person", "people", "face", "model", "wedding", "private", "nude"];
  if (excludedWords.some(word => lowerTitle.includes(word))) return null;

  const license = getMeta(info, "LicenseShortName");
  if (license.toLowerCase() !== "cc0") return null;
  const downloadUrl = info.thumburl || info.url;
  if (!downloadUrl) return null;
  if (!info.width || !info.height || info.width < 640 || info.height < 480) return null;

  return {
    id: String(page.pageid),
    title,
    source: "Wikimedia Commons",
    sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    downloadUrl: cleanDownloadUrl(downloadUrl),
    originalUrl: info.url,
    license: CC0_LICENSE,
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    creator: getMeta(info, "Artist") || "Unknown creator",
    width: info.width,
    height: info.height,
    query,
  };
}

async function requestWithBackoff(request, label, maxAttempts = 4) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      const status = error.response?.status;
      const retryable = status === 429 || status === 502 || status === 503 || status === 504;
      if (!retryable || attempt === maxAttempts - 1) throw error;
      const retryAfter = Number(error.response?.headers?.["retry-after"] || 0);
      const delayMs = Math.max(retryAfter * 1000, 1500 * (2 ** attempt));
      console.warn(`${label} returned ${status}; retrying in ${delayMs}ms`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(`Request failed: ${label}`);
}

async function searchCandidates(query) {
  const response = await requestWithBackoff(() => axios.get(API_URL, {
    params: {
      action: "query",
      generator: "search",
      gsrsearch: `${query} CC0`,
      gsrnamespace: 6,
      gsrlimit: 50,
      prop: "imageinfo",
      iiprop: "url|extmetadata|mime|size",
      iiurlwidth: 1280,
      format: "json",
      maxlag: 1,
    },
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Encoding": "gzip",
    },
    timeout: 30000,
  }), `Commons API search: ${query}`);

  return Object.values(response.data?.query?.pages || {})
    .map(page => candidateFromPage(page, query))
    .filter(Boolean);
}

function selectFreshCandidates(candidates, usedIds, count = 4) {
  const used = new Set(usedIds);
  const unique = new Map();
  for (const candidate of candidates) {
    if (!used.has(candidate.id) && !unique.has(candidate.id)) unique.set(candidate.id, candidate);
  }

  const pool = shuffle([...unique.values()]);
  const selected = [];
  const creators = new Set();
  while (pool.length > 0 && selected.length < count) {
    const differentCreatorIndex = pool.findIndex(candidate => !creators.has(candidate.creator));
    const index = differentCreatorIndex >= 0 ? differentCreatorIndex : 0;
    const [candidate] = pool.splice(index, 1);
    selected.push(candidate);
    creators.add(candidate.creator);
  }

  if (selected.length < count) {
    throw new Error(`Only ${selected.length} fresh CC0 images were found; need ${count}`);
  }
  return selected;
}

async function downloadImage(candidate, index, runId) {
  const response = await requestWithBackoff(() => axios.get(candidate.downloadUrl, {
    responseType: "arraybuffer",
    headers: { "User-Agent": USER_AGENT },
    timeout: 60000,
    maxContentLength: 12 * 1024 * 1024,
  }), `Commons image: ${candidate.title}`, 2);
  const contentType = String(response.headers["content-type"] || "");
  if (!contentType.startsWith("image/")) {
    throw new Error(`Source did not return an image for ${candidate.title}`);
  }

  ensureDir(RUNTIME_IMAGE_DIR);
  const filename = `${runId}_${String(index + 1).padStart(2, "0")}.jpg`;
  const fullPath = path.join(RUNTIME_IMAGE_DIR, filename);
  const buffer = Buffer.from(response.data);
  fs.writeFileSync(fullPath, buffer);
  return {
    ...candidate,
    path: `.runtime/images/${filename}`,
    fullPath,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
  };
}

async function downloadFreshImages({ policy = loadImageSourcePolicy(), count = 4 } = {}) {
  ensureDir(RUNTIME_DIR);
  fs.rmSync(RUNTIME_IMAGE_DIR, { recursive: true, force: true });
  ensureDir(RUNTIME_IMAGE_DIR);

  const history = loadHistory();
  const candidates = [];
  for (const query of policy.searchQueries) {
    const results = await searchCandidates(query);
    candidates.push(...results);
  }

  const used = new Set(history.used);
  const uniqueFresh = [...new Map(
    candidates
      .filter(candidate => !used.has(candidate.id))
      .map(candidate => [candidate.id, candidate]),
  ).values()];
  if (uniqueFresh.length < count) {
    throw new Error(`Only ${uniqueFresh.length} fresh CC0 candidates were found; need ${count}`);
  }

  // Download more candidates than needed so a CDN failure can be skipped safely.
  const downloadPool = selectFreshCandidates(candidates, history.used, Math.min(uniqueFresh.length, count * 3));
  const runId = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const records = [];
  for (const candidate of downloadPool) {
    try {
      records.push(await downloadImage(candidate, records.length, runId));
      if (records.length === count) break;
    } catch (error) {
      console.warn(`Skipping unavailable candidate ${candidate.title}:`, error.message || error);
    }
  }
  if (records.length < count) {
    throw new Error(`Only ${records.length} fresh CC0 images could be downloaded; need ${count}`);
  }

  history.used = [...new Set([...history.used, ...records.map(record => record.id)])];
  history.lastRun = new Date().toISOString();
  saveHistory(history);

  const currentManifest = {
    generatedAt: new Date().toISOString(),
    source: policy.source,
    records: records.map(({ fullPath, ...record }) => record),
    credits: records
      .map(record => `${record.creator} — ${record.title} — ${record.sourceUrl} — ${record.license}`)
      .join("\n"),
  };
  fs.writeFileSync(path.join(RUNTIME_DIR, "current-assets.json"), JSON.stringify(currentManifest, null, 2) + "\n");

  return {
    images: records.map(record => record.fullPath),
    records,
    credits: currentManifest.credits,
  };
}

module.exports = {
  CC0_LICENSE,
  candidateFromPage,
  downloadFreshImages,
  loadHistory,
  loadImageSourcePolicy,
  saveHistory,
  selectFreshCandidates,
};
