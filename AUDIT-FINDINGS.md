# User video production audit

The supplied sample video was inspected at 540x960, H.264/AAC, 24 fps. The container duration was 107 seconds, while speech transcription measured approximately 55.4 seconds. This indicates a long silent tail or video-only tail after the narration finishes.

The visual review found four clearly different source scenes and readable scene labels. However, long subtitle blocks were placed as large centered paragraphs, which makes the visual feel like a slide rather than a paced short-form video. Some labels and captions compete for attention, and the final scene remains on screen after the spoken content has finished.

The production pipeline should therefore: derive the final duration from the narration, avoid a silent tail, break subtitles into shorter caption chunks, reduce caption density, apply per-format motion and transition presets, show a small number of purposeful overlays, normalize voice audio, and fail if the rendered output contains an excessive tail beyond the audio duration.

The uploaded sample itself was not public-uploaded by this audit. It was used only for technical and visual review.

## Re-render verification

After the first audit, the pipeline was corrected to derive scene timing from the narration duration rather than using fixed 30-second image segments. A subtitle normalizer was added to split long Edge TTS cues into short captions of at most seven words per cue. The corrected 540x960 sample rendered at 55.375 seconds, matching the approximately 55-second narration, with no long silent tail. Five time-sampled frames showed all four scenes were used and captions were shorter and less paragraph-like.

The production presets now vary zoom direction, transition family, scene labels, and caption placement across the supported editorial formats. Full scheduled renders remain 1080x1920 at 24 fps; the 540x960 sample is only a fast local verification render.
