# yt-auto-bot1

This project generates short-form relationship reflections with synthetic narration and uploads them through the YouTube Data API. It is designed to support original, viewer-useful content rather than impersonation, fake engagement, scraped material, or guaranteed monetization.

## Important publishing policy

The bot now defaults to `private` uploads and refuses public uploads unless `ALLOW_PUBLIC_UPLOAD=true` is explicitly provided. Review the rendered video, title, description, asset rights, and policy suitability before enabling public publishing. A successful upload is not a guarantee of views, YPP acceptance, ad suitability, or revenue.

The description states that the commentary and narration use AI-assisted tools. The API request also sets YouTube's `status.containsSyntheticMedia=true`. This is appropriate for the current synthetic narration workflow, but the channel owner remains responsible for selecting the correct disclosure for the actual video in YouTube Studio.

YouTube monetization review expects original and authentic content and may reject repetitive, mass-produced, generic, or reused content. Randomly changing a hook, image, or background track does not by itself make a video sufficiently original. Add real editorial review, specific examples, varied formats, meaningful commentary, and viewer value before publishing.

## Asset rights gate

The old bundled `images/` and `music/` folders were removed. The bot now uses only the eight files in `licensed-images/`, which are CC0 1.0 records retrieved from Wikimedia Commons and listed individually in `asset-licenses.json`. Each record includes the source page, download URL, creator field, license URL, and SHA-256 hash.

The runtime refuses to render any file that is not listed in the verified manifest. Music is optional; when no verified music exists, the video uses narration-only audio instead of silently selecting an unverified track. CC0 addresses copyright licensing, but the channel owner should still check the source page and avoid images containing identifiable people, private scenes, trademarks, or other non-copyright restrictions.

Do not treat an asset as risk-free merely because it is found online or appears to be AI-generated. Re-check source pages and licenses periodically before relying on a video for commercial publishing.

## Required secrets

Configure these GitHub Actions secrets:

| Secret | Purpose |
| --- | --- |
| `GOOGLE_CREDENTIALS` | OAuth client JSON for the YouTube Data API |
| `GOOGLE_TOKEN` | Authorized token JSON with the YouTube upload scope |
| `BOT_TOKEN` | Optional Telegram bot token for status notifications |
| `CHAT_ID` | Optional Telegram chat ID for status notifications |

The OAuth token must be created with `https://www.googleapis.com/auth/youtube.upload`. If `token.json` is not present in a non-interactive workflow, the job fails rather than waiting for input.

## Runtime settings

The workflow passes conservative defaults. Override these only after review:

| Variable | Default | Meaning |
| --- | --- | --- |
| `UPLOAD_PRIVACY_STATUS` | `private` | Upload visibility: `private`, `unlisted`, or `public` |
| `ALLOW_PUBLIC_UPLOAD` | `false` | Must be exactly `true` to permit public visibility |
| `TTS_VOICE` | `en-US-JennyNeural` | Edge TTS voice |
| `DEFAULT_LANGUAGE` | `en` | Video metadata language |
| `DEFAULT_AUDIO_LANGUAGE` | `en-US` | Spoken audio language |
| `FFMPEG_PRESET` | `medium` | Encoding quality/speed trade-off |

## Local checks

Install dependencies with `npm ci`, install FFmpeg and `edge-tts`, and run `npm test`. A real run requires valid Google credentials, the verified asset manifest, and the relevant runtime settings. Keep generated `credentials.json`, `token.json`, `voice/`, and `output/` files out of version control.

## Content quality guidance

The generator reads `content-briefs.json` instead of selecting one long script template. Each brief has a distinct topic, format, scene, insight, action, and viewer question. The renderer uses different structures for myth-versus-reality, mini-case, conversation script, practical checklist, reflective letter, three-part lesson, and journal prompt. This creates real editorial variation rather than merely changing a hook or swapping an image.

Use the briefs as researched starting points, not as a substitute for editorial review. To add a new format, add a new brief with a new `format` value and add its narration structure to `renderBrief()` in `index.js`. To test one format locally, set `CONTENT_FORMAT` to a supported value. Avoid diagnosing viewers, making absolute claims about relationships, or presenting the script as therapy. A human should check factual tone, originality, readability, voice pronunciation, image suitability, licensing, and the final disclosure before a video is made public.

## Sources

1. [YouTube channel monetization policies](https://support.google.com/youtube/answer/1311392)
2. [Disclosing use of GenAI content](https://support.google.com/youtube/answer/14328491)
3. [YouTube Videos API reference](https://developers.google.com/youtube/v3/docs/videos)
