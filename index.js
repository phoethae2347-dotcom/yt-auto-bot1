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

// ===== VIRAL HOOK ENGINE =====
const hooks = [
  "This dating mistake is silently ruining your life.",
  "If they do this, they were never serious about you.",
  "One truth about relationships nobody tells you.",
  "Stop ignoring this red flag in dating.",
  "This will save you years of heartbreak."
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ===== SCRIPT =====
function generateScript() {
  const hook = pick(hooks);

  return `
${hook}

At first, it feels like attention.

But slowly, it turns into confusion.

You start questioning yourself.

You wonder if you're overthinking.

But you're not.

Here is the truth:

Confusion is not love.

People who truly want you bring clarity.

They show consistency.

They show effort.

If someone only shows up when it benefits them,

that is not love.

That is convenience.

So ask yourself:

Do they bring peace, or confusion?

Because that answer can save you years.

And if this helped you,

like and subscribe for more.
`.trim();
}

// ===== TITLE + VIEW BOOST =====
function buildTitle(script) {
  const base = script.split("\n")[0];
  return (base + " #shorts #dating #relationship #viral").substring(0, 90);
}

// ===== IMAGES =====
function getImages() {
  const files = fs.readdirSync("images").filter(f => /\.(jpg|png|jpeg)$/i.test(f));
  if (files.length < 4) throw new Error("Need at least 4 images");

  return files.sort(() => Math.random() - 0.5).slice(0, 4).map(f => "images/" + f);
}

// ===== AUDIO CHECK =====
function okAudio(f) {
  try { return fs.statSync(f).size > 5000; }
  catch { return false; }
}

// ===== CINEMATIC VIDEO =====
function createVideo(images, audio, output) {
  return new Promise((resolve, reject) => {

    const musicFiles = fs.readdirSync("music").filter(f => f.endsWith(".mp3"));
    if (musicFiles.length === 0) return reject(new Error("No music"));

    const music = "music/" + musicFiles[Math.floor(Math.random() * musicFiles.length)];

    const duration = 10;

    const inputs = images.map(img => `-loop 1 -t ${duration} -i "${img}"`).join(" ");

    const filter = `
[0:v]scale=1080:1920,setsar=1,zoompan=z='min(zoom+0.0015,1.15)':d=300[v0];
[1:v]scale=1080:1920,setsar=1,zoompan=z='min(zoom+0.0015,1.15)':d=300[v1];
[2:v]scale=1080:1920,setsar=1,zoompan=z='min(zoom+0.0015,1.15)':d=300[v2];
[3:v]scale=1080:1920,setsar=1,zoompan=z='min(zoom+0.0015,1.15)':d=300[v3];

[v0][v1]xfade=transition=fade:duration=0.5:offset=9[v01];
[v01][v2]xfade=transition=fade:duration=0.5:offset=19[v02];
[v02][v3]xfade=transition=fade:duration=0.5:offset=29,format=yuv420p[v];

[4:a]volume=1[a1];
[5:a]volume=0.15[a2];
[a1][a2]amix=inputs=2:duration=first[a]
`;

    const cmd = `"${ffmpegPath}" -y ${inputs} -i "${audio}" -i "${music}" -filter_complex "${filter}" -map "[v]" -map "[a]" -shortest -r 30 -pix_fmt yuv420p "${output}"`;

    exec(cmd, (err, stdout, stderr) => {
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

    if (!fs.existsSync(out)) throw new Error("Video missing");

    await notify("☁ Upload...");
    await uploadVideo(out, buildTitle(script), script);

    await notify("✅ Uploaded");

  } catch (e) {
    console.log("ERROR:", e.message);
    await notify("❌ ERROR: " + e.message);
  }
}

run();