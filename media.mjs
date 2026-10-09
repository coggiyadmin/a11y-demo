// Media and captions.
//
// The audio-alternative axis was the thinnest coverage in the corpus, and it is also where
// automation is weakest in an interesting way: a tool can see that a <track> element
// exists, but not whether the captions are accurate, synchronised, or identify who is
// speaking. Those are `cannot-tell` — examined, outcome needs a person — and the
// corpus marks them as such rather than letting a present-but-useless track count
// as a pass.
//
// Captions also help in a noisy room or with audio muted, and transcripts help anyone
// who would rather read than watch. That is recorded through taxonomy/criterion-needs.json.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIR = path.join(ROOT, 'media');

const page = (title, body, head = '') => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="../fixture.css">${head}
</head>
<body>
<main>
<h1>${title}</h1>
${body}
</main>
<p><a href="../index.html">Back to the index</a></p>
</body>
</html>`;

// A tiny real WebVTT file, so the "correct" cases have something genuine to point at
// and a parser has something to parse.
const VTT_GOOD = `WEBVTT

00:00:00.000 --> 00:00:03.000
<v Agent>Your flight leaves from gate 14.

00:00:03.000 --> 00:00:06.000
<v Traveller>Which terminal is that?

00:00:06.000 --> 00:00:09.000
<v Agent>Terminal 5. Boarding closes 20 minutes before departure.
`;

// Present, parseable, and useless: no speaker identification, no sound description,
// and the timings do not line up with anything. A tool sees a track; a person sees
// that it does not do the job.
const VTT_POOR = `WEBVTT

00:00:00.000 --> 00:00:30.000
[inaudible]
`;

const CASES = [
  {
    id: 'video_no_captions',
    sc: ['1.2.2'], outcome: 'fail', confidence: 'definite',
    brokenNote: 'Prerecorded video with spoken dialogue and no caption track at all. The absence of '
      + 'a track is machine-detectable, so this is a definite fail rather than a judgement call.',
    broken: `<video controls preload="none" poster="../pixel.png" width="320">
  <source src="flight-info.mp4" type="video/mp4">
</video>`,
    correctNote: 'A caption track is declared, default, and language-tagged.',
    correct: `<video controls preload="none" poster="../pixel.png" width="320">
  <source src="flight-info.mp4" type="video/mp4">
  <track kind="captions" src="flight-info.vtt" srclang="en" label="English" default>
</video>`,
  },
  {
    id: 'captions_present_but_poor',
    sc: ['1.2.2'], outcome: 'cannot-tell', confidence: 'possible',
    brokenNote: 'A caption track IS present, so a presence check passes — but it says only '
      + '"[inaudible]" across the whole runtime, identifies no speaker and is not '
      + 'synchronised. This is the case that proves presence is not conformance. The honest '
      + 'automated outcome is cannot-tell, NOT pass.',
    broken: `<video controls preload="none" poster="../pixel.png" width="320">
  <source src="flight-info.mp4" type="video/mp4">
  <track kind="captions" src="poor.vtt" srclang="en" label="English" default>
</video>
<p>A presence check reports this as captioned. Open <a href="poor.vtt">poor.vtt</a>.</p>`,
    correctNote: 'Captions carry speaker identification and timed, meaningful text.',
    correct: `<video controls preload="none" poster="../pixel.png" width="320">
  <source src="flight-info.mp4" type="video/mp4">
  <track kind="captions" src="flight-info.vtt" srclang="en" label="English" default>
</video>
<p>Open <a href="flight-info.vtt">flight-info.vtt</a> — speakers named, timings meaningful.</p>`,
  },
  {
    id: 'audio_no_transcript',
    sc: ['1.2.1'], outcome: 'fail', confidence: 'probable',
    brokenNote: 'Audio-only content with no transcript. Nothing on the page conveys what is said.',
    broken: `<audio controls preload="none"><source src="announcement.mp3" type="audio/mpeg"></audio>`,
    correctNote: 'A transcript is on the page, not behind a link that may not exist.',
    correct: `<audio controls preload="none"><source src="announcement.mp3" type="audio/mpeg"></audio>
<h2 id="t">Transcript</h2>
<p><strong>Agent:</strong> Your flight leaves from gate 14.</p>
<p><strong>Traveller:</strong> Which terminal is that?</p>
<p><strong>Agent:</strong> Terminal 5. Boarding closes 20 minutes before departure.</p>`,
  },
  {
    id: 'video_no_audio_description',
    sc: ['1.2.3', '1.2.5'], outcome: 'cannot-tell', confidence: 'possible',
    brokenNote: 'Video whose meaning depends on what is shown, with no audio description and '
      + 'no text alternative. Whether description is NEEDED depends on the content, so a tool '
      + 'can flag the absence but cannot decide the outcome.',
    broken: `<video controls preload="none" poster="../pixel.png" width="320">
  <source src="seat-map.mp4" type="video/mp4">
  <track kind="captions" src="flight-info.vtt" srclang="en" label="English" default>
</video>`,
    correctNote: 'A descriptions track plus a text alternative covering the visual content.',
    correct: `<video controls preload="none" poster="../pixel.png" width="320">
  <source src="seat-map.mp4" type="video/mp4">
  <track kind="captions" src="flight-info.vtt" srclang="en" label="English" default>
  <track kind="descriptions" src="seat-map-desc.vtt" srclang="en" label="Descriptions">
</video>
<h2>What the video shows</h2>
<p>The seat map highlights row 14 at the front of the cabin, then zooms to show the
   extra legroom seats shaded in a darker tone and labelled "extra legroom".</p>`,
  },
  {
    id: 'live_no_captions',
    sc: ['1.2.4'], outcome: 'fail', confidence: 'probable',
    brokenNote: 'A live stream with no caption mechanism. Live captioning cannot be added after '
      + 'the fact, so this is a build-time decision, not a content fix.',
    broken: `<video controls autoplay muted width="320" aria-label="Live boarding announcements">
  <source src="live-stream.mp4" type="video/mp4">
</video>`,
    correctNote: 'A live caption region is present and announced politely as text arrives.',
    correct: `<video controls autoplay muted width="320" aria-label="Live boarding announcements">
  <source src="live-stream.mp4" type="video/mp4">
</video>
<h2 id="lc">Live captions</h2>
<div role="log" aria-live="polite" aria-labelledby="lc"><p>Agent: Boarding group 2 at gate 14.</p></div>`,
  },
  {
    id: 'alert_by_sound_only',
    sc: ['1.1.1', '4.1.3'], outcome: 'fail', confidence: 'definite',
    brokenNote: 'A session warning signalled by a beep and nothing else. Unavailable when audio '
      + 'cannot be perceived, with sound muted, or in a noisy room — the same defect '
      + 'blocks both audio-alternative and environmental-resilience needs.',
    broken: `<button type="button" onclick="new Audio('beep.mp3').play()">Start checkout timer</button>
<p>You will hear a tone when your reservation is about to expire.</p>`,
    correctNote: 'The same warning as visible text in a live region, with the sound optional.',
    correct: `<button type="button"
  onclick="document.getElementById('w').textContent='Your reservation expires in 2 minutes.'">Start checkout timer</button>
<div id="w" role="status" aria-live="assertive"></div>
<p>A visible warning appears here, and a tone plays if sound is enabled.</p>`,
  },
  {
    id: 'autoplay_no_control',
    sc: ['1.4.2'], outcome: 'fail', confidence: 'definite',
    brokenNote: 'Audio starts automatically and runs past three seconds with no pause control. '
      + 'It also masks screen-reader output, blocking non-visual operation as well as interrupting everyone.',
    broken: `<audio autoplay loop><source src="ambient.mp3" type="audio/mpeg"></audio>
<p>Background audio starts on load with no way to stop it.</p>`,
    correctNote: 'Not autoplaying, and a control is available regardless.',
    correct: `<audio controls preload="none"><source src="ambient.mp3" type="audio/mpeg"></audio>
<p>Audio plays only when started, and can be paused.</p>`,
  },
  {
    id: 'captions_unlabelled_track',
    sc: ['1.2.2'], outcome: 'fail', confidence: 'probable',
    brokenNote: 'A track element with no srclang and no label, so a player cannot present a '
      + 'meaningful caption choice and a user cannot tell what language they would get.',
    broken: `<video controls preload="none" poster="../pixel.png" width="320">
  <source src="flight-info.mp4" type="video/mp4">
  <track kind="captions" src="flight-info.vtt">
</video>`,
    correctNote: 'srclang and label present, so the track is identifiable and selectable.',
    correct: `<video controls preload="none" poster="../pixel.png" width="320">
  <source src="flight-info.mp4" type="video/mp4">
  <track kind="captions" src="flight-info.vtt" srclang="en" label="English" default>
  <track kind="captions" src="flight-info-fr.vtt" srclang="fr" label="Français">
</video>`,
  },
];

// Real media, emitted by this generator.
//
// These were previously references to files that did not exist. That is not a
// harmless shortcut: a <video autoplay> or <audio autoplay> pointing at a missing
// source makes the browser wait out its load timeout on every scan — measured at
// roughly 20s per page on one engine, on three fixtures, every run. A fixture must
// not be pathological for the tools under test.
//
// Each is the smallest valid file ffmpeg will produce: a 1-second 160x120 black
// H.264 clip and 1-second silent mono MP3s, all under 2KB. They are embedded here
// rather than committed as loose binaries because this generator wipes its own
// directory, so anything not emitted here would vanish on the next run.
const MEDIA = {
  'flight-info.mp4': 'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAN3bW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAA+gAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAqF0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAKAAAAB4AAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAPoAAAQAAABAAAAAAIZbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAAKABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABxG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAYRzdGJsAAAAwHN0c2QAAAAAAAAAAQAAALBhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAKAAeABIAAAASAAAAAAAAAABFUxhdmM2Mi4yOC4xMDEgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAANmF2Y0MBZAAK/+EAGmdkAAqs2UKEflwEQAAAAwBAAAADAoPEiWWAAQAFaO+Blyz9+PgAAAAAEHBhc3AAAAABAAAAAQAAABRidHJ0AAAAAAAAGFgAAAAAAAAAGHN0dHMAAAAAAAAAAQAAAAUAAAgAAAAAFHN0c3MAAAAAAAAAAQAAAAEAAAA4Y3R0cwAAAAAAAAAFAAAAAQAAEAAAAAABAAAoAAAAAAEAABAAAAAAAQAAAAAAAAABAAAIAAAAABxzdHNjAAAAAAAAAAEAAAABAAAABQAAAAEAAAAoc3RzegAAAAAAAAAAAAAABQAAAtsAAAAMAAAADAAAAAwAAAAMAAAAFHN0Y28AAAAAAAAAAQAAA6cAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjYyLjEyLjEwMQAAAAhmcmVlAAADE21kYXQAAAKsBgX//6jcRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY1IHIzMjIyIGIzNTYwNWEgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDI1IC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MSByZWY9MSBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgzOjB4MTEzIG1lPWhleCBzdWJtZT0yIHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTAgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0wIDh4OGRjdD0xIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PTAgdGhyZWFkcz00IGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MyBiX3B5cmFtaWQ9MiBiX2FkYXB0PTEgYl9iaWFzPTAgZGlyZWN0PTEgd2VpZ2h0Yj0xIG9wZW5fZ29wPTAgd2VpZ2h0cD0xIGtleWludD0yNTAga2V5aW50X21pbj01IHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9MTAgcmM9Y3JmIG1idHJlZT0xIGNyZj01MS4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAJ2WIhAAS/8MjFaf/wpDapsY1SXyZn4ZjOkMymbOGj0gBIQC9IitUEQAAAAhBmiQYh/8DFgAAAAhBnkJCCH8U0QAAAAgBnmFEP/8VsAAAAAgBnmNEP/8VsQ==',
  'seat-map.mp4': 'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAN3bW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAA+gAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAqF0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAKAAAAB4AAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAPoAAAQAAABAAAAAAIZbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAAKABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABxG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAYRzdGJsAAAAwHN0c2QAAAAAAAAAAQAAALBhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAKAAeABIAAAASAAAAAAAAAABFUxhdmM2Mi4yOC4xMDEgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAANmF2Y0MBZAAK/+EAGmdkAAqs2UKEflwEQAAAAwBAAAADAoPEiWWAAQAFaO+Blyz9+PgAAAAAEHBhc3AAAAABAAAAAQAAABRidHJ0AAAAAAAAGFgAAAAAAAAAGHN0dHMAAAAAAAAAAQAAAAUAAAgAAAAAFHN0c3MAAAAAAAAAAQAAAAEAAAA4Y3R0cwAAAAAAAAAFAAAAAQAAEAAAAAABAAAoAAAAAAEAABAAAAAAAQAAAAAAAAABAAAIAAAAABxzdHNjAAAAAAAAAAEAAAABAAAABQAAAAEAAAAoc3RzegAAAAAAAAAAAAAABQAAAtsAAAAMAAAADAAAAAwAAAAMAAAAFHN0Y28AAAAAAAAAAQAAA6cAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjYyLjEyLjEwMQAAAAhmcmVlAAADE21kYXQAAAKsBgX//6jcRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY1IHIzMjIyIGIzNTYwNWEgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDI1IC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MSByZWY9MSBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgzOjB4MTEzIG1lPWhleCBzdWJtZT0yIHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTAgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0wIDh4OGRjdD0xIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PTAgdGhyZWFkcz00IGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MyBiX3B5cmFtaWQ9MiBiX2FkYXB0PTEgYl9iaWFzPTAgZGlyZWN0PTEgd2VpZ2h0Yj0xIG9wZW5fZ29wPTAgd2VpZ2h0cD0xIGtleWludD0yNTAga2V5aW50X21pbj01IHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9MTAgcmM9Y3JmIG1idHJlZT0xIGNyZj01MS4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAJ2WIhAAS/8MjFaf/wpDapsY1SXyZn4ZjOkMymbOGj0gBIQC9IitUEQAAAAhBmiQYh/8DFgAAAAhBnkJCCH8U0QAAAAgBnmFEP/8VsAAAAAgBnmNEP/8VsQ==',
  'live-stream.mp4': 'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAN3bW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAA+gAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAqF0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAKAAAAB4AAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAPoAAAQAAABAAAAAAIZbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAAKABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABxG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAYRzdGJsAAAAwHN0c2QAAAAAAAAAAQAAALBhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAKAAeABIAAAASAAAAAAAAAABFUxhdmM2Mi4yOC4xMDEgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAANmF2Y0MBZAAK/+EAGmdkAAqs2UKEflwEQAAAAwBAAAADAoPEiWWAAQAFaO+Blyz9+PgAAAAAEHBhc3AAAAABAAAAAQAAABRidHJ0AAAAAAAAGFgAAAAAAAAAGHN0dHMAAAAAAAAAAQAAAAUAAAgAAAAAFHN0c3MAAAAAAAAAAQAAAAEAAAA4Y3R0cwAAAAAAAAAFAAAAAQAAEAAAAAABAAAoAAAAAAEAABAAAAAAAQAAAAAAAAABAAAIAAAAABxzdHNjAAAAAAAAAAEAAAABAAAABQAAAAEAAAAoc3RzegAAAAAAAAAAAAAABQAAAtsAAAAMAAAADAAAAAwAAAAMAAAAFHN0Y28AAAAAAAAAAQAAA6cAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjYyLjEyLjEwMQAAAAhmcmVlAAADE21kYXQAAAKsBgX//6jcRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY1IHIzMjIyIGIzNTYwNWEgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDI1IC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MSByZWY9MSBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgzOjB4MTEzIG1lPWhleCBzdWJtZT0yIHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTAgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0wIDh4OGRjdD0xIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PTAgdGhyZWFkcz00IGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MyBiX3B5cmFtaWQ9MiBiX2FkYXB0PTEgYl9iaWFzPTAgZGlyZWN0PTEgd2VpZ2h0Yj0xIG9wZW5fZ29wPTAgd2VpZ2h0cD0xIGtleWludD0yNTAga2V5aW50X21pbj01IHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9MTAgcmM9Y3JmIG1idHJlZT0xIGNyZj01MS4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAJ2WIhAAS/8MjFaf/wpDapsY1SXyZn4ZjOkMymbOGj0gBIQC9IitUEQAAAAhBmiQYh/8DFgAAAAhBnkJCCH8U0QAAAAgBnmFEP/8VsAAAAAgBnmNEP/8VsQ==',
  'announcement.mp3': 'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYyLjEyLjEwMQAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAEAAABVgANTU1NTU1Q0NDQ0NDUFBQUFBQXl5eXl5ea2tra2tra3l5eXl5eYaGhoaGhpSUlJSUlKGhoaGhoaGvr6+vr6+8vLy8vLzKysrKysrX19fX19fX5eXl5eXl8vLy8vLy////////AAAAAExhdmM2Mi4yOAAAAAAAAAAAAAAAACQCgAAAAAAAAAVYCAC0GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/+MYxAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxDsAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxHYAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxLEAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  'ambient.mp3': 'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYyLjEyLjEwMQAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAEAAABVgANTU1NTU1Q0NDQ0NDUFBQUFBQXl5eXl5ea2tra2tra3l5eXl5eYaGhoaGhpSUlJSUlKGhoaGhoaGvr6+vr6+8vLy8vLzKysrKysrX19fX19fX5eXl5eXl8vLy8vLy////////AAAAAExhdmM2Mi4yOAAAAAAAAAAAAAAAACQCgAAAAAAAAAVYCAC0GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/+MYxAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxDsAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxHYAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxLEAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  'beep.mp3': 'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYyLjEyLjEwMQAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAABwAAAtAAZmZmZmZmZmZmZmZmZmaAgICAgICAgICAgICAgJmZmZmZmZmZmZmZmZmZs7Ozs7Ozs7Ozs7Ozs7OzzMzMzMzMzMzMzMzMzMzm5ubm5ubm5ubm5ubm5v//////////////////AAAAAExhdmM2Mi4yOAAAAAAAAAAAAAAAACQEIAAAAAAAAALQl00y2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/+MYxAANCQ59mUF4ACqqBTkH43kAAAA8YxjfkAAPmMb/ADMf/+b4YDQE3HrLmzn5f3f7v8MdPuygDD+TBDl393SqEED0EAAG/+MYxAYOcT6U8YGgAC/4QkL/EYQ/6ReLxiXSA//lIgwZ0AwqFxEWMS7TAooC34iL84EzwFlhVfLoNBUFREe/8FYAaVqEDUST/+MYxAcNURZO+cHgAv/+SX+cK/3/+9fVjPF5AUAAECGCzib2jJjQLgYOxitDwuC35b6P////b//7f/vq/nED0Dpq2F7wIAQY/+MYxAwOSS4MAAC8wAWBCYEgKBg1hvmN4Nefs5jRjngAGDMASAgQgwBFCperzTlSrl////6f/s//9FUAv//3/zv+hz/kFnka/+MYxA0OYSpQEULgAncJG7esMLb6VTABwOTJAxEBDAQAUhyJz+edJYGh+JDmsEOUdwxyn//////+pRhxA2nxxAwun4AIFgCa/+MYxA4QgVp8AYKQAHmhPkULhFxzFVKq/IAKDBBQGEh8gucpkUSRKRk7L/5NmZcL6zAzWCf/iwXFRYXFf/xZbBZMQU1FMy4x/+MYxAcAAANIAcAAADAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
};

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
for (const [name, data] of Object.entries(MEDIA)) {
  fs.writeFileSync(path.join(DIR, name), Buffer.from(data, 'base64'));
}
fs.writeFileSync(path.join(DIR, 'flight-info.vtt'), VTT_GOOD);
// second language track for captions_unlabelled_track's corrected twin
fs.writeFileSync(path.join(DIR, 'flight-info-fr.vtt'),
  'WEBVTT\n\n00:00:00.000 --> 00:00:03.000\n<v Agent>Votre vol part de la porte 14.\n');
fs.writeFileSync(path.join(DIR, 'poor.vtt'), VTT_POOR);
fs.writeFileSync(path.join(DIR, 'seat-map-desc.vtt'),
  'WEBVTT\n\n00:00:00.000 --> 00:00:04.000\nThe seat map highlights row 14 at the front of the cabin.\n');

const cases = [];
for (const c of CASES) {
  for (const [kind, body, note] of [['broken', c.broken, c.brokenNote], ['correct', c.correct, c.correctNote]]) {
    const file = kind === 'broken' ? `${c.id}.html` : `safe_${c.id}.html`;
    const outcome = kind === 'broken' ? c.outcome : 'pass';
    const header = `<!--\n  ${c.id} — ${kind}\n  WCAG: ${c.sc.join(', ')}\n  expected outcome: ${outcome}\n  ${note}\n-->\n`;
    fs.writeFileSync(path.join(DIR, file), header + page(`${c.id} — ${kind}`, `<p>${note}</p><hr>${body}`));
    cases.push({
      id: `media-${kind === 'broken' ? c.id : 'safe_' + c.id}`,
      mode: kind === 'broken' ? 'tp' : 'safe',
      path: `media/${file}`,
      surface: 'media', journey: 'media-player', ui_state: 'default',
      method: ['static-source', 'media-analysis', kind === 'broken' && c.outcome === 'cannot-tell' ? 'guided-manual' : 'runtime-dom'],
      input_at: ['keyboard', 'pointer'],
      // broken cases whose outcome is cannot-tell must NOT be scored as recall misses:
      // the engine cannot be expected to decide them
      min_criteria: kind === 'broken' && c.outcome === 'fail' ? Object.fromEntries(c.sc.map((s) => [s, 1])) : {},
      must_not_report: kind === 'correct' ? c.sc : [],
      expected_outcome: outcome,
      confidence: kind === 'broken' ? c.confidence : 'definite',
      notes: note,
    });
  }
}

fs.writeFileSync(path.join(DIR, 'index.html'), page('media fixtures',
  `<p>Captions, transcripts, audio description and sound-only signalling.</p>
   <p>Several of these are <strong>cannot-tell</strong>, not fail: a tool can see that a
   caption track exists but cannot judge whether the captions are accurate, synchronised,
   or identify the speaker. <code>captions_present_but_poor</code> exists to prove the
   point — a presence check passes it, and the captions say only "[inaudible]".</p>
   <ul>${CASES.map((c) => `<li><a href="${c.id}.html">${c.id}</a> ·
     <a href="safe_${c.id}.html">corrected</a> — ${c.sc.join(', ')} — <em>${c.outcome}</em></li>`).join('\n')}</ul>`));

fs.writeFileSync(path.join(ROOT, 'media.json'), JSON.stringify({
  description: 'Media and captions. Includes cases whose honest automated outcome is '
    + 'cannot-tell rather than pass or fail — presence of a caption track is not conformance.',
  generated: new Date().toISOString().slice(0, 10),
  counts: {
    pairs: CASES.length, cases: cases.length,
    definite_fail: CASES.filter((c) => c.outcome === 'fail').length,
    cannot_tell: CASES.filter((c) => c.outcome === 'cannot-tell').length,
  },
  cases,
}, null, 2) + '\n');

console.log(`${CASES.length} pairs → ${cases.length} cases`);
console.log(`  machine-decidable fail: ${CASES.filter((c) => c.outcome === 'fail').length}`);
console.log(`  cannot-tell (needs a person): ${CASES.filter((c) => c.outcome === 'cannot-tell').length}`);
