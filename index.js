require("dotenv").config();
const fs = require("fs");
const { exec } = require("child_process");
const TelegramBot = require("node-telegram-bot-api");
const { createVoice } = require("./createVoice");
const { uploadVideo } = require("./upload");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
const CHAT_ID = process.env.CHAT_ID;
const ffmpegPath = "ffmpeg";

// ===== GOOGLE AUTH =====
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

// ===== SCRIPT ENGINE =====
const hooks = [
  "If someone does this to you, they were never serious about you.",
  "This relationship truth will save you years of heartbreak.",
  "Stop ignoring this red flag before it ruins your peace.",
  "If they keep doing this, you need to walk away.",
  "One dating truth nobody tells you until it's too late."
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateScript() {
  const hook = pick(hooks);

  return `
${hook}

At first, it feels like attention.

They text you just enough.

They give you little moments of affection.

And that makes you believe something meaningful is growing.

You start hoping.

You start investing your emotions.

You start imagining a future.

But then, something slowly changes.

Their replies become inconsistent.

Their energy becomes confusing.

Some days they act interested.

Other days they feel distant.

And suddenly, you are left questioning yourself.

You wonder if you said something wrong.

You wonder if you're asking for too much.

You wonder if maybe you are simply overthinking.

But listen carefully.

You are not overthinking.

You are responding to inconsistency.

And inconsistency creates emotional chaos.

Here is the truth most people learn too late.

Confusion is never a sign of love.

Real love does not make you feel unstable every day.

People who genuinely want you
do not leave you guessing.

They show up.

They communicate.

They make their intentions clear.

Because when someone values your presence,
they do not risk losing you through mixed signals.

If someone only appears when they are lonely,

if they only give attention when it is convenient,

if they disappear the moment effort is required,

that is not love.

That is emotional convenience.

And emotional convenience will keep draining you for years if you let it.

Healthy love feels calm.

Healthy love feels secure.

Healthy love does not force you to decode every message.

So ask yourself this today.

Do they bring peace into your life?

Or do they bring anxiety every single day?

Because the answer to that question

can save you years of heartbreak.

And if this message opened your eyes,

like this video,

and subscribe for more.
`.trim();
}

// ===== TITLE =====
function buildTitle(script) {
  return (script.split("\n")[0] + " #viral #relationship #dating").substring(0, 90);
}

// ===== IMAGES =====
function getImages() {
  const files = fs.readdirSync("images").filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  if (files.length < 4) throw new Error("Need 4 images");
  return files.slice(0, 4).map(f => "images/" + f);
}

// ===== AUDIO CHECK =====
function okAudio(f) {
  try {
    return fs.statSync(f).size > 5000;
  } catch {
    return false;
  }
}

// ===== VIDEO =====
function createVideo(images, audio, output) {
  return new Promise((resolve, reject) => {
    const musicFiles = fs.readdirSync("music").filter(f => f.endsWith(".mp3"));
    if (musicFiles.length === 0) return reject(new Error("No music"));

    const music = "music/" + musicFiles[0];
    const inputs = images.map(img => `-loop 1 -t 30 -framerate 24 -i "${img}"`).join(" ");

    const filter = `
[0:v]scale=1080:1920,setsar=1,fps=24[v0];
[1:v]scale=1080:1920,setsar=1,fps=24[v1];
[2:v]scale=1080:1920,setsar=1,fps=24[v2];
[3:v]scale=1080:1920,setsar=1,fps=24[v3];
[v0][v1]xfade=transition=fade:duration=1:offset=29[v01];
[v01][v2]xfade=transition=fade:duration=1:offset=58[v02];
[v02][v3]xfade=transition=fade:duration=1:offset=87,format=yuv420p[v];
[4:a]volume=1[a1];
[5:a]volume=0.08[a2];
[a1][a2]amix=inputs=2:duration=first[a]
`;

    const cmd = `${ffmpegPath} -y ${inputs} -i "${audio}" -i "${music}" -filter_complex "${filter}" -map "[v]" -map "[a]" -shortest -preset ultrafast "${output}"`;

    exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (err, stdout, stderr) => {
      if (err) {
        console.log("FFMPEG STDERR:\n", stderr);
        reject(new Error("FFmpeg failed"));
      } else {
        resolve();
      }
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