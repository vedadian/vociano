import { useEffect, useState } from "react";

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
        this.threshold = options?.processorOptions?.threshold || 0.1;
        this.sampleRate = options?.processorOptions?.sampleRate || 44100;
        this.bufferSize = this.sampleRate / 20;
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

      yin(buffer: Float32Array, threshold: number, sampleRate: number) {
        const tauMax = buffer.length >> 1;
        const yinBuffer = new Float32Array(tauMax);
        let minTau = 2;

        for (let tau = minTau; tau < tauMax; tau++) {
          let sum = 0;
          for (let i = 0; i < tauMax; i++) {
            const delta = buffer[i] - buffer[i + tau];
            sum += delta * delta;
          }
          yinBuffer[tau] = sum;
        }

        let runningSum = 0;
        for (let tau = minTau; tau < tauMax; tau++) {
          runningSum += yinBuffer[tau];
          yinBuffer[tau] *= tau / runningSum;
        }

        for (let tau = minTau; tau < tauMax; tau++) {
          if (yinBuffer[tau] < threshold) {
            while (tau + 1 < tauMax && yinBuffer[tau + 1] < yinBuffer[tau]) {
              tau++;
            }
            return sampleRate / this.parabolicInterpolation(yinBuffer, tau);
          }
        }

        return null;
      }

      processInputChannel(input: Float32Array) {
        const amplitude =
          input.reduce((sum, x) => sum + x * x, 0) / input.length;
        if (amplitude < 0.001) return null;
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
        threshold: 0.1,
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

const startingOctave = 3;
const startingNote = 4;

const notesWithColors = [
  { note: "Do", color: "#f8b4b4", frequency: 261.63 }, // C4
  { note: "Re", color: "#fcd9b6", frequency: 293.66 }, // D4
  { note: "Mi", color: "#f9fcb6", frequency: 329.63 }, // E4
  { note: "Fa", color: "#b6fcd9", frequency: 349.23 }, // F4
  { note: "Sol", color: "#b6e0fc", frequency: 392.0 }, // G4
  { note: "La", color: "#cab6fc", frequency: 440.0 }, // A4
  { note: "Si", color: "#fcb6e0", frequency: 493.88 }, // B4
];

const getUserMediaSupported = Boolean(navigator.mediaDevices?.getUserMedia);

export function Main() {
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [currentNote, setCurrentNote] = useState<{
    index?: number;
    error?: number;
  }>({});

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
        const getError = (index: number) => {
          const i = index + startingNote;
          const note = notesWithColors[i % notesWithColors.length];
          const octave =
            Math.floor(i / notesWithColors.length) + startingOctave;
          const freq = note.frequency * Math.pow(2, octave - 4);
          return 1200 * Math.log2(pitch / freq);
        };
        let nearestIndex = 0;
        let minError = getError(nearestIndex);
        for (let index = 1; index < 17; index++) {
          const error = getError(index);
          if (Math.abs(error) < Math.abs(minError)) {
            minError = error;
            nearestIndex = index;
          }
        }
        setCurrentNote({ index: nearestIndex, error: minError });
        console.warn({
          pitch,
          nearestIndex,
          note: notesWithColors[nearestIndex % notesWithColors.length].note,
          frequency:
            notesWithColors[nearestIndex % notesWithColors.length].frequency *
            Math.pow(
              2,
              Math.floor(nearestIndex / notesWithColors.length) +
                startingOctave -
                4
            ),
          error: minError,
        });
      } else setCurrentNote({});
    });
  }, [mediaStream]);

  return (
    <>
      <div className="w-full h-full overflow-scroll">
        {new Array(17).fill(null).map((_, index) => {
          const i = index + startingNote;
          return (
            <div
              key={`${i}`}
              className="border-b w-full h-12 flex flex-row items-center pl-3 gap-1"
              style={{
                backgroundColor:
                  notesWithColors[i % notesWithColors.length].color,
              }}
            >
              <span className="inline-flex w-12 justify-end">
                {notesWithColors[i % notesWithColors.length].note} #
                {startingOctave + Math.floor(i / notesWithColors.length)}
              </span>
              {currentNote.index === index && (
                <span className="inline-block w-6 h-6 bg-black">
                  {currentNote.error}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
