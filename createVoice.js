const { exec } = require("child_process");
const fs = require("fs");

function createVoice(text) {
  return new Promise((resolve, reject) => {

    const filePath = `voice/voice_${Date.now()}.mp3`;

    // 🔥 Edge TTS command (SUPER STABLE)
    const command = `edge-tts --voice en-US-AriaNeural --text "${text.replace(/"/g, '')}" --write-media "${filePath}"`;

    exec(command, (error) => {
      if (error) {
        return reject(new Error("Edge TTS failed"));
      }

      // 🔥 validate file
      if (!fs.existsSync(filePath)) {
        return reject(new Error("Voice not created"));
      }

      const size = fs.statSync(filePath).size;

      if (size < 10000) {
        return reject(new Error("Voice corrupted"));
      }

      resolve(filePath);
    });

  });
}

module.exports = { createVoice };