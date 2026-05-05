require("dotenv").config();
const fs = require("fs");
const { exec } = require("child_process");
const TelegramBot = require("node-telegram-bot-api");
const { createVoice } = require("./createVoice");
const { uploadVideo } = require("./upload");

// ===== TELEGRAM (notify only) =====
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
const CHAT_ID = process.env.CHAT_ID;

async function notify(text) {
  try {
    if (CHAT_ID) {
      await bot.sendMessage(CHAT_ID, text);
    }
  } catch (e) {
    console.log("notify error:", e.message);
  }
}

const ffmpegPath = "ffmpeg";

// ===== folders =====
["voice", "output", "temp", "images"].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d);
});

// ===== google auth =====
if (process.env.GOOGLE_CREDENTIALS) {
  fs.writeFileSync("credentials.json", process.env.GOOGLE_CREDENTIALS);
}
if (process.env.GOOGLE_TOKEN) {
  fs.writeFileSync("token.json", process.env.GOOGLE_TOKEN);
}

// ===== simple script =====
function generateScript() {
  const list = [
    "You won’t believe this money fact",
    "This success habit works instantly",
    "A shocking truth most people ignore",
    "One mindset trick that changes everything"
  ];
  const pick = list[Math.floor(Math.random() * list.length)];
  return pick + ". Watch till the end.";
}

// ===== pick local image =====
function getImage() {
  const files = fs.readdirSync("images").filter(f => f.endsWith(".jpg") || f.endsWith(".png"));
  if (files.length === 0) throw new Error("no images");
  const i = Math.floor(Math.random() * files.length);
  return "images/" + files[i];
}

// ===== audio check =====
function okAudio(f) {
  try { return fs.statSync(f).size > 5000; } catch { return false; }
}

// ===== video =====
function createVideo(img, aud, out) {
  return new Promise((res, rej) => {
    const cmd = `"${ffmpegPath}" -y -loop 1 -i "${img}" -i "${aud}" -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.002,1.15)':d=125:s=1080x1920" -c:v libx264 -preset veryfast -tune stillimage -shortest -pix_fmt yuv420p -r 30 -movflags +faststart "${out}"`;
    exec(cmd, (e, so, se) => {
      if (e) { console.log(se); rej(new Error("ffmpeg failed")); }
      else res();
    });
  });
}

// ===== title/hashtags =====
function cleanTitle(t) {
  return t.replace(/[#@]/g, "").replace(/\n/g, " ").trim().substring(0, 70);
}
function tags(t) {
  const base = ["#shorts", "#viral", "#fyp"];
  const x = t.toLowerCase();
  if (x.includes("money")) base.push("#money");
  if (x.includes("success")) base.push("#success");
  if (x.includes("truth")) base.push("#facts");
  return base.join(" ");
}

// ===== run once =====
async function run() {
  try {
    const script = generateScript();

    const voice = await createVoice(script);
    if (!okAudio(voice)) throw new Error("audio bad");

    const img = getImage();

    const out = "output/video_" + Date.now() + ".mp4";
    await createVideo(img, voice, out);
    if (!fs.existsSync(out)) throw new Error("video missing");

    const h = tags(script);
    const title = cleanTitle(script) + " " + h;
    const desc = script + "\n\n" + h;

    await uploadVideo(out, title, desc);

    await notify("OK uploaded");
    console.log("OK");
  } catch (e) {
    console.log("ERR:", e.message);
    await notify("ERROR: " + e.message);
    process.exit(1);
  }
}

run();