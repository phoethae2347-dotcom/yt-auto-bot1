const { exec } = require("child_process");
const fs = require("fs");

function runTTS(text, output) {
  return new Promise((resolve, reject) => {

    const cmd = `edge-tts --text "${text.replace(/"/g, "'")}" --write-media "${output}"`;

    exec(cmd, (err, stdout, stderr) => {
      if (err) reject(stderr);
      else resolve(output);
    });

  });
}

async function createVoice(text) {
  const output = `voice/voice_${Date.now()}.mp3`;

  let attempts = 0;

  while (attempts < 3) {
    try {
      await runTTS(text, output);

      if (fs.existsSync(output) && fs.statSync(output).size > 5000) {
        return output;
      }

      throw new Error("invalid audio");

    } catch (e) {
      attempts++;
      console.log(`TTS retry ${attempts}`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  throw new Error("Edge TTS failed after retries");
}

module.exports = { createVoice };