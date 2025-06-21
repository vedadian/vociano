import { useCallback, useEffect, useRef, useState } from "react";

const [yinWorkletProcessorModuleReady, createYinWorkletProcessor] = (() => {
  const yinWorkletProcessor = function () {
    class YinProcessor extends AudioWorkletProcessor {
      private threshold: number;
      private sampleRate: number;
      private buffer: Float32Array[][];
      private bufferPosition: number;
      private bufferSize: number;
      constructor(
        options?: Omit<AudioWorkletNodeOptions, "processorOptions"> & {
          processorOptions?: { threshold: number; sampleRate: number };
        }
      ) {
        super();
        this.threshold = options?.processorOptions?.threshold || 0.2;
        this.sampleRate = options?.processorOptions?.sampleRate || 44100;
        this.bufferSize = this.sampleRate / 10;
        this.buffer = new Array(options?.numberOfInputs || 1)
          .fill(null)
          .map(() =>
            new Array(options?.channelCount || 1)
              .fill(null)
              .map(() => new Float32Array(this.bufferSize))
          );
        this.bufferPosition = 0;
      }

      parabolicInterpolation(buffer: Float32Array, tau: number): number {
        const x0 = tau < 1 ? tau : tau - 1;
        const x2 = tau + 1 < buffer.length ? tau + 1 : tau;
        const s0 = buffer[x0];
        const s1 = buffer[tau];
        const s2 = buffer[x2];
        const a = (s0 + s2 - 2 * s1) / 2;
        const b = (s2 - s0) / 2;
        return tau - b / (2 * a);
      }

      ma(buffer: Float32Array, n: number) {
        let sum = 0;
        for (let i = 0; i < n; ++i) sum += buffer[i];
        for (let i = 0; i <= n; ++i) {
          sum += buffer[i + n];
          buffer[i] = sum / (i + n);
        }
        for (let i = n + 1; i < buffer.length - n - 1; ++i) {
          sum += buffer[i + n] - buffer[i - n - 1];
          buffer[i] = sum / (2 * n + 1);
        }
        for (let i = buffer.length - n - 1; i < buffer.length; ++i) {
          sum -= buffer[i - n - 1];
          buffer[buffer.length - i] = sum / (n - 1 - i + buffer.length);
        }
      }

      yin(buffer: Float32Array, threshold: number, sampleRate: number) {
        const tauMin = Math.max(2, Math.floor(sampleRate / 20000));
        const tauMax = Math.min(
          Math.floor(buffer.length / 2),
          Math.ceil(sampleRate / 10)
        );
        const yinBuffer = new Float32Array(tauMax);

        for (let tau = tauMin; tau < tauMax; tau++) {
          let sum = 0;
          for (let i = 0; i < tauMax - tau; i++) {
            const delta = buffer[i] - buffer[i + tau];
            sum += delta * delta;
          }
          yinBuffer[tau] = sum;
        }

        let runningSum = 0;
        for (let tau = tauMin; tau < tauMax; tau++) {
          runningSum += yinBuffer[tau];
          yinBuffer[tau] *= tau / (runningSum + 1e-5);
        }
        for (let tau = 0; tau < tauMin; tau++)
          yinBuffer[tau] = yinBuffer[tauMin];

        for (let tau = tauMin; tau < tauMax; tau++) {
          if (yinBuffer[tau] < threshold) {
            while (tau + 1 < tauMax && yinBuffer[tau + 1] < yinBuffer[tau]) {
              tau++;
            }
            return sampleRate / this.parabolicInterpolation(yinBuffer, tau);
          }
        }

        console.warn({
          minYinBuffer: Math.min(...yinBuffer.slice(tauMin, tauMax)),
          threshold,
        });
        return null;
      }

      processInputChannel(input: Float32Array) {
        const amplitude =
          input.reduce((sum, x) => sum + x * x, 0) / input.length;
        if (amplitude < 0.001) return null;
        this.ma(input, 2);
        return this.yin(input, this.threshold, this.sampleRate);
      }

      consumableElementCount(inputs: Float32Array[][]) {
        if (
          inputs.length === 0 ||
          inputs[0].length === 0 ||
          inputs[0][0].length === 0
        )
          return 0;
        return Math.min(
          inputs[0][0].length,
          this.bufferSize - this.bufferPosition
        );
      }

      consumeInputs(inputs: Float32Array[][], begin: number, end: number) {
        inputs.forEach((input, inputIndex) => {
          input.forEach((channel, channelIndex) => {
            this.buffer[inputIndex][channelIndex].set(
              channel.subarray(begin, end),
              this.bufferPosition
            );
          });
        });
        this.bufferPosition += end - begin;
      }

      process(inputs: Float32Array[][]) {
        const n = this.consumableElementCount(inputs);
        if (n === 0) return true;
        this.consumeInputs(inputs, 0, n);
        if (this.bufferPosition === this.bufferSize) {
          const pitch = this.buffer.map((channels) =>
            channels.map((channel) => this.processInputChannel(channel))
          );
          this.port.postMessage(pitch);
          this.bufferPosition = 0;
          let begin = n;
          while (begin + this.bufferSize < inputs[0][0].length) {
            this.consumeInputs(inputs, begin, begin + this.bufferSize);
            const pitch = this.buffer.map((channels) =>
              channels.map((channel) => this.processInputChannel(channel))
            );
            this.port.postMessage(pitch);
            this.bufferPosition = 0;
            begin += this.bufferSize;
          }
          if (begin < inputs[0][0].length)
            this.consumeInputs(inputs, begin, inputs[0][0].length);
        }
        return true;
      }
    }

    registerProcessor("yin-processor", YinProcessor);
  };

  const sourceCode = (() => {
    const wholeFunction = yinWorkletProcessor.toString();
    return wholeFunction
      .substring("function() {".length, wholeFunction.length - 1)
      .replace(/^[\s\r\n]+|[\s\r\n]+$/g, "");
  })();

  const blob = new Blob([sourceCode], { type: "application/javascript" });
  const blobURL = URL.createObjectURL(blob);

  let yinWorkletProcessorModuleReady__ = false;
  const audioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)();
  audioContext.audioWorklet.addModule(blobURL).then(() => {
    yinWorkletProcessorModuleReady__ = true;
  });

  function yinWorkletProcessorModuleReady() {
    return yinWorkletProcessorModuleReady__;
  }

  function createYinWorkletProcessor(
    stream: MediaStream,
    onPitchDetected: (pitch: (number | null)[][]) => void
  ) {
    const yinNode = new AudioWorkletNode(audioContext, "yin-processor", {
      channelCountMode: "explicit",
      numberOfInputs: 1,
      channelCount: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: {
        threshold: 0.2,
        sampleRate: audioContext.sampleRate,
      },
    });

    yinNode.port.onmessage = (event: MessageEvent<(number | null)[][]>) => {
      onPitchDetected(event.data);
    };

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(yinNode).connect(audioContext.destination);
    audioContext.resume();

    return () => {
      audioContext.suspend();
      source.disconnect();
      yinNode.disconnect();
      console.warn("CLEAN UP");
    };
  }

  return [yinWorkletProcessorModuleReady, createYinWorkletProcessor];
})();

const octave4PianoKlavier = [
  { note: "C", type: "tone", start: 0, frequency: 261.63 },
  { note: "C#/Db", type: "semi_tone", start: 0.5, frequency: 277.18 },
  { note: "D", type: "tone", start: 1, frequency: 293.66 },
  { note: "D#/Eb", type: "semi_tone", start: 1.5, frequency: 311.13 },
  { note: "E", type: "tone", start: 2, frequency: 329.63 },
  { note: "F", type: "tone", start: 3, frequency: 349.23 },
  { note: "F#/Gb", type: "semi_tone", start: 3.5, frequency: 369.99 },
  { note: "G", type: "tone", start: 4, frequency: 392.0 },
  { note: "G#/Ab", type: "semi_tone", start: 4.5, frequency: 415.3 },
  { note: "A", type: "tone", start: 5, frequency: 440.0 },
  { note: "A#/Bb", type: "semi_tone", start: 5.5, frequency: 466.16 },
  { note: "B", type: "tone", start: 6, frequency: 493.88 },
] as const;

function getFrequency(octave: number, noteIndex: number) {
  const note = octave4PianoKlavier[noteIndex % octave4PianoKlavier.length];
  return note.frequency * Math.pow(2, octave - 4);
}

function getOctaveAndNoteIndexAndError(pitch: number) {
  let octaveDelta = 0;
  let scaledPitch = pitch;
  while (
    scaledPitch > octave4PianoKlavier[octave4PianoKlavier.length - 1].frequency
  ) {
    scaledPitch /= 2;
    octaveDelta++;
  }
  while (scaledPitch < octave4PianoKlavier[0].frequency) {
    scaledPitch *= 2;
    octaveDelta--;
  }
  let noteIndex = 0;
  let error = 1200 * Math.log2(scaledPitch / octave4PianoKlavier[0].frequency);
  for (let i = 1; i < octave4PianoKlavier.length; i++) {
    const noteError =
      1200 * Math.log2(scaledPitch / octave4PianoKlavier[i].frequency);
    if (Math.abs(noteError) < Math.abs(error)) {
      noteIndex = i;
      error = noteError;
    }
  }
  return [4 + octaveDelta, noteIndex, error];
}

const getUserMediaSupported = Boolean(navigator.mediaDevices?.getUserMedia);

const pitchGraphStartX = 250;
const pitchSampleWidth = 3;

function drawPiano(c: CanvasRenderingContext2D, pitchSequence: number[]) {
  c.font = "18px sans-serif";
  c.textAlign = "end";
  c.lineWidth = 2;
  c.fillStyle = "white";
  c.fillRect(0, 0, c.canvas.width, c.canvas.height);
  let baseY = c.canvas.height;
  for (let octaveDelta = -1; octaveDelta < 3; octaveDelta++) {
    for (const klavier of octave4PianoKlavier) {
      if (klavier.type !== "tone") continue;
      const y = baseY - 48 - klavier.start * 48;
      c.strokeStyle = "gray";
      c.beginPath();
      c.moveTo(0, y + 24);
      c.lineTo(c.canvas.width, y + 24);
      c.stroke();
      c.beginPath();
      c.fillStyle = "white";
      c.strokeStyle = "black";
      c.fillRect(0, y, 240, 48);
      c.strokeRect(0, y, 240, 48);
      c.fillStyle = "black";
      c.fillText(`${klavier.note}#${4 + octaveDelta}`, 235, y + 32);
    }
    for (const klavier of octave4PianoKlavier) {
      if (klavier.type === "tone") continue;
      const y = baseY - 48 - klavier.start * 48;
      c.strokeStyle = "gray";
      c.beginPath();
      c.moveTo(0, y + 24);
      c.lineTo(c.canvas.width, y + 24);
      c.stroke();
      c.beginPath();
      c.fillStyle = "black";
      c.strokeStyle = "white";
      c.fillRect(0, y, 200, 48);
      c.strokeRect(0, y, 200, 48);
      c.fillStyle = "white";
      c.fillText(
        `${klavier.note.split("/").at(-1)}#${4 + octaveDelta}`,
        195,
        y + 32
      );
    }
    baseY -= 7 * 48;
  }
  c.strokeStyle = "violet";
  c.lineWidth = 5;
  c.beginPath();
  let prevPoint: [number, number] | null = null;
  pitchSequence.forEach((p, i) => {
    if (Number.isNaN(p)) {
      prevPoint = null;
      return;
    }
    const [o, n, e] = getOctaveAndNoteIndexAndError(p);
    console.info({
      pitch: p,
      octave: o,
      note: octave4PianoKlavier[n].frequency,
      error: e,
    });
    const x = pitchGraphStartX + pitchSampleWidth * i;
    const y =
      c.canvas.height -
      48 -
      (o - 3) * 7 * 48 -
      octave4PianoKlavier[n].start * 48 -
      (48 * e) / 100;
    if (prevPoint === null) {
      c.moveTo(x, y);
    } else {
      const [px, py] = prevPoint;
      const [[cp1x, cp1y], [cp2x, cp2y]] = [0.2, 0.8].map((a) => [
        (1 - a) * x + a * px,
        (1 - a) * py + a * y,
      ]);
      c.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
    }
    prevPoint = [x, y];
  });
  c.stroke();
}

type PianoCanvasProps = Omit<
  React.DetailedHTMLProps<
    React.CanvasHTMLAttributes<HTMLCanvasElement>,
    HTMLCanvasElement
  >,
  "ref"
> & {
  pitchSequence: number[];
};

function PianoCanvas({ pitchSequence, ...rest }: PianoCanvasProps) {
  const contextRef = useRef<CanvasRenderingContext2D>(null);
  const bufferContextRef = useRef<CanvasRenderingContext2D>(null);
  useEffect(() => {
    if (!contextRef.current || !bufferContextRef.current) return;
    const c = contextRef.current;
    const b = bufferContextRef.current;
    drawPiano(
      b,
      pitchSequence.slice(
        -(b.canvas.width - pitchGraphStartX) / pitchSampleWidth
      )
    );
    requestAnimationFrame(() => {
      c.drawImage(b.canvas, 0, 0);
    });
  }, [pitchSequence]);

  const updateContextRefs = useCallback((c: HTMLCanvasElement | null) => {
    if (!c) return;
    const b = document.createElement("canvas").getContext("2d");
    if (!b) return;
    console.warn("MOUNT");
    b.canvas.width = c.offsetWidth;
    b.canvas.height = c.offsetHeight;
    c.width = c.offsetWidth;
    c.height = c.offsetHeight;
    contextRef.current = c.getContext("2d");
    bufferContextRef.current = b;
    return () => {
      console.warn("UNMOUNT");
      contextRef.current = null;
    };
  }, []);

  return <canvas {...rest} ref={updateContextRefs} />;
}

export function Main() {
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [pitchSequence, setPitchSequence] = useState<number[]>([]);

  useEffect(() => {
    if (mediaStream !== null || !getUserMediaSupported) return;
    const setupMediaStream = () => {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => setMediaStream(stream));
    };
    if (!yinWorkletProcessorModuleReady()) setTimeout(setupMediaStream, 1000);
    else setupMediaStream();
  }, [mediaStream]);

  useEffect(() => {
    if (mediaStream === null) return;
    return createYinWorkletProcessor(mediaStream, (allPitchs) => {
      const pitch = allPitchs.flatMap((p) => p).find((p) => p !== null);
      if (pitch) {
        setPitchSequence((ps) => [...ps.slice(-2048), pitch]);
      } else {
        setPitchSequence((ps) =>
          Number.isNaN(ps[ps.length - 1]) ? ps : [...ps.slice(1), Number.NaN]
        );
      }
    });
  }, [mediaStream]);

  return (
    <div className="w-full h-full overflow-scroll">
      <PianoCanvas className="w-full h-full" pitchSequence={pitchSequence} />
    </div>
  );
}
