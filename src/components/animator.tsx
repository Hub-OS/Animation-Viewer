import { useEffect, useMemo, useRef } from "react";
import { Signal, useSignal, useSignalValue } from "../hooks/use-signal";
import * as classes from "./animator.module.css";
import { InputSheets, RenderTree } from "./render-order";
import VideoControls from "./video-controls";
import Spacer from "./spacer";
import createRenderer, { calculateLoopDuration } from "../lib/renderer";
import { beginCapture, endCapture, recordingSignal } from "../lib/capture";
import ResetIcon from "@mui/icons-material/Replay";

const MIN_RESOLUTION = 1;
const MAX_RESOLUTION = 4096;
const MIN_SCALE = 1;
const MAX_SCALE = 8;
const DEFAULT_ORIGIN_X = "0.5";
const DEFAULT_ORIGIN_Y = "0.8";

function parseRangeValue(stringValue: string, min: number, max?: number) {
  const value = parseFloat(stringValue);

  if (Number.isNaN(value)) {
    return min;
  } else {
    max = max ?? Infinity;
    return Math.max(Math.min(value, max), min);
  }
}

export default function Animator({
  sheetsSignal,
  renderTreeSignal,
  recording,
}: {
  sheetsSignal: Signal<InputSheets>;
  renderTreeSignal: Signal<RenderTree>;
  recording: boolean;
}) {
  const sheets = useSignalValue(sheetsSignal);
  const renderTree = useSignalValue(renderTreeSignal);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const resolutionXSignal = useSignal("240");
  const resolutionYSignal = useSignal("160");
  const pauseSignal = useSignal(false);
  const timeSignal = useSignal(0);
  const scaleSignal = useSignal("2");
  const originXSignal = useSignal(DEFAULT_ORIGIN_X);
  const originYSignal = useSignal(DEFAULT_ORIGIN_Y);
  const backgroundColorSignal = useSignal("rgb(0,0,0)");

  const resXString = useSignalValue(resolutionXSignal);
  const resYString = useSignalValue(resolutionYSignal);
  const scaleString = useSignalValue(scaleSignal);
  const originXString = useSignalValue(originXSignal);
  const originYString = useSignalValue(originYSignal);
  const loopDuration = useMemo(
    () => calculateLoopDuration(renderTree),
    [renderTree],
  );

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const baseRender = createRenderer(canvas, renderTree);

    const render = (frameTime: number) => {
      const originX = parseRangeValue(originXSignal.get(), 0, 1);
      const originY = parseRangeValue(originYSignal.get(), 0, 1);

      // update canvas size
      const resolutionX = Math.floor(
        parseRangeValue(resolutionXSignal.get(), MIN_RESOLUTION),
      );
      const resolutionY = Math.floor(
        parseRangeValue(resolutionYSignal.get(), MIN_RESOLUTION),
      );

      const scale = parseRangeValue(scaleSignal.get(), MIN_SCALE, MAX_SCALE);

      canvas.width = resolutionX * scale;
      canvas.height = resolutionY * scale;

      // update bg
      ctx.fillStyle = backgroundColorSignal.get();
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      baseRender(frameTime, originX, originY, scale);
    };

    if (recording && loopDuration == 0) {
      // cancel recordings if there's nothing to record
      alert("Load an animation first!");
      recordingSignal.set("off");
    }

    timeSignal.set(0);

    let valid = true;
    let prevTime: DOMHighResTimeStamp = 0;
    let pendingTime: DOMHighResTimeStamp = 0;

    beginCapture(canvas);

    function animationLoop(timestamp: DOMHighResTimeStamp) {
      if (!valid) {
        return;
      }

      let frameTime = timeSignal.get();

      // check if we're still recording
      const recording = recordingSignal.get() == "recording";

      // override pause signal if we're recording
      if (prevTime != 0 && (!pauseSignal.get() || recording)) {
        // update frame time if 1/60s passed
        pendingTime += timestamp - prevTime;

        const conversion = 1000 / 60;
        const frameIncrease = Math.floor(pendingTime / conversion);
        pendingTime -= frameIncrease * conversion;

        frameTime += frameIncrease;
        timeSignal.set(frameTime);
      }

      prevTime = timestamp;

      render(frameTime);

      if (frameTime > loopDuration) {
        endCapture();
      }

      requestAnimationFrame(animationLoop);
    }

    requestAnimationFrame(animationLoop);

    return () => {
      valid = false;
    };
  }, [sheets, renderTree, resXString, resYString, recording]);

  return (
    <div className={classes.root}>
      <div
        className={classes.canvasContainer}
        style={recording ? { borderColor: "red" } : undefined}
      >
        <canvas ref={canvasRef} />
      </div>

      <div className={classes.row}>
        <div className={classes.sceneControls}>
          <div>
            <span>Resolution:</span>
            <input
              type="number"
              min={MIN_RESOLUTION}
              max={MAX_RESOLUTION}
              disabled={recording}
              value={resXString}
              onChange={(e) => resolutionXSignal.set(e.target.value)}
            />
            x
            <input
              type="number"
              min={MIN_RESOLUTION}
              max={MAX_RESOLUTION}
              disabled={recording}
              value={resYString}
              onChange={(e) => resolutionYSignal.set(e.target.value)}
            />
          </div>

          <div>
            <span>Detail Scale:</span>
            <input
              type="number"
              min={MIN_SCALE}
              max={MAX_SCALE}
              disabled={recording}
              value={scaleString}
              onChange={(e) => scaleSignal.set(e.target.value)}
            />
          </div>

          <div>
            <span>Origin X:</span>
            <input
              type="range"
              min={0}
              max={1}
              step="any"
              disabled={recording}
              value={originXString}
              onChange={(e) => originXSignal.set(e.target.value)}
            />
            <button
              className="icon-button"
              disabled={recording}
              onClick={() => originXSignal.set(DEFAULT_ORIGIN_X)}
            >
              <ResetIcon />
            </button>
          </div>

          <div>
            <span>Origin Y:</span>
            <input
              type="range"
              min={0}
              max={1}
              step="any"
              disabled={recording}
              value={originYString}
              onChange={(e) => originYSignal.set(e.target.value)}
            />
            <button
              className="icon-button"
              disabled={recording}
              onClick={() => originYSignal.set(DEFAULT_ORIGIN_Y)}
            >
              <ResetIcon />
            </button>
          </div>

          <div>
            <span>Background:</span>
            <input
              type="color"
              defaultValue="rgb(0,0,0)"
              onChange={(e) => backgroundColorSignal.set(e.target.value)}
            />
          </div>
        </div>

        <Spacer />

        <VideoControls
          pauseSignal={pauseSignal}
          timeSignal={timeSignal}
          recording={recording}
          loopDuration={loopDuration}
        />
      </div>
    </div>
  );
}
