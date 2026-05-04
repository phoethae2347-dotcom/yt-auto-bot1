const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");

const SCOPES = ["https://www.googleapis.com/auth/youtube.upload"];
const TOKEN_PATH = "token.json";

// ===== AUTH =====
function authorize() {
  const credentials = JSON.parse(fs.readFileSync("credentials.json"));
  const { client_secret, client_id, redirect_uris } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    oAuth2Client.setCredentials(token);
    return Promise.resolve(oAuth2Client);
  }

  return getNewToken(oAuth2Client);
}

// ===== GET TOKEN =====
function getNewToken(oAuth2Client) {
  return new Promise((resolve, reject) => {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
    });

    console.log("👉 OPEN THIS URL:\n", authUrl);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("Paste code here: ", (code) => {
      rl.close();

      oAuth2Client.getToken(code, (err, token) => {
        if (err) return reject(err);

        oAuth2Client.setCredentials(token);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
        console.log("✅ Token saved");

        resolve(oAuth2Client);
      });
    });
  });
}

// ===== UPLOAD =====
async function uploadVideo(filePath, title, description) {
  const auth = await authorize();

  const youtube = google.youtube({
    version: "v3",
    auth,
  });

  const res = await youtube.videos.insert({
    part: "snippet,status",
    requestBody: {
      snippet: {
        title,
        description,
        tags: ["viral", "shorts"],
        categoryId: "22",
      },
      status: {
        privacyStatus: "public",
      },
    },
    media: {
      body: fs.createReadStream(filePath),
    },
  });

  console.log("🎬 Uploaded:", res.data.id);
}

module.exports = { uploadVideo };