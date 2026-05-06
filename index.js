require("dotenv").config();
const fs = require("fs");
const { exec } = require("child_process");
const TelegramBot = require("node-telegram-bot-api");
const { createVoice } = require("./createVoice");
const { uploadVideo } = require("./upload");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
const CHAT_ID = process.env.CHAT_ID;
const ffmpegPath = "ffmpeg";

// ===== NOTIFY =====
async function notify(msg) {
  try {
    if (CHAT_ID) await bot.sendMessage(CHAT_ID, msg);
  } catch {}
}

// ===== SETUP =====
["voice", "output", "images", "music"].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d);
});

// ===== GOOGLE AUTH =====
if (process.env.GOOGLE_CREDENTIALS) {
  fs.writeFileSync("credentials.json", process.env.GOOGLE_CREDENTIALS.replace(/\\n/g, "\n"));
}
if (process.env.GOOGLE_TOKEN) {
  fs.writeFileSync("token.json", process.env.GOOGLE_TOKEN.replace(/\\n/g, "\n"));
}

// ===== HOOK =====
const hooks = [
  "If they confuse you, they were never serious about you.",
  "This dating mistake ruins your life silently.",
  "Stop ignoring this red flag.",
  "One truth about love nobody tells you.",
  "This will save you years of heartbreak."
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ===== SCRIPT =====
function generateScript() {
  return `
${pick(hooks)}

At first, it feels like attention.

But slowly,
it turns into confusion.

You start questioning yourself.

But you're not wrong.

Here is the truth:

Confusion is not love.

People who truly want you bring clarity.

They show consistency.

If someone only shows up
when it benefits them,

that is not love.

That is convenience.

So ask yourself:

Do they bring peace,
or confusion?

And if this helped you,
like and subscribe.
`.trim();
}

// ===== TITLE =====
function buildTitle(script) {
  return (script.split("\n")[0] + " #dating #viral #relationship").substring(0, 90);
}

// ===== IMAGES =====
function getImages() {
  const files = fs.readdirSync("images")
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f));

  if (files.length < 4) throw new Error("Need 4 images");

  return files.sort(() => Math.random() - 0.5).slice(0, 4).map(f => "images/" + f);
}

// ===== AUDIO CHECK =====
function okAudio(f) {
  try { return fs.statSync(f).size > 5000; }
  catch { return false; }
}

// ===== VIDEO FIX =====
function createVideo(images, audio, output) {
  return new Promise((resolve, reject) => {

    const musicFiles = fs.readdirSync("music").filter(f => f.endsWith(".mp3"));
    if (musicFiles.length === 0) return reject(new Error("No music"));

    const music = "music/" + musicFiles[Math.floor(Math.random() * musicFiles.length)];

    // loop images infinitely (key fix)
    const inputs = images.map(img => `-loop 1 -i "${img}"`).join(" ");

    const filter = `
[0:v]scale=1080:1920,zoompan=z='min(zoom+0.001,1.2)':d=150[v0];
[1:v]scale=1080:1920,zoompan=z='min(zoom+0.001,1.2)':d=150[v1];
[2:v]scale=1080:1920,zoompan=z='min(zoom+0.001,1.2)':d=150[v2];
[3:v]scale=1080:1920,zoompan=z='min(zoom+0.001,1.2)':d=150[v3];

[v0][v1][v2][v3]concat=n=4:v=1:a=0[v];

[4:a]volume=1[a1];
[5:a]volume=0.15[a2];
[a1][a2]amix=inputs=2:duration=first[a]
`;

    const cmd = `"${ffmpegPath}" -y ${inputs} -i "${audio}" -i "${music}" \
-filter_complex "${filter}" \
-map "[v]" -map "[a]" \
-shortest -r 30 -pix_fmt yuv420p "${output}"`;

    exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
      if (err) {
        console.log(stderr);
        reject(new Error("FFmpeg failed"));
      } else resolve();
    });
  });
}

// ===== MAIN =====
async function run() {
  try {
    console.log("START RUN");

    const script = generateScript();

    await notify("🎙 Voice...");
    const voice = await createVoice(script);

    if (!okAudio(voice)) throw new Error("Audio invalid");

    await notify("🎬 Video...");
    const images = getImages();

    const out = `output/video_${Date.now()}.mp4`;

    await createVideo(images, voice, out);

    await notify("☁ Upload...");
    await uploadVideo(out, buildTitle(script), script);

    await notify("✅ Uploaded");

  } catch (e) {
    console.log("ERROR:", e.message);
    await notify("❌ ERROR: " + e.message);
  }
}

run();