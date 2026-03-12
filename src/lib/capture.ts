// adapted from: https://varunbarad.com/blog/record-canvas-video

import { Signal } from "../hooks/use-signal";

type RecordingState = "start" | "recording" | "off";
export const recordingSignal = new Signal<RecordingState>("off");

let recordedChunks: Blob[] = [];
let mediaRecorder: MediaRecorder | undefined;

export function beginCapture(canvas: HTMLCanvasElement) {
  switch (recordingSignal.get()) {
    case "off":
      return;
    case "start":
      recordingSignal.set("recording");
      break;
    case "recording":
      alert("Recording interrupted");
      recordingSignal.set("off");
      mediaRecorder?.stop();
      mediaRecorder = undefined;
      return;
    default:
      console.error(`Unknown recording state: "${recordingSignal.get()}"`);
      recordingSignal.set("off");
      return;
  }

  try {
    const stream = canvas.captureStream(60);

    mediaRecorder = new MediaRecorder(stream, {
      mimeType: "video/webm",
      audioBitsPerSecond: 0,
    });
    recordedChunks = [];

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    });

    mediaRecorder.addEventListener("stop", () => {
      if (recordingSignal.get() == "recording") {
        recordingSignal.set("off");
        downloadRecording();
      }
      mediaRecorder = undefined;
    });

    mediaRecorder.start();
  } catch (err) {
    console.error(err);
    alert(`Recording failed: ${err}`);
  }
}

export function endCapture() {
  mediaRecorder?.stop();
  mediaRecorder = undefined;
}

function downloadRecording() {
  if (recordedChunks.length === 0) {
    alert("No recording data available!");
    return;
  }

  const blob = new Blob(recordedChunks, { type: "video/webm" });
  recordedChunks = [];

  const url = URL.createObjectURL(blob);
  const tab = window.open(url, "_blank");

  if (tab) {
    tab.focus();
    tab.addEventListener("close", () => {
      URL.revokeObjectURL(url);
    });
  } else {
    URL.revokeObjectURL(url);
  }
}
