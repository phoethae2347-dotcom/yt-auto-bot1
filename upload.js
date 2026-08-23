require("dotenv").config();

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { google } = require("googleapis");

const SCOPES = ["https://www.googleapis.com/auth/youtube.upload"];
const ROOT = __dirname;
const TOKEN_PATH = path.join(ROOT, "token.json");
const CREDENTIALS_PATH = path.join(ROOT, "credentials.json");
const VALID_PRIVACY = new Set(["private", "unlisted", "public"]);

function authorize() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error("credentials.json is missing; configure GOOGLE_CREDENTIALS first");
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
  const config = credentials.installed || credentials.web;
  if (!config) throw new Error("credentials.json must contain installed or web OAuth config");

  const redirectUris = config.redirect_uris || ["urn:ietf:wg:oauth:2.0:oob"];
  const oAuth2Client = new google.auth.OAuth2(
    config.client_id,
    config.client_secret,
    redirectUris[0],
  );

  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    oAuth2Client.setCredentials(token);
    return Promise.resolve(oAuth2Client);
  }

  return getNewToken(oAuth2Client);
}

function getNewToken(oAuth2Client) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      return reject(new Error("token.json is missing and this run is non-interactive; complete OAuth once locally"));
    }

    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
    });

    console.log("Open this URL to authorize YouTube upload:\n", authUrl);

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("Paste the authorization code here: ", (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return reject(err);
        oAuth2Client.setCredentials(token);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
        resolve(oAuth2Client);
      });
    });
  });
}

async function uploadVideo(filePath, options) {
  const {
    title,
    description,
    tags = [],
    categoryId = "22",
    privacyStatus = "private",
    containsSyntheticMedia = true,
  } = options || {};

  if (!title || title.length > 100) throw new Error("Title is required and must be 100 characters or fewer");
  if (!description || Buffer.byteLength(description, "utf8") > 5000) {
    throw new Error("Description is required and must be 5000 UTF-8 bytes or fewer");
  }
  if (!VALID_PRIVACY.has(privacyStatus)) throw new Error(`Invalid privacy status: ${privacyStatus}`);
  if (privacyStatus === "public" && process.env.ALLOW_PUBLIC_UPLOAD !== "true") {
    throw new Error("Public upload blocked. Set ALLOW_PUBLIC_UPLOAD=true only after human review.");
  }
  if (!fs.existsSync(filePath)) throw new Error(`Video file does not exist: ${filePath}`);

  const auth = await authorize();
  const youtube = google.youtube({ version: "v3", auth });
  const res = await youtube.videos.insert({
    part: "snippet,status",
    requestBody: {
      snippet: {
        title,
        description,
        tags: tags.slice(0, 30),
        categoryId,
        defaultLanguage: process.env.DEFAULT_LANGUAGE || "en",
        defaultAudioLanguage: process.env.DEFAULT_AUDIO_LANGUAGE || "en-US",
      },
      status: {
        privacyStatus,
        selfDeclaredMadeForKids: false,
        containsSyntheticMedia: Boolean(containsSyntheticMedia),
      },
    },
    media: { body: fs.createReadStream(filePath) },
  });

  const videoId = res.data.id;
  console.log("Uploaded video:", videoId, `(${privacyStatus})`);
  return videoId;
}

module.exports = { authorize, uploadVideo };
