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
  } catch (e) {
    console.log("Notify failed:", e.message);
  }
}

// ===== SETUP =====
["voice", "output", "images", "music"].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d);
});

// ===== HELPERS =====
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ✅ FIX: Shuffle array randomly
function shuffle(arr) {
  return arr
    .map(item => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

// ===== SCRIPT ENGINE =====
// ✅ IMPROVED: Multiple script templates for variety
const scriptTemplates = [

  // Template 1 - Inconsistency
  (hook) => `
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
`.trim(),

  // Template 2 - Self worth
  (hook) => `
${hook}

You kept making excuses for them.

You told yourself they were just busy.

You told yourself they had a lot going on.

You told yourself that one day, they would show up differently.

But days turned into weeks.

Weeks turned into months.

And you were still waiting.

Still hoping.

Still giving more than you were receiving.

Here is what nobody tells you about one-sided love.

It does not feel like rejection at first.

It feels like patience.

It feels like loyalty.

It feels like you are being the bigger person.

But at some point, patience becomes self-abandonment.

And loyalty without reciprocity is just suffering with a better name.

You deserve someone who does not need to be convinced to choose you.

You deserve someone who shows up without being asked.

You deserve someone who makes you feel wanted,
not just tolerated.

Because the right person will never make you feel like a burden.

They will make you feel like a blessing.

Stop chasing people who walk away easily.

Your energy is too valuable to pour into empty vessels.

Know your worth.

And stop discounting it for people who cannot see it.

If this hit home, share it with someone who needs to hear it.

And subscribe for more truth like this.
`.trim(),

  // Template 3 - Red flags
  (hook) => `
${hook}

They said all the right things in the beginning.

They called you special.

They told you they had never felt this way before.

They made you feel chosen.

But slowly, the words stopped matching the actions.

They would say they missed you,
but never make time to see you.

They would say they cared,
but disappear when you needed them most.

They would promise to do better,
and then repeat the same behavior again.

This is what emotional manipulation looks like
in the early stages.

It is not always yelling.

It is not always obvious.

Sometimes it is just someone who is very good
at making you feel crazy for noticing the inconsistency.

If you have to convince someone to treat you with basic respect,
that is your answer.

If you have to beg for effort,
that is your sign.

If you feel more alone with them than without them,
please listen to that feeling.

Because your instincts are not lying to you.

You are not too sensitive.

You are not asking for too much.

You are simply asking the wrong person.

The right person will not make love feel like hard work.

They will make it feel like coming home.

Like this video if this spoke to you,
and subscribe for more.
`.trim(),

  // Template 4 - Moving on
  (hook) => `
${hook}

Letting go is one of the hardest things you will ever do.

Not because you are weak.

But because you invested so much.

You gave your time.

You gave your energy.

You gave pieces of yourself
that you cannot get back.

And walking away from that
feels like admitting defeat.

But here is the truth.

Staying in something that is slowly breaking you
is not strength.

It is fear.

Fear of starting over.

Fear of being alone.

Fear that maybe this is the best you deserve.

But you deserve so much more than someone
who only shows up halfway.

You deserve more than being someone's option.

You deserve more than being kept around
for when it is convenient.

Healing starts the moment you stop
trying to fix someone who does not want to be fixed.

It starts when you choose yourself,
even when it is terrifying.

Even when it hurts.

Even when you are not sure what comes next.

Because on the other side of that pain
is a version of you that is finally free.

Free to receive the love you always deserved.

Take care of yourself.

And subscribe for more content like this.
`.trim(),

];

const hooks = [
  "If someone does this to you, they were never serious about you.",
  "This relationship truth will save you years of heartbreak.",
  "Stop ignoring this red flag before it ruins your peace.",
  "If they keep doing this, you need to walk away.",
  "One dating truth nobody tells you until it is too late.",
  "This is what loving the wrong person actually looks like.",
  "You are not too much. You are just too much for the wrong person.",
  "Stop waiting for someone to choose you. Choose yourself.",
  "The moment you accept being treated poorly, you teach them how to treat you.",
  "This is the sign you needed to finally walk away.",
];

// ✅ IMPROVED: Random template + random hook each run
function generateScript() {
  const hook = pick(hooks);
  const template = pick(scriptTemplates);
  return template(hook);
}

// ===== TITLE =====
// ✅ IMPROVED: More hashtag variety
const hashtagSets = [
  "#viral #relationship #dating",
  "#relationships #love #selflove",
  "#datingadvice #heartbreak #motivation",
  "#lovequotes #selfworth #mentalhealth",
  "#relationshipadvice #toxic #healing",
];

function buildTitle(script) {
  const hashtags = pick(hashtagSets);
  return (script.split("\n")[0] + " " + hashtags).substring(0, 90);
}

// ===== IMAGES =====
// ✅ FIX: Random 4 images from all available images
function getImages() {
  const files = fs.readdirSync("images")
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f));

  if (files.length < 4) throw new Error(`Need at least 4 images, found ${files.length}`);

  const shuffled = shuffle(files);
  return shuffled.slice(0, 4).map(f => "images/" + f);
}

// ===== MUSIC =====
// ✅ FIX: Random music selection
function getMusic() {
  const files = fs.readdirSync("music")
    .filter(f => /\.mp3$/i.test(f));

  if (files.length === 0) throw new Error("No music files found in music/ folder");

  return "music/" + pick(files);
}

// ===== AUDIO CHECK =====
function okAudio(f) {
  try {
    return fs.statSync(f).size > 5000;
  } catch {
    return false;
  }
}

// ===== CLEANUP =====
// ✅ NEW: Clean up old temp files to save space
function cleanup(voiceFile) {
  try {
    if (voiceFile && fs.existsSync(voiceFile)) fs.unlinkSync(voiceFile);
  } catch (e) {
    console.log("Cleanup warning:", e.message);
  }

  // Remove output videos older than 1 day
  try {
    const outputs = fs.readdirSync("output").filter(f => f.endsWith(".mp4"));
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    outputs.forEach(f => {
      const fullPath = "output/" + f;
      const stat = fs.statSync(fullPath);
      if (stat.mtimeMs < oneDayAgo) {
        fs.unlinkSync(fullPath);
        console.log("Cleaned old video:", f);
      }
    });
  } catch (e) {
    console.log("Output cleanup warning:", e.message);
  }
}

// ===== VIDEO =====
// ✅ FIX: Filter as joined string (no newline issues on any OS)
function createVideo(images, audio, music, output) {
  return new Promise((resolve, reject) => {
    const inputs = images
      .map(img => `-loop 1 -t 30 -framerate 24 -i "${img}"`)
      .join(" ");

    const filterParts = [
      "[0:v]scale=1080:1920,setsar=1,fps=24[v0]",
      "[1:v]scale=1080:1920,setsar=1,fps=24[v1]",
      "[2:v]scale=1080:1920,setsar=1,fps=24[v2]",
      "[3:v]scale=1080:1920,setsar=1,fps=24[v3]",
      "[v0][v1]xfade=transition=fade:duration=1:offset=29[v01]",
      "[v01][v2]xfade=transition=fade:duration=1:offset=58[v02]",
      "[v02][v3]xfade=transition=fade:duration=1:offset=87,format=yuv420p[v]",
      "[4:a]volume=1[a1]",
      "[5:a]volume=0.08[a2]",
      "[a1][a2]amix=inputs=2:duration=first[a]",
    ].join(";");

    const cmd = [
      ffmpegPath,
      "-y",
      inputs,
      `-i "${audio}"`,
      `-i "${music}"`,
      `-filter_complex "${filterParts}"`,
      `-map "[v]"`,
      `-map "[a]"`,
      "-shortest",
      "-preset ultrafast",
      `"${output}"`,
    ].join(" ");

    console.log("Running FFmpeg...");

    exec(cmd, { maxBuffer: 1024 * 1024 * 100 }, (err, stdout, stderr) => {
      if (err) {
        console.log("FFMPEG STDERR:\n", stderr);
        reject(new Error("FFmpeg failed: " + (stderr ? stderr.slice(-300) : err.message)));
      } else {
        resolve();
      }
    });
  });
}

// ===== MAIN =====
async function run() {
  let voiceFile = null;

  try {
    console.log("===== START RUN =====");
    console.log("Time:", new Date().toISOString());

    // 1. Generate script
    const script = generateScript();
    console.log("Hook:", script.split("\n")[0]);

    // 2. Create voice
    await notify("🎙 Generating voice...");
    voiceFile = await createVoice(script);
    console.log("Voice file:", voiceFile);

    if (!okAudio(voiceFile)) {
      throw new Error(`Audio file invalid or too small: ${voiceFile}`);
    }

    // 3. Get images & music
    const images = getImages();
    const music = getMusic();
    console.log("Images selected:", images);
    console.log("Music selected:", music);

    // 4. Create video
    await notify("🎬 Creating video...");
    const out = `output/video_${Date.now()}.mp4`;

    await createVideo(images, voiceFile, music, out);

    if (!fs.existsSync(out)) {
      throw new Error("Video file was not created");
    }

    const videoSize = (fs.statSync(out).size / (1024 * 1024)).toFixed(2);
    console.log(`Video created: ${out} (${videoSize} MB)`);

    // 5. Upload
    await notify(`☁️ Uploading video (${videoSize} MB)...`);
    const title = buildTitle(script);
    console.log("Title:", title);

    await uploadVideo(out, title, script);

    await notify(`✅ Upload complete!\n📌 Title: ${title}`);
    console.log("===== DONE =====");

  } catch (e) {
    console.log("ERROR:", e.message);
    await notify("❌ ERROR: " + e.message);
  } finally {
    // ✅ Always cleanup temp files
    cleanup(voiceFile);
  }
}

run();