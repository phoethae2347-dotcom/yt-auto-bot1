require("dotenv").config();
const fs = require("fs");
const { exec, execSync } = require("child_process");
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

// ===== SCRIPT (≈2 MIN) =====
function generateScript() {
  return `
If they confuse you, they were never serious about you.

At first, it feels like attention.

They message you.
They show interest.

And you think it's real.

But slowly,
things start changing.

Replies slow down.

Effort disappears.

And confusion grows.

You start questioning yourself.

But you're not wrong.

Here is the truth:

Confusion is not love.

People who truly want you
bring clarity.

They show consistency.

They show effort.

If someone only shows up
when it benefits them,

that is not love.

That is convenience.

And convenience will never build
a real relationship.

Healthy love feels calm.

Not confusing.

So ask yourself:

Do they bring peace?

Or do they bring stress?

Because that answer
can save you years.

And if this helped you,

like this video
and subscribe for more.
`.trim();
}

// ===== TITLE =====
function buildTitle(script) {
  return (script.split("\n")[0] + " #dating #viral #relationship").substring(0, 90);
}

// ===== AUDIO CHECK =====
function okAudio(f) {
  try { return fs.statSync(f).size > 5000; }
  catch { return false; }
}

// ===== GET AUDIO DURATION =====
function getAudioDuration(file) {
  const out = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`);
  return Math.ceil(parseFloat(out.toString()));
}

// ===== IMAGES =====
function getImages() {
  const files = fs.readdirSync("images")
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f));

  if (files.length < 4) throw new Error("Need at least 4 images");

  return files.sort(() => Math.random() - 0.5).slice(0, 4).map(f => "images/" + f);
}

// ===== VIDEO (AUTO SYNC) =====
function createVideo(images, audio, output) {
  return new Promise((resolve, reject) => {

    const musicFiles = fs.readdirSync("music").filter(f => f.endsWith(".mp3"));
    if (musicFiles.length === 0) return reject(new Error("No music"));

    const music = "music/" + musicFiles[Math.floor(Math.random() * musicFiles.length)];

    // 🔥 AUTO LENGTH
    const duration = getAudioDuration(audio);
    const perImage = Math.ceil(duration / images.length);

    const inputs = images.map(img => `-loop 1 -t ${perImage} -i "${img}"`).join(" ");

    const filter = `
[0:v]scale=1080:1920,zoompan=z='min(zoom+0.0015,1.2)':d=300[v0];
[1:v]scale=1080:1920,zoompan=z='min(zoom+0.0015,1.2)':d=300[v1];
[2:v]scale=1080:1920,zoompan=z='min(zoom+0.0015,1.2)':d=300[v2];
[3:v]scale=1080:1920,zoompan=z='min(zoom+0.0015,1.2)':d=300[v3];

[v0][v1][v2][v3]concat=n=4:v=1:a=0[v];

[4:a]volume=1[a1];
[5:a]volume=0.12[a2];
[a1][a2]amix=inputs=2:duration=first[a]
`;

    const cmd = `"${ffmpegPath}" -y ${inputs} -i "${audio}" -i "${music}" -filter_complex "${filter}" -map "[v]" -map "[a]" -shortest -r 30 -pix_fmt yuv420p "${output}"`;

    exec(cmd, { maxBuffer: 1024 * 1024 * 20 }, (err, stdout, stderr) => {
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