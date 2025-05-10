import { useEffect, useState } from "react";

const [yinWorkletProcessorModuleReady, createYinWorkletProcessor] = (() => {
  const yinWorkletProcessor = function () {
    class YinProcessor extends AudioWorkletProcessor {
      private threshold: number;
      private sampleRate: number;
      constructor(options?: { threshold: number; sampleRate: number }) {
        super();
        this.threshold = options?.threshold || 0.1;
        this.sampleRate = options?.sampleRate || 44100;
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
            return this.parabolicInterpolation(yinBuffer, tau);
          }
        }

        return null;
      }

      process(inputs: Float32Array[][]) {
        const input = inputs[0][0];
        if (!input) return true;
        const pitch = this.yin(input, this.sampleRate, this.threshold);
        this.port.postMessage(pitch);
        return true;
      }
    }

    registerProcessor("yin-processor", YinProcessor);
  };

  const sourceCode = yinWorkletProcessor.toString();
  console.warn({ sourceCode });

  const blob = new Blob(
    [sourceCode.substring("function() {".length, sourceCode.length - 1)],
    { type: "application/javascript" }
  );
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
    onPitchDetected: (pitch: number | null) => void
  ) {
    const yinNode = new AudioWorkletNode(audioContext, "yin-processor", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });

    yinNode.port.onmessage = (event: MessageEvent<number | null>) => {
      onPitchDetected(event.data);
    };

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(yinNode).connect(audioContext.destination);

    return () => {
      source.disconnect();
      yinNode.disconnect();
    };
  }

  return [yinWorkletProcessorModuleReady, createYinWorkletProcessor];
})();

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
    return createYinWorkletProcessor(mediaStream, (pitch) => {
      if (pitch) {
        console.warn({ pitch });
        // Find the nearest note
        let nearestIndex = 0;
        let minError = Math.abs(pitch - notesWithColors[4].frequency);
        for (let index = 1; index < 17; index++) {
          const i = index + 4;
          const note = notesWithColors[i % notesWithColors.length];
          const o = Math.floor(i / notesWithColors.length);
          const freq = note.frequency * Math.pow(2, o - 4);
          const error = 1200 * Math.log2(pitch / freq);
          if (error < minError) {
            minError = error;
            nearestIndex = index;
          }
        }
        setCurrentNote({ index: nearestIndex, error: minError });
        console.warn({ index: nearestIndex, error: minError });
      } else setCurrentNote({});
    });
  }, [mediaStream]);

  return (
    <>
      <div className="w-full h-full overflow-scroll">
        {new Array(17).fill(null).map((_, index) => {
          const i = index + 4;
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
                {3 + Math.floor(i / notesWithColors.length)}
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
