import * as classes from "./app.module.css";
import { useSignal, useSignalLens } from "../hooks/use-signal";
import InputSheetList, { InputSheets, RenderTree } from "./render-order";
import Animator from "./animator";
import { endCapture, recordingSignal } from "../lib/capture";

export default function App() {
  const renderOrderSignal = useSignal<RenderTree>({
    rootOrder: [],
    nodes: {},
  });
  const sheetsSignal = useSignal<InputSheets>({});
  const structureVersionSignal = useSignal(0);
  const recording = useSignalLens(recordingSignal, (state) => state != "off");

  return (
    <>
      <div className={classes.toolbar}>
        <button commandfor="about-dialog" command="show-popover">
          About
        </button>
        <button
          onClick={() => {
            if (recording) {
              endCapture();
            } else {
              recordingSignal.set("start");
            }
          }}
        >
          {recording ? "Rec..." : "Record"}
        </button>
      </div>

      <div className={classes.main}>
        <InputSheetList
          sheetsSignal={sheetsSignal}
          renderTreeSignal={renderOrderSignal}
          structureVersionSignal={structureVersionSignal}
          recording={recording}
        />

        <Animator
          sheetsSignal={sheetsSignal}
          renderTreeSignal={renderOrderSignal}
          structureVersionSignal={structureVersionSignal}
          recording={recording}
        />
      </div>
    </>
  );
}
