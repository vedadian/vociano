document.addEventListener("DOMContentLoaded", () => {

  const TONE_FREQUENCIES = [
    // Octave 0
    16.35, 17.32, 18.35, 19.45, 20.60, 21.83, 23.12, 24.50, 25.96, 27.50, 29.14, 30.87,
    // Octave 1
    32.70, 34.65, 36.71, 38.89, 41.20, 43.65, 46.25, 49, 51.91, 55, 58.27, 61.74,
    // Octave 2
    65.41, 69.30, 73.42, 77.78, 82.41, 87.31, 92.50, 98, 103.83, 110, 116.54, 123.47,
    // Octave 3
    130.81, 138.59, 146.83, 155.56, 164.81, 174.61, 185, 196, 207.65, 220, 233.08, 246.94,
    // Octave 4
    261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392, 415.30, 440, 466.16, 493.88,
    // Octave 5
    523.25, 554.37, 587.33, 622.25, 659.25, 698.46, 739.99, 783.99, 830.61, 880, 932.33, 987.77,
    // Octave 6
    1046.50, 1108.73, 1174.66, 1244.51, 1318.51, 1396.91, 1479.98, 1567.98, 1661.22, 1760, 1864.66, 1975.53,
    // Octave 7
    2093.00, 2217.46, 2349.32, 2489.02, 2637.02, 2793.83, 2959.96, 3135.96, 3322.44, 3520, 3729.31, 3951.07,
    // Octave 8
    4186.01, 4434.92, 4698.63, 4978.03, 5274.04, 5587.65, 5919.91, 6271.93, 6644.88, 7040, 7458.62, 7902.13,
  ];

  const KEY_TITLES = [
    "Do", "Do#", "Re", "Re#", "Mi",
    "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"
  ];

  const klavier = document.querySelector("div.klavier");
  const transcript = document.querySelector("div.transcript");

  const createElement = (tagName, textContent, classList, styles) => {
    let node = document.createElement(tagName);
    node.classList.add(...classList);
    Object.entries(styles).forEach(([key, value]) => node.style[key] = value);
    node.textContent = textContent;
    return node;
  }

  const buildKlavier = () => {

    for (let octave = 5; octave > 2; --octave) {
      for (let keyIndex = KEY_TITLES.length - 1; keyIndex >= 0; --keyIndex) {
        const key = document.createElement("div");
        const isSharp = KEY_TITLES[keyIndex].endsWith("#");
        if (isSharp) {
          key.classList.add("sharpKey");
        } else {
          key.classList.add("key");

          const lightness = 0.65 + 0.15 * (octave - 3);
          const hue = Math.floor(360 / 12 * keyIndex);
          key.style.backgroundColor = `hsl(${hue}deg, 30%, ${100 * lightness}%)`;
        }
        key.textContent = KEY_TITLES[keyIndex];
        klavier.appendChild(key);
        if (keyIndex === 0 || keyIndex === 5) {
          const nilKey = createElement("div", "", ["sharpKey", "nil"], {});
          klavier.appendChild(nilKey);
        }
      }
    }
  };

  const buildTranscript = () => {
    for (let octave = 5; octave > 2; --octave) {
      for (let keyIndex = KEY_TITLES.length - 1; keyIndex >= 0; --keyIndex) {
        transcript.appendChild(createElement("div", "", ["transcriptLine"], {}));
        if(keyIndex === 0 || keyIndex === 5)
          transcript.appendChild(createElement("div", "", ["transcriptLine", "nil"], {}));
      }
    }
  };
  
  buildKlavier();
  buildTranscript();

  // if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
  //   return;
  
  // navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
  //   const mediaRecorder = new MediaRecorder(stream);
  //   mediaRecorder.addEventListener("dataavailable", e => {
  //     console.log(e.data);
  //   });
  //   mediaRecorder.start(40);
  // });

  const transcriptLines = Array.from(transcript.querySelectorAll("div.transcriptLine"));
  const firstTranscriptLineIndex = 6 * 12 - 1;
  console.log(TONE_FREQUENCIES[firstTranscriptLineIndex]);
  for (let t = 0; t < 50; ++t) {
    const f = Math.random() * (1000 - 150) + 150;
    let j = 0;
    let d = Math.log2(TONE_FREQUENCIES[firstTranscriptLineIndex] / f);
    for (let i = 0; i < transcriptLines.length; ++i) {
      const dd = Math.log2(TONE_FREQUENCIES[firstTranscriptLineIndex - i] / f);
      if (Math.abs(d) > Math.abs(dd)) {
        j = i;
        d = dd;
      }
    }
    const alpha = Math.max(0, Math.min(1200 * Math.abs(d), 100)) / 100;
    const note = document.createElement("div");
    note.classList.add("transcriptNote");
    note.style.left = `${t * 1}rem`;
    note.style.borderRadius = `50%`;
    note.style.backgroundColor = `rgb(${alpha * 255}, ${(1 - alpha) * 128}, 0)`;
    transcriptLines[j].appendChild(note);
  }

});