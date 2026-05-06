require("dotenv").config();
const fs = require("fs");
const { exec } = require("child_process");
const TelegramBot = require("node-telegram-bot-api");
const { createVoice } = require("./createVoice");
const { uploadVideo } = require("./upload");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
const CHAT_ID = process.env.CHAT_ID;
const ffmpegPath = "ffmpeg";

// ===== GOOGLE SECRET FILE CREATE =====
if (process.env.GOOGLE_CREDENTIALS) {
  fs.writeFileSync("credentials.json", process.env.GOOGLE_CREDENTIALS.replace(/\\n/g, "\n"));
}
if (process.env.GOOGLE_TOKEN) {
  fs.writeFileSync("token.json", process.env.GOOGLE_TOKEN.replace(/\\n/g, "\n"));
}

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

// ===== SCRIPT =====
function generateScript() {
  return `
If they confuse you, they were never serious about you.

At first, it feels like attention.

But slowly, it turns into confusion.

You begin questioning yourself.

But the truth is simple.

Confusion is not love.

People who truly want you bring peace.

They show consistency.

They show effort.

If someone only appears when convenient,

that is not love.

That is convenience.

Healthy love feels calm.

Not confusing.

So ask yourself:

Do they bring peace or confusion?

Because that answer can save you years.

And if this helped you,

like this video and subscribe for more.
`.trim();
}

// ===== TITLE =====
function buildTitle(script) {
  return (script.split("\n")[0] + " #viral #relationship #dating").substring(0, 90);
}

// ===== IMAGES =====
function getImages() {
  const files = fs.readdirSync("images").filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  if (files.length < 4) throw new Error("Need at least 4 images");

  const arr = [];
  while (arr.length < 6) {
    arr.push(files[arr.length % files.length]);
  }
  return arr.map(f => "images/" + f);
}

// ===== AUDIO CHECK =====
function okAudio(f) {
  try { return fs.statSync(f).size > 5000; }
  catch { return false; }
}

// ===== VIDEO =====
function createVideo(images, audio, output) {
  return new Promise((resolve, reject) => {

    const musicFiles = fs.readdirSync("music").filter(f => f.endsWith(".mp3"));
    if (musicFiles.length === 0) return reject(new Error("No music"));

    const music = "music/" + musicFiles[0];

    const inputs = images.map(img => `-loop 1 -t 20 -i "${img}"`).join(" ");

    const filter = `
[0:v]scale=1080:1920,format=yuv420p[v0];
[1:v]scale=1080:1920,format=yuv420p[v1];
[2:v]scale=1080:1920,format=yuv420p[v2];
[3:v]scale=1080:1920,format=yuv420p[v3];
[4:v]scale=1080:1920,format=yuv420p[v4];
[5:v]scale=1080:1920,format=yuv420p[v5];

[v0][v1][v2][v3][v4][v5]concat=n=6:v=1:a=0[v];

[6:a]volume=1[a1];
[7:a]volume=0.08[a2];
[a1][a2]amix=inputs=2:duration=first[a]
`;

    const cmd = `${ffmpegPath} -y ${inputs} -i "${audio}" -i "${music}" -filter_complex "${filter}" -map "[v]" -map "[a]" -shortest -preset ultrafast -r 24 -pix_fmt yuv420p "${output}"`;

    exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (err, stdout, stderr) => {
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