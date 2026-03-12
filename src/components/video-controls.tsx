import * as classes from "./video-controls.module.css";
import { Signal, useSignalValue } from "../hooks/use-signal";
import PlayIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import ReplayIcon from "@mui/icons-material/Replay";
import PrevFrameIcon from "@mui/icons-material/SkipPrevious";
import NextFrameIcon from "@mui/icons-material/SkipNext";

function PlaybackButton({
  pauseSignal,
  recording,
}: {
  pauseSignal: Signal<boolean>;
  recording: boolean;
}) {
  const paused = useSignalValue(pauseSignal);

  return (
    <button
      className="icon-button"
      title={paused ? "Play" : "Pause"}
      disabled={recording}
      onClick={() => pauseSignal.set(!paused)}
    >
      {paused ? <PlayIcon /> : <PauseIcon />}
    </button>
  );
}

function FrameCounter({ timeSignal }: { timeSignal: Signal<number> }) {
  const frameTime = useSignalValue(timeSignal);

  return frameTime;
}

export default function VideoControls({
  pauseSignal,
  timeSignal,
  recording,
  loopDuration,
}: {
  pauseSignal: Signal<boolean>;
  timeSignal: Signal<number>;
  recording: boolean;
  loopDuration: number;
}) {
  return (
    <div className={classes.root}>
      <div>
        <button
          className="icon-button"
          disabled={recording}
          onClick={() => timeSignal.set(0)}
        >
          <ReplayIcon />
        </button>

        <PlaybackButton pauseSignal={pauseSignal} recording={recording} />

        <button
          className="icon-button"
          disabled={recording}
          onClick={() => {
            timeSignal.set(Math.max(timeSignal.get() - 1, 0));
            pauseSignal.set(true);
          }}
        >
          <PrevFrameIcon />
        </button>

        <button
          className="icon-button"
          disabled={recording}
          onClick={() => {
            timeSignal.set(timeSignal.get() + 1);
            pauseSignal.set(true);
          }}
        >
          <NextFrameIcon />
        </button>
      </div>

      <div>
        <FrameCounter timeSignal={timeSignal} /> / {loopDuration}
      </div>
    </div>
  );
}
