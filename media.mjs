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
    // 1.2.2 asks for captions for the AUDIO content of synchronized media, so the
    // clip must carry an audio track for the criterion to apply at all. It used to
    // be a video-only stream, which made this case inapplicable rather than failing
    // (#54). flight-info.mp4 now has an audio stream for its full 9 seconds.
    brokenNote: 'Prerecorded synchronized media — the clip has an audio track for its full nine '
      + 'seconds — and no caption track at all. The absence of a track on a video with audio is '
      + 'machine-detectable, so this is a definite fail rather than a judgement call.',
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
    // Relabelled from a 1.2.2 fail to a pass (#54). The page DOES provide captions:
    // a <track kind="captions"> that the browser loads and the player offers. HTML
    // requires srclang only for kind="subtitles", and label is optional for every
    // kind; a player falls back to a generic name. An unhelpful caption menu entry
    // is a usability and authoring-quality problem, not a missing caption, and no
    // WCAG 2.2 success criterion or failure technique covers it. No honest 1.2.2
    // failure fits the case's name, so rather than redesign the page into a
    // different case under a permanent ID, the ground truth now says what the page
    // is: captioned. A tool that reports 1.2.2 here is reporting a false positive.
    id: 'captions_unlabelled_track',
    sc: ['1.2.2'], outcome: 'pass', confidence: 'definite',
    brokenNote: 'A caption track with no srclang and no label. Captions ARE provided — the track '
      + 'is kind="captions", loads, and is offered by the player — so 1.2.2 is satisfied. The '
      + 'missing language and label make the caption menu less helpful, which is an authoring '
      + 'best practice (HTML requires srclang only for subtitles), not a WCAG 2.2 failure. '
      + 'Expected outcome: pass; reporting 1.2.2 here is a false positive.',
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
// Most are the smallest valid file ffmpeg will produce: a 1-second 160x120 black
// H.264 clip and 1-second silent mono MP3s, all under 2KB. They are embedded here
// rather than committed as loose binaries because this generator wipes its own
// directory, so anything not emitted here would vanish on the next run.
//
// flight-info.mp4 is the exception (#54). The caption cases assert 1.2.2, which is
// about captions for the AUDIO in synchronized media, and a video-only clip made
// them inapplicable. It is now 9 seconds — the length of flight-info.vtt — of
// black 160x120 H.264 frames plus a mono AAC audio track, about 17KB. The audio is
// generated, not recorded: an amplitude-modulated tone at a 4 Hz
// syllable rate, one pitch per speaker turn, in the three cue windows of the
// caption file. It contains no recorded voice, so it carries no third-party rights
// and is redistributable under this project's licence. Regenerate with:
//
//   ffmpeg -f lavfi -i "color=c=black:s=160x120:r=4:d=9" \
//     -f lavfi -i "aevalsrc='0.3*sin(2*PI*if(between(t\,3\,6)\,300\,200)*t)*(0.5+0.5*sin(2*PI*4*t))*between(mod(t\,3)\,0.2\,2.6)':s=16000:d=9" \
//     -map 0:v -map 1:a -c:v libx264 -preset veryslow -crf 51 -tune stillimage \
//     -pix_fmt yuv420p -c:a aac -b:a 12k -ac 1 -shortest -map_metadata -1 \
//     -fflags +bitexact -flags:v +bitexact -flags:a +bitexact -movflags +faststart \
//     flight-info.mp4
//
// The frames are deliberately blank: text burned into the picture would be open
// captions, and would satisfy 1.2.2 on the page meant to fail it.
const MEDIA = {
  'flight-info.mp4': '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6wT5TvibwCc7zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz3ABAi8QViRRQeO3HV8aly4REiIiAGBsQY1lESF7PkPY/TSfvPcTNiXH4pmWWWWWUGBgYGBgYGBgYGBgYGBgaeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeefgAAAAoBnhhmiCec/xFxAQYvCCAbEASKlHy+r1erlySSJJEhBPOCPjiiTd+S1n3lJeCcKSqqcc8888888884MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMblllllllllllllllll4ARIvADY002vrWrly5JIkiJEAALENZKJKDqSXgXoRHgGW3E/xM000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003AAQgvEFYgChim32+93dySJIiRIiAJCQkJMNbpM2oJ8t6KT1EfA4UbBISEhISEhISEhISE/R5555555555555555555555555555555555555555555555555555555555555555555555555557gBBi8IIBsZZfP2/njWrl3JJIkiJEB54pFXJyas3gvXSfB3zOleeFGNeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee4AAAAAKAZ4YrUgnnP8RcQEELxBWIApl45+3/Mly5LiSJEiIAMDSylI+fCN1RDgOUJcyZQzF4NLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLwBEC8AJBsQBTL+Pv8a1q7kuSERESBPsAHrOzCXffQBLwztSV0bbvXr169evXga8DAwMDAwMDAwMDAwMDAwMDAwMDA0ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssvAAP4vEFYk05+V/V3cu5ckkkkkSQHSTekWLuS1YRC/0Ih1/gdiQ1Yk4YGBk00000000000000000000000000000000000000000000000000000000000000000000000000000000000003AAQgvEFYgCWW/49//Pi5JJJIiRIiAEhN0qAQsmeQTqY+VIrhCij6fT6c/O8888888888888888888888888888888888888888888888888888888888888888888888888888888889wAAAACgGeGM1IJ5z/EXEBGC8AViAKEKp+8vUl3JciSSRJAMElEhHDcGI+qvqFWXS8rnUNBgYGBgZEDI6XnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnuAQgvEFYi05/P2/383cuS5EkSIkQAYGllA1vXWDzy7jKwdQ4xRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRcAQovCFYi07+ft/p8auXJciSJESIHNOecAbhAs0g2RUi40CIc0888888888888888888888888888888888888888888888888888888888888888888888888888888888888888/AEMLwAkGxAFMvD8XqXLuS5IkkkSQLoLQycElSUS9O/Aoh8g9dgGp2wMDAyY9NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNwAAAAoBnhjtSCec/xFwAQYvEFYi05/p/b/1++rkkkkSJESIASEpTgBjeOgn8fjq4CDz30+n0166KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKOABEi8AIhsQBLLl+NauXLkuJJJEiA1mGyWRZoCPLuokeA28Bhvj9/v96f3p/bzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz3AQQvCFYkUUHj+nf/PV8XqS4iIkREDjlR8gA2TB0QezyrwFyyyyyyyyygwMDAwMDAwMDAwMDEp5555555555555555555555555555555555555555555555555555555555555555555+AEGLxAgGxAEsv+nr/5l3cktJIkRIkAMDAGMuhhAuUxwkDmnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn4AAAACgGeGQ1IJ5z/EXABNi8AViAJZfP/46vUuS5EiRIiQABl1AJFFLo1wUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUcBCC8QViAKZc/18f+96lyXEkSIkRAEhMISAIfyuTTYCNZAJCQkJCQkJOBISEzHJpgmaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabgEILwhWItOf4+f+fOtXclySRIiRECXk94A38nkJhj2fAjcPox55555555555555555555555555555555555555555555555555555555555555555555555555555555555555557gAQYvCCAbEAUy/6ft/+er1Lu5JJEkSRIIogAS7AWIWh0zUJZZZZZZZZZZZQaWUGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBrxIGBgYGJXgYGBgYkDDuAAAAAEUGaGkk1AgLRMpgQYzn/ABPxAQYvCFYk07/t/H/t+81q5ciREREiA859gBOMGLaSNpHgW5a9evXr168DAwMDAwMDAwNKDSyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy8AT4vACIbEWnm/9L1q7lySSRJEiIAADkTBjTE/i9tFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFHABCi8Lzx//T+f//vXWpEkkiREiIH0+geCYx0GoN9Of6c/O8888888888888888888888888888888888888888888888888888888888888888888888888888888889wBNC8AViAJZfP/6au7ly5EkSJEgAE5n0WTZ8tmbYPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPcAAAACkGeIaXEFs5/DUgBCC8EgBTLx//c/p//1u5LkkkSIkRIP5/zaktQGllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllll4ABCC8IViAJZeP47/9tauXLlyJJEkSQTznnAGUnFtInoyYJ5555555555555555555555555555555555555555555555555555555555555555555555555555555555555555+AD6LyzI8EEF7f9nn/FbkuXcuSSfcAYOI64ZV+mRkPHAYKslxvzOQ9h8dszGKiVEaZE3Y1tH/M+WBh6aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaiiiijXRwAUJPE8+fn9v+/4vV3LuSXEkkiSQACnHuH1nYceHn3gAAB4w8PeAAMPaHh72AAA9oefXYAACrQ8PewAAHtDw9dgAAKtDw9dgAAKtDw9dgAAO4eHvYAAD2h4e9gAAPaHh67AAAe3gAAAAKAZ4pRaIJ5z8RcAEYlG7zS+w7Dsffx5+Zl/D26I/GwQlxCPGtaTpQqnD2vhZMhLPBbcX7L0flllPEREREEpWrJcj5oS4fidhkp8zTRKdN+WJPf8USQjuokY3rxIY+6iWFwpKRGJXbpKNEJRopJKCUOESQfgEY4AcBGCAHAAAACgGeKWWiCec/EXEBGCAHARggBwEYIAcBGCAHAAAACgGeKYWiCec/EXEBGCAHARhABwEClZg7vu+77T72+8TX/9zv/v+on4v//U/08z24WHp/9vX37SzEf6PwnnGtMQIHAQATACZMDYgPqn7z7Z8R5x+8+qfaPriKdQJ/JHTsqWxsyEcMeE50ikqwBw2i2dQEZIKmNdhyIGWfKohpHBQyU9fWGQRSuWWAEYhiTRZI+w776AIoBgRI97d9716zQ/vo15hyVVv737VZpyL4t2kIsgS8iXTS8OXREaMYlMhEZEAlFaRSEjBikThIuhTMWVRysGVQEZkMlIgkYriU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eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh/ARiU2vsOw7Ds/H4/PtwBFSQYpKjPu6BuYkgRIiyVabGXF3axIIP/4kg3+YkQf64kIP57HwPqX/l9S/jcARjgBwEYIAcAAAAKAZ47DNIJ5z8RcAEYIAcBGCAHARggBwEYIAcAAAAKAZ47LNIJ5z8RcQEYIAcBGEAHAQKVNDu+77vtPx+Cp9/b//B9/18+Rf1//nf9bn3LDH4OgvwF4fwPDCCYZCAMgA92GyAGpAdudUcYbcIFeQcMgJRBICEauQqwiECeQnOXccFjc7x76IRqMyubdjtildDsGZQP/zu5MGJ6L9Nf+/8MycXBQWaSQ+n9WEiMIhP+JW8z15nYeVQ80o5Lxn6b5HRrPGzjzrmHi1R0aowlvN1S+vec8xcakTD16RILPuuctZZvokdZEySRDkRluUnbbH5HBUOXVq1ivkiod3AoqFQJf6vzVBD7l7x4u662SRWgkcpJwceqIkESEC7jWaPHoP41jB/c49D/5fxfv1nBsUH4r0n8j693T2V8V2DzVs3gARjvLQiCcABLvrmaJIlpAid09Ylxt61+e/pf5v82DJIYPbkPKX1RIdrjEMAbV34L9d+e9e4uxaLLRqVpaWlZSixfzX60dhBQVmwKCl2goKasCv+UFDff3hP8fGZ3394T/Hw2n394T/Hw2n394T/HwZPv7wn+Pht3394T/HwZPv7wn+Pgzvv7wn+PjgAAAAoBnjtM0gnnPxFwAPovEFYgDAiu9/T/et3LkuRJEkSIAT/mmDDTM9EsZoiXwN93Efhdgrsyb94+K/efefeooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo4AEELxhWJNL/Rr8LkkSSRIiREDOzthj2lid8kZtIjxHyqR8hcTI2wFAd36TqkJCQkJCQkJOHJpppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppuAAPwvEFYmEWHv4ef18Xd3LkkSSJLVACe1ugZQ3Q5OdjSfNPDhPu3BydAI0zmX637bnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnv3+/3+/3+/3+/3+3nnnnnnnnnnnnnnnnnnuAD+LxBWJRIsmvHpP9Ob4ltSQRIkRADA0oMaY6SGFzBD3h2wn8MtVM2Vf9D1eHLhLLLKDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA16eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeefgAAAAE0GaPGiNQIC2trRMpgAEE85/AP8A/i8QViAKZe/f2/9+b1dy5JJCIiIAYGvDgR10klK3hKh4CJZUtBBH+mf6r169evXr14GBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBjcsssssssssssssssssssssssssssssssssssssssssssssssssssvAA+i8QViYRYfPh8fXjV3JaS4kRIiAJ/zTBhpjCSHoCXP+JkbmBrIL/vkYfpw41UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUcAQYvGFYmKVW/DX88y5JJEiREiIGdnZ2rMNhJOLsSfdPAlB6bA4sbQKD4duODOzs7OzsXO88888888888888888888888888888888888888888888888888888888888888888888888888888889wECLwhWItPHa/i7u5ckkkSJEQOd57vBFXKLf0RHgn1nJ+7dKTzB423B55555555555555555555555555555555555555555555555555555555555555555555555555555555555555557gAAAApBnkPk8QWznw1JAQQvEFYgCmXfb+dy5LkkiRIkRADA0soiPjwjVlEPVviol8ad7RWjj79W0NLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLwEALxBWIjJR6/j3/39r1d3cuSJJEIgAwNeHAD1k55I8C7kv4KBPPPPPPPPPODXgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgaWUGBpZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZeAA9C8skEKICIav7Ov8zNyXcuSSSRNSABBzh9Ubd+LQ8sEXCkzvBDxbxGxKJ5lS1cPaY9RVzJ8wsgsFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFHAD6LxhWItPH7f8f+v0u5JJIkSIkQMcMcGdqwDg5OXiSZYVqCOg0b6fT6fT6fT6c/O88888888888888888888888888888888888888888888888888888888888888888888888888888889wAAAAKAZ5LhOiCec8RcAD+LwRWIA0IoAQhvtv7f/pO5Lly5JJI4sH9mswqUREcTwcjtuoy9Bm0S4VuMbtG5g3+/3+9Ol5555555555555555555555555555555555555555555555555555555555557gAPwvLImmf1/T/24yXJckkiRIiQBTx08dPHXkB4ETIDu7AhHivjwN8m0NLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLwAQYvEFYyyz+nf+/EuXJJJIiRIiAGBr3bADcIDiEKWMwCZpgpcMKN8uaeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeefgBAC8IViAKZd/18f/jN3Lly5JEkkSIBRRQASVj4pLFZfANVQgSv+Z8s+WBk0000000000000000000000000000000000000000000000000000000000000000000000000000000000003AAAAAKAZ5LpOiCec8RcAD6LxhWJNPf9v+n/v/KSSSRIiREiDHDHBnZwM/Nt1cpkl0DwDD/kQkJCQk5NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNwAQ4vACQbEASy/r3/73d3LlySJJEkQEvADOTWEQq/quEr9/v96dLzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz3AAQAvEFYkQUnr+3v/5/WXq5JIiJEREAMDSgwAbWhKILWZF4cjM/cepllllNygwMDAwMDEvlPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPwAPwvEFYgCwiu+3+vr/+GuZJckkiSIkSAG+jXrwBOJ8HgltiMCumumumumeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeefgAAAAKAZ5LxOiCec8RcQEELwhWIApl4/v+f/35cuXJJJESJEDXQvpAAuoeBB6hXB906qaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabgEGLxBWJNOf6+v+/V3LlyWkkSJEgBISEhIAhtEl0h+uigRuhISEhISEhISEhISEhISEhISEhISEhISEhIScCQk4EhISEhISEhISEhM0wSEnJgkJCTk000xyaaaYJmmmmmmmmmmmmmmmmmmmmmmmmmmmm4ABBi8IVjLLn/V/txeruS5JIiRIiB557vAHv08m3NE8KfgZZ4UY155555555555555555555555555555555555555555555555555555555555555555555555555555555555555557gBBC8QViAJZd/2/p//C7u5cuSSJJEkQAwNLKACVID4zhRPIRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRcYooooooooooooooooouAAAAACgGeTAxEgnnPEXABAC8IViAKZev+Pt//63erlyIiJERA+U8+wAereBgy+olYP65za9evXr14GBgYGBgYGBgaU3LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLwAECLwhWJNOf7Z/t8bu7ly5JEkSJEC6KP0ACfQW4PoRaLkm+WaMmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm4BCC8Lzx//U+3//zrrUiSSRIiRED6fQPBMY6DUG+nP9Od55555555555555555555555555555555555555555555555555555555555555555555555555555555557gAAAAKAZ5MLESCec8RcQEyLwBWIAll9v/3S7ly5JJEkSJAAJzaJiIJ9DkVw/enS88888888888888888888888888888888888888888888888888888888888888888888888888888888888889wAQgvHImnf/p+f/0+rlyXJJESJEQMcsckxJXF8D6Uizg0sssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssvAQYvCFYkEWHf9Of+vxly5ckkkSRIkD5c084AynQtaG90SBZe+jXp55555555555555555555555555555555555555555555555555555555555555555555555555555555555555+AAPIvGFYqIjQQQXP9P2/8v3lbS7uXJJPuCWM55ePtLQ/WrfKSi4IhlE84FNRnaGHrkm0bqFZgsgsg9NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNRRRRRRRwAAAAAoBnkxMRIJ5zxFwAQYvEFYgCmWfn/t//C5cuXJJEiRIgBISEhIGctk22srsoUSqASEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEzBISEhISEhJyaaYJmmmCQmaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabgD8LwhWUngYhPn/p+f/n/yeLi5cuSSPaBH7S8AG2iD+DNCgFLKDQllzBF3Q1tDX+/3+/3+9Lzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz3AAQYvHImnj/x1/zetXcu5LiSJIkgY5RkmJHjd18fQg7LLLLLLLLLLLLLLLKblllllNyygwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwNwBPk8Tz7e/8f+s+q811mrXLq5JEkkAfY4A4jJwAAAFKHh7bcAAAMRh4e7gAAw4eHrcAAGHHh59xAAw48PPuIADDjw8+4gAMOPDz7wABh4w8+9gAYeMPD3gADDxh4e8AAAPGHh7wcABPJWyyPVlOrKdWS6fn/T2mru9f1/6f588au7v+n/x+vXF3d39v9f9OtXclgWZwD/1WV1EhFCLVGcCBAgQBqBrnIeRykQl3oaTrldas2lXgmUkEygwTKDBMoMEmwYkEhINKDEgkJNy48CRvTGz58PDw8PDw8PD76/BGbbbbbbbb+PjgAEY4AcBGCAHARggBwEYIAcBGCAHARggBwEYIAc=',
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
    // A case whose own page satisfies its criterion is a control, whatever its file
    // name: it asserts only what must NOT be reported.
    const passes = outcome === 'pass';
    cases.push({
      id: `media-${kind === 'broken' ? c.id : 'safe_' + c.id}`,
      mode: passes ? 'safe' : 'tp',
      path: `media/${file}`,
      surface: 'media', journey: 'media-player', ui_state: 'default',
      method: ['static-source', 'media-analysis', kind === 'broken' && c.outcome === 'cannot-tell' ? 'guided-manual' : 'runtime-dom'],
      input_at: ['keyboard', 'pointer'],
      // broken cases whose outcome is cannot-tell must NOT be scored as recall misses:
      // the engine cannot be expected to decide them
      min_criteria: kind === 'broken' && c.outcome === 'fail' ? Object.fromEntries(c.sc.map((s) => [s, 1])) : {},
      must_not_report: passes ? c.sc : [],
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
    pass: CASES.filter((c) => c.outcome === 'pass').length,
  },
  cases,
}, null, 2) + '\n');

console.log(`${CASES.length} pairs → ${cases.length} cases`);
console.log(`  machine-decidable fail: ${CASES.filter((c) => c.outcome === 'fail').length}`);
console.log(`  cannot-tell (needs a person): ${CASES.filter((c) => c.outcome === 'cannot-tell').length}`);
