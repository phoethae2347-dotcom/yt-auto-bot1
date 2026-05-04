require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { exec } = require("child_process");
const fs = require("fs");

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true
});

// ❗ Render uses system ffmpeg
const ffmpegPath = "ffmpeg";

// ===== SETUP =====
["voice", "output", "temp", "images"].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

// ===== IMAGE =====
function getNextImage() {
  const files = fs.readdirSync("images").filter(f => f.endsWith(".jpg"));
  if (files.length === 0) throw new Error("No images");

  let index = 0;
  if (fs.existsSync("index.txt")) {
    index = parseInt(fs.readFileSync("index.txt"));
  }

  const file = files[index % files.length];
  fs.writeFileSync("index.txt", (index + 1).toString());

  return `images/${file}`;
}

// ===== TEXT CLEAN =====
function cleanText(text) {
  return text.replace(/\[.*?\]/g, "").trim();
}

// ===== VOICE (NO PYTHON) =====
function generateVoice(text, filePath) {
  return new Promise((resolve, reject) => {

    // ❗ free TTS using ffmpeg tone (temporary hack)
    const command = `"${ffmpegPath}" -f lavfi -i "flite=text='${cleanText(text)}':voice=kal" -t 5 -y "${filePath}"`;

    exec(command, (error) => {
      if (error) {
        console.log("VOICE ERROR:", error);
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

// ===== VIDEO =====
function createVideo(imagePath, audioPath, outputPath) {
  return new Promise((resolve, reject) => {

    const command = `"${ffmpegPath}" -y -loop 1 -i "${imagePath}" -i "${audioPath}" -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.002,1.2)':d=125:s=1080x1920" -c:v libx264 -preset veryfast -shortest -pix_fmt yuv420p -r 30 "${outputPath}"`;

    exec(command, (error) => {
      if (error) {
        console.log("VIDEO ERROR:", error);
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

// ===== MAIN =====
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  try {
    bot.sendMessage(chatId, "🔥 Creating video...");

    const audioFile = `voice/voice_${Date.now()}.mp3`;
    const videoFile = `output/video_${Date.now()}.mp4`;

    // 1. Voice
    await generateVoice(text, audioFile);

    // 2. Image
    const imagePath = getNextImage();

    // 3. Video
    await createVideo(imagePath, audioFile, videoFile);

    // 4. Send
    await bot.sendVideo(chatId, fs.createReadStream(videoFile));

    console.log("🔥 VIDEO OK");

  } catch (err) {
    console.log("ERROR:", err);
    bot.sendMessage(chatId, "ERROR ❌");
  }
});